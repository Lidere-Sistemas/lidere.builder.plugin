import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as fmt from '../formato';
import { useEntidade } from '../hooks';
import { DefinicaoEntidade, entidade as api, Registro } from '../runtime';
import { Aviso, Button, Skeleton } from '../ui';
import { textoValor } from './comum';
import { FormularioRegistro } from './FormularioRegistro';
import { plural } from './comum';

/**
 * Registros filhos de um registro (ações de uma RNC, itens de um pedido): lista enxuta com
 * incluir, editar e excluir na própria página. O portal grava com o vínculo ao pai.
 */
export const AcoesFilhas = ({
  def,
  pai,
  podeEditar = true,
  aoMudar,
  abrirNovo,
  aoFecharNovo
}: {
  def: DefinicaoEntidade;
  pai: { entidade: string; id: number };
  podeEditar?: boolean;
  /** Avisa o pai (ex.: recontar pendências). */
  aoMudar?: () => void;
  /** Controlado de fora: abre o formulário de inclusão (ex.: ação primária da ficha). */
  abrirNovo?: boolean;
  aoFecharNovo?: () => void;
}) => {
  const consulta = useMemo(() => ({ filtros: { [`${pai.entidade}_id`]: pai.id }, ordem: 'id', tamanho: 200 }), [pai]);
  const lista = useEntidade(def.chave, consulta);
  const [novoLocal, setNovoLocal] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const novo = novoLocal || !!abrirNovo;
  const fecharNovo = () => {
    setNovoLocal(false);
    aoFecharNovo?.();
  };
  const recarregar = () => {
    lista.recarregar();
    aoMudar?.();
  };
  const principal = def.campos[0];
  const outros = def.campos.slice(1, 3);

  return (
    <div className="flex flex-col gap-3">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {lista.carregando && !lista.registros.length ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : lista.registros.length === 0 && !novo ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Ainda não há {plural(def.nome).toLowerCase()}.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {lista.registros.map((r: Registro, i) =>
            editando === r.id ? (
              <li key={r.id} className="p-4">
                <FormularioRegistro def={def} registro={r} compacto aoCancelar={() => setEditando(null)}
                  aoSalvar={() => { setEditando(null); recarregar(); }} />
              </li>
            ) : (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm break-words">{principal ? textoValor(principal, r[principal.chave]) : `#${r.id}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {[...outros.map((c) => `${c.rotulo}: ${textoValor(c, r[c.chave])}`), `${String(r.criado_por ?? '')} · ${fmt.dataHora(r.criado_em)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {podeEditar && confirmar !== r.id && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Editar" title="Editar" onClick={() => setEditando(r.id)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Excluir" title="Excluir" onClick={() => setConfirmar(r.id)}><Trash2 /></Button>
                  </div>
                )}
                {confirmar === r.id && (
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Excluir?</span>
                    <Button variant="outline" size="sm" onClick={() => setConfirmar(null)}>Não</Button>
                    <Button variant="destructive" size="sm" onClick={async () => {
                      setConfirmar(null);
                      setErro(null);
                      try { await api(def.chave).excluir(r.id); recarregar(); } catch (e: any) { setErro(String(e?.message || e)); }
                    }}>Excluir</Button>
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}
      {novo ? (
        <div className="rounded-lg border bg-muted/30 p-4">
          <FormularioRegistro def={def} registro={null} paiId={pai.id} compacto rotuloSalvar="Adicionar"
            aoCancelar={fecharNovo} aoSalvar={() => { fecharNovo(); recarregar(); }} />
        </div>
      ) : (
        podeEditar && (
          <div>
            <Button variant="outline" size="sm" onClick={() => setNovoLocal(true)}><Plus /> Adicionar {def.nome.toLowerCase()}</Button>
          </div>
        )
      )}
    </div>
  );
};
