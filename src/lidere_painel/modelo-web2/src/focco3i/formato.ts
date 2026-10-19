/** Formatação pt-BR padrão do portal: dd/mm/aaaa, R$, milhar com ponto, vírgula decimal. */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const moeda = (v: unknown) =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '–';

export const numero = (v: unknown, casas = 0) =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : '–';

export const quantidade = (v: unknown) =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : '–';

/** R$ 1,23 mi / R$ 456,7 mil: para KPI e eixo de gráfico. */
export const moedaCompacta = (v: unknown) => {
  if (!ehNumero(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${(v / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bi`;
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return moeda(v);
};

/** Eixo de gráfico: R$ 10 mi, R$ 2,5 mi, R$ 900 mil (no máximo uma casa). */
export const moedaEixo = (v: unknown) => {
  if (!ehNumero(v)) return '–';
  const a = Math.abs(v);
  const n = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (a >= 1e9) return `R$ ${n(v / 1e9)} bi`;
  if (a >= 1e6) return `R$ ${n(v / 1e6)} mi`;
  if (a >= 1e3) return `R$ ${n(v / 1e3)} mil`;
  return `R$ ${n(v)}`;
};

export const milhoes = (v: unknown) =>
  ehNumero(v) ? `${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi` : '–';

/** "2026-07-23" ou "2026-07-23 10:00:00" -> "23/07/2026". */
export const data = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 10) return '–';
  const [a, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** "2026-07-23 14:05:00" ou ISO -> "23/07/2026 14:05" (24h). */
export const dataHora = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 10) return '–';
  const [dia, hora] = v.replace('T', ' ').split(' ');
  return `${data(dia)}${hora ? ` ${hora.slice(0, 5)}` : ''}`;
};

/** "2026-07" -> "jul/26". */
export const mes = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 7) return '–';
  const [a, m] = v.split('-');
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
};

/** "2026-07" -> "julho de 2026". */
export const mesLongo = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 7) return '–';
  const [a, m] = v.split('-');
  return `${MESES_LONGOS[Number(m) - 1]} de ${a}`;
};

export const percentual = (v: unknown, casas = 1) =>
  ehNumero(v) ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%` : '–';

/** Hora de agora, 24h: "14:05". */
export const horaAgora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
