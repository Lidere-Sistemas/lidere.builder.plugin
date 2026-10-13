"""lidere-builder: CLI e contrato do painel vivo (focco3i-painel/1), do lado do usuário."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("lidere-builder")
except PackageNotFoundError:  # rodando da fonte sem instalar
    __version__ = "0.0.0"
