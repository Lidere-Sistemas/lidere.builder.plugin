import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
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
  /** Formata os VALORES no tooltip. */
  formatar?: (valor: number) => string;
  /** Formata o eixo de valor (padrão: `formatar`). Use a versão compacta (R$ 1,2 mi). */
  formatarEixo?: (valor: number) => string;
  /** Uma cor por barra/fatia (vale para uma série só). */
  coresPorPonto?: string[];
  /** Índice da categoria clicada (drill). */
  aoClicar?: (indice: number) => void;
  /** Largura reservada para os rótulos no eixo de categoria em barra horizontal. */
  larguraRotulo?: number;
  /** Mostrar legenda (padrão: quando há mais de uma série). */
  legenda?: boolean;
}

const fmtPadrao = (v: number) => v.toLocaleString('pt-BR');
const textoLegenda = (valor: string) => <span style={{ color: 'var(--muted-foreground)' }}>{valor}</span>;

/** Rótulo de categoria numa linha só, cortado com reticências para caber na largura reservada. */
const RotuloCategoria = ({ x, y, payload, largura }: { x?: number; y?: number; payload?: { value: string }; largura: number }) => {
  const max = Math.max(6, Math.floor(largura / 6.6));
  const texto = String(payload?.value ?? '');
  const curto = texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="var(--muted-foreground)">
      <title>{texto}</title>
      {curto}
    </text>
  );
};

/** Tooltip com a cara do popover do portal. */
const Dica = ({ active, payload, label, formatar }: { active?: boolean; payload?: any[]; label?: string; formatar: (v: number) => string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label !== undefined && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ background: p.payload?.__cor ?? p.color ?? p.fill }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums">{formatar(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
};

/** Gráfico no visual do portal (Recharts): barras, linha, área ou rosca, com cores do tema. */
export const Grafico = ({
  tipo, categorias, series, altura = 300, empilhado, horizontal, formatar, formatarEixo, coresPorPonto, aoClicar, larguraRotulo = 200, legenda
}: Props) => {
  const { cores } = usePainel();
  const fmt = formatar ?? fmtPadrao;
  const fmtEixo = formatarEixo ?? fmt;
  const corDe = (i: number) => series[i]?.cor ?? cores[i % cores.length];
  const dados = useMemo(
    () =>
      categorias.map((categoria, i) => {
        const linha: Record<string, string | number> = { categoria };
        series.forEach((s, j) => (linha[`s${j}`] = s.valores[i] ?? 0));
        if (coresPorPonto?.length) linha.__cor = coresPorPonto[i % coresPorPonto.length];
        return linha;
      }),
    [categorias, series, coresPorPonto]
  );
  const mostrarLegenda = legenda ?? series.length > 1;
  const eixo = { stroke: 'var(--muted-foreground)', fontSize: 12, tickLine: false, axisLine: false } as const;
  const grade = <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={horizontal} horizontal={!horizontal} />;
  const dica = <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<Dica formatar={fmt} />} />;
  const leg = mostrarLegenda ? <Legend verticalAlign="top" align="right" height={32} iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} formatter={textoLegenda} /> : null;
  const clique = aoClicar ? (_: unknown, indice: number) => aoClicar(indice) : undefined;

  if (tipo === 'donut') {
    const valores = series[0]?.valores ?? [];
    const fatias = categorias.map((nome, i) => ({ nome, valor: valores[i] ?? 0, __cor: coresPorPonto?.[i] ?? cores[i % cores.length] }));
    return (
      <div style={{ height: altura }} className="w-full">
        <ResponsiveContainer>
          <PieChart>
            <Tooltip content={<Dica formatar={fmt} />} />
            <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={textoLegenda} />
            <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius="58%" outerRadius="85%" paddingAngle={1} stroke="var(--card)" onClick={clique} isAnimationActive={false}>
              {fatias.map((f) => <Cell key={f.nome} fill={f.__cor} className={aoClicar ? 'cursor-pointer' : undefined} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (tipo === 'bar') {
    return (
      <div style={{ height: altura }} className="w-full">
        <ResponsiveContainer>
          <BarChart data={dados} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 12, right: 16, bottom: 0, left: 4 }} barCategoryGap="22%">
            {grade}
            {horizontal ? (
              <>
                <XAxis type="number" tickFormatter={fmtEixo} {...eixo} />
                <YAxis type="category" dataKey="categoria" width={larguraRotulo} interval={0} {...eixo} tick={<RotuloCategoria largura={larguraRotulo - 8} />} />
              </>
            ) : (
              <>
                <XAxis dataKey="categoria" interval="preserveStartEnd" {...eixo} />
                <YAxis tickFormatter={fmtEixo} width={96} {...eixo} />
              </>
            )}
            {dica}
            {leg}
            {series.map((s, j) => (
              <Bar key={s.nome} dataKey={`s${j}`} name={s.nome} fill={corDe(j)} stackId={empilhado ? 'pilha' : undefined}
                radius={empilhado ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 22 : 56}
                onClick={clique} className={aoClicar ? 'cursor-pointer' : undefined} isAnimationActive={false}>
                {coresPorPonto?.length && series.length === 1 ? dados.map((d) => <Cell key={String(d.categoria)} fill={String(d.__cor)} />) : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const Grafico = tipo === 'area' ? AreaChart : LineChart;
  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer>
        <Grafico data={dados} margin={{ top: 12, right: 16, bottom: 0, left: 4 }}>
          {grade}
          <XAxis dataKey="categoria" interval="preserveStartEnd" {...eixo} />
          <YAxis tickFormatter={fmtEixo} width={96} {...eixo} />
          <Tooltip cursor={{ stroke: 'var(--border)' }} content={<Dica formatar={fmt} />} />
          {leg}
          {series.map((s, j) =>
            tipo === 'area' ? (
              <Area key={s.nome} type="monotone" dataKey={`s${j}`} name={s.nome} stroke={corDe(j)} fill={corDe(j)} fillOpacity={0.15}
                strokeWidth={2} stackId={empilhado ? 'pilha' : undefined} isAnimationActive={false} />
            ) : (
              <Line key={s.nome} type="monotone" dataKey={`s${j}`} name={s.nome} stroke={corDe(j)} strokeWidth={2}
                dot={{ r: 3, fill: corDe(j) }} activeDot={{ r: 5 }} isAnimationActive={false} />
            )
          )}
        </Grafico>
      </ResponsiveContainer>
    </div>
  );
};
