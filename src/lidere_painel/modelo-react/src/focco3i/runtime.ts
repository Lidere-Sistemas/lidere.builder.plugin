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
  entidade?: (entidade: string, operacao: string, entrada?: Record<string, unknown>) => Promise<unknown>;
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

// --- módulo com dados (entidades declaradas no painel.json) ------------------------------

export interface CampoEntidade {
  chave: string;
  tipo: 'texto' | 'texto_longo' | 'inteiro' | 'decimal' | 'data' | 'data_hora' | 'booleano' | 'opcao' | 'referencia';
  rotulo: string;
  obrigatorio: boolean;
  tamanho?: number | null;
  precisao?: number | null;
  escala?: number | null;
  opcoes?: string[] | null;
  /** tipo referencia: entidade apontada (do mesmo módulo). */
  entidade?: string | null;
  /** Opções vindas de uma consulta do painel: 1ª coluna = valor, 2ª = rótulo. */
  consulta?: string | null;
  filtro: boolean;
  padrao?: unknown;
  ajuda?: string | null;
}

export interface DefinicaoEntidade {
  chave: string;
  nome: string;
  pai?: string | null;
  numeracao?: string | null;
  etapas?: { inicial: string; lista: Record<string, string>; transicoes: Record<string, string[]> } | null;
  campos: CampoEntidade[];
}

export interface DefinicaoModulo {
  sigla: string;
  entidades: Record<string, DefinicaoEntidade>;
}

/** Registro como volta do portal: campos + controle (id, numero, etapa, versao, criado_em...). */
export type Registro = Record<string, unknown> & { id: number; versao: number };

export interface Pagina<T = Registro> {
  registros: T[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface ConsultaEntidade {
  /** Igualdade em opção/número/booleano; "contém" em texto; `campo__de`/`campo__ate` para faixa; `q` = busca geral. */
  filtros?: Record<string, unknown>;
  /** "campo" ou "-campo" (decrescente). Padrão: "-id". */
  ordem?: string;
  pagina?: number;
  tamanho?: number;
}

const operar = <T,>(entidade: string, operacao: string, entrada: Record<string, unknown> = {}) => {
  const r = runtime();
  if (!r.entidade) return Promise.reject(new Error('Runtime antigo: rode `lidere-painel atualizar`.'));
  return r.entidade(entidade, operacao, entrada) as Promise<T>;
};

/** CRUD de uma entidade do módulo. O portal grava com a empresa da sessão, valida e audita. */
export const entidade = (nome: string) => ({
  listar: (consulta: ConsultaEntidade = {}) => operar<Pagina>(nome, 'listar', { ...consulta }),
  obter: (id: number) => operar<{ registro: Registro }>(nome, 'obter', { id }).then((r) => r.registro),
  criar: (dados: Record<string, unknown>, paiId?: number) =>
    operar<{ registro: Registro }>(nome, 'criar', { dados, pai_id: paiId }).then((r) => r.registro),
  alterar: (id: number, versao: number, dados: Record<string, unknown>) =>
    operar<{ registro: Registro }>(nome, 'alterar', { id, versao, dados }).then((r) => r.registro),
  mudarEtapa: (id: number, versao: number, etapa: string) =>
    operar<{ registro: Registro }>(nome, 'etapa', { id, versao, etapa }).then((r) => r.registro),
  excluir: (id: number) => operar<{ excluido: number; filhos_excluidos: number }>(nome, 'excluir', { id }),
  historico: (id: number) =>
    operar<{ historico: { operacao: string; usuario: string; data: string; antes: unknown; depois: unknown }[] }>(
      nome, 'historico', { id }
    ).then((r) => r.historico),
});
