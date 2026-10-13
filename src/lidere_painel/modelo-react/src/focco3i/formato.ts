/** Formatação pt-BR padrão do portal: dd/mm/aaaa, R$, milhar com ponto. */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const moeda = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '–';

export const numero = (v: unknown, casas = 0) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : '–';

export const quantidade = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : '–';

export const milhoes = (v: unknown) =>
  typeof v === 'number' ? `${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi` : '–';

/** "2026-07-23" ou "2026-07-23 10:00:00" -> "23/07/2026". */
export const data = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 10) return '–';
  const [a, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** "2026-07" -> "jul/26". */
export const mes = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 7) return '–';
  const [a, m] = v.split('-');
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
};

export const percentual = (v: unknown, casas = 1) =>
  typeof v === 'number' ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%` : '–';
