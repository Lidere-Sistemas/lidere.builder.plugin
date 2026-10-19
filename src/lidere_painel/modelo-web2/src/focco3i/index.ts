/**
 * SDK de painel do Lidere Builder, padrão visual web2 (React 19 + Tailwind 4 + tokens do portal).
 * Vai junto em cada projeto; atualize com `lidere-painel atualizar`. Não edite: monte a tela em src/.
 */
export { PainelApp, usePainel } from './PainelApp';
export { useConsulta, useDadosPainel, useEntidade } from './hooks';
export type { EstadoConsulta, EstadoDados, EstadoEntidade } from './hooks';
export { exportarExcel, exportarImagem, imprimir } from './exportar';
export type { PlanilhaExcel } from './exportar';
export { consultar, entidade, gravarDados, lerDados } from './runtime';
export type {
  CampoEntidade,
  ConsultaEntidade,
  ContextoPainel,
  DefinicaoEntidade,
  DefinicaoModulo,
  Pagina as PaginaRegistros,
  Parametros,
  Registro,
  ResultadoConsulta
} from './runtime';
export * as fmt from './formato';
export { cn } from './utils';
export * from './ui';
export { Pagina, Cartao, Indicadores, Grade, Coluna, Chips, Campos, Estado, Vazio, Carregando } from './componentes/Layout';
export type { Indicador } from './componentes/Layout';
export { Grafico } from './componentes/Grafico';
export type { SerieGrafico } from './componentes/Grafico';
export { TabelaDados, Paginacao, formatarValor } from './componentes/TabelaDados';
export type { ColunaTabela } from './componentes/TabelaDados';
export { Filtros } from './componentes/Filtros';
export type { CampoFiltro } from './componentes/Filtros';
export { Exportar } from './componentes/Exportar';
export { useImpressao } from './componentes/Impressao';
// Programas especiais (entidades do painel.json)
export { useModulo, BadgeEtapa, plural, textoValor, tituloRegistro } from './programa/comum';
export { ListaRegistros } from './programa/ListaRegistros';
export { FormularioRegistro } from './programa/FormularioRegistro';
export { FichaRegistro } from './programa/FichaRegistro';
export { Etapas } from './programa/Etapas';
export { AcoesFilhas } from './programa/AcoesFilhas';
export { Historico } from './programa/Historico';
export { ProgramaEntidade } from './programa/ProgramaEntidade';
