/** SDK de painel focco3i (React). Vai junto em cada projeto; atualize com `lidere-painel atualizar`. */
export { PainelApp, usePainel } from './PainelApp';
export { useConsulta, useDadosPainel } from './hooks';
export type { EstadoConsulta, EstadoDados } from './hooks';
export { exportarExcel, exportarImagem, imprimir } from './exportar';
export type { PlanilhaExcel } from './exportar';
export { consultar, gravarDados, lerDados } from './runtime';
export type { ContextoPainel, Parametros, ResultadoConsulta } from './runtime';
export * as fmt from './formato';
export { Pagina, Cartao, Indicadores, Grade, Coluna, Chips, Campos, Estado } from './componentes/Layout';
export type { Indicador } from './componentes/Layout';
export { Grafico } from './componentes/Grafico';
export type { SerieGrafico } from './componentes/Grafico';
export { TabelaDados } from './componentes/TabelaDados';
export type { ColunaTabela } from './componentes/TabelaDados';
export { Filtros } from './componentes/Filtros';
export type { CampoFiltro } from './componentes/Filtros';
