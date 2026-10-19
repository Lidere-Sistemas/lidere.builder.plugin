import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConsultaEntidade,
  consultar,
  entidade,
  gravarDados,
  lerDados,
  Pagina,
  Parametros,
  Registro,
  ResultadoConsulta
} from './runtime';

export interface EstadoConsulta<T> {
  dados: T[];
  resultado: ResultadoConsulta<T> | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Executa uma consulta declarada no painel.json e acompanha os parâmetros.
 * `habilitada: false` segura a consulta (ex.: drill que só roda quando o usuário clica).
 */
export function useConsulta<T = Record<string, unknown>>(
  consulta: string,
  parametros: Parametros = {},
  opcoes: { habilitada?: boolean } = {}
): EstadoConsulta<T> {
  const { habilitada = true } = opcoes;
  const chave = JSON.stringify(parametros);
  const [resultado, setResultado] = useState<ResultadoConsulta<T> | null>(null);
  const [carregando, setCarregando] = useState(habilitada);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const ultima = useRef(0);

  useEffect(() => {
    if (!habilitada) {
      setCarregando(false);
      return;
    }
    const id = ++ultima.current;
    setCarregando(true);
    setErro(null);
    consultar<T>(consulta, JSON.parse(chave))
      .then((r) => id === ultima.current && setResultado(r))
      .catch((e: Error) => id === ultima.current && setErro(e.message || 'Falha ao consultar o ERP.'))
      .finally(() => id === ultima.current && setCarregando(false));
  }, [consulta, chave, habilitada, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados: resultado?.registros ?? [], resultado, carregando, erro, recarregar };
}

export interface EstadoDados<T> {
  valor: T;
  carregando: boolean;
  gravando: boolean;
  erro: string | null;
  gravar: (novo: T) => Promise<void>;
}

/**
 * Dado editável do painel guardado no portal (metas, feriados, parâmetros do usuário).
 * `padrao` vale enquanto nada foi gravado. Quem não tem permissão de alterar recebe erro ao gravar.
 */
export function useDadosPainel<T>(chave: string, padrao: T): EstadoDados<T> {
  const [valor, setValor] = useState<T>(padrao);
  const [carregando, setCarregando] = useState(true);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    lerDados<T>(chave)
      .then((v) => ativo && v !== null && v !== undefined && setValor(v))
      .catch((e) => ativo && setErro(String(e?.message || e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [chave]);

  const gravar = useCallback(
    async (novo: T) => {
      setGravando(true);
      setErro(null);
      try {
        setValor((await gravarDados<T>(chave, novo)) ?? novo);
      } catch (e: any) {
        setErro(String(e?.message || e));
        throw e;
      } finally {
        setGravando(false);
      }
    },
    [chave]
  );

  return { valor, carregando, gravando, erro, gravar };
}

export interface EstadoEntidade {
  registros: Registro[];
  total: number;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Lista os registros de uma entidade do módulo (portal filtra pela empresa da sessão).
 * Volta a buscar quando filtros/ordem mudam ou quando `recarregar()` é chamado (depois de gravar).
 */
export function useEntidade(nome: string, consulta: ConsultaEntidade = {}, opcoes: { habilitada?: boolean } = {}): EstadoEntidade {
  const { habilitada = true } = opcoes;
  const chave = JSON.stringify(consulta);
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [carregando, setCarregando] = useState(habilitada);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const ultima = useRef(0);

  useEffect(() => {
    if (!habilitada) {
      setCarregando(false);
      return;
    }
    const id = ++ultima.current;
    setCarregando(true);
    setErro(null);
    entidade(nome)
      .listar(JSON.parse(chave))
      .then((r) => id === ultima.current && setPagina(r))
      .catch((e: Error) => id === ultima.current && setErro(e.message || 'Falha ao ler os registros.'))
      .finally(() => id === ultima.current && setCarregando(false));
  }, [nome, chave, habilitada, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { registros: pagina?.registros ?? [], total: pagina?.total ?? 0, carregando, erro, recarregar };
}
