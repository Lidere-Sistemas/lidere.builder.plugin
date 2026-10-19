import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Fragment, ReactNode, useMemo, useState } from 'react';
import * as fmt from '../formato';
import { Button, Input, Select, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui';
import { cn } from '../utils';

export interface ColunaTabela<T> {
  campo: keyof T & string;
  titulo: string;
  tipo?: 'texto' | 'numero' | 'quantidade' | 'moeda' | 'data' | 'data_hora' | 'percentual' | 'mes';
  /** Render customizado (badge, link, cor). Recebe a linha inteira. */
  render?: (linha: T) => ReactNode;
  largura?: number | string;
  /** Texto longo que pode quebrar linha. */
  quebra?: boolean;
  /** Conteúdo do rodapé (ex.: total da coluna). */
  rodape?: ReactNode;
}

interface Props<T> {
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chave: (linha: T) => string | number;
  /** Drill: conteúdo que abre logo abaixo da linha clicada. */
  detalhe?: (linha: T) => ReactNode;
  /** Clique na linha (quando não há drill), ex.: abrir o registro. */
  aoClicar?: (linha: T) => void;
  busca?: boolean;
  porPagina?: number;
  ordemInicial?: { campo: keyof T & string; direcao: 'asc' | 'desc' };
  vazio?: string;
  /** Conteúdo à direita da busca (ex.: botão exportar). */
  ferramentas?: ReactNode;
}

const NUMERICOS = ['numero', 'quantidade', 'moeda', 'percentual'];
const numerico = (tipo?: string) => NUMERICOS.includes(tipo ?? '');

export const formatarValor = (tipo: ColunaTabela<unknown>['tipo'], v: unknown): string => {
  switch (tipo) {
    case 'moeda': return fmt.moeda(v);
    case 'numero': return fmt.numero(v);
    case 'quantidade': return fmt.quantidade(v);
    case 'data': return fmt.data(v);
    case 'data_hora': return fmt.dataHora(v);
    case 'percentual': return fmt.percentual(v);
    case 'mes': return fmt.mes(v);
    default: return v === null || v === undefined || v === '' ? '–' : String(v);
  }
};

/** Tabela no padrão do portal: busca, ordenação por coluna, paginação e drill por linha. */
export function TabelaDados<T extends Record<string, unknown>>({
  colunas, linhas, chave, detalhe, aoClicar, busca = true, porPagina = 25, ordemInicial, vazio = 'Nenhum registro com esses filtros.', ferramentas
}: Props<T>) {
  const [ordem, setOrdem] = useState(ordemInicial);
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(0);
  const [tamanho, setTamanho] = useState(porPagina);
  const [aberta, setAberta] = useState<string | number | null>(null);

  const filtradas = useMemo(() => {
    const termo = texto.trim().toLowerCase();
    let lista = termo
      ? linhas.filter((l) => colunas.some((c) => `${l[c.campo] ?? ''} ${formatarValor(c.tipo, l[c.campo])}`.toLowerCase().includes(termo)))
      : linhas;
    if (ordem) {
      const { campo, direcao } = ordem;
      lista = [...lista].sort((a, b) => {
        const x = a[campo] as never, y = b[campo] as never;
        const r = x === y ? 0 : x === null || x === undefined ? 1 : y === null || y === undefined ? -1 : typeof x === 'string' ? String(x).localeCompare(y, 'pt-BR') : x > y ? 1 : -1;
        return direcao === 'asc' ? r : -r;
      });
    }
    return lista;
  }, [linhas, colunas, texto, ordem]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / tamanho));
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = filtradas.slice(atual * tamanho, atual * tamanho + tamanho);
  const totalColunas = colunas.length;
  const temRodape = colunas.some((c) => c.rodape !== undefined);

  const ordenar = (campo: keyof T & string) =>
    setOrdem(ordem?.campo === campo ? { campo, direcao: ordem.direcao === 'asc' ? 'desc' : 'asc' } : { campo, direcao: numerico(colunas.find((c) => c.campo === campo)?.tipo) ? 'desc' : 'asc' });

  return (
    <div className="flex flex-col gap-3">
      {(busca || ferramentas) && (
        <div className="pf-sem-impressao flex flex-wrap items-center justify-between gap-2">
          {busca && (
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar na tabela" value={texto} className="pl-9" onChange={(e) => { setTexto(e.target.value); setPagina(0); }} />
            </div>
          )}
          {ferramentas && <div className="ml-auto flex items-center gap-2">{ferramentas}</div>}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {colunas.map((c) => {
                const ativa = ordem?.campo === c.campo;
                const Icone = ativa ? (ordem!.direcao === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <TableHead key={c.campo} style={{ width: c.largura }} className={cn(numerico(c.tipo) && 'text-right')}>
                    <button
                      type="button"
                      onClick={() => ordenar(c.campo)}
                      className={cn('inline-flex cursor-pointer items-center gap-1 uppercase hover:text-foreground', ativa && 'text-foreground', numerico(c.tipo) && 'flex-row-reverse')}
                    >
                      {c.titulo}
                      <Icone className={cn('size-3', !ativa && 'opacity-40')} />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalColunas} className="py-10 text-center text-muted-foreground">{vazio}</TableCell>
              </TableRow>
            )}
            {visiveis.map((linha) => {
              const id = chave(linha);
              const estaAberta = aberta === id;
              const clicavel = Boolean(detalhe || aoClicar);
              return (
                <Fragment key={id}>
                  <TableRow
                    data-state={estaAberta ? 'selected' : undefined}
                    onClick={() => (detalhe ? setAberta(estaAberta ? null : id) : aoClicar?.(linha))}
                    className={cn(clicavel && 'cursor-pointer')}
                  >
                    {colunas.map((c, n) => (
                      <TableCell
                        key={c.campo}
                        className={cn(numerico(c.tipo) && 'text-right tabular-nums', c.quebra && 'min-w-56 whitespace-normal')}
                      >
                        {n === 0 && detalhe ? (
                          <span className="inline-flex items-center gap-1.5">
                            <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', estaAberta && 'rotate-90')} />
                            {c.render ? c.render(linha) : formatarValor(c.tipo, linha[c.campo])}
                          </span>
                        ) : c.render ? c.render(linha) : formatarValor(c.tipo, linha[c.campo])}
                      </TableCell>
                    ))}
                  </TableRow>
                  {detalhe && estaAberta && (
                    <tr className="bg-muted/30">
                      <td colSpan={totalColunas} className="border-y px-4 py-4">{detalhe(linha)}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
          {temRodape && (
            <TableFooter>
              <TableRow className="odd:bg-transparent hover:bg-transparent">
                {colunas.map((c) => (
                  <TableCell key={c.campo} className={cn('font-semibold', numerico(c.tipo) && 'text-right tabular-nums')}>{c.rodape ?? ''}</TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {filtradas.length > porPagina && (
        <Paginacao pagina={atual} paginas={paginas} total={filtradas.length} tamanho={tamanho}
          opcoes={[...new Set([10, 25, 50, 100, porPagina])].sort((a, b) => a - b)}
          aoMudar={setPagina} aoMudarTamanho={(t) => { setTamanho(t); setPagina(0); }} />
      )}
    </div>
  );
}

/** Paginação do portal: anterior/próximo ao centro, "N por página" à direita. */
export const Paginacao = ({
  pagina, paginas, total, tamanho, aoMudar, aoMudarTamanho, opcoes = [10, 25, 50, 100]
}: {
  pagina: number; paginas: number; total: number; tamanho: number;
  aoMudar: (p: number) => void; aoMudarTamanho: (t: number) => void; opcoes?: number[];
}) => {
  const de = total === 0 ? 0 : pagina * tamanho + 1;
  const ate = Math.min(total, (pagina + 1) * tamanho);
  return (
    <div className="pf-sem-impressao flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {fmt.numero(de)}–{fmt.numero(ate)} de {fmt.numero(total)}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={pagina === 0} onClick={() => aoMudar(pagina - 1)}>
          <ChevronLeft /> Anterior
        </Button>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-md border px-2 tabular-nums">{pagina + 1}</span>
        <span className="px-1 text-muted-foreground">de {fmt.numero(paginas)}</span>
        <Button variant="ghost" size="sm" disabled={pagina >= paginas - 1} onClick={() => aoMudar(pagina + 1)}>
          Próximo <ChevronRight />
        </Button>
      </div>
      <Select value={tamanho} onChange={(e) => aoMudarTamanho(Number(e.target.value))} className="w-36" aria-label="Linhas por página">
        {opcoes.map((o) => <option key={o} value={o}>{o} por página</option>)}
      </Select>
    </div>
  );
};
