import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  SvgIcon,
  SvgIconProps,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import * as fmt from '../formato';
import { useConsulta, useEntidade } from '../hooks';
import { usePainel } from '../PainelApp';
import { CampoEntidade, DefinicaoEntidade, DefinicaoModulo, entidade as api, Registro } from '../runtime';

/*
 * Cadastro no PADRÃO DO PORTAL (CRUD de Marcas/Empresas/Usuários):
 * busca + Filtros (diálogo) + Adicionar no topo; tabela small zebrada em Paper com ordenação e
 * paginação 25/50/100; ações em ícones (Ver, Editar, Excluir); formulário em diálogo com rótulo
 * acima do campo; confirmação de exclusão; snackbar de sucesso/erro. Tudo sai da declaração do
 * painel.json. Quem quiser outra cara monta a própria tela com useEntidade/entidade().
 */

// Ícones Material (mesmos do portal), sem depender de @mui/icons-material.
const icone = (d: string) => (props: SvgIconProps) => <SvgIcon {...props}><path d={d} /></SvgIcon>;
const IconeAdicionar = icone('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z');
const IconeFiltro = icone('M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z');
const IconeEditar = icone('M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z');
const IconeExcluir = icone('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z');
const IconeVer = icone('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z');
const IconeOk = icone('M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z');
const IconeFechar = icone('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
const IconeLimpar = icone('M5 13h14v-2H5v2zm-2 4h14v-2H3v2zM7 7v2h14V7H7z');

const LinhaZebrada = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': { backgroundColor: theme.palette.action.hover },
  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
  '&:last-child td, &:last-child th': { border: 0 }
}));
const cabecalho = { fontWeight: 'bold', fontSize: '13px', textTransform: 'none', letterSpacing: 0, backgroundColor: 'transparent', color: 'text.primary' } as const;

/** Definição do módulo que o portal mandou junto com o manifesto (entidades do painel.json). */
export const useModulo = (): DefinicaoModulo => {
  const { contexto } = usePainel();
  const modulo = (contexto.manifesto as { modulo?: DefinicaoModulo } | null)?.modulo;
  if (!modulo) throw new Error('Este painel não tem "entidades" no painel.json (ou o portal recusou o módulo).');
  return modulo;
};

const textoValor = (campo: Pick<CampoEntidade, 'tipo' | 'escala'>, v: unknown): string => {
  if (v === null || v === undefined || v === '') return '–';
  switch (campo.tipo) {
    case 'decimal': return fmt.numero(v, campo.escala ?? 2);
    case 'data': return fmt.data(v);
    case 'data_hora': {
      const [dia, hora] = String(v).replace('T', ' ').split(' ');
      return `${fmt.data(dia)}${hora ? ` ${hora.slice(0, 5)}` : ''}`;
    }
    case 'booleano': return v ? 'Sim' : 'Não';
    default: return String(v);
  }
};

/** Opções de um campo: lista fixa, consulta do painel ou registros de outra entidade. */
const useOpcoes = (campo: CampoEntidade) => {
  const consulta = useConsulta<Record<string, unknown>>(campo.consulta || '', {}, { habilitada: !!campo.consulta });
  const referencia = useEntidade(campo.entidade || '', { tamanho: 500 }, { habilitada: campo.tipo === 'referencia' && !!campo.entidade });
  return useMemo((): { valor: string; rotulo: string }[] | null => {
    if (campo.opcoes?.length) return campo.opcoes.map((o) => ({ valor: o, rotulo: o }));
    if (campo.consulta) return (consulta.resultado?.linhas ?? []).map((l) => ({ valor: String(l[0]), rotulo: String(l[1] ?? l[0]) }));
    if (campo.tipo === 'referencia') {
      return referencia.registros.map((r) => {
        const titulo = Object.entries(r).find(([k, v]) => typeof v === 'string' && !['numero', 'etapa', 'criado_por', 'alterado_por', 'criado_em', 'alterado_em'].includes(k));
        return { valor: String(r.id), rotulo: [r.numero, titulo?.[1]].filter(Boolean).join(' · ') || `#${r.id}` };
      });
    }
    return null;
  }, [campo, consulta.resultado, referencia.registros]);
};

/** Campo no padrão do portal: rótulo ACIMA de um TextField outlined small sem label próprio. */
const CampoFormulario = ({
  campo, valor, onChange, erro
}: { campo: CampoEntidade; valor: unknown; onChange: (v: unknown) => void; erro?: string }) => {
  const opcoes = useOpcoes(campo);
  if (campo.tipo === 'booleano')
    return (
      <Box sx={{ pt: 2.5 }}>
        <FormControlLabel control={<Checkbox checked={!!valor} onChange={(e) => onChange(e.target.checked)} />} label={campo.rotulo} />
      </Box>
    );
  const comum = { fullWidth: true, size: 'small' as const, error: !!erro, helperText: erro || campo.ajuda || undefined };
  let entrada: ReactNode;
  if (opcoes) {
    entrada = (
      <TextField {...comum} select value={valor === null || valor === undefined ? '' : String(valor)}
        onChange={(e) => onChange(e.target.value === '' ? null : campo.tipo === 'referencia' || campo.tipo === 'inteiro' ? Number(e.target.value) : e.target.value)}>
        <MenuItem value=""><em>Selecione</em></MenuItem>
        {opcoes.map((o) => <MenuItem key={o.valor} value={o.valor}>{o.rotulo}</MenuItem>)}
      </TextField>
    );
  } else {
    const tipoHtml = { inteiro: 'number', decimal: 'number', data: 'date', data_hora: 'datetime-local' }[campo.tipo as string];
    const texto = valor === null || valor === undefined ? '' : campo.tipo === 'data_hora' ? String(valor).replace(' ', 'T').slice(0, 16) : String(valor);
    entrada = (
      <TextField {...comum} type={tipoHtml || 'text'} value={texto} placeholder={tipoHtml ? undefined : `Digite ${campo.rotulo.toLowerCase()}`}
        multiline={campo.tipo === 'texto_longo'} minRows={campo.tipo === 'texto_longo' ? 3 : undefined}
        inputProps={{ maxLength: campo.tamanho || undefined, step: campo.tipo === 'decimal' ? 'any' : undefined }}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} />
    );
  }
  return (
    <>
      <InputLabel sx={{ mb: 1, color: 'text.primary', fontWeight: 500 }}>{campo.rotulo}</InputLabel>
      {entrada}
    </>
  );
};

const largura = (c: CampoEntidade) => (c.tipo === 'texto_longo' || (c.tipo === 'texto' && (c.tamanho ?? 100) > 100) ? 12 : 6);

/** Diálogo do portal: título h4 na cor primária, fechar à direita, conteúdo com divisórias. */
const DialogoPortal = ({
  aberto, titulo, aoFechar, children, acoes, largo
}: { aberto: boolean; titulo: string; aoFechar: () => void; children: ReactNode; acoes?: ReactNode; largo?: boolean }) => (
  <Dialog open={aberto} onClose={aoFechar} fullWidth maxWidth={largo ? 'md' : 'sm'}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Typography variant="h4" color="primary" component="span">{titulo}</Typography>
      <IconButton color="primary" size="small" onClick={aoFechar}><IconeFechar fontSize="small" /></IconButton>
    </DialogTitle>
    <DialogContent dividers>
      {children}
      {acoes && (
        <>
          <Divider sx={{ mt: 3 }} />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>{acoes}</Stack>
        </>
      )}
    </DialogContent>
  </Dialog>
);

type Aviso = { tipo: 'success' | 'error'; texto: string } | null;

const Formulario = ({
  def, registro, paiId, aberto, aoFechar, aoSalvar
}: { def: DefinicaoEntidade; registro: Registro | null; paiId?: number; aberto: boolean; aoFechar: () => void; aoSalvar: (texto: string) => void }) => {
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setTentou(false);
    const inicial: Record<string, unknown> = {};
    def.campos.forEach((c) => { inicial[c.chave] = registro ? registro[c.chave] : c.padrao ?? null; });
    setValores(inicial);
  }, [aberto, registro, def]);

  const faltando = def.campos.filter((c) => c.obrigatorio && (valores[c.chave] === null || valores[c.chave] === undefined || valores[c.chave] === ''));
  const salvar = async () => {
    setTentou(true);
    if (faltando.length) return;
    setSalvando(true);
    setErro(null);
    try {
      if (registro) await api(def.chave).alterar(registro.id, registro.versao, valores);
      else await api(def.chave).criar(valores, paiId);
      aoSalvar(registro ? `${def.nome} alterado(a) com sucesso!` : `${def.nome} cadastrado(a) com sucesso!`);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogoPortal aberto={aberto} aoFechar={aoFechar}
      titulo={registro ? `Editar ${def.nome}${registro.numero ? ` ${registro.numero}` : ''}` : `Adicionar ${def.nome}`}
      acoes={<>
        <Button variant="outlined" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
        <Button variant="contained" startIcon={<IconeOk />} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
      </>}>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
      <Grid container spacing={3}>
        {def.campos.map((c) => (
          <Grid item xs={12} md={largura(c)} key={c.chave}>
            <CampoFormulario campo={c} valor={valores[c.chave]}
              erro={tentou && faltando.includes(c) ? `${c.rotulo} é obrigatório` : undefined}
              onChange={(v) => setValores((atual) => ({ ...atual, [c.chave]: v }))} />
          </Grid>
        ))}
      </Grid>
    </DialogoPortal>
  );
};

const Confirmar = ({
  aberto, titulo, texto, aoCancelar, aoConfirmar
}: { aberto: boolean; titulo: string; texto: string; aoCancelar: () => void; aoConfirmar: () => void }) => (
  <Dialog open={aberto} onClose={aoCancelar} fullWidth maxWidth="xs">
    <DialogTitle variant="h5" color="primary.main">{titulo}</DialogTitle>
    <Divider />
    <DialogContent><Typography variant="body1">{texto}</Typography></DialogContent>
    <DialogActions sx={{ p: 2, gap: 1 }}>
      <Button fullWidth variant="outlined" startIcon={<IconeFechar />} onClick={aoCancelar}>Cancelar</Button>
      <Button fullWidth variant="contained" startIcon={<IconeOk />} onClick={aoConfirmar}>Confirmar</Button>
    </DialogActions>
  </Dialog>
);

/** "Ver": dados do registro, próxima etapa e os filhos (ações, itens...) no mesmo padrão. */
const Detalhe = ({
  modulo, def, registro, aberto, aoFechar, aoMudar, podeEditar
}: { modulo: DefinicaoModulo; def: DefinicaoEntidade; registro: Registro | null; aberto: boolean; aoFechar: () => void; aoMudar: (texto: string) => void; podeEditar: boolean }) => {
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => setErro(null), [registro]);
  if (!registro) return null;
  const filhos = Object.values(modulo.entidades).filter((e) => e.pai === def.chave);
  const proximas = def.etapas ? def.etapas.transicoes[String(registro.etapa)] || [] : [];
  const mudar = async (etapa: string) => {
    setErro(null);
    try {
      await api(def.chave).mudarEtapa(registro.id, registro.versao, etapa);
      aoMudar(`${def.nome} movido(a) para ${def.etapas!.lista[etapa] || etapa}.`);
    } catch (e: any) {
      setErro(String(e?.message || e));
    }
  };
  return (
    <DialogoPortal aberto={aberto} aoFechar={aoFechar} largo titulo={registro.numero ? String(registro.numero) : def.nome}>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
      {def.etapas && (
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>Etapa:</Typography>
          <Chip size="small" label={def.etapas.lista[String(registro.etapa)] || String(registro.etapa || '–')} />
          {podeEditar && proximas.map((p) => (
            <Button key={p} size="small" variant="outlined" onClick={() => mudar(p)}>Mover para {def.etapas!.lista[p] || p}</Button>
          ))}
        </Stack>
      )}
      <Grid container spacing={2}>
        {def.campos.map((c) => (
          <Grid item xs={12} md={largura(c)} key={c.chave}>
            <Typography variant="body2" color="text.secondary">{c.rotulo}</Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{textoValor(c, registro[c.chave])}</Typography>
          </Grid>
        ))}
      </Grid>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Criado por {String(registro.criado_por || '–')} em {textoValor({ tipo: 'data_hora' }, registro.criado_em)}
        {registro.alterado_em ? ` · alterado por ${String(registro.alterado_por || '–')} em ${textoValor({ tipo: 'data_hora' }, registro.alterado_em)}` : ''}
      </Typography>
      {filhos.map((f) => (
        <Box key={f.chave} sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <CadastroEntidade entidade={f.chave} pai={{ entidade: def.chave, id: registro.id }} podeCriar={podeEditar} podeEditar={podeEditar} podeExcluir={podeEditar} />
        </Box>
      ))}
    </DialogoPortal>
  );
};

interface PropsCadastro {
  /** Chave da entidade no painel.json. */
  entidade: string;
  /** Campos que aparecem na tabela (padrão: os 6 primeiros que cabem numa coluna). */
  colunas?: string[];
  /** Filhos: só os registros deste pai (o componente faz isso sozinho no "Ver"). */
  pai?: { entidade: string; id: number };
  /** Ícones extras por linha (mesmo padrão: IconButton primary small com Tooltip). */
  acoes?: (registro: Registro) => ReactNode;
  /** Permissões: quem não pode, não vê o botão (o portal confere de novo). */
  podeCriar?: boolean;
  podeEditar?: boolean;
  podeExcluir?: boolean;
}

/**
 * Cadastro completo de uma entidade do módulo, no padrão das telas de cadastro do portal.
 * Tudo vem da declaração do painel.json (campos, filtros, etapas, filhos).
 */
export function CadastroEntidade({
  entidade, colunas, pai, acoes, podeCriar = true, podeEditar = true, podeExcluir = true
}: PropsCadastro) {
  const modulo = useModulo();
  const def = modulo.entidades[entidade];
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtros, setFiltros] = useState<Record<string, unknown>>({});
  const [rascunho, setRascunho] = useState<Record<string, unknown>>({});
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [ordem, setOrdem] = useState('-id');
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(pai ? 10 : 25);
  const [editando, setEditando] = useState<Registro | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [vendo, setVendo] = useState<Registro | null>(null);
  const [excluindo, setExcluindo] = useState<Registro | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    const t = setTimeout(() => { setBuscaAplicada(busca); setPagina(0); }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const consulta = useMemo(() => ({
    filtros: { ...filtros, ...(buscaAplicada ? { q: buscaAplicada } : {}), ...(pai ? { [`${pai.entidade}_id`]: pai.id } : {}) },
    ordem, pagina: pagina + 1, tamanho: porPagina
  }), [filtros, buscaAplicada, pai, ordem, pagina, porPagina]);
  const lista = useEntidade(entidade, consulta);

  // Mantém o "Ver" com a versão mais nova do registro depois de mudar etapa.
  useEffect(() => {
    if (vendo) setVendo(lista.registros.find((r) => r.id === vendo.id) ?? vendo);
  }, [lista.registros]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) return <Alert severity="error">Entidade "{entidade}" não existe no painel.json.</Alert>;

  const mostrar = colunas
    ? def.campos.filter((c) => colunas.includes(c.chave))
    : def.campos.filter((c) => c.tipo !== 'texto_longo').slice(0, 6);
  const temFilhos = Object.values(modulo.entidades).some((e) => e.pai === entidade);
  const filtraveis = def.campos.filter((c) => c.filtro);
  const temFiltros = !pai && (filtraveis.length > 0 || !!def.etapas);
  const ordenar = (chave: string) => { setOrdem(ordem === chave ? `-${chave}` : chave); setPagina(0); };
  const avisar = (texto: string, tipo: 'success' | 'error' = 'success') => setAviso({ tipo, texto });

  const colunaOrdenavel = (chave: string, titulo: string, alinhar?: 'right') => (
    <TableCell key={chave} align={alinhar} sx={cabecalho} sortDirection={ordem.replace('-', '') === chave ? (ordem.startsWith('-') ? 'desc' : 'asc') : false}>
      <TableSortLabel active={ordem.replace('-', '') === chave} direction={ordem.startsWith('-') ? 'desc' : 'asc'} onClick={() => ordenar(chave)}>
        {titulo}
      </TableSortLabel>
    </TableCell>
  );
  const totalColunas = mostrar.length + (def.numeracao ? 1 : 0) + (def.etapas ? 1 : 0) + 1;

  return (
    <Box>
      {!pai ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', my: 2, gap: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <TextField fullWidth size="small" label={`Busca de ${def.nome}`} placeholder="Digite para Pesquisar"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </Box>
          {temFiltros && (
            <Tooltip title="Filtros">
              <Button variant="outlined" startIcon={<IconeFiltro />} onClick={() => { setRascunho(filtros); setFiltrosAbertos(true); }}>Filtros</Button>
            </Tooltip>
          )}
          {podeCriar && (
            <Tooltip title={`Adicionar ${def.nome}`}>
              <Button variant="contained" startIcon={<IconeAdicionar />} onClick={() => { setEditando(null); setFormAberto(true); }}>Adicionar</Button>
            </Tooltip>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h5">{def.nome}</Typography>
          {podeCriar && (
            <Button size="small" variant="contained" startIcon={<IconeAdicionar />} onClick={() => { setEditando(null); setFormAberto(true); }}>Adicionar</Button>
          )}
        </Box>
      )}

      {lista.erro && <Alert severity="error" sx={{ mb: 2 }}>{lista.erro}</Alert>}

      <Paper sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          <Table size="small" sx={{ minWidth: pai ? undefined : 750 }}>
            <TableHead>
              <TableRow>
                {def.numeracao && colunaOrdenavel('numero', 'Número')}
                {mostrar.map((c) => colunaOrdenavel(c.chave, c.rotulo, c.tipo === 'decimal' || c.tipo === 'inteiro' ? 'right' : undefined))}
                {def.etapas && colunaOrdenavel('etapa', 'Etapa')}
                <TableCell align="right" sx={cabecalho}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.registros.map((l) => (
                <LinhaZebrada key={l.id}>
                  {def.numeracao && <TableCell>{String(l.numero ?? '–')}</TableCell>}
                  {mostrar.map((c) => (
                    <TableCell key={c.chave} align={c.tipo === 'decimal' || c.tipo === 'inteiro' ? 'right' : undefined}>{textoValor(c, l[c.chave])}</TableCell>
                  ))}
                  {def.etapas && (
                    <TableCell><Chip size="small" label={def.etapas.lista[String(l.etapa)] || String(l.etapa || '–')} /></TableCell>
                  )}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {acoes?.(l)}
                    {(temFilhos || def.etapas) && (
                      <Tooltip title="Ver"><IconButton color="primary" size="small" onClick={() => setVendo(l)}><IconeVer fontSize="small" /></IconButton></Tooltip>
                    )}
                    {podeEditar && (
                      <Tooltip title="Editar"><IconButton color="primary" size="small" onClick={() => { setEditando(l); setFormAberto(true); }}><IconeEditar fontSize="small" /></IconButton></Tooltip>
                    )}
                    {podeExcluir && (
                      <Tooltip title="Excluir"><IconButton color="primary" size="small" onClick={() => setExcluindo(l)}><IconeExcluir fontSize="small" /></IconButton></Tooltip>
                    )}
                  </TableCell>
                </LinhaZebrada>
              ))}
              {!lista.carregando && lista.registros.length === 0 && (
                <TableRow><TableCell align="center" colSpan={totalColunas}>Nenhum registro encontrado</TableCell></TableRow>
              )}
              {lista.carregando && lista.registros.length === 0 && (
                <TableRow><TableCell align="center" colSpan={totalColunas} sx={{ color: 'text.secondary' }}>Carregando…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {lista.total > 0 && (
          <TablePagination component="div" count={lista.total} page={pagina} rowsPerPage={porPagina}
            rowsPerPageOptions={pai ? [10, 25, 50] : [25, 50, 100]} labelRowsPerPage="Linhas por página:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            onPageChange={(_, p) => setPagina(p)} onRowsPerPageChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(0); }} />
        )}
      </Paper>

      {temFiltros && (
        <DialogoPortal aberto={filtrosAbertos} titulo="Filtros" aoFechar={() => setFiltrosAbertos(false)}
          acoes={<>
            <Button variant="outlined" startIcon={<IconeLimpar />} onClick={() => setRascunho({})}>Limpar</Button>
            <Button variant="outlined" startIcon={<IconeFechar />} onClick={() => setFiltrosAbertos(false)}>Fechar</Button>
            <Button variant="contained" startIcon={<IconeOk />} onClick={() => { setFiltros(rascunho); setPagina(0); setFiltrosAbertos(false); }}>Filtrar</Button>
          </>}>
          <Grid container spacing={2}>
            {def.etapas && (
              <Grid item xs={12} md={6}>
                <CampoFormulario campo={{ chave: 'etapa', tipo: 'opcao', rotulo: 'Etapa', obrigatorio: false, filtro: true, opcoes: Object.values(def.etapas.lista) }}
                  valor={rascunho.etapa ? def.etapas.lista[String(rascunho.etapa)] : null}
                  onChange={(v) => setRascunho((f) => ({ ...f, etapa: Object.entries(def.etapas!.lista).find(([, r]) => r === v)?.[0] }))} />
              </Grid>
            )}
            {filtraveis.map((c) => (
              <Grid item xs={12} md={6} key={c.chave}>
                <CampoFormulario campo={{ ...c, obrigatorio: false, ajuda: null }} valor={rascunho[c.chave]}
                  onChange={(v) => setRascunho((f) => ({ ...f, [c.chave]: v ?? undefined }))} />
              </Grid>
            ))}
          </Grid>
        </DialogoPortal>
      )}

      <Formulario def={def} registro={editando} paiId={pai?.id} aberto={formAberto}
        aoFechar={() => setFormAberto(false)} aoSalvar={(texto) => { setFormAberto(false); lista.recarregar(); avisar(texto); }} />

      <Detalhe modulo={modulo} def={def} registro={vendo} aberto={!!vendo} podeEditar={podeEditar}
        aoFechar={() => setVendo(null)} aoMudar={(texto) => { lista.recarregar(); avisar(texto); }} />

      <Confirmar aberto={!!excluindo} titulo={`Excluir ${def.nome}`}
        texto={`Tem certeza que deseja excluir ${excluindo?.numero ? `${def.nome} ${excluindo.numero}` : 'este registro'}?${temFilhos ? ' Os itens ligados a ele também serão excluídos.' : ''}`}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={async () => {
          const alvo = excluindo!;
          setExcluindo(null);
          try { await api(entidade).excluir(alvo.id); lista.recarregar(); avisar(`${def.nome} excluído(a) com sucesso!`); }
          catch (e: any) { avisar(String(e?.message || e), 'error'); }
        }} />

      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Alert severity={aviso?.tipo || 'success'} variant="standard" onClose={() => setAviso(null)} sx={{ border: '0.5px solid', borderColor: 'secondary.light' }}>
          <AlertTitle variant="h5">{aviso?.tipo === 'error' ? 'Erro' : 'Sucesso'}</AlertTitle>
          <Typography variant="body1">{aviso?.texto}</Typography>
        </Alert>
      </Snackbar>
    </Box>
  );
}
