"""Configuração da CLI: onde está o portal e o token pessoal do usuário.

Fica em ~/.lidere-builder/config.json (chmod 600), gravado por `lidere-painel entrar` (login pelo
navegador, o mesmo do Claude) ou `lidere-painel configurar` (token colado, para máquina sem navegador).
Variáveis de ambiente sobrescrevem: LIDERE_PORTAL_URL, LIDERE_PORTAL_TOKEN, LIDERE_COR_PRIMARIA
(os nomes antigos FOCCO3I_* também valem).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from urllib.parse import urlsplit

from lidere_painel.erros import ConfigInvalida

ARQUIVO = Path(os.path.expanduser("~/.lidere-builder/config.json"))


def url_aceitavel(url: str) -> bool:
    """https, ou http so em loopback (desenvolvimento). Token do portal nao viaja em texto claro."""
    partes = urlsplit(url or "")
    if not partes.hostname:
        return False
    return partes.scheme == "https" or (partes.scheme == "http" and partes.hostname in ("127.0.0.1", "localhost", "::1"))


def exigir_url_segura(url: str, o_que: str) -> str:
    if not url_aceitavel(url):
        raise ConfigInvalida(f"{o_que} precisa ser https:// ({url!r}). O token nao pode viajar sem criptografia.")
    return url


def _env(*nomes: str) -> str | None:
    for nome in nomes:
        valor = os.environ.get(nome, "").strip()
        if valor:
            return valor
    return None


@dataclass(frozen=True)
class Config:
    portal_url: str
    portal_token: str
    cor_primaria: str = "#674596"
    empresa: str = ""
    timeout_s: int = 30
    owners: tuple[str, ...] = ()
    funcoes_extras: tuple[str, ...] = ()
    ambiente: str = "portal"

    @classmethod
    def de_ambiente(cls) -> Config:
        salvo = json.loads(ARQUIVO.read_text(encoding="utf-8")) if ARQUIVO.is_file() else {}
        url = _env("LIDERE_PORTAL_URL", "FOCCO3I_PORTAL_URL") or salvo.get("portal_url")
        token = _env("LIDERE_PORTAL_TOKEN", "FOCCO3I_PORTAL_TOKEN") or salvo.get("portal_token")
        if not url or not token:
            raise ConfigInvalida(
                "CLI sem login no portal. Rode `lidere-painel entrar --mcp <endereço do MCP>` e autorize no navegador."
            )
        if not token.startswith("f3i_"):
            raise ConfigInvalida("Token inválido: o token do portal começa com f3i_.")
        exigir_url_segura(url, "O endereco do portal")
        return cls(
            portal_url=url.rstrip("/"),
            portal_token=token,
            cor_primaria=_env("LIDERE_COR_PRIMARIA", "FOCCO3I_COR_PRIMARIA") or salvo.get("cor_primaria") or "#674596",
            empresa=salvo.get("empresa", ""),
        )


def mcp_salvo() -> str | None:
    """Endereço do MCP do último `entrar` (para renovar o login sem perguntar de novo)."""
    salvo = json.loads(ARQUIVO.read_text(encoding="utf-8")) if ARQUIVO.is_file() else {}
    return _env("LIDERE_MCP_URL") or salvo.get("mcp_url")


def salvar(
    portal_url: str,
    portal_token: str,
    cor_primaria: str | None = None,
    empresa: str | None = None,
    mcp_url: str | None = None,
) -> Path:
    exigir_url_segura(portal_url, "O endereco do portal")
    if mcp_url:
        exigir_url_segura(mcp_url, "O endereco do MCP")
    ARQUIVO.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    anterior = json.loads(ARQUIVO.read_text(encoding="utf-8")) if ARQUIVO.is_file() else {}
    dados = {"portal_url": portal_url.rstrip("/"), "portal_token": portal_token}
    mesmo_portal = anterior.get("portal_url") == dados["portal_url"]
    for chave in ("cor_primaria", "empresa", "mcp_url"):
        # cor e empresa são do portal anterior: outro portal começa sem elas
        if anterior.get(chave) and (mesmo_portal or chave == "mcp_url"):
            dados[chave] = anterior[chave]
    if mcp_url:
        dados["mcp_url"] = mcp_url.rstrip("/")
    if cor_primaria:
        dados["cor_primaria"] = cor_primaria
    if empresa:
        dados["empresa"] = empresa
    # Escrita atômica (temporário + replace): arquivo corrompido não derruba o próximo login.
    temporario = ARQUIVO.with_suffix(".tmp")
    descritor = os.open(temporario, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descritor, "w", encoding="utf-8") as arquivo:
        json.dump(dados, arquivo, indent=2)
    os.chmod(temporario, 0o600)  # no Windows vale a ACL do perfil do usuário
    os.replace(temporario, ARQUIVO)
    return ARQUIVO
