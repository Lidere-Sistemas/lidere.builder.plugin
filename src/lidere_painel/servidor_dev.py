"""Servidor de pre-visualizacao local do painel: o usuario valida na maquina dele.

Faz exatamente o papel que o portal fara depois:

- mostra o painel num iframe sandbox (sem allow-same-origin);
- serve os arquivos do painel com CSP que bloqueia rede externa (connect-src 'none');
- recebe "consultar <id>" e executa o SQL DO MANIFESTO pelo mesmo Executor do MCP
  (guard, conferencia de coluna, transacao read only, auditoria).

Le a pasta do disco a cada requisicao: editou o HTML ou o SQL, e so recarregar.
So escuta em 127.0.0.1 e so atende quem chega como 127.0.0.1/localhost na porta certa (barra
DNS rebinding). As rotas /_api exigem o segredo desta execucao, que so a pagina daqui conhece
(barra CSRF de qualquer site aberto no navegador enquanto o servir roda).
"""

from __future__ import annotations

import html
import json
import secrets
from datetime import datetime
import mimetypes
from pathlib import Path
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response
from starlette.routing import Route
from starlette.types import ASGIApp, Receive, Scope, Send

from lidere_painel.config import Config
from lidere_painel.erros import Focco3iMcpError
from lidere_painel.documento import montar_documento
from lidere_painel.projeto import montar_area
from lidere_painel.pacote import PacoteInvalido, carregar_pasta, converter_parametros
from lidere_painel.portal import PortalCliente, PortalExecutor

NIVEL_CONSULTA = 2

__all__ = ["criar_app", "CSP_PAINEL"]

_ESTATICO = Path(__file__).with_name("estatico")

CSP_PAINEL = (
    "default-src 'self' 'unsafe-inline' data: blob:; "
    "connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'"
)
"""CSP dos arquivos do painel. O portal deve servir com a mesma politica."""

SANDBOX_PAINEL = "allow-scripts allow-forms allow-downloads allow-modals"
"""Sandbox do iframe, igual ao do portal: sem allow-same-origin (nao le token nem DOM do portal).
allow-downloads para exportar Excel/imagem e allow-modals para imprimir (window.print)."""

CSP_ISOLADO = f"{CSP_PAINEL}; sandbox {SANDBOX_PAINEL}"
"""Todo documento do painel, mesmo aberto direto na aba (fora do iframe), roda em origem opaca:
nao le a pagina da pre-visualizacao nem o segredo dela."""

LIMITE_DADOS_BYTES = 256 * 1024

CABECALHO_SEGREDO = "X-Painel-Dev"


class _SoEstaPagina:
    """Barra quem nao e a propria pre-visualizacao: Host errado (DNS rebinding) e, nas rotas /_api,
    segredo ausente, Origin de outro site ou corpo que nao e JSON (CSRF)."""

    def __init__(self, app: ASGIApp, porta: int, segredo: str) -> None:
        self.app = app
        self.hosts = {f"127.0.0.1:{porta}".encode(), f"localhost:{porta}".encode()}
        self.origens = {f"http://127.0.0.1:{porta}".encode(), f"http://localhost:{porta}".encode()}
        self.segredo = segredo.encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        cab = {k.lower(): v for k, v in scope.get("headers", [])}
        motivo = None
        if cab.get(b"host") not in self.hosts:
            motivo = "host nao permitido"
        elif scope["path"].startswith("/_api/"):
            origem = cab.get(b"origin")
            if not secrets.compare_digest(cab.get(CABECALHO_SEGREDO.lower().encode(), b""), self.segredo):
                motivo = "segredo da pre-visualizacao ausente"
            elif origem is not None and origem not in self.origens:
                motivo = "origem nao permitida"
            elif scope["method"] in ("POST", "PUT") and not cab.get(b"content-type", b"").startswith(b"application/json"):
                motivo = "corpo precisa ser application/json"
        if motivo:
            await PlainTextResponse(f"recusado: {motivo}", status_code=403)(scope, receive, send)
            return
        await self.app(scope, receive, send)


_SHELL = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titulo} · pré-visualização</title>
<style>
:root{{--bg:#f4f5f7;--fg:#15181c;--fg2:#5b636e;--line:#dfe2e6;--ok:#1d7f4e;--erro:#b23b3b;--warn:#9a5b00}}
@media (prefers-color-scheme:dark){{:root{{--bg:#121417;--fg:#eef0f3;--fg2:#a3abb5;--line:#2a2f35;--ok:#4cbf85;--erro:#e57373;--warn:#e0a54a}}}}
*{{box-sizing:border-box}}body{{margin:0;font:14px system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);height:100vh;display:grid;grid-template-rows:auto 1fr auto}}
header{{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line)}}
header b{{font-size:15px}}.tag{{font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--line);color:var(--fg2)}}
.tag.teste{{color:var(--warn);border-color:currentColor}}
iframe{{width:100%;height:100%;border:0;background:var(--bg)}}
footer{{border-top:1px solid var(--line);font:12px ui-monospace,Menlo,monospace;color:var(--fg2)}}
footer button{{all:unset;cursor:pointer;display:flex;gap:12px;align-items:center;width:100%;box-sizing:border-box;padding:6px 16px;font:inherit}}
footer button:hover{{background:var(--line)}}footer button b{{color:var(--fg)}}
#log-linhas{{max-height:30vh;overflow:auto;border-top:1px solid var(--line)}}footer.fechado #log-linhas{{display:none}}
#log-linhas div{{padding:4px 16px;border-bottom:1px solid var(--line)}}.ok{{color:var(--ok)}}.erro{{color:var(--erro)}}
.invalido{{padding:24px;white-space:pre-wrap;color:var(--erro);font:14px ui-monospace,Menlo,monospace}}
</style></head><body>
<header><b>{titulo}</b><span class="tag">v{versao}</span><span class="tag teste">base {ambiente}</span>
<span class="tag">pré-visualização local · o portal mostra igual</span></header>
{corpo}
<footer id="rodape" class="fechado"><button id="log-alternar" type="button" aria-expanded="false" aria-controls="log-linhas">
<b>Consultas</b><span id="log-resumo">nenhuma ainda</span><span style="margin-left:auto" id="log-seta">▸ mostrar</span></button>
<div id="log-linhas" aria-label="Consultas executadas"></div></footer>
<script src="/_host/painel-host.js"></script>
<script>
(function(){{
  var SEGREDO = {segredo};
  var iframe = document.getElementById("painel");
  if (!iframe) return;
  var log = document.getElementById("log-linhas");
  var rodape = document.getElementById("rodape");
  var botao = document.getElementById("log-alternar");
  var resumo = document.getElementById("log-resumo");
  var total = 0, erros = 0;
  function alternar(aberto) {{
    rodape.classList.toggle("fechado", !aberto);
    botao.setAttribute("aria-expanded", String(aberto));
    document.getElementById("log-seta").textContent = aberto ? "▾ esconder" : "▸ mostrar";
    try {{ localStorage.setItem("lidere-log-aberto", aberto ? "1" : "0"); }} catch (e) {{}}
  }}
  var salvo = null;
  try {{ salvo = localStorage.getItem("lidere-log-aberto"); }} catch (e) {{}}
  alternar(salvo === "1");
  botao.addEventListener("click", function () {{ alternar(rodape.classList.contains("fechado")); }});
  var host = montarHostPainel(iframe, {{
    contexto: {{ manifesto: {manifesto}, tema: "light", usuario: {usuario}, ambiente: "{ambiente}",
               portal: {{ cor_primaria: "{cor_primaria}", empresa: "{empresa}" }} }},
    consultar: function (consulta, parametros) {{
      return fetch("/_api/consultas/" + encodeURIComponent(consulta), {{
        method: "POST", headers: {{ "Content-Type": "application/json", "X-Painel-Dev": SEGREDO }}, body: JSON.stringify({{ parametros: parametros }})
      }}).then(function (r) {{ return r.json().then(function (j) {{ if (!r.ok) throw new Error(j.erro); return j; }}); }});
    }},
    entidade: function (entidade, operacao, entrada) {{
      return fetch("/_api/entidade", {{
        method: "POST", headers: {{ "Content-Type": "application/json", "X-Painel-Dev": SEGREDO }},
        body: JSON.stringify({{ entidade: entidade, operacao: operacao, entrada: entrada }})
      }}).then(function (r) {{ return r.json().then(function (j) {{ if (!r.ok) throw new Error(j.erro); return j; }}); }});
    }},
    dados: {{
      ler: function (chave) {{
        return fetch("/_api/dados/" + encodeURIComponent(chave), {{ headers: {{ "X-Painel-Dev": SEGREDO }} }}).then(function (r) {{ return r.json().then(function (j) {{ if (!r.ok) throw new Error(j.erro); return j.valor; }}); }});
      }},
      gravar: function (chave, valor) {{
        return fetch("/_api/dados/" + encodeURIComponent(chave), {{
          method: "PUT", headers: {{ "Content-Type": "application/json", "X-Painel-Dev": SEGREDO }}, body: JSON.stringify({{ valor: valor }})
        }}).then(function (r) {{ return r.json().then(function (j) {{ if (!r.ok) throw new Error(j.erro); return j.valor; }}); }});
      }}
    }},
    aoConsultar: function (r) {{
      var d = document.createElement("div");
      d.className = r.ok ? "ok" : "erro";
      d.textContent = new Date().toLocaleTimeString("pt-BR") + "  " + r.consulta + "  " +
        (r.ok ? r.dados.total_linhas + " linhas · " + r.ms + " ms · auditoria " + r.dados.auditoria_id : "ERRO: " + r.erro);
      log.prepend(d);
      total += 1; if (!r.ok) erros += 1;
      resumo.textContent = total + " executada(s)" + (erros ? " · " + erros + " com erro" : " · todas ok") +
        " · última: " + r.consulta + (r.ok ? " (" + r.ms + " ms)" : " (erro)");
      resumo.className = erros ? "erro" : "ok";
    }}
  }});
  iframe.src = "/painel/_documento";
}})();
</script></body></html>"""


def _manifesto_bruto(p) -> dict[str, Any]:
    return json.loads(p.arquivos["painel.json"].decode("utf-8"))


def criar_app(pasta: Path, config: Config, porta: int = 8765) -> ASGIApp:
    cliente = PortalCliente(config)
    executor = PortalExecutor(cliente)
    segredo = secrets.token_urlsafe(32)

    def painel():
        # React: le o build/ mais recente (o `vite build --watch` recompila a cada alteracao).
        return carregar_pasta(montar_area(pasta), config.owners, config.funcoes_extras, governanca=False)

    async def shell(_: Request) -> HTMLResponse:
        try:
            p = painel()
        except PacoteInvalido as erro:
            corpo = f'<div class="invalido">{html.escape(str(erro))}</div>'
            return HTMLResponse(_SHELL.format(titulo="Painel inválido", versao="?", ambiente=config.ambiente,
                                              corpo=corpo, manifesto="null", usuario='""',
                                              cor_primaria="", empresa="", segredo='""'))
        corpo = f'<iframe id="painel" sandbox="{SANDBOX_PAINEL}" title="Painel"></iframe>'
        manifesto = p.manifesto_publico()
        bruto = _manifesto_bruto(p)
        if bruto.get("entidades") is not None:
            # Modulo com dados: o portal confere as entidades e devolve a definicao que o SDK usa nos formularios.
            try:
                manifesto["modulo"] = (await cliente.modulo_validar(bruto)).get("modulo")
            except Focco3iMcpError as erro:
                corpo = f'<div class="invalido">Modulo com dados recusado pelo portal: {html.escape(str(erro))}</div>'
        return HTMLResponse(_SHELL.format(
            titulo=html.escape(p.nome), versao=html.escape(p.versao), ambiente=config.ambiente, corpo=corpo,
            manifesto=json.dumps(manifesto, ensure_ascii=False).replace("</", "<\\/"),
            usuario=json.dumps(config.empresa or "usuario do token"),
            cor_primaria=html.escape(config.cor_primaria),
            empresa=html.escape(config.empresa),
            segredo=json.dumps(segredo),
        ))

    async def host_js(_: Request) -> Response:
        return Response((_ESTATICO / "painel-host.js").read_bytes(), media_type="text/javascript")

    async def documento(_: Request) -> Response:
        """O mesmo documento unico que o portal injeta via srcdoc: paridade total com o portal."""
        try:
            p = painel()
        except PacoteInvalido as erro:
            return Response(str(erro), status_code=422, media_type="text/plain; charset=utf-8")
        return HTMLResponse(montar_documento(p), headers={
            "Content-Security-Policy": CSP_ISOLADO,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        })

    async def arquivo(request: Request) -> Response:
        caminho = request.path_params["caminho"]
        try:
            p = painel()
        except PacoteInvalido as erro:
            return Response(str(erro), status_code=422, media_type="text/plain; charset=utf-8")
        conteudo = p.arquivos.get(caminho)
        if conteudo is None:
            return Response("nao encontrado", status_code=404)
        tipo = mimetypes.guess_type(caminho)[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo == "application/javascript":
            tipo += "; charset=utf-8"
        return Response(conteudo, media_type=tipo, headers={
            "Content-Security-Policy": CSP_ISOLADO,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        })

    async def consultar(request: Request) -> JSONResponse:
        consulta_id = request.path_params["consulta"]
        try:
            corpo: dict[str, Any] = await request.json()
            p = painel()
            consulta = p.consultas.get(consulta_id)
            if consulta is None:
                return JSONResponse({"erro": f"consulta '{consulta_id}' nao existe no painel.json"}, status_code=404)
            binds = converter_parametros(consulta, corpo.get("parametros"))
            dados = await executor.ler(
                ferramenta=f"painel:{p.id}/{consulta.id}",
                nivel=NIVEL_CONSULTA,
                sql=consulta.sql,
                binds=binds,
                max_linhas=consulta.max_linhas,
            )
        except Focco3iMcpError as erro:
            return JSONResponse({"erro": str(erro)}, status_code=422)
        except json.JSONDecodeError:
            return JSONResponse({"erro": "corpo precisa ser JSON"}, status_code=400)
        dados["atualizado_em"] = datetime.now().isoformat(timespec="seconds")
        return JSONResponse(dados)

    arquivo_dados = pasta / ".dados-dev.json"

    def _ler_dados() -> dict[str, Any]:
        try:
            return json.loads(arquivo_dados.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    async def dados(request: Request) -> JSONResponse:
        """Dados do painel na pre-visualizacao: arquivo local .dados-dev.json (no portal, banco do portal)."""
        chave = request.path_params["chave"]
        try:
            p = painel()
        except PacoteInvalido as erro:
            return JSONResponse({"erro": str(erro)}, status_code=422)
        if chave not in p.dados:
            return JSONResponse({"erro": f"chave '{chave}' nao esta declarada em dados no painel.json"}, status_code=404)
        guardados = _ler_dados()
        if request.method == "GET":
            return JSONResponse({"valor": guardados.get(chave)})
        corpo = await request.body()
        if len(corpo) > LIMITE_DADOS_BYTES:
            return JSONResponse({"erro": "valor grande demais (limite 256 KB)"}, status_code=413)
        guardados[chave] = json.loads(corpo or b"{}").get("valor")
        arquivo_dados.write_text(json.dumps(guardados, ensure_ascii=False, indent=2), encoding="utf-8")
        return JSONResponse({"valor": guardados[chave]})

    async def entidade(request: Request) -> JSONResponse:
        """Modulo com dados na pre-visualizacao: o portal cria/estende as tabelas e executa (owner de teste)."""
        try:
            corpo = await request.json()
            p = painel()
            dados = await cliente.modulo_operar(
                _manifesto_bruto(p), str(corpo.get("entidade", "")), str(corpo.get("operacao", "")), corpo.get("entrada") or {}
            )
        except (PacoteInvalido, Focco3iMcpError) as erro:
            return JSONResponse({"erro": str(erro)}, status_code=422)
        except ValueError:
            return JSONResponse({"erro": "pedido invalido"}, status_code=400)
        return JSONResponse(dados)

    app = Starlette(routes=[
        Route("/_api/entidade", entidade, methods=["POST"]),
        Route("/_api/dados/{chave}", dados, methods=["GET", "PUT"]),
        Route("/", shell),
        Route("/_host/painel-host.js", host_js),
        Route("/painel/_documento", documento),
        Route("/painel/{caminho:path}", arquivo),
        Route("/_api/consultas/{consulta}", consultar, methods=["POST"]),
    ])
    return _SoEstaPagina(app, porta, segredo)
