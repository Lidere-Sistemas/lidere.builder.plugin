"""`lidere-painel entrar`: login pelo navegador, no mesmo OAuth do MCP do portal.

O usuário não copia nem cola token. Fluxo (cliente público com PKCE, RFC 8252):

1. Descobre o authorization server do MCP (RFC 8414) e registra a CLI como "lidere-painel"
   com retorno em loopback (127.0.0.1, porta livre).
2. Abre o navegador na tela "Autorizar" do portal, onde o usuário já está logado.
3. Recebe o código no loopback, troca pelo access token (authlib: PKCE S256 + state).
4. Resgata o token do portal em /oauth/token-portal. O MCP encerra a sessão OAuth da CLI ali.

PKCE e troca de código ficam com a authlib (lib madura); aqui só a cola: descoberta,
registro dinâmico (um POST) e o servidor de retorno de uso único.
"""

from __future__ import annotations

import threading
import webbrowser
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlsplit

import httpx
from authlib.common.security import generate_token
from authlib.integrations.httpx_client import OAuth2Client

from lidere_painel.config import url_aceitavel
from lidere_painel.erros import Focco3iMcpError

__all__ = ["entrar", "ErroDeLogin", "CLIENTE", "portal_url_aceitavel"]

CLIENTE = "lidere-painel"
ESCOPO = "focco3i"
ESPERA_S = 300

_PAGINA_OK = (
    "<!doctype html><meta charset='utf-8'><title>Lidere Builder</title>"
    "<body style='font-family:system-ui;padding:40px'><h2>Pronto, pode fechar esta aba.</h2>"
    "<p>O Lidere Builder está conectado ao portal.</p></body>"
)


class ErroDeLogin(Focco3iMcpError):
    """O login pelo navegador não terminou. A mensagem diz o motivo e o que fazer."""


portal_url_aceitavel = url_aceitavel
"""Mesma regra da config (mantido pelo nome antigo)."""


def _base(mcp_url: str) -> str:
    """Raiz do servidor MCP (issuer): https://mcp.cliente/mcp -> https://mcp.cliente."""
    url = mcp_url.rstrip("/")
    return url[: -len("/mcp")] if url.endswith("/mcp") else url


class _Retorno:
    """Servidor HTTP de uso único em 127.0.0.1, porta escolhida pelo sistema."""

    def __init__(self) -> None:
        self.url_recebida: str | None = None
        self.estado_esperado: str | None = None
        self._chegou = threading.Event()
        retorno = self

        class Handler(BaseHTTPRequestHandler):
            timeout = 10  # socket local preso não trava o retorno

            def do_GET(self) -> None:  # noqa: N802 - nome da API do http.server
                partes = urlsplit(self.path)
                estado = parse_qs(partes.query).get("state", [""])[0]
                # Só a volta do NOSSO pedido (state certo) e só a primeira: o resto é ignorado.
                if partes.path != "/callback" or not retorno.estado_esperado or estado != retorno.estado_esperado or retorno._chegou.is_set():
                    self.send_error(404)
                    return
                retorno.url_recebida = f"http://127.0.0.1:{self.server.server_port}{self.path}"
                corpo = _PAGINA_OK.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(corpo)))
                self.end_headers()
                self.wfile.write(corpo)
                retorno._chegou.set()

            def log_message(self, *args: object) -> None:
                return

        self._servidor = HTTPServer(("127.0.0.1", 0), Handler)
        self.redirect_uri = f"http://127.0.0.1:{self._servidor.server_port}/callback"
        self._thread = threading.Thread(target=self._servidor.serve_forever, daemon=True)
        self._thread.start()

    def esperar(self, segundos: float) -> str | None:
        self._chegou.wait(segundos)
        return self.url_recebida

    def fechar(self) -> None:
        self._servidor.shutdown()
        self._servidor.server_close()


def entrar(
    mcp_url: str,
    abrir_navegador: Callable[[str], object] = webbrowser.open,
    transporte: httpx.BaseTransport | None = None,
    espera_s: float = ESPERA_S,
) -> tuple[str, str]:
    """Faz o login e devolve (url_da_api_do_portal, token_do_portal)."""
    base = _base(mcp_url)
    recurso = mcp_url.rstrip("/")
    http = httpx.Client(timeout=20, transport=transporte)
    retorno = _Retorno()
    try:
        try:
            meta = http.get(f"{base}/.well-known/oauth-authorization-server")
            meta.raise_for_status()
            meta = meta.json()
            registro = http.post(
                meta["registration_endpoint"],
                json={
                    "client_name": CLIENTE,
                    "redirect_uris": [retorno.redirect_uri],
                    "grant_types": ["authorization_code", "refresh_token"],
                    "response_types": ["code"],
                    "token_endpoint_auth_method": "none",
                    "scope": ESCOPO,
                },
            )
        except (httpx.HTTPError, ValueError, KeyError) as erro:
            raise ErroDeLogin(f"Não consegui falar com o MCP em {mcp_url}. Confira o endereço e a rede.") from erro
        if registro.status_code >= 400:
            raise ErroDeLogin(f"O MCP recusou o registro da CLI ({registro.status_code}): {registro.text[:200]}")
        cliente = registro.json()

        oauth = OAuth2Client(
            client_id=cliente["client_id"],
            client_secret=cliente.get("client_secret"),
            token_endpoint_auth_method="client_secret_post" if cliente.get("client_secret") else "none",
            redirect_uri=retorno.redirect_uri,
            scope=ESCOPO,
            code_challenge_method="S256",
            timeout=20,
            transport=transporte,
        )
        verificador = generate_token(64)
        url_autorizar, estado = oauth.create_authorization_url(
            meta["authorization_endpoint"], code_verifier=verificador, resource=recurso
        )
        retorno.estado_esperado = estado
        abrir_navegador(url_autorizar)
        recebida = retorno.esperar(espera_s)
        if recebida is None:
            raise ErroDeLogin("O login não foi concluído no navegador a tempo. Rode `lidere-painel entrar` de novo.")
        params = parse_qs(urlsplit(recebida).query)
        if "error" in params:
            # Não ecoar texto livre da URL (a saída é lida pelo agente): só o código, curto e ASCII.
            codigo = "".join(c for c in params["error"][0] if c.isascii() and (c.isalnum() or c == "_"))[:40]
            raise ErroDeLogin(f"O portal não autorizou ({codigo or 'recusado'}). Rode `lidere-painel entrar` de novo.")
        try:
            token = oauth.fetch_token(
                meta["token_endpoint"], authorization_response=recebida, code_verifier=verificador, resource=recurso
            )
            resgate = http.post(
                f"{base}/oauth/token-portal", headers={"Authorization": f"Bearer {token['access_token']}"}
            )
        except Exception as erro:  # authlib levanta OAuthError e httpx.HTTPError
            raise ErroDeLogin(f"Não consegui concluir o login: {erro}") from erro
        if resgate.status_code == 503:
            raise ErroDeLogin("O login pela CLI ainda não está ligado neste portal. Fale com a Lidere.")
        if resgate.status_code != 200:
            raise ErroDeLogin("O MCP não entregou o acesso ao portal. Rode `lidere-painel entrar` de novo.")
        dados = resgate.json()
        portal_url = str(dados.get("portal_url", ""))
        if not str(dados.get("token", "")).startswith("f3i_") or not portal_url_aceitavel(portal_url):
            raise ErroDeLogin("Resposta inesperada do MCP ao entregar o acesso ao portal. Fale com a Lidere.")
        return portal_url, dados["token"]
    finally:
        retorno.fechar()
        http.close()
