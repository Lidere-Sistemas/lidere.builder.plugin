"""Modo portal: o MCP não tem senha do Oracle; fala com o gateway do portal com o token do usuário.

O portal confere quem é o usuário, os escopos que o PERFIL dele libera (as areas do MCP),
executa pelo mesmo núcleo governado dos Painéis e audita por usuário.
Tabela fora do escopo volta recusada antes de chegar ao banco.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

import httpx

from lidere_painel.config import Config
from lidere_painel.erros import EntradaInvalida, Focco3iMcpError, PonteIndisponivel, SqlBloqueado

__all__ = ["PortalCliente", "ForaDoEscopo", "PortalExecutor"]


class ForaDoEscopo(Focco3iMcpError):
    """O portal recusou: tabela fora dos escopos do usuário. Nada foi ao banco."""


class PortalCliente:
    """`token`: o token fixo do .env (MCP local) ou uma função que devolve o token do usuário
    da requisição atual (MCP remoto com OAuth)."""

    def __init__(self, config: Config, token: str | Callable[[], str] | None = None) -> None:
        self._base = config.portal_url.rstrip("/") + "/mcp/gateway/"
        self._token = token if token is not None else config.portal_token
        self._timeout = config.timeout_s + 15

    async def _chamar(
        self, metodo: str, rota: str, corpo: dict[str, Any] | None = None, arquivos: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as cliente:
                token = self._token() if callable(self._token) else self._token
                cabecalho = {"Authorization": f"Bearer {token}"}
                if arquivos:
                    resposta = await cliente.request(metodo, self._base + rota, files=arquivos, headers=cabecalho)
                else:
                    resposta = await cliente.request(metodo, self._base + rota, json=corpo, headers=cabecalho)
        except httpx.HTTPError as erro:
            raise PonteIndisponivel(f"Portal inacessível em {self._base} ({erro.__class__.__name__}). Confira a URL e a rede.") from erro
        try:
            dados = resposta.json()
        except ValueError:
            dados = {"detail": resposta.text[:300]}
        if resposta.status_code == 401:
            raise Focco3iMcpError("Login no portal expirado ou revogado. Rode `lidere-painel entrar` e autorize de novo no navegador.")
        if resposta.status_code == 403:
            raise ForaDoEscopo(dados.get("detail", "Fora do seu escopo."))
        if resposta.status_code == 400:
            raise EntradaInvalida(dados.get("detail", "Pedido inválido."))
        if resposta.status_code == 422:
            raise SqlBloqueado(dados.get("detail", "Recusado pela governança."))
        if resposta.status_code >= 400:
            raise Focco3iMcpError(f"O portal respondeu {resposta.status_code}: {dados.get('detail', '')}")
        return dados

    async def quem_sou(self) -> dict[str, Any]:
        return await self._chamar("GET", "quem-sou/")

    async def publicar_painel(self, zip_path: Path) -> dict[str, Any]:
        """Publica (ou atualiza) o painel no portal. Mesma validação e escopos do upload pela tela."""
        return await self._chamar(
            "POST", "publicar-painel/", arquivos={"arquivo": (zip_path.name, zip_path.read_bytes(), "application/zip")}
        )

    async def consultar(self, sql: str, binds: dict[str, Any] | None, max_linhas: int | None) -> dict[str, Any]:
        return await self._chamar("POST", "consultar/", {"sql": sql, "binds": binds or {}, "max_linhas": max_linhas})

    async def buscar_objetos(self, termo: str, limite: int) -> dict[str, Any]:
        return await self._chamar("POST", "buscar-objetos/", {"termo": termo, "limite": limite})

    async def buscar_colunas(self, termo: str, tabela: str | None, limite: int) -> dict[str, Any]:
        return await self._chamar("POST", "buscar-colunas/", {"termo": termo, "tabela": tabela, "limite": limite})

    async def descrever_tabela(self, tabela: str, owner: str | None, filtro: str | None) -> dict[str, Any]:
        return await self._chamar("POST", "descrever-tabela/", {"tabela": tabela, "owner": owner, "filtro": filtro})

    async def listar_fks(self, tabela: str, owner: str | None) -> dict[str, Any]:
        return await self._chamar("POST", "listar-fks/", {"tabela": tabela, "owner": owner})


class PortalExecutor:
    """Mesmo contrato do Executor local (`ler`), mas executando pelo portal.

    Usado pelo `lidere-painel` (validar/servir) quando o MCP está em modo portal: quem
    cria painel também fica limitado aos próprios escopos.
    """

    def __init__(self, cliente: PortalCliente) -> None:
        self._cliente = cliente

    def limite(self, max_linhas: int | None) -> int:
        return max_linhas or 500

    async def ler(self, *, ferramenta: str, nivel: int, sql: str, binds=None, max_linhas=None, interno: bool = False) -> dict[str, Any]:
        if interno:
            raise EntradaInvalida("No modo portal, o dicionário é consultado pelas ferramentas próprias.")
        return await self._cliente.consultar(sql, binds, max_linhas)
