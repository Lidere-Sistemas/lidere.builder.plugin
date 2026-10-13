/** Tipos e acesso ao runtime da plataforma (painel-runtime.js, carregado no index.html). */

export interface ContextoPainel {
  manifesto: unknown;
  tema: 'light' | 'dark';
  usuario: string;
  ambiente: string;
  portal?: { cor_primaria?: string; empresa?: string };
}

export interface ResultadoConsulta<T = Record<string, unknown>> {
  colunas: string[];
  linhas: unknown[][];
  /** Linhas como objetos, com as chaves em minúsculo (alias do SQL). */
  registros: T[];
  total_linhas: number;
  truncado: boolean;
  duracao_ms?: number;
  auditoria_id: string;
  atualizado_em?: string;
}

export type Parametros = Record<string, string | number | null | undefined>;

interface RuntimePainel {
  pronto: () => Promise<ContextoPainel>;
  consultar: (consulta: string, parametros?: Record<string, unknown>) => Promise<ResultadoConsulta>;
  lerDados?: (chave: string) => Promise<unknown>;
  gravarDados?: (chave: string, valor: unknown) => Promise<unknown>;
}

declare global {
  interface Window {
    Painel?: RuntimePainel;
  }
}

const runtime = (): RuntimePainel => {
  if (!window.Painel) {
    throw new Error('painel-runtime.js não foi carregado. Rode `lidere-painel atualizar` e confira o index.html.');
  }
  return window.Painel;
};

export const pronto = () => runtime().pronto();

/** Executa uma consulta DECLARADA no painel.json. Parâmetros vazios não são enviados (chegam como NULL). */
export const consultar = <T = Record<string, unknown>>(consulta: string, parametros: Parametros = {}) => {
  const limpos: Record<string, unknown> = {};
  Object.entries(parametros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') limpos[chave] = valor;
  });
  return runtime().consultar(consulta, limpos) as Promise<ResultadoConsulta<T>>;
};

/** Lê um dado editável do painel (chave declarada em "dados" no painel.json). Volta null se nunca foi gravado. */
export const lerDados = <T = unknown>(chave: string) => {
  const r = runtime();
  if (!r.lerDados) return Promise.reject(new Error('Runtime antigo: rode `lidere-painel atualizar`.'));
  return r.lerDados(chave) as Promise<T | null>;
};

/** Grava um dado editável do painel no portal. Exige permissão de alterar o painel. */
export const gravarDados = <T = unknown>(chave: string, valor: T) => {
  const r = runtime();
  if (!r.gravarDados) return Promise.reject(new Error('Runtime antigo: rode `lidere-painel atualizar`.'));
  return r.gravarDados(chave, valor) as Promise<T>;
};
