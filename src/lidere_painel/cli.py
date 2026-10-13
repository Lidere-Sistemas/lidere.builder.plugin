"""CLI `lidere-painel`: criar, ver ao vivo, validar e empacotar um painel.

    lidere-painel novo <pasta>           cria o painel (React + TypeScript com o SDK do portal)
    lidere-painel atualizar <pasta>     poe runtime, portal.css e fonte na versao oficial
    lidere-painel servir <pasta>        abre a pre-visualizacao ao vivo em 127.0.0.1
    lidere-painel validar <pasta>       confere o contrato e roda cada consulta uma vez
    lidere-painel empacotar <pasta>     valida e gera dist/<id>-<versao>.zip

Fala com o PORTAL usando o token pessoal do usuario (`lidere-painel configurar`):
mesmo guard, mesmos escopos e mesma auditoria do portal. Nao tem senha de banco.
"""

from __future__ import annotations

import argparse
import asyncio
import shutil
import subprocess
import sys
import webbrowser
from pathlib import Path

from lidere_painel import __version__
from lidere_painel.config import Config, salvar
from lidere_painel.erros import Focco3iMcpError
from lidere_painel.pacote import Painel, PacoteInvalido, carregar_pasta, converter_parametros, empacotar, versao_tupla
from lidere_painel.portal import PortalCliente, PortalExecutor

NIVEL_CONSULTA = 2
from lidere_painel.projeto import (
    ARQUIVOS_DE_BUILD,
    MODELO_REACT,
    ErroDeBuild,
    construir,
    construir_dependencias,
    encerrar_vigia,
    iniciar_vigia,
    montar_area,
)

_PAINEL = Path(__file__).parent
_ESTATICO = _PAINEL / "estatico"
_PLATAFORMA = ("painel-runtime.js", "portal.css", "inter-latin.woff2")


def _novo(pasta: Path) -> int:
    """Painel novo, sempre React + TypeScript com o SDK do portal."""
    if pasta.exists() and any(pasta.iterdir()):
        print(f"{pasta} ja existe e nao esta vazia.", file=sys.stderr)
        return 1
    shutil.copytree(MODELO_REACT, pasta, dirs_exist_ok=True, ignore=shutil.ignore_patterns("node_modules", "build"))
    _atualizar(pasta, silencioso=True)
    print("Instalando dependencias...")
    try:
        construir_dependencias(pasta)
    except ErroDeBuild as erro:
        print(str(erro), file=sys.stderr)
        return 1
    print(f"Painel criado em {pasta}.")
    print("Edite painel.json, consultas/*.sql e src/Painel.tsx (componentes em src/focco3i).")
    print(f"Ver ao vivo: lidere-painel servir {pasta}")
    return 0


def _atualizar(pasta: Path, silencioso: bool = False) -> int:
    """Poe os arquivos da plataforma, o SDK e a configuracao de build na versao oficial."""
    if not (pasta / "painel.json").is_file() or not (pasta / "src").is_dir():
        print(f"{pasta} nao e um painel (falta painel.json ou src/). Crie com `lidere-painel novo <pasta>`.", file=sys.stderr)
        return 1
    publico = pasta / "public"
    publico.mkdir(exist_ok=True)
    for nome in _PLATAFORMA:
        shutil.copy2(_ESTATICO / nome, publico / nome)
    sdk = pasta / "src" / "focco3i"
    if sdk.exists():
        shutil.rmtree(sdk)
    shutil.copytree(MODELO_REACT / "src" / "focco3i", sdk)
    # Configuracao de build oficial: o build executa o que estiver nela (ver conferir_projeto).
    for nome in ARQUIVOS_DE_BUILD:
        shutil.copy2(MODELO_REACT / nome, pasta / nome)
    solto = pasta / "vite.config.js"
    if solto.exists():
        solto.unlink()
    if not silencioso:
        print(f"Arquivos da plataforma, SDK (src/focco3i) e configuracao de build atualizados em {pasta}.")
    return 0


async def _executar_consultas(painel: Painel, config: Config) -> list[str]:
    """Roda cada consulta com os parametros padrao. Devolve os problemas."""
    executor = PortalExecutor(PortalCliente(config))  # valida pelo portal, como o usuario, nos escopos dele
    problemas = []
    try:
        for consulta in painel.consultas.values():
            # Parametro com `exemplo` (ex.: o id de um registro no drill) e exercitado com ele.
            exemplos = {p.nome: p.exemplo for p in consulta.parametros if p.exemplo is not None}
            sem_valor = [
                p.nome for p in consulta.parametros if p.obrigatorio and p.padrao is None and p.nome not in exemplos
            ]
            if sem_valor:
                print(
                    f"  {consulta.id}: PULADA, parametro obrigatorio sem padrao nem exemplo: {', '.join(sem_valor)}. "
                    'Declare "exemplo" no painel.json para o validar testar esta consulta.'
                )
                continue
            try:
                binds = converter_parametros(consulta, exemplos)
                dados = await executor.ler(
                    ferramenta=f"painel:{painel.id}/{consulta.id}:validar",
                    nivel=NIVEL_CONSULTA,
                    sql=consulta.sql,
                    binds=binds,
                    max_linhas=consulta.max_linhas,
                )
                aviso = "  (CORTADO no max_linhas)" if dados["truncado"] else ""
                com = f" (com {exemplos})" if exemplos else ""
                print(f"  {consulta.id}: ok{com}, {dados['total_linhas']} linhas em {dados['duracao_ms']} ms{aviso}")
            except Focco3iMcpError as erro:
                problemas.append(f"{consulta.id}: {erro}")
                print(f"  {consulta.id}: FALHOU")
    finally:
        pass
    return problemas


def _carregar(pasta: Path, config: Config) -> Painel | None:
    try:
        print("Compilando o painel (tsc + vite build)...")
        construir(pasta)
        painel = carregar_pasta(montar_area(pasta), config.owners, config.funcoes_extras, governanca=False)
    except ErroDeBuild as erro:
        print(str(erro), file=sys.stderr)
        return None
    except PacoteInvalido as erro:
        print(str(erro), file=sys.stderr)
        return None
    print(f"Contrato ok: {painel.nome} v{painel.versao}, {len(painel.consultas)} consulta(s), {len(painel.arquivos)} arquivo(s).")
    return painel


async def _conferir_escopos(painel: Painel, config: Config) -> list[str]:
    """O mesmo que o portal confere no upload: escopos seus, e cada tabela dentro deles."""
    from fnmatch import fnmatchcase

    eu = await PortalCliente(config).quem_sou()
    meus = {e["chave"]: e for e in eu.get("escopos", [])}
    problemas = [
        f"escopo {e} declarado no painel.json, mas voce nao tem (seus: {', '.join(meus) or 'nenhum'})"
        for e in painel.escopos
        if e not in meus
    ]
    padroes = list(eu.get("tabelas_comuns", []))
    for e in painel.escopos:
        padroes += meus.get(e, {}).get("tabelas", [])
    for consulta in painel.consultas.values():
        fora = [t for t in consulta.tabelas if not any(fnmatchcase(t, p) for p in padroes)]
        if fora:
            problemas.append(
                f"consulta {consulta.id}: {', '.join(fora)} fora dos escopos declarados ({', '.join(painel.escopos)})"
            )
    return problemas


def _validar(pasta: Path, config: Config, sem_banco: bool) -> Painel | None:
    painel = _carregar(pasta, config)
    if painel is None:
        return None
    if sem_banco:
        return painel
    try:
        problemas = asyncio.run(_conferir_escopos(painel, config))
    except Focco3iMcpError as erro:
        print(str(erro), file=sys.stderr)
        return None
    if problemas:
        print("\n".join(problemas), file=sys.stderr)
        return None
    print("Rodando cada consulta na base, com os parametros padrao:")
    problemas = asyncio.run(_executar_consultas(painel, config))
    if problemas:
        print("\n".join(problemas), file=sys.stderr)
        return None
    return painel


def _mostrar_arquivo(arquivo: Path) -> None:
    """Abre o gerenciador de arquivos com o arquivo selecionado (Explorer, Finder ou a pasta no Linux)."""
    arquivo = arquivo.resolve()
    if sys.platform == "win32":
        # String, não lista: o Explorer não entende o argumento inteiro entre aspas ("/select,C:\a b\x.zip").
        subprocess.run(f'explorer /select,"{arquivo}"')
    elif sys.platform == "darwin":
        subprocess.run(["open", "-R", str(arquivo)])
    else:
        webbrowser.open(arquivo.parent.as_uri())


def _aviso_versao(esperada: str | None) -> str:
    """Texto que o hook de inicio de sessao injeta no contexto do Claude. Sempre sai com codigo 0."""
    if not esperada or esperada == __version__:
        return f"Lidere Builder: CLI lidere-painel {__version__} pronta."
    instalar = f"uv tool install --force git+https://github.com/Lidere-Sistemas/lidere.builder.plugin@v{esperada}"
    try:
        cli_antiga = versao_tupla(__version__) < versao_tupla(esperada)
    except ValueError:
        cli_antiga = True
    if cli_antiga:
        return (
            f"ATENCAO Lidere Builder: a CLI lidere-painel instalada e a {__version__}, mas o plugin e o {esperada}. "
            f"Antes de qualquer painel, atualize a CLI com `{instalar}` (o uv fica na pasta de programas do usuario; "
            "veja a skill instalar) e confira com `lidere-painel --version`. Nao monte painel com a CLI antiga."
        )
    return (
        f"ATENCAO Lidere Builder: a CLI lidere-painel {__version__} e mais nova que o plugin {esperada}. "
        "Peca ao usuario para atualizar o plugin (no terminal: `claude plugin update lidere-builder@lidere`) e reabrir o app."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lidere-painel", description="Paineis vivos sobre o ERP, publicados no portal.")
    parser.add_argument("--version", action="version", version=f"lidere-painel {__version__}")
    sub = parser.add_subparsers(dest="comando", required=True)
    p_novo = sub.add_parser("novo", help="cria um painel a partir do modelo")
    p_novo.add_argument("pasta", type=Path)
    p_novo.add_argument("--react", action="store_true", help=argparse.SUPPRESS)  # aceito por compatibilidade: sempre React
    p_atu = sub.add_parser("atualizar", help="atualiza runtime, portal.css e fonte para a versao oficial")
    p_atu.add_argument("pasta", type=Path)
    p_servir = sub.add_parser("servir", help="pre-visualizacao ao vivo")
    p_servir.add_argument("pasta", type=Path)
    p_servir.add_argument("--porta", type=int, default=8765)
    p_servir.add_argument("--sem-navegador", action="store_true")
    p_val = sub.add_parser("validar", help="confere o contrato e roda as consultas")
    p_val.add_argument("pasta", type=Path)
    p_val.add_argument("--sem-banco", action="store_true", help="so o contrato, sem executar")
    p_emp = sub.add_parser("empacotar", help="valida e gera o .zip para o portal")
    p_emp.add_argument("pasta", type=Path)
    p_emp.add_argument("--destino", type=Path, default=None)
    p_emp.add_argument("--mostrar", action="store_true", help="abre a pasta do zip com o arquivo selecionado")
    p_pub = sub.add_parser("publicar", help="valida, empacota e publica no portal (deploy)")
    p_pub.add_argument("pasta", type=Path)
    p_ent = sub.add_parser("entrar", help="login no portal pelo navegador (o mesmo login do Claude)")
    p_ent.add_argument("--mcp", help="endereco do MCP do portal (ex.: https://mcp.cliente.com.br/mcp)")
    p_conf = sub.add_parser("configurar", help="grava URL do portal e token pessoal (~/.lidere-builder/config.json)")
    p_conf.add_argument("--url", help="URL da API do portal (ex.: https://portal.cliente.com.br/api)")
    p_conf.add_argument("--cor", help="cor primaria da empresa para a pre-visualizacao (main_color)")
    sub.add_parser("status", help="mostra com quem e em que escopos a CLI esta conectada")
    p_ver = sub.add_parser("versao", help="confere se a CLI tem a versao do plugin (usado pelo hook de inicio de sessao)")
    p_ver.add_argument("--esperada", help="versao do plugin instalado (ex.: 0.2.1)")
    args = parser.parse_args(argv)

    if args.comando == "versao":
        print(_aviso_versao(args.esperada))
        return 0

    if args.comando == "configurar":
        import getpass

        url = args.url or input("URL da API do portal: ").strip()
        token = getpass.getpass("Token do MCP (f3i_..., gerado em MCP > Meus tokens do MCP): ").strip()
        try:
            arquivo = salvar(url, token, args.cor)
        except Focco3iMcpError as erro:
            print(str(erro), file=sys.stderr)
            return 1
        print(f"Configuracao salva em {arquivo} (so voce le). Teste com: lidere-painel status")
        return 0

    if args.comando == "entrar":
        from lidere_painel.config import mcp_salvo, url_aceitavel
        from lidere_painel.login import ErroDeLogin, entrar

        mcp_url = args.mcp or mcp_salvo()
        if not mcp_url:
            print("Informe o endereco do MCP do portal: lidere-painel entrar --mcp <endereco>", file=sys.stderr)
            return 1
        if not url_aceitavel(mcp_url):
            print(f"O endereco do MCP precisa ser https:// ({mcp_url}).", file=sys.stderr)
            return 1
        print("Abrindo o navegador para voce autorizar no portal...")
        try:
            portal_url, token = entrar(mcp_url)
        except ErroDeLogin as erro:
            print(str(erro), file=sys.stderr)
            return 1
        try:
            # Confere com o token recebido (não o do ambiente) antes de dar o login por feito.
            eu = asyncio.run(PortalCliente(Config(portal_url=portal_url, portal_token=token)).quem_sou())
        except Focco3iMcpError as erro:
            print(f"Login feito, mas o portal nao respondeu em {portal_url}: {erro}", file=sys.stderr)
            print("Nada foi salvo. Fale com a Lidere se continuar.", file=sys.stderr)
            return 1
        salvar(portal_url, token, mcp_url=mcp_url)
        print(f"Conectado ao portal como {eu['usuario']}.")
        return 0

    if args.comando == "novo":
        return _novo(args.pasta)
    if args.comando == "atualizar":
        return _atualizar(args.pasta)

    try:
        config = Config.de_ambiente()
    except Focco3iMcpError as erro:
        print(f"Configuracao invalida: {erro}", file=sys.stderr)
        return 1

    if args.comando == "status":
        try:
            eu = asyncio.run(PortalCliente(config).quem_sou())
        except Focco3iMcpError as erro:
            print(str(erro), file=sys.stderr)
            return 1
        print(f"Conectado a {config.portal_url} como {eu['usuario']} (empresa {eu['empresa_id']}).")
        print("Escopos (use a chave no painel.json):")
        for e in eu["escopos"]:
            print(f"  {e['chave']}  {e['nome']}")
        if not eu["escopos"]:
            print("  nenhum")
        return 0

    if args.comando == "servir":
        import uvicorn

        from lidere_painel.servidor_dev import criar_app

        print("Compilando o painel...")
        try:
            construir(args.pasta)
            vigia = iniciar_vigia(args.pasta)
        except ErroDeBuild as erro:
            print(str(erro), file=sys.stderr)
            return 1
        print("Recompilando a cada alteracao em src/ (vite build --watch).")
        url = f"http://127.0.0.1:{args.porta}/"
        print(f"Pre-visualizacao em {url} (Ctrl+C para sair). Base: {config.ambiente}.")
        if not args.sem_navegador:
            webbrowser.open(url)
        try:
            uvicorn.run(criar_app(args.pasta.resolve(), config, args.porta), host="127.0.0.1", port=args.porta, log_level="warning")
        finally:
            if vigia is not None:
                encerrar_vigia(vigia)
        return 0

    if args.comando == "validar":
        return 0 if _validar(args.pasta, config, args.sem_banco) else 1

    painel = _validar(args.pasta, config, sem_banco=False)
    if painel is None:
        print("Nada foi empacotado.", file=sys.stderr)
        return 1
    zip_path = empacotar(painel, getattr(args, "destino", None) or args.pasta.parent / "dist", versao_cli=__version__)
    print(f"Pacote gerado: {zip_path}")
    if getattr(args, "mostrar", False):
        _mostrar_arquivo(zip_path)
    if args.comando == "publicar":
        try:
            r = asyncio.run(PortalCliente(config).publicar_painel(zip_path))
        except Focco3iMcpError as erro:
            print(f"O portal recusou a publicacao: {erro}", file=sys.stderr)
            return 1
        print(f"Publicado no portal: {r['nome']} v{r['versao']} ({r['status']}).")
        print(f"Abra em: {r['url']}")
        return 0
    print("Suba esse arquivo em Paineis > Cadastrar no portal.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
