/*
 * focco3i-painel/1 · runtime do painel (vai DENTRO do zip).
 *
 * O painel roda num iframe isolado (sandbox, sem acesso ao portal e sem rede).
 * Ele nunca tem SQL nem credencial: pede dado ao host pelo id da consulta
 * declarada no painel.json, e o host executa no servidor com auditoria.
 *
 *   Painel.pronto().then(ctx => ...)          // ctx: { manifesto, tema, usuario, ambiente,
 *                                             //        portal: { cor_primaria, empresa } }
 *   Painel.consultar("mensal", { meses: 12 }) // -> { colunas, linhas, registros, total_linhas,
 *                                             //      truncado, atualizado_em, auditoria_id }
 *   Painel.aoMudarTema(tema => ...)           // "light" | "dark"
 *   Painel.lerDados("metas")                  // -> valor JSON guardado no portal (ou null)
 *   Painel.gravarDados("metas", {...})        // grava (precisa de permissao de alterar o painel)
 *
 * Dados do painel: so as chaves declaradas em "dados" no painel.json. Ficam no portal,
 * por painel (e por empresa, se a chave for "por_empresa"), com auditoria de quem gravou.
 *
 * Altura: o runtime avisa o host da altura do conteudo (ResizeObserver), e o host
 * ajusta o iframe. Assim o painel rola junto com a pagina do portal, sem segunda
 * barra de rolagem.
 */
(function () {
  "use strict";
  var CANAL = "focco3i-painel";
  var proximo = 1;
  var pendentes = {};
  var contexto = null;
  var aguardandoContexto = [];
  var ouvintesTema = [];

  function enviar(msg) {
    msg.canal = CANAL;
    window.parent.postMessage(msg, "*");
  }

  window.addEventListener("message", function (ev) {
    if (ev.source !== window.parent) return;
    var msg = ev.data;
    if (!msg || msg.canal !== CANAL) return;
    if (msg.tipo === "contexto") {
      contexto = msg.contexto;
      document.documentElement.setAttribute("data-theme", contexto.tema || "light");
      var cor = contexto.portal && contexto.portal.cor_primaria;
      if (cor && /^(#[0-9a-fA-F]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\))$/.test(cor)) document.documentElement.style.setProperty("--pf-primaria", cor);
      aguardandoContexto.splice(0).forEach(function (f) { f(contexto); });
    } else if (msg.tipo === "tema") {
      document.documentElement.setAttribute("data-theme", msg.tema);
      if (contexto) contexto.tema = msg.tema;
      ouvintesTema.forEach(function (f) { f(msg.tema); });
    } else if (msg.tipo === "resposta" && pendentes[msg.req]) {
      var p = pendentes[msg.req];
      delete pendentes[msg.req];
      if (msg.ok && p.bruto) {
        p.resolve(msg.dados);
      } else if (msg.ok) {
        var d = msg.dados;
        d.registros = d.linhas.map(function (linha) {
          var o = {};
          d.colunas.forEach(function (c, i) { o[c.toLowerCase()] = linha[i]; });
          return o;
        });
        p.resolve(d);
      } else {
        p.reject(new Error(msg.erro || (p.bruto ? "Falha nos dados do painel." : "Falha ao consultar.")));
      }
    }
  });

  var ultimaAltura = 0;
  function avisarAltura() {
    var altura = Math.ceil(document.documentElement.scrollHeight);
    if (Math.abs(altura - ultimaAltura) < 2) return;
    ultimaAltura = altura;
    enviar({ tipo: "altura", altura: altura });
  }
  if (window.ResizeObserver) {
    new ResizeObserver(avisarAltura).observe(document.documentElement);
  }
  window.addEventListener("load", avisarAltura);

  function pedir(msg, bruto) {
    var req = proximo++;
    return new Promise(function (resolve, reject) {
      pendentes[req] = { resolve: resolve, reject: reject, bruto: bruto };
      msg.req = req;
      enviar(msg);
    });
  }

  window.Painel = {
    pronto: function () {
      if (contexto) return Promise.resolve(contexto);
      return new Promise(function (resolve) { aguardandoContexto.push(resolve); enviar({ tipo: "pronto" }); });
    },
    consultar: function (consulta, parametros) {
      return pedir({ tipo: "consultar", consulta: consulta, parametros: parametros || {} }, false);
    },
    lerDados: function (chave) {
      return pedir({ tipo: "dados-ler", chave: chave }, true);
    },
    gravarDados: function (chave, valor) {
      return pedir({ tipo: "dados-gravar", chave: chave, valor: valor }, true);
    },
    aoMudarTema: function (f) { ouvintesTema.push(f); },
  };
})();
