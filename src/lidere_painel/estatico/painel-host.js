/*
 * focco3i-painel/1 · lado HOST (quem mostra o painel: o servidor de dev local
 * ou o portal). Referencia de implementacao: o portal faz o mesmo em React.
 *
 *   montarHostPainel(iframe, {
 *     contexto: { manifesto, tema, usuario, ambiente },
 *     consultar: async (consulta, parametros) => ({ colunas, linhas, ... }),
 *     entidade: async (entidade, operacao, entrada) => ({...}),  // opcional: modulo com dados
 *     aoConsultar: (registro) => {},  // opcional, para log na tela
 *     aoMudarAltura: (altura) => {}   // opcional: ajusta o iframe a altura do conteudo
 *   })
 *
 * Regras que o host garante:
 * - iframe com sandbox="allow-scripts" (SEM allow-same-origin): o painel nao le
 *   cookie, token nem DOM do portal;
 * - so aceita mensagem vinda DESTE iframe;
 * - o painel so pede consulta por id; o SQL fica no servidor.
 */
function montarHostPainel(iframe, opcoes) {
  "use strict";
  var CANAL = "focco3i-painel";

  function responder(msg) {
    msg.canal = CANAL;
    iframe.contentWindow.postMessage(msg, "*");
  }

  function aoReceber(ev) {
    if (ev.source !== iframe.contentWindow) return;
    var msg = ev.data;
    if (!msg || msg.canal !== CANAL) return;
    if (msg.tipo === "pronto") {
      responder({ tipo: "contexto", contexto: opcoes.contexto });
    } else if (msg.tipo === "altura") {
      var altura = Number(msg.altura);
      if (altura > 0 && altura < 100000 && opcoes.aoMudarAltura) opcoes.aoMudarAltura(altura);
    } else if (msg.tipo === "consultar") {
      var inicio = Date.now();
      Promise.resolve()
        .then(function () { return opcoes.consultar(String(msg.consulta), msg.parametros || {}); })
        .then(function (dados) {
          responder({ tipo: "resposta", req: msg.req, ok: true, dados: dados });
          if (opcoes.aoConsultar) opcoes.aoConsultar({ consulta: msg.consulta, ok: true, ms: Date.now() - inicio, dados: dados });
        })
        .catch(function (erro) {
          responder({ tipo: "resposta", req: msg.req, ok: false, erro: String(erro && erro.message || erro) });
          if (opcoes.aoConsultar) opcoes.aoConsultar({ consulta: msg.consulta, ok: false, ms: Date.now() - inicio, erro: String(erro && erro.message || erro) });
        });
    } else if ((msg.tipo === "dados-ler" || msg.tipo === "dados-gravar") && opcoes.dados) {
      Promise.resolve()
        .then(function () {
          return msg.tipo === "dados-ler" ? opcoes.dados.ler(String(msg.chave)) : opcoes.dados.gravar(String(msg.chave), msg.valor);
        })
        .then(function (valor) { responder({ tipo: "resposta", req: msg.req, ok: true, dados: valor === undefined ? null : valor }); })
        .catch(function (erro) { responder({ tipo: "resposta", req: msg.req, ok: false, erro: String(erro && erro.message || erro) }); });
    } else if (msg.tipo === "entidade" && opcoes.entidade) {
      var inicioEnt = Date.now();
      var rotulo = String(msg.entidade) + "." + String(msg.operacao);
      Promise.resolve()
        .then(function () { return opcoes.entidade(String(msg.entidade), String(msg.operacao), msg.entrada || {}); })
        .then(function (dados) {
          responder({ tipo: "resposta", req: msg.req, ok: true, dados: dados });
          if (opcoes.aoConsultar) opcoes.aoConsultar({ consulta: rotulo, ok: true, ms: Date.now() - inicioEnt, dados: { total_linhas: dados && dados.total !== undefined ? dados.total : 1, auditoria_id: "-" } });
        })
        .catch(function (erro) {
          responder({ tipo: "resposta", req: msg.req, ok: false, erro: String(erro && erro.message || erro) });
          if (opcoes.aoConsultar) opcoes.aoConsultar({ consulta: rotulo, ok: false, ms: Date.now() - inicioEnt, erro: String(erro && erro.message || erro) });
        });
    }
  }

  window.addEventListener("message", aoReceber);
  return {
    tema: function (tema) { opcoes.contexto.tema = tema; responder({ tipo: "tema", tema: tema }); },
    desmontar: function () { window.removeEventListener("message", aoReceber); },
  };
}
