import {
  Box,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography
} from '@mui/material';
import { Fragment, ReactNode, useMemo, useState } from 'react';
import * as fmt from '../formato';

export interface ColunaTabela<T> {
  campo: keyof T & string;
  titulo: string;
  tipo?: 'texto' | 'numero' | 'quantidade' | 'moeda' | 'data' | 'percentual';
  /** Render customizado (chip, link, cor). Recebe a linha inteira. */
  render?: (linha: T) => ReactNode;
  largura?: number | string;
  quebra?: boolean;
}

interface Props<T> {
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chave: (linha: T) => string | number;
  /** Drill: conteúdo que abre logo abaixo da linha clicada (ex.: <DetalheNF id=... />). */
  detalhe?: (linha: T) => ReactNode;
  busca?: boolean;
  porPagina?: number;
  ordemInicial?: { campo: keyof T & string; direcao: 'asc' | 'desc' };
  vazio?: string;
}

const numerico = (tipo?: string) => ['numero', 'quantidade', 'moeda', 'percentual'].includes(tipo ?? '');

const formatar = <T,>(c: ColunaTabela<T>, v: unknown) => {
  switch (c.tipo) {
    case 'moeda': return fmt.moeda(v);
    case 'numero': return fmt.numero(v);
    case 'quantidade': return fmt.quantidade(v);
    case 'data': return fmt.data(v);
    case 'percentual': return fmt.percentual(v);
    default: return v === null || v === undefined || v === '' ? '–' : String(v);
  }
};

/** Tabela no padrão do portal: ordenação, busca, paginação e drill por linha. */
export function TabelaDados<T extends Record<string, unknown>>({
  colunas, linhas, chave, detalhe, busca = true, porPagina = 25, ordemInicial, vazio = 'Nenhum registro com esses filtros.'
}: Props<T>) {
  const [ordem, setOrdem] = useState(ordemInicial);
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(0);
  const [tamanho, setTamanho] = useState(porPagina);
  const [aberta, setAberta] = useState<string | number | null>(null);

  const filtradas = useMemo(() => {
    const termo = texto.trim().toLowerCase();
    let lista = termo ? linhas.filter((l) => colunas.some((c) => String(l[c.campo] ?? '').toLowerCase().includes(termo))) : linhas;
    if (ordem) {
      const { campo, direcao } = ordem;
      lista = [...lista].sort((a, b) => {
        const x = a[campo] as never, y = b[campo] as never;
        const r = x === y ? 0 : x === null || x === undefined ? 1 : y === null || y === undefined ? -1 : x > y ? 1 : -1;
        return direcao === 'asc' ? r : -r;
      });
    }
    return lista;
  }, [linhas, colunas, texto, ordem]);

  const visiveis = filtradas.slice(pagina * tamanho, pagina * tamanho + tamanho);
  const totalColunas = colunas.length + (detalhe ? 1 : 0);

  return (
    <Box>
      {busca && (
        <TextField
          size="small"
          placeholder="Buscar na tabela"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setPagina(0); }}
          sx={{ mb: 1.5, width: { xs: '100%', sm: 320 } }}
        />
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {detalhe && <TableCell sx={{ width: 40 }} />}
              {colunas.map((c) => (
                <TableCell key={c.campo} align={numerico(c.tipo) ? 'right' : 'left'} sx={{ width: c.largura, whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={ordem?.campo === c.campo}
                    direction={ordem?.campo === c.campo ? ordem.direcao : 'asc'}
                    onClick={() => setOrdem({ campo: c.campo, direcao: ordem?.campo === c.campo && ordem.direcao === 'asc' ? 'desc' : 'asc' })}
                  >
                    {c.titulo}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{vazio}</Typography>
                </TableCell>
              </TableRow>
            )}
            {visiveis.map((linha) => {
              const id = chave(linha);
              const estaAberta = aberta === id;
              const alternar = () => detalhe && setAberta(estaAberta ? null : id);
              return (
                <Fragment key={id}>
                  <TableRow
                    hover
                    selected={estaAberta}
                    onClick={alternar}
                    sx={{ cursor: detalhe ? 'pointer' : 'default', '& > td': { borderBottom: estaAberta ? 0 : undefined } }}
                  >
                    {detalhe && (
                      <TableCell>
                        <IconButton size="small" aria-label={estaAberta ? 'Fechar detalhe' : 'Abrir detalhe'}>
                          <Box component="span" sx={{ display: 'inline-block', transition: 'transform .15s', transform: estaAberta ? 'rotate(90deg)' : 'none', fontSize: 12 }}>▶</Box>
                        </IconButton>
                      </TableCell>
                    )}
                    {colunas.map((c) => (
                      <TableCell
                        key={c.campo}
                        align={numerico(c.tipo) ? 'right' : 'left'}
                        sx={{ whiteSpace: c.quebra ? 'normal' : 'nowrap', fontVariantNumeric: numerico(c.tipo) ? 'tabular-nums' : undefined, maxWidth: c.quebra ? 360 : undefined }}
                      >
                        {c.render ? c.render(linha) : formatar(c, linha[c.campo])}
                      </TableCell>
                    ))}
                  </TableRow>
                  {detalhe && estaAberta && (
                    <TableRow>
                      <TableCell colSpan={totalColunas} sx={{ bgcolor: 'grey.50', p: 2, whiteSpace: 'normal' }}>
                        <Collapse in appear>{detalhe(linha)}</Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {filtradas.length > tamanho && (
        <TablePagination
          component="div"
          count={filtradas.length}
          page={pagina}
          onPageChange={(_, p) => setPagina(p)}
          rowsPerPage={tamanho}
          onRowsPerPageChange={(e) => { setTamanho(Number(e.target.value)); setPagina(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Linhas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count.toLocaleString('pt-BR')}`}
        />
      )}
    </Box>
  );
}
