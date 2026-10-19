import { useMemo } from 'react';
import * as fmt from '../formato';
import { useConsulta, useEntidade } from '../hooks';
import { usePainel } from '../PainelApp';
import { CampoEntidade, DefinicaoEntidade, DefinicaoModulo, Registro } from '../runtime';
import { Badge, Input, Select, Textarea, VarianteBadge } from '../ui';

/** Definição do módulo que o portal mandou junto com o manifesto (entidades do painel.json). */
export const useModulo = (): DefinicaoModulo => {
  const { contexto } = usePainel();
  const modulo = (contexto.manifesto as { modulo?: DefinicaoModulo } | null)?.modulo;
  if (!modulo) throw new Error('Este programa não tem "entidades" no painel.json (ou o portal recusou o módulo).');
  return modulo;
};

export const CONTROLE = new Set(['id', 'numero', 'etapa', 'versao', 'criado_em', 'criado_por', 'alterado_em', 'alterado_por']);

export const vazio = (v: unknown) => v === null || v === undefined || v === '';

/** Valor de um campo como texto pt-BR (datas dd/mm/aaaa, decimais com vírgula). */
export const textoValor = (campo: Pick<CampoEntidade, 'tipo' | 'escala'>, v: unknown): string => {
  if (vazio(v)) return '–';
  switch (campo.tipo) {
    case 'decimal': return fmt.numero(typeof v === 'number' ? v : Number(v), campo.escala ?? 2);
    case 'inteiro': return fmt.numero(typeof v === 'number' ? v : Number(v));
    case 'data': return fmt.data(v);
    case 'data_hora': return fmt.dataHora(v);
    case 'booleano': return v ? 'Sim' : 'Não';
    default: return String(v);
  }
};

/** Rótulo e tom da etapa: inicial em destaque, final (sem saída) em verde, intermediárias em âmbar. */
export const etapaInfo = (def: DefinicaoEntidade, etapa: unknown): { rotulo: string; tom: VarianteBadge } => {
  const chave = String(etapa ?? '');
  const e = def.etapas;
  if (!e) return { rotulo: chave || '–', tom: 'secondary' };
  const rotulo = e.lista[chave] || chave || '–';
  if (chave === e.inicial) return { rotulo, tom: 'destaque' };
  if (!(e.transicoes[chave] || []).length) return { rotulo, tom: 'sucesso' };
  return { rotulo, tom: 'alerta' };
};

export const BadgeEtapa = ({ def, etapa }: { def: DefinicaoEntidade; etapa: unknown }) => {
  const { rotulo, tom } = etapaInfo(def, etapa);
  return <Badge variant={tom}>{rotulo}</Badge>;
};

/** Título legível de um registro: número + primeiro campo de texto. */
export const tituloRegistro = (def: DefinicaoEntidade, r: Registro | null | undefined) => {
  if (!r) return def.nome;
  const texto = def.campos.find((c) => c.tipo === 'texto' && !vazio(r[c.chave]));
  return [r.numero, texto ? r[texto.chave] : null].filter((x) => !vazio(x)).join(' · ') || `${def.nome} #${r.id}`;
};

/** Opções de um campo: lista fixa, consulta do painel ou registros de outra entidade. */
export const useOpcoes = (campo: CampoEntidade) => {
  const consulta = useConsulta<Record<string, unknown>>(campo.consulta || '', {}, { habilitada: !!campo.consulta });
  const referencia = useEntidade(campo.entidade || '', { tamanho: 500 }, { habilitada: campo.tipo === 'referencia' && !!campo.entidade });
  return useMemo((): { valor: string; rotulo: string }[] | null => {
    if (campo.opcoes?.length) return campo.opcoes.map((o) => ({ valor: o, rotulo: o }));
    if (campo.consulta) return (consulta.resultado?.linhas ?? []).map((l) => ({ valor: String(l[0]), rotulo: String(l[1] ?? l[0]) }));
    if (campo.tipo === 'referencia') {
      return referencia.registros.map((r) => {
        const titulo = Object.entries(r).find(([k, v]) => typeof v === 'string' && !CONTROLE.has(k));
        return { valor: String(r.id), rotulo: [r.numero, titulo?.[1]].filter(Boolean).join(' · ') || `#${r.id}` };
      });
    }
    return null;
  }, [campo, consulta.resultado, referencia.registros]);
};

/** Entrada de um campo da entidade, com a cara dos campos do portal. */
export const EntradaCampo = ({
  campo, valor, aoMudar, id, invalido
}: { campo: CampoEntidade; valor: unknown; aoMudar: (v: unknown) => void; id: string; invalido?: boolean }) => {
  const opcoes = useOpcoes(campo);
  if (campo.tipo === 'booleano') {
    return (
      <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
        <input id={id} type="checkbox" checked={!!valor} onChange={(e) => aoMudar(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        {campo.rotulo}
      </label>
    );
  }
  if (opcoes) {
    return (
      <Select id={id} aria-invalid={invalido || undefined} value={vazio(valor) ? '' : String(valor)}
        onChange={(e) => aoMudar(e.target.value === '' ? null : campo.tipo === 'referencia' || campo.tipo === 'inteiro' ? Number(e.target.value) : e.target.value)}>
        <option value="">Selecione</option>
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </Select>
    );
  }
  if (campo.tipo === 'texto_longo') {
    return (
      <Textarea id={id} aria-invalid={invalido || undefined} rows={4} maxLength={campo.tamanho || undefined}
        value={vazio(valor) ? '' : String(valor)} onChange={(e) => aoMudar(e.target.value === '' ? null : e.target.value)} />
    );
  }
  const tipoHtml = ({ inteiro: 'number', decimal: 'number', data: 'date', data_hora: 'datetime-local' } as Record<string, string>)[campo.tipo] || 'text';
  const texto = vazio(valor) ? '' : campo.tipo === 'data_hora' ? String(valor).replace(' ', 'T').slice(0, 16) : String(valor);
  return (
    <Input id={id} type={tipoHtml} aria-invalid={invalido || undefined} value={texto} maxLength={campo.tamanho || undefined}
      step={campo.tipo === 'decimal' ? 'any' : undefined} onChange={(e) => aoMudar(e.target.value === '' ? null : e.target.value)} />
  );
};

/** Plural simples em pt-BR para títulos ("Ação" → "Ações", "Item" → "Itens"). */
export const plural = (nome: string) =>
  /ão$/i.test(nome) ? nome.replace(/ão$/i, 'ões')
  : /m$/i.test(nome) ? nome.replace(/m$/i, 'ns')
  : /l$/i.test(nome) ? nome.replace(/l$/i, 'is')
  : /[rzs]$/i.test(nome) ? `${nome}es`
  : `${nome}s`;

