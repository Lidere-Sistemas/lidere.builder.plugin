import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search, X } from 'lucide-react';
import { ReactNode, useEffect, useId, useMemo, useState } from 'react';
import * as fmt from '../formato';
import { useEntidade } from '../hooks';
import { CampoEntidade, DefinicaoEntidade, entidade as api, Registro } from '../runtime';
import { Aviso, Badge, Button, Card, Input, Label, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui';
import { cn } from '../utils';
import { Paginacao } from '../componentes/TabelaDados';
import { Vazio } from '../componentes/Layout';
import { BadgeEtapa, plural, textoValor, useOpcoes, vazio } from './comum';

type Filtros = Record<string, unknown>;

/** Quantos registros em cada etapa (com a busca e os filtros atuais). */
const useContagens = (def: DefinicaoEntidade, filtros: Filtros, versao: number) => {
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const chave = JSON.stringify(filtros);
  useEffect(() => {
    if (!def.etapas) return;
    let ativo = true;
    const etapas = ['', ...Object.keys(def.etapas.lista)];
    Promise.all(
      etapas.map((e) =>
        api(def.chave)
          .listar({ filtros: { ...JSON.parse(chave), ...(e ? { etapa: e } : {}) }, tamanho: 1 })
          .then((p) => [e, p.total] as const)
      )
    )
      .then((r) => ativo && setContagens(Object.fromEntries(r)))
      .catch(() => ativo && setContagens({}));
    return () => {
      ativo = false;
    };
  }, [def, chave, versao]);
  return contagens;
};

const FiltroCampo = ({ campo, filtros, mudar }: { campo: CampoEntidade; filtros: Filtros; mudar: (chave: string, valor: unknown) => void }) => {
  const id = useId();
  const opcoes = useOpcoes(campo);
  const rotulo = <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">{campo.rotulo}</Label>;
  if (opcoes || campo.tipo === 'booleano') {
    const lista = opcoes ?? [{ valor: '1', rotulo: 'Sim' }, { valor: '0', rotulo: 'Não' }];
    return (
      <div className="flex w-44 flex-col gap-1.5">
        {rotulo}
        <Select id={id} value={vazio(filtros[campo.chave]) ? '' : String(filtros[campo.chave])} onChange={(e) => mudar(campo.chave, e.target.value || undefined)}>
          <option value="">Todas</option>
          {lista.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </Select>
      </div>
    );
  }
  if (['data', 'data_hora', 'inteiro', 'decimal'].includes(campo.tipo)) {
    const tipo = campo.tipo.startsWith('data') ? 'date' : 'number';
    return (
      <div className="flex flex-col gap-1.5">
        {rotulo}
        <div className="flex items-center gap-1.5">
          <Input id={id} type={tipo} className="w-38" aria-label={`${campo.rotulo} de`} value={String(filtros[`${campo.chave}__de`] ?? '')} onChange={(e) => mudar(`${campo.chave}__de`, e.target.value || undefined)} />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type={tipo} className="w-38" aria-label={`${campo.rotulo} até`} value={String(filtros[`${campo.chave}__ate`] ?? '')} onChange={(e) => mudar(`${campo.chave}__ate`, e.target.value || undefined)} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-52 flex-col gap-1.5">
      {rotulo}
      <Input id={id} placeholder="Contém…" value={String(filtros[campo.chave] ?? '')} onChange={(e) => mudar(campo.chave, e.target.value || undefined)} />
    </div>
  );
};

const textoFiltro = (def: DefinicaoEntidade, chave: string, valor: unknown) => {
  const [base, sufixo] = chave.split('__');
  const campo = def.campos.find((c) => c.chave === base);
  const rotulo = campo?.rotulo ?? base;
  const v = campo ? (campo.tipo === 'booleano' ? (String(valor) === '1' ? 'Sim' : 'Não') : textoValor(campo, valor)) : String(valor);
  return sufixo === 'de' ? `${rotulo} a partir de ${v}` : sufixo === 'ate' ? `${rotulo} até ${v}` : `${rotulo}: ${v}`;
};

/**
 * Lista filter-rich de um programa (UMA listagem, sem submenu por status): busca geral, abas
 * por etapa com contagem, filtros de cada campo marcado com "filtro" no painel.json, chips do
 * que está aplicado, ordenação e paginação no servidor. Clique na linha abre o registro.
 */
export const ListaRegistros = ({
  def,
  colunas,
  aoAbrir,
  aoNovo,
  rotuloNovo,
  versao = 0,
  extra
}: {
  def: DefinicaoEntidade;
  /** Campos na tabela (padrão: até 5 que cabem numa linha). */
  colunas?: string[];
  aoAbrir: (r: Registro) => void;
  aoNovo?: () => void;
  rotuloNovo?: string;
  /** Muda → recarrega (depois de gravar). */
  versao?: number;
  /** Conteúdo extra por linha, antes da etapa (ex.: contagem de ações). */
  extra?: { titulo: string; render: (r: Registro) => ReactNode };
}) => {
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [etapa, setEtapa] = useState('');
  const [filtros, setFiltros] = useState<Filtros>({});
  const [ordem, setOrdem] = useState('-id');
  const [pagina, setPagina] = useState(0);
  const [tamanho, setTamanho] = useState(25);

  useEffect(() => {
    const t = setTimeout(() => { setQ(busca.trim()); setPagina(0); }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const filtrosAtivos = useMemo(() => Object.fromEntries(Object.entries(filtros).filter(([, v]) => !vazio(v))), [filtros]);
  const base = useMemo(() => ({ ...filtrosAtivos, ...(q ? { q } : {}) }), [filtrosAtivos, q]);
  const consulta = useMemo(() => ({ filtros: { ...base, ...(etapa ? { etapa } : {}) }, ordem, pagina: pagina + 1, tamanho }), [base, etapa, ordem, pagina, tamanho]);
  const lista = useEntidade(def.chave, consulta);
  const contagens = useContagens(def, base, versao);
  useEffect(() => lista.recarregar(), [versao]); // eslint-disable-line react-hooks/exhaustive-deps

  const mostrar = colunas
    ? colunas.map((c) => def.campos.find((x) => x.chave === c)!).filter(Boolean)
    : def.campos.filter((c) => c.tipo !== 'texto_longo').slice(0, 5);
  const filtraveis = def.campos.filter((c) => c.filtro);
  const mudar = (chave: string, valor: unknown) => { setFiltros((f) => ({ ...f, [chave]: valor })); setPagina(0); };
  const limpar = () => { setFiltros({}); setBusca(''); setQ(''); setEtapa(''); setPagina(0); };
  const temAlgo = Object.keys(filtrosAtivos).length > 0 || !!q || !!etapa;
  const ordenar = (chave: string) => { setOrdem(ordem === chave ? `-${chave}` : chave); setPagina(0); };

  const Cab = ({ chave, titulo, direita }: { chave: string; titulo: string; direita?: boolean }) => {
    const ativa = ordem.replace('-', '') === chave;
    const Icone = ativa ? (ordem.startsWith('-') ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <TableHead className={cn(direita && 'text-right')}>
        <button type="button" onClick={() => ordenar(chave)} className={cn('inline-flex cursor-pointer items-center gap-1 uppercase hover:text-foreground', ativa && 'text-foreground')}>
          {titulo} <Icone className={cn('size-3', !ativa && 'opacity-40')} />
        </button>
      </TableHead>
    );
  };
  const numerico = (c: CampoEntidade) => c.tipo === 'inteiro' || c.tipo === 'decimal';
  const totalColunas = mostrar.length + 2 + (def.numeracao ? 1 : 0) + (def.etapas ? 1 : 0) + (extra ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {def.etapas && (
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 shadow-xs" role="tablist" aria-label="Etapas">
          {[['', 'Todas'] as const, ...Object.entries(def.etapas.lista)].map(([chave, rotulo]) => (
            <button key={chave || 'todas'} type="button" role="tab" aria-selected={etapa === chave}
              onClick={() => { setEtapa(chave); setPagina(0); }}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                etapa === chave ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}>
              {rotulo}
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', etapa === chave ? 'bg-primary-foreground/20' : 'bg-muted')}>
                {contagens[chave] ?? '·'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label className="text-xs font-normal text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={`Número, ${def.campos.filter((c) => c.tipo === 'texto' || c.tipo === 'opcao').map((c) => c.rotulo.toLowerCase()).slice(0, 2).join(', ')}…`}
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        {filtraveis.filter((c) => c.tipo !== 'texto').map((c) => <FiltroCampo key={c.chave} campo={c} filtros={filtros} mudar={mudar} />)}
        {aoNovo && <Button onClick={aoNovo}><Plus /> {rotuloNovo ?? `Nova ${def.nome}`}</Button>}
      </div>

      {temAlgo && (
        <div className="flex flex-wrap items-center gap-2">
          {q && <Chip texto={`Busca: ${q}`} remover={() => { setBusca(''); setQ(''); }} />}
          {etapa && <Chip texto={`Etapa: ${def.etapas?.lista[etapa] ?? etapa}`} remover={() => setEtapa('')} />}
          {Object.entries(filtrosAtivos).map(([k, v]) => <Chip key={k} texto={textoFiltro(def, k, v)} remover={() => mudar(k, undefined)} />)}
          <Button variant="link" size="sm" className="ml-1 text-xs" onClick={limpar}>Limpar filtros</Button>
        </div>
      )}

      {lista.erro && <Aviso tom="erro" titulo="Não foi possível carregar">{lista.erro}</Aviso>}

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {def.numeracao && <Cab chave="numero" titulo="Número" />}
              {mostrar.map((c) => <Cab key={c.chave} chave={c.chave} titulo={c.rotulo} direita={numerico(c)} />)}
              {extra && <TableHead>{extra.titulo}</TableHead>}
              {def.etapas && <Cab chave="etapa" titulo="Etapa" />}
              <Cab chave="criado_em" titulo="Registrado em" />
              <TableHead>Por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.registros.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => aoAbrir(r)}>
                {def.numeracao && <TableCell className="font-medium tabular-nums">{String(r.numero ?? '–')}</TableCell>}
                {mostrar.map((c, i) => (
                  <TableCell key={c.chave} className={cn(numerico(c) && 'text-right tabular-nums', i === 0 && 'max-w-[42ch] truncate')}>
                    {c.tipo === 'opcao' && !vazio(r[c.chave]) ? <Badge variant="outline">{String(r[c.chave])}</Badge> : textoValor(c, r[c.chave])}
                  </TableCell>
                ))}
                {extra && <TableCell>{extra.render(r)}</TableCell>}
                {def.etapas && <TableCell><BadgeEtapa def={def} etapa={r.etapa} /></TableCell>}
                <TableCell className="tabular-nums">{fmt.dataHora(r.criado_em)}</TableCell>
                <TableCell className="text-muted-foreground">{String(r.criado_por ?? '–')}</TableCell>
              </TableRow>
            ))}
            {!lista.carregando && lista.registros.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalColunas}>
                  <Vazio mensagem={temAlgo ? 'Nenhum registro com esses filtros.' : `Ainda não há ${plural(def.nome)}.`}
                    acao={temAlgo ? <Button variant="outline" size="sm" onClick={limpar}>Limpar filtros</Button> : aoNovo ? <Button size="sm" onClick={aoNovo}><Plus /> {rotuloNovo ?? `Nova ${def.nome}`}</Button> : undefined} />
                </TableCell>
              </TableRow>
            )}
            {lista.carregando && lista.registros.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalColunas} className="py-10 text-center text-muted-foreground">Carregando…</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {lista.total > 10 && (
        <Paginacao pagina={pagina} paginas={Math.max(1, Math.ceil(lista.total / tamanho))} total={lista.total} tamanho={tamanho}
          aoMudar={setPagina} aoMudarTamanho={(t) => { setTamanho(t); setPagina(0); }} opcoes={[25, 50, 100]} />
      )}
    </div>
  );
};

const Chip = ({ texto, remover }: { texto: string; remover: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pr-1 pl-2.5 text-xs">
    {texto}
    <button type="button" onClick={remover} aria-label={`Remover ${texto}`} className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
      <X className="size-3" />
    </button>
  </span>
);
