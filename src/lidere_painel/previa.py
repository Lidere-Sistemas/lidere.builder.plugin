"""Controle da pre-visualizacao (`lidere-painel servir`): uma por porta, a nova derruba a anterior.

Fluxo de teste do usuario antes de subir para o portal: `servir` (testa gravando e consultando de verdade)
-> "terminou?" -> `parar` -> `empacotar`/`publicar`. Cada `servir` registra o processo dele (e o do
recompilador) em ~/.lidere-builder/previas.json. Ao subir de novo na mesma porta, a pre-visualizacao
anterior registrada ali e encerrada. Porta ocupada por OUTRO programa nunca e derrubada: avisa e para.
"""

from __future__ import annotations

import json
import os
import signal
import socket
import sys
import time
from pathlib import Path

ARQUIVO = Path.home() / ".lidere-builder" / "previas.json"


def porta_ocupada(porta: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", porta)) == 0


def _ler() -> dict[str, dict]:
    try:
        return json.loads(ARQUIVO.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _gravar(dados: dict[str, dict]) -> None:
    ARQUIVO.parent.mkdir(parents=True, exist_ok=True)
    ARQUIVO.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")


def _vivo(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform == "win32":
        import ctypes  # noqa: PLC0415

        alca = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not alca:
            return False
        codigo = ctypes.c_ulong()
        ctypes.windll.kernel32.GetExitCodeProcess(alca, ctypes.byref(codigo))
        ctypes.windll.kernel32.CloseHandle(alca)
        return codigo.value == 259  # STILL_ACTIVE
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _encerrar(pid: int, grupo: bool = False) -> None:
    if not _vivo(pid):
        return
    try:
        if sys.platform == "win32":
            os.kill(pid, signal.SIGTERM)  # TerminateProcess
        elif grupo:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        else:
            os.kill(pid, signal.SIGTERM)
    except OSError:
        pass


def registrar(porta: int, pasta: Path, vigia_pid: int | None) -> None:
    dados = _ler()
    dados[str(porta)] = {"pid": os.getpid(), "vigia": vigia_pid, "pasta": str(pasta), "inicio": time.strftime("%d/%m/%Y %H:%M:%S")}
    _gravar(dados)


def esquecer(porta: int) -> None:
    dados = _ler()
    if dados.get(str(porta), {}).get("pid") == os.getpid():
        dados.pop(str(porta), None)
        _gravar(dados)


def parar(porta: int, espera_s: float = 8.0) -> str | None:
    """Encerra a pre-visualizacao registrada nesta porta. Devolve a pasta dela (ou None se nao havia)."""
    dados = _ler()
    registro = dados.pop(str(porta), None)
    _gravar(dados)
    if not registro:
        return None
    if registro.get("vigia"):
        _encerrar(int(registro["vigia"]), grupo=True)
    _encerrar(int(registro.get("pid") or 0))
    limite = time.monotonic() + espera_s
    while porta_ocupada(porta) and time.monotonic() < limite:
        time.sleep(0.2)
    return registro.get("pasta")


def liberar(porta: int) -> tuple[bool, str]:
    """Antes de subir: derruba a pre-visualizacao anterior NOSSA nesta porta. (ok, mensagem)."""
    anterior = parar(porta)
    if porta_ocupada(porta):
        return False, (
            f"A porta {porta} esta ocupada por outro programa (nao e uma pre-visualizacao do Lidere Builder). "
            f"Use outra porta: lidere-painel servir <pasta> --porta {porta + 1}"
        )
    if anterior:
        return True, f"Pre-visualizacao anterior ({anterior}) encerrada."
    return True, ""


def listar() -> dict[str, dict]:
    """Pre-visualizacoes registradas que ainda estao no ar (limpa as que morreram)."""
    dados = {p: r for p, r in _ler().items() if _vivo(int(r.get("pid") or 0))}
    _gravar(dados)
    return dados
