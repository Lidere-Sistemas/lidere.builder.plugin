"""Projeto de painel (sempre React + Vite). Monta a pasta que vira o pacote.

O pacote e `build/` (saida do Vite) + painel.json + consultas/. O autor nao mexe nos arquivos
de plataforma: eles ficam em public/ e o Vite copia para o build.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from lidere_painel.pacote import PacoteInvalido

__all__ = [
    "eh_react",
    "conferir_projeto",
    "ARQUIVOS_DE_BUILD",
    "construir",
    "construir_dependencias",
    "montar_area",
    "comando_npm",
    "iniciar_vigia",
    "encerrar_vigia",
    "ErroDeBuild",
    "PLATAFORMA",
    "ESTATICO",
    "MODELO_REACT",
]

ESTATICO = Path(__file__).with_name("estatico")
MODELO_REACT = Path(__file__).with_name("modelo-react")
PLATAFORMA = ("painel-runtime.js", "portal.css", "inter-latin.woff2")
ARQUIVOS_DE_BUILD = ("package.json", "package-lock.json", "vite.config.ts", "tsconfig.json")
"""Configuracao do build: sempre a oficial. O build (tsc + vite) executa o que estiver nela, entao um
projeto adulterado poderia rodar codigo na maquina do usuario. `lidere-painel atualizar` restaura."""
_IGNORAR_NA_VARREDURA = {"node_modules", ".git"}


class ErroDeBuild(PacoteInvalido):
    """Falha ao compilar o projeto React. E um PacoteInvalido: quem mostra erro de pacote mostra este."""

    def __init__(self, mensagem: str) -> None:
        super().__init__([mensagem])


def eh_react(pasta: Path) -> bool:
    return (pasta / "package.json").is_file() and (pasta / "vite.config.ts").is_file()


def _node_embutido() -> tuple[str, str] | None:
    """(node, npm-cli.js) do pacote nodejs-wheel-binaries, que vem junto com a CLI.

    Assim o usuario nao instala Node nem precisa de admin, e no Windows nao existe o
    problema do `npm.cmd` (chamamos `node npm-cli.js`, um executavel de verdade).
    """
    try:
        from nodejs_wheel.executable import ROOT_DIR
    except ImportError:
        return None
    pasta = ROOT_DIR if os.name == "nt" else os.path.join(ROOT_DIR, "bin")
    node = os.path.join(pasta, "node.exe" if os.name == "nt" else "node")
    npm_cli = os.path.join(ROOT_DIR, "lib", "node_modules", "npm", "bin", "npm-cli.js")
    if not (os.path.isfile(node) and os.path.isfile(npm_cli)):
        return None
    return node, npm_cli


def _ambiente_node(node: str | None) -> dict[str, str]:
    """PATH com a pasta do node na frente: os atalhos de node_modules/.bin (tsc, vite) chamam `node`.
    Sem as variaveis de login do portal: o build nao precisa delas."""
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith(("LIDERE_", "FOCCO3I_"))}
    if node:
        env["PATH"] = os.path.dirname(node) + os.pathsep + env.get("PATH", "")
    return env


def comando_npm() -> tuple[list[str], dict[str, str]]:
    """Comando base do npm e o ambiente para rodar. Prefere o Node embutido; senao, o npm do sistema."""
    embutido = _node_embutido()
    if embutido is not None:
        return list(embutido), _ambiente_node(embutido[0])
    npm = shutil.which("npm")  # no Windows devolve o npm.cmd com caminho completo
    if npm is None:
        raise ErroDeBuild("Node.js nao encontrado. Reinstale a CLI do Lidere Builder (ela traz o Node junto).")
    return [npm], _ambiente_node(None)


def _sem_janela() -> int:
    return getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0


_ARGS_VIGIA = ("build", "--watch", "--emptyOutDir", "false")


def iniciar_vigia(pasta: Path) -> subprocess.Popen:
    """Vite em modo watch, chamado direto (sem npm/cmd no meio) e num grupo de processos proprio.

    `--emptyOutDir false`: o `construir` acabou de gerar o build/, e o watch nao pode apaga-lo antes de
    recompilar. Senao a pre-visualizacao abre (ou recarrega) no meio e mostra "Projeto React sem build/".
    """
    embutido = _node_embutido()
    vite = (pasta / "node_modules" / "vite" / "bin" / "vite.js").resolve()
    if embutido is not None and vite.is_file():
        cmd, env = [embutido[0], str(vite), *_ARGS_VIGIA], _ambiente_node(embutido[0])
    else:
        base, env = comando_npm()
        cmd = [*base, "exec", "--", "vite", *_ARGS_VIGIA]
    if sys.platform == "win32":
        opcoes = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP | _sem_janela()}
    else:
        opcoes = {"start_new_session": True}
    return subprocess.Popen(cmd, cwd=pasta, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, **opcoes)


def encerrar_vigia(vigia: subprocess.Popen) -> None:
    """Encerra o Vite e os filhos. `terminate` sozinho deixaria processo orfao no Windows."""
    if vigia.poll() is not None:
        return
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/PID", str(vigia.pid), "/T", "/F"], capture_output=True, creationflags=_sem_janela())
    else:
        import signal

        try:
            os.killpg(vigia.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
    try:
        vigia.wait(timeout=5)
    except subprocess.TimeoutExpired:
        vigia.kill()


def _npm(pasta: Path, *args: str) -> None:
    base, env = comando_npm()
    resultado = subprocess.run(
        [*base, *args], cwd=pasta, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace",
        creationflags=_sem_janela(),
    )
    if resultado.returncode != 0:
        saida = (resultado.stdout + resultado.stderr).strip().splitlines()
        raise ErroDeBuild("Falha em `npm " + " ".join(args) + "`:\n" + "\n".join(saida[-25:]))


def conferir_projeto(pasta: Path) -> None:
    """Antes de qualquer build ou copia: sem link simbolico/junction e com a configuracao de build oficial."""
    raiz = pasta.resolve()
    pendentes = [pasta]
    while pendentes:
        atual = pendentes.pop()
        for item in atual.iterdir():
            junction = getattr(item, "is_junction", lambda: False)()
            if item.is_symlink() or junction or not item.resolve().is_relative_to(raiz):
                raise ErroDeBuild(
                    f"{item.relative_to(pasta).as_posix()}: link simbolico ou atalho para fora da pasta nao e aceito no painel."
                )
            if item.is_dir() and item.name not in _IGNORAR_NA_VARREDURA:
                pendentes.append(item)
    if not eh_react(pasta):
        raise ErroDeBuild(f"{pasta} nao e um painel React (falta package.json ou vite.config.ts). Crie com `lidere-painel novo <pasta>`.")
    if (pasta / "vite.config.js").exists():
        raise ErroDeBuild("vite.config.js nao e aceito: o painel usa o vite.config.ts oficial. Rode `lidere-painel atualizar <pasta>`.")
    diferentes = [
        nome for nome in ARQUIVOS_DE_BUILD
        if not (pasta / nome).is_file() or (pasta / nome).read_bytes() != (MODELO_REACT / nome).read_bytes()
    ]
    if diferentes:
        raise ErroDeBuild(
            f"Configuracao de build diferente da oficial ({', '.join(diferentes)}). Ela roda codigo na sua maquina, "
            "por isso so a oficial e aceita: rode `lidere-painel atualizar <pasta>`."
        )


def construir_dependencias(pasta: Path) -> None:
    """`npm ci` pelo lock oficial (versoes e hashes travados), sem scripts de instalacao de pacote.
    Reinstala quando o lock muda (ex.: depois de `lidere-painel atualizar`)."""
    conferir_projeto(pasta)
    modulos = pasta / "node_modules"
    marca = modulos / ".lidere-lock"
    lock = hashlib.sha256((pasta / "package-lock.json").read_bytes()).hexdigest()
    if modulos.is_dir() and marca.is_file() and marca.read_text().strip() == lock:
        return
    if modulos.exists():
        shutil.rmtree(modulos)
    _npm(pasta, "ci", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error")
    marca.write_text(lock)


def construir(pasta: Path) -> None:
    """npm install (se faltar) + npm run build (tsc --noEmit && vite build)."""
    construir_dependencias(pasta)
    _npm(pasta, "run", "build")


def montar_area(pasta: Path, destino: Path | None = None) -> Path:
    """Monta numa pasta temporaria o conteudo do pacote: build/ + painel.json + consultas/."""
    conferir_projeto(pasta)
    build = pasta / "build"
    if not (build / "index.html").is_file():
        raise ErroDeBuild("Projeto React sem build/. Rode `lidere-painel validar` ou `empacotar`, que compilam.")
    # Pasta fixa por projeto: a pre-visualizacao remonta a cada requisicao sem acumular lixo.
    area = destino or Path(tempfile.gettempdir()) / f"focco3i-painel-{hashlib.sha1(str(pasta.resolve()).encode()).hexdigest()[:10]}"
    if area.exists():
        shutil.rmtree(area)
    # symlinks=True: link nunca vira arquivo na copia (o contrato recusa link).
    shutil.copytree(build, area, symlinks=True)
    shutil.copy2(pasta / "painel.json", area / "painel.json", follow_symlinks=False)
    if (pasta / "consultas").is_dir():
        shutil.copytree(pasta / "consultas", area / "consultas", symlinks=True)
    return area
