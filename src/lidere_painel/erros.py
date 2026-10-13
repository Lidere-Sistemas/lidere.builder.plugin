"""Erros da CLI de painel. Mensagens em PT-BR, ditas ao usuário como estão."""


class Focco3iMcpError(Exception):
    """Base de toda falha conhecida."""


class ConfigInvalida(Focco3iMcpError):
    """Configuração ausente ou inconsistente."""


class SqlBloqueado(Focco3iMcpError):
    def __init__(self, motivo: str) -> None:
        self.motivo = motivo
        super().__init__(f"SQL bloqueado pela governanca: {motivo}")


class EntradaInvalida(Focco3iMcpError):
    """Parâmetro fora do aceito."""


class PonteIndisponivel(Focco3iMcpError):
    """Portal inacessível."""
