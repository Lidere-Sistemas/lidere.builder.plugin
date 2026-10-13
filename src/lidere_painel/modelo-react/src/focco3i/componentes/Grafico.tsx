import { useTheme } from '@mui/material';
import type { ApexOptions } from 'apexcharts';

type ApexXAxis = NonNullable<ApexOptions['xaxis']>;
type ApexYAxis = Exclude<NonNullable<ApexOptions['yaxis']>, unknown[]>;
import { useRef } from 'react';
import Chart from 'react-apexcharts';
import { usePainel } from '../PainelApp';

export interface SerieGrafico {
  nome: string;
  valores: number[];
  cor?: string;
}

interface Props {
  tipo: 'bar' | 'line' | 'area' | 'donut';
  categorias: string[];
  series: SerieGrafico[];
  altura?: number;
  empilhado?: boolean;
  horizontal?: boolean;
  /** Formata os VALORES (eixo de valor e tooltip). Os nomes das categorias nunca passam por aqui. */
  formatar?: (valor: number) => string;
  /** Uma cor por barra/fatia (ex.: faixas de atraso em verde, âmbar e vermelho). Vale para uma série só. */
  coresPorPonto?: string[];
  /** Recebe o índice da categoria clicada. Sempre chama a versão mais recente da função. */
  aoClicar?: (indice: number) => void;
}

/** ApexCharts no visual do portal (mesma lib dos dashboards). Sem toolbar: download não funciona no painel isolado. */
export const Grafico = ({ tipo, categorias, series, altura = 300, empilhado, horizontal, formatar, coresPorPonto, aoClicar }: Props) => {
  const tema = useTheme();
  const { cores } = usePainel();
  // O ApexCharts guarda os eventos do primeiro render: o handler estável lê sempre a função atual.
  const clique = useRef(aoClicar);
  clique.current = aoClicar;
  const fmt = formatar ?? ((v: number) => v.toLocaleString('pt-BR'));
  const corTexto = tema.palette.text.secondary;
  const porPonto = Boolean(coresPorPonto?.length) && tipo !== 'donut';
  const estilo = { style: { colors: corTexto } };
  // O ApexCharts tipa o eixo X com texto e o Y com número: um formatador para cada.
  const valorEmX: ApexXAxis = { labels: { ...estilo, formatter: (v: string) => fmt(Number(v)) } };
  const valorEmY: ApexYAxis = { labels: { ...estilo, formatter: (v: number) => fmt(Number(v)) } };

  const eixos: Pick<ApexOptions, 'labels' | 'xaxis' | 'yaxis'> =
    tipo === 'donut'
      ? { labels: categorias }
      : horizontal
        ? { xaxis: { ...valorEmX, categories: categorias }, yaxis: { labels: estilo } }
        : { xaxis: { categories: categorias, labels: estilo }, yaxis: valorEmY };

  const opcoes: ApexOptions = {
    chart: {
      type: tipo,
      stacked: Boolean(empilhado),
      toolbar: { show: false },
      animations: { enabled: false },
      fontFamily: tema.typography.fontFamily as string,
      // Sempre um objeto: o ApexCharts lê chart.events.beforeMount e quebra com undefined.
      events: {
        dataPointSelection: (_e, _c, cfg) => clique.current?.(cfg.dataPointIndex),
        ...(tipo === 'donut' ? {} : { xAxisLabelClick: (_e, _c, cfg) => clique.current?.(cfg.labelIndex) })
      }
    },
    colors:
      tipo === 'donut' || porPonto
        ? (coresPorPonto?.length ? coresPorPonto : categorias.map((_, i) => cores[i % cores.length]))
        : series.map((s, i) => s.cor ?? cores[i % cores.length]),
    // ApexCharts quebra com chave presente e valor undefined: só inclui o que vale para o tipo.
    // Em barra horizontal o eixo X é o de VALOR e o Y o de categoria.
    ...eixos,
    plotOptions: { bar: { horizontal: Boolean(horizontal), distributed: porPonto, borderRadius: 4, columnWidth: '60%', barHeight: '70%' } },
    dataLabels: { enabled: false },
    grid: { borderColor: tema.palette.grey[100], strokeDashArray: 0 },
    legend: { show: !porPonto, position: 'top', horizontalAlign: 'right', fontSize: '12px' },
    tooltip: { y: { formatter: (v: number) => fmt(Number(v)) } },
    stroke: { width: tipo === 'line' || tipo === 'area' ? 2 : 0 },
    states: { active: { filter: { type: 'none' } } }
  };
  const dadosSerie = tipo === 'donut' ? series[0]?.valores ?? [] : series.map((s) => ({ name: s.nome, data: s.valores }));
  return <Chart type={tipo} height={altura} options={opcoes} series={dadosSerie as ApexOptions['series']} />;
};
