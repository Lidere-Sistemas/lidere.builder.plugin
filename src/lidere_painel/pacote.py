"""Contrato do pacote de painel (formato `focco3i-painel/1`) e sua validacao.

Um painel e uma pasta (ou um .zip com o mesmo conteudo na raiz):

    painel.json        manifesto: identidade, menu, consultas nomeadas
    index.html         a tela; pede dado por Painel.consultar(id, params)
    consultas/*.sql    um SELECT por consulta, com binds :nome
    assets/...         css, js, imagens, fontes (tudo local, nada de CDN)

Regra de ouro da governanca: o SQL mora no MANIFESTO, que fica no servidor. O
HTML so conhece o id da consulta e manda parametros tipados. Quem executa e o
host (servidor de dev local ou o portal), sempre pelo guard e com auditoria.

Este modulo e puro (sem banco, sem rede) para ser reaproveitado no portal: o
portal roda a mesma validacao no upload e nao confia no que veio no zip.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any

import sqlglot
from sqlglot import exp

from lidere_painel.erros import EntradaInvalida, Focco3iMcpError, SqlBloqueado

try:  # o host (portal) leva o guard junto e valida a governanca do SQL no upload
    from lidere_painel.guarda_sql import BINDS_RESERVADOS, validar_select
except ImportError:  # a CLI distribuida nao leva o guard: a governanca roda so no portal
    BINDS_RESERVADOS = frozenset({"empresa_sessao", "empresas_sessao"})
    validar_select = None


@dataclass(frozen=True)
class _SqlEstrutura:
    """O que o contrato precisa do SQL quando o guard nao esta presente (sem regra de governanca)."""

    sql: str
    tabelas: tuple[str, ...]
    binds: frozenset[str]


def _analisar_sql(sql: str, owners: tuple[str, ...], funcoes_extras: tuple[str, ...], governanca: bool) -> Any:
    """Host (governanca=True): guard completo. CLI: so a estrutura (um SELECT, tabelas e binds); o portal decide o resto."""
    if governanca:
        if validar_select is None:  # fail-closed: host sem guard nunca aceita SQL
            raise SqlBloqueado("guard de SQL ausente neste host: a governanca nao pode ser verificada.")
        return validar_select(sql, owners, funcoes_extras)
    texto = (sql or "").strip()
    while texto.endswith(";"):
        texto = texto[:-1].rstrip()
    if not texto:
        raise SqlBloqueado("SQL vazio.")
    try:
        arvores = [a for a in sqlglot.parse(texto, read="oracle") if a is not None]
    except sqlglot.errors.SqlglotError as erro:
        raise SqlBloqueado(f"nao foi possivel interpretar o SQL ({(str(erro).splitlines() or ['erro de sintaxe'])[0]}).") from erro
    if len(arvores) != 1 or not isinstance(arvores[0], exp.Query):
        raise SqlBloqueado("escreva um unico SELECT (ou WITH ... SELECT).")
    arvore = arvores[0]
    ctes = {cte.alias_or_name.upper() for cte in arvore.find_all(exp.CTE)}
    tabelas: list[str] = []
    for tabela in arvore.find_all(exp.Table):
        nome = tabela.name.upper()
        if not tabela.db and nome in ctes:
            continue
        completo = f"{tabela.db.upper()}.{nome}" if tabela.db else nome
        if completo not in tabelas:
            tabelas.append(completo)
    binds = frozenset((p.name or "").lower() for p in arvore.find_all(exp.Placeholder) if p.name)
    return _SqlEstrutura(sql=texto, tabelas=tuple(tabelas), binds=binds)

__all__ = [
    "FORMATO",
    "PacoteInvalido",
    "Parametro",
    "Consulta",
    "Painel",
    "carregar_pasta",
    "carregar_zip",
    "empacotar",
    "converter_parametros",
]

FORMATO = "focco3i-painel/1"
LIMITE_ZIP_BYTES = 10 * 1024 * 1024
LIMITE_ARQUIVO_BYTES = 5 * 1024 * 1024
LIMITE_ARQUIVOS = 200
EXTENSOES = {
    ".html", ".js", ".css", ".json", ".sql", ".md", ".txt",
    ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico",
    ".woff", ".woff2", ".ttf",
}
TIPOS_PARAMETRO = {"inteiro", "decimal", "texto", "data"}
_RE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$")
_RE_ID_CONSULTA = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
_RE_VERSAO = re.compile(r"^\d+\.\d+\.\d+$")
_RE_ESCOPO = re.compile(r"^[A-Za-z][A-Za-z0-9_]{1,39}$")
_ESTATICO = Path(__file__).with_name("estatico")
ARQUIVOS_DA_PLATAFORMA = ("painel-runtime.js", "portal.css", "inter-latin.woff2")
"""Arquivos que vem do focco3i, nao do autor do painel: precisam ser identicos a uma versao oficial."""

HASHES_ANTERIORES: dict[str, frozenset[str]] = {
    # Versoes oficiais anteriores continuam aceitas: painel ja publicado nao quebra quando
    # o runtime evolui. Ao trocar um arquivo de plataforma, ACRESCENTE o hash antigo aqui.
    "painel-runtime.js": frozenset(
        {
            "9baddac87d67cfe269d43f27f360b3eb99fb94bb49412a33ee57286facccc523",
            "6463de1516f8661a9f6d3966020c2f54ef5b112017b0bffee90981a893037a71",
        }
    ),
    "portal.css": frozenset(
        {
            "88b07f0b42db447be1d1ed93e2bd09b41019e29c633e7a60fb725909f37de166",
            "67aee6ae590dd12f289df0be9bd54c47042ca8c6566ab19666f0808e08009a23",
        }
    ),
    "inter-latin.woff2": frozenset(),
}


_RE_TOKEN = re.compile(rb"f3i_[A-Za-z0-9_-]{20,}")
"""Token pessoal do portal: nunca pode ir dentro de um pacote (ex.: copiado por engano para public/)."""


def _hashes_aceitos(nome: str) -> frozenset[str]:
    atual = hashlib.sha256((_ESTATICO / nome).read_bytes()).hexdigest()
    return HASHES_ANTERIORES.get(nome, frozenset()) | {atual}

_RE_CDN = re.compile(r"""(?:src|href)\s*=\s*["']\s*(?:https?:)?//""", re.IGNORECASE)


class PacoteInvalido(Focco3iMcpError):
    """O pacote nao segue o contrato. A mensagem lista todos os problemas achados."""

    def __init__(self, problemas: list[str]) -> None:
        self.problemas = problemas
        super().__init__("Pacote de painel invalido:\n- " + "\n- ".join(problemas))


@dataclass(frozen=True)
class Parametro:
    nome: str
    tipo: str
    rotulo: str
    padrao: Any = None
    obrigatorio: bool = False
    exemplo: Any = None
    """Valor so para o `validar` exercitar a consulta (ex.: o id de um registro no drill)."""
    minimo: float | None = None
    maximo: float | None = None
    opcoes: tuple[Any, ...] | None = None


@dataclass(frozen=True)
class Consulta:
    id: str
    sql: str
    sql_validado: str
    tabelas: tuple[str, ...]
    parametros: tuple[Parametro, ...]
    max_linhas: int


@dataclass(frozen=True)
class Painel:
    id: str
    nome: str
    versao: str
    descricao: str
    menu_grupo: str
    menu_icone: str | None
    consultas: dict[str, Consulta]
    arquivos: dict[str, bytes] = field(repr=False)
    escopos: tuple[str, ...] = ()
    """Escopos do MCP que o painel usa (as chaves que `lidere-painel status` mostra). O host confere as tabelas contra eles."""
    dados: dict[str, dict[str, Any]] = field(default_factory=dict)
    """Chaves de dados editaveis (metas, feriados...) que o painel le e grava no portal."""

    def manifesto_publico(self) -> dict[str, Any]:
        """O que o front do host pode ver: sem SQL. Parametros sim, para montar filtros."""
        return {
            "id": self.id,
            "nome": self.nome,
            "versao": self.versao,
            "descricao": self.descricao,
            "menu": {"grupo": self.menu_grupo, "icone": self.menu_icone},
            "escopos": list(self.escopos),
            "dados": self.dados,
            "consultas": {
                c.id: {
                    "parametros": [
                        {
                            "nome": p.nome, "tipo": p.tipo, "rotulo": p.rotulo, "padrao": p.padrao,
                            "obrigatorio": p.obrigatorio, "opcional": not p.obrigatorio and p.padrao is None,
                            "opcoes": list(p.opcoes) if p.opcoes else None,
                        }
                        for p in c.parametros
                    ]
                }
                for c in self.consultas.values()
            },
        }


# --- leitura -----------------------------------------------------------------------------


def _caminho_seguro(nome: str, problemas: list[str]) -> str | None:
    caminho = PurePosixPath(nome.replace("\\", "/"))
    if caminho.is_absolute() or ".." in caminho.parts or any(p.startswith(".") for p in caminho.parts):
        problemas.append(f"caminho nao permitido no pacote: {nome}")
        return None
    if caminho.suffix.lower() not in EXTENSOES:
        problemas.append(f"tipo de arquivo nao permitido: {nome} (aceitos: {', '.join(sorted(EXTENSOES))})")
        return None
    return str(caminho)


def carregar_pasta(
    pasta: Path, owners: tuple[str, ...], funcoes_extras: tuple[str, ...] = (), governanca: bool = True
) -> Painel:
    problemas: list[str] = []
    arquivos: dict[str, bytes] = {}
    if not (pasta / "painel.json").is_file():
        raise PacoteInvalido([f"{pasta} nao tem painel.json"])
    raiz = pasta.resolve()
    for item in sorted(pasta.rglob("*")):
        if item.is_dir():
            continue
        # Link simbolico (ou caminho que sai da pasta) nunca entra: levaria arquivo local para o zip.
        if item.is_symlink() or not item.resolve().is_relative_to(raiz):
            problemas.append(f"{item.relative_to(pasta).as_posix()}: link simbolico nao e aceito no painel")
            continue
        relativo = item.relative_to(pasta).as_posix()
        if any(parte.startswith(".") or parte == "__pycache__" for parte in PurePosixPath(relativo).parts):
            continue
        if relativo.endswith(".zip"):
            continue
        seguro = _caminho_seguro(relativo, problemas)
        if seguro:
            arquivos[seguro] = item.read_bytes()
    return _montar(arquivos, owners, funcoes_extras, problemas, governanca)


def carregar_zip(
    conteudo: bytes, owners: tuple[str, ...], funcoes_extras: tuple[str, ...] = (), governanca: bool = True
) -> Painel:
    problemas: list[str] = []
    if len(conteudo) > LIMITE_ZIP_BYTES:
        raise PacoteInvalido([f"zip maior que {LIMITE_ZIP_BYTES // 1024 // 1024} MB"])
    try:
        pacote = zipfile.ZipFile(io.BytesIO(conteudo))
    except zipfile.BadZipFile as erro:
        raise PacoteInvalido(["arquivo nao e um zip valido"]) from erro
    arquivos: dict[str, bytes] = {}
    infos = [i for i in pacote.infolist() if not i.is_dir()]
    if len(infos) > LIMITE_ARQUIVOS:
        raise PacoteInvalido([f"mais de {LIMITE_ARQUIVOS} arquivos no zip"])
    total = 0
    for info in infos:
        if info.file_size > LIMITE_ARQUIVO_BYTES:
            problemas.append(f"{info.filename} passa de {LIMITE_ARQUIVO_BYTES // 1024 // 1024} MB")
            continue
        total += info.file_size
        if total > LIMITE_ZIP_BYTES * 3:  # defesa contra zip bomb
            raise PacoteInvalido(["conteudo descompactado grande demais"])
        seguro = _caminho_seguro(info.filename, problemas)
        if seguro:
            arquivos[seguro] = pacote.read(info)
    return _montar(arquivos, owners, funcoes_extras, problemas, governanca)


# --- validacao ---------------------------------------------------------------------------


def _parametro(nome: str, bruto: Any, problemas: list[str], onde: str) -> Parametro | None:
    if not isinstance(bruto, dict):
        problemas.append(f"{onde}: parametro {nome} precisa ser objeto")
        return None
    tipo = bruto.get("tipo")
    if tipo not in TIPOS_PARAMETRO:
        problemas.append(f"{onde}: parametro {nome} com tipo '{tipo}' (aceitos: {', '.join(sorted(TIPOS_PARAMETRO))})")
        return None
    param = Parametro(
        nome=nome,
        tipo=tipo,
        rotulo=str(bruto.get("rotulo") or nome),
        padrao=bruto.get("padrao"),
        obrigatorio=bool(bruto.get("obrigatorio", False)),
        minimo=bruto.get("min"),
        maximo=bruto.get("max"),
        opcoes=tuple(bruto["opcoes"]) if isinstance(bruto.get("opcoes"), list) else None,
        exemplo=bruto.get("exemplo"),
    )
    # Sem padrao e sem obrigatorio = filtro OPCIONAL: chega como NULL quando o usuario
    # nao escolhe nada. O SQL trata com (:p IS NULL OR coluna = :p).
    for rotulo, valor in (("padrao", param.padrao), ("exemplo", param.exemplo)):
        if valor is not None:
            try:
                _converter(param, valor)
            except ValueError as erro:
                problemas.append(f"{onde}: {rotulo} de {nome} invalido ({erro})")
    return param


def _montar(
    arquivos: dict[str, bytes],
    owners: tuple[str, ...],
    funcoes_extras: tuple[str, ...],
    problemas: list[str],
    governanca: bool = True,
) -> Painel:
    if "painel.json" not in arquivos:
        raise PacoteInvalido(problemas + ["painel.json ausente na raiz do pacote"])
    if "index.html" not in arquivos:
        problemas.append("index.html ausente na raiz do pacote")
    try:
        manifesto = json.loads(arquivos["painel.json"].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as erro:
        raise PacoteInvalido(problemas + [f"painel.json nao e JSON valido ({erro})"]) from erro

    if manifesto.get("formato") != FORMATO:
        problemas.append(f"formato precisa ser '{FORMATO}'")
    painel_id = str(manifesto.get("id", ""))
    if not _RE_ID.match(painel_id):
        problemas.append("id precisa ser slug minusculo com hifen, 3 a 64 caracteres (ex.: vendas-por-mes)")
    nome = str(manifesto.get("nome", "")).strip()
    if not nome or len(nome) > 80:
        problemas.append("nome obrigatorio, ate 80 caracteres")
    versao = str(manifesto.get("versao", ""))
    if not _RE_VERSAO.match(versao):
        problemas.append("versao precisa ser semver (ex.: 1.0.0)")
    menu = manifesto.get("menu") or {}
    grupo = str(menu.get("grupo") or "Painéis").strip()[:40]
    escopos_brutos = manifesto.get("escopos")
    if (
        not isinstance(escopos_brutos, list)
        or not escopos_brutos
        or not all(isinstance(e, str) and _RE_ESCOPO.match(e) for e in escopos_brutos)
    ):
        problemas.append(
            'escopos: declare os escopos do MCP que o painel usa, com as chaves que `lidere-painel status` mostra. '
            "Quem publica precisa ter esses escopos, e cada tabela das consultas precisa estar neles."
        )
        escopos_brutos = []
    escopos = tuple(dict.fromkeys(e.upper() for e in escopos_brutos))
    dados: dict[str, dict[str, Any]] = {}
    brutos_dados = manifesto.get("dados") or {}
    if not isinstance(brutos_dados, dict) or len(brutos_dados) > 20:
        problemas.append("dados: objeto com ate 20 chaves, ex.: {\"metas\": {\"descricao\": \"Metas do mes\", \"por_empresa\": false}}")
        brutos_dados = {}
    for chave, def_dado in brutos_dados.items():
        if not _RE_ID_CONSULTA.match(str(chave)) or not isinstance(def_dado, dict):
            problemas.append(f"dados: chave '{chave}' invalida (minusculo com _) ou definicao nao e objeto")
            continue
        dados[chave] = {
            "descricao": str(def_dado.get("descricao", "")).strip()[:120],
            "por_empresa": bool(def_dado.get("por_empresa", False)),
        }

    for oficial in ARQUIVOS_DA_PLATAFORMA:
        conteudo_oficial = arquivos.get(oficial)
        if conteudo_oficial is None or hashlib.sha256(conteudo_oficial).hexdigest() not in _hashes_aceitos(oficial):
            problemas.append(
                f"{oficial} ausente ou diferente da versao oficial do focco3i. Nao edite esse arquivo: "
                "rode `lidere-painel atualizar <pasta>` e ponha seu estilo num css proprio."
            )
    indice = arquivos.get("index.html", b"").decode("utf-8", "ignore")
    for referencia in ("portal.css", "painel-runtime.js"):
        if indice and referencia not in indice:
            problemas.append(f"index.html precisa carregar {referencia} (padrao do portal)")

    for nome_arquivo, conteudo in arquivos.items():
        if _RE_TOKEN.search(conteudo):
            problemas.append(f"{nome_arquivo} contem um token do portal (f3i_...). Tire o token do pacote.")
        if nome_arquivo.endswith((".html", ".css", ".js")) and _RE_CDN.search(conteudo.decode("utf-8", "ignore")):
            problemas.append(
                f"{nome_arquivo} carrega recurso externo (http/https). Empacote fontes, scripts e "
                "imagens dentro do zip: o host bloqueia rede externa no painel."
            )

    consultas: dict[str, Consulta] = {}
    brutas = manifesto.get("consultas")
    if not isinstance(brutas, dict) or not brutas:
        problemas.append("consultas: declare ao menos uma consulta")
        brutas = {}
    for consulta_id, bruta in brutas.items():
        onde = f"consulta {consulta_id}"
        if not _RE_ID_CONSULTA.match(consulta_id):
            problemas.append(f"{onde}: id precisa ser minusculo com _ (ex.: mensal)")
            continue
        if not isinstance(bruta, dict):
            problemas.append(f"{onde}: precisa ser objeto")
            continue
        arquivo_sql = bruta.get("arquivo")
        sql = bruta.get("sql")
        if arquivo_sql:
            if arquivo_sql not in arquivos:
                problemas.append(f"{onde}: arquivo {arquivo_sql} nao esta no pacote")
                continue
            sql = arquivos[arquivo_sql].decode("utf-8")
        if not sql:
            problemas.append(f"{onde}: informe 'arquivo' ou 'sql'")
            continue
        parametros = []
        for nome_param, bruto in (bruta.get("parametros") or {}).items():
            if nome_param.lower() in BINDS_RESERVADOS:
                problemas.append(f"{onde}: :{nome_param.lower()} e reservado (o portal preenche com as empresas da sessao), nao declare")
                continue
            param = _parametro(nome_param.lower(), bruto, problemas, onde)
            if param:
                parametros.append(param)
        try:
            validado = _analisar_sql(sql, owners, funcoes_extras, governanca)
        except SqlBloqueado as erro:
            problemas.append(f"{onde}: {erro.motivo}")
            continue
        usados = validado.binds - BINDS_RESERVADOS
        declarados = {p.nome for p in parametros}
        if usados - declarados:
            problemas.append(f"{onde}: bind sem declaracao em parametros: {', '.join(sorted(usados - declarados))}")
        if declarados - usados:
            problemas.append(f"{onde}: parametro declarado e nao usado no SQL: {', '.join(sorted(declarados - usados))}")
        max_linhas = bruta.get("max_linhas", 1000)
        if not isinstance(max_linhas, int) or not 1 <= max_linhas <= 20000:
            problemas.append(f"{onde}: max_linhas entre 1 e 20000")
            max_linhas = 1000
        consultas[consulta_id] = Consulta(
            id=consulta_id,
            sql=sql,
            sql_validado=validado.sql,
            tabelas=validado.tabelas,
            parametros=tuple(parametros),
            max_linhas=max_linhas,
        )

    if problemas:
        raise PacoteInvalido(problemas)
    return Painel(
        id=painel_id,
        nome=nome,
        versao=versao,
        descricao=str(manifesto.get("descricao", "")).strip()[:300],
        menu_grupo=grupo,
        menu_icone=(str(menu["icone"])[:30] if menu.get("icone") else None),
        consultas=consultas,
        arquivos=arquivos,
        escopos=escopos,
        dados=dados,
    )


# --- parametros em tempo de execucao -----------------------------------------------------


def _converter(param: Parametro, valor: Any) -> Any:
    if param.tipo == "inteiro":
        if isinstance(valor, bool) or not isinstance(valor, (int, str)):
            raise ValueError("esperado inteiro")
        numero = int(valor)
    elif param.tipo == "decimal":
        if isinstance(valor, bool) or not isinstance(valor, (int, float, str)):
            raise ValueError("esperado numero")
        numero = float(valor)
    elif param.tipo == "data":
        if not isinstance(valor, str):
            raise ValueError("esperada data AAAA-MM-DD")
        date.fromisoformat(valor)  # valida; vai como texto, o SQL converte o texto AAAA-MM-DD em data
        return valor
    else:
        if not isinstance(valor, (str, int, float)):
            raise ValueError("esperado texto")
        texto = str(valor)
        if len(texto) > 200:
            raise ValueError("texto com mais de 200 caracteres")
        if param.opcoes is not None and texto not in [str(o) for o in param.opcoes]:
            raise ValueError(f"valor fora das opcoes ({', '.join(map(str, param.opcoes))})")
        return texto
    if param.minimo is not None and numero < param.minimo:
        raise ValueError(f"menor que o minimo {param.minimo}")
    if param.maximo is not None and numero > param.maximo:
        raise ValueError(f"maior que o maximo {param.maximo}")
    if param.opcoes is not None and numero not in param.opcoes:
        raise ValueError("valor fora das opcoes")
    return numero


def converter_parametros(consulta: Consulta, recebidos: dict[str, Any] | None) -> dict[str, Any]:
    """Valida e tipa os parametros que vieram do HTML. So passam os declarados no manifesto."""
    recebidos = {str(k).lower(): v for k, v in (recebidos or {}).items()}
    extras = set(recebidos) - {p.nome for p in consulta.parametros}
    if extras:
        raise EntradaInvalida(f"Parametro nao declarado na consulta {consulta.id}: {', '.join(sorted(extras))}.")
    binds: dict[str, Any] = {}
    problemas: list[str] = []
    for param in consulta.parametros:
        valor = recebidos.get(param.nome, param.padrao)
        if valor is None or valor == "":
            if param.obrigatorio:
                problemas.append(f"parametro {param.nome} e obrigatorio")
            binds[param.nome] = None
            continue
        try:
            binds[param.nome] = _converter(param, valor)
        except ValueError as erro:
            problemas.append(f"parametro {param.nome}: {erro}")
    if problemas:
        raise EntradaInvalida("Parametros invalidos: " + "; ".join(problemas) + ".")
    return binds


# --- empacotamento -----------------------------------------------------------------------


def empacotar(painel: Painel, destino: Path) -> Path:
    """Grava `<id>-<versao>.zip` com um MANIFEST.sha256 para o host conferir integridade."""
    destino.mkdir(parents=True, exist_ok=True)
    caminho = destino / f"{painel.id}-{painel.versao}.zip"
    hashes = "\n".join(f"{hashlib.sha256(c).hexdigest()}  {n}" for n, c in sorted(painel.arquivos.items()))
    with zipfile.ZipFile(caminho, "w", zipfile.ZIP_DEFLATED) as pacote:
        for nome, conteudo in sorted(painel.arquivos.items()):
            pacote.writestr(nome, conteudo)
        pacote.writestr("MANIFEST.sha256.txt", hashes + "\n")
    return caminho
