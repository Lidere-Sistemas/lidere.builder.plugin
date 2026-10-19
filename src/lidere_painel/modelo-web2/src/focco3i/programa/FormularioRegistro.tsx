import { Check, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { DefinicaoEntidade, entidade as api, Registro } from '../runtime';
import { Aviso, Button, Label, Spinner } from '../ui';
import { cn } from '../utils';
import { EntradaCampo, vazio } from './comum';

const larga = (tipo: string, tamanho?: number | null) => tipo === 'texto_longo' || (tipo === 'texto' && (tamanho ?? 100) > 100);

/**
 * Formulário de um registro (novo ou edição), gerado da declaração da entidade no painel.json.
 * Fica NA PÁGINA (sem janela flutuante: o painel cresce dentro do portal). Obrigatórios com *.
 */
export const FormularioRegistro = ({
  def,
  registro,
  paiId,
  campos,
  aoSalvar,
  aoCancelar,
  compacto,
  rotuloSalvar
}: {
  def: DefinicaoEntidade;
  /** null = novo registro. */
  registro: Registro | null;
  paiId?: number;
  /** Campos e ordem (padrão: todos). */
  campos?: string[];
  aoSalvar: (r: Registro) => void;
  aoCancelar: () => void;
  /** Uma linha só (filhos, ex.: ações da RNC). */
  compacto?: boolean;
  rotuloSalvar?: string;
}) => {
  const base = useId();
  const lista = campos ? campos.map((c) => def.campos.find((x) => x.chave === c)!).filter(Boolean) : def.campos;
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const inicial: Record<string, unknown> = {};
    def.campos.forEach((c) => (inicial[c.chave] = registro ? registro[c.chave] : c.padrao ?? null));
    setValores(inicial);
    setErro(null);
    setTentou(false);
  }, [registro, def]);

  const faltando = lista.filter((c) => c.obrigatorio && vazio(valores[c.chave]));
  const salvar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTentou(true);
    if (faltando.length) return;
    setSalvando(true);
    setErro(null);
    try {
      const dados = Object.fromEntries(lista.map((c) => [c.chave, valores[c.chave] ?? null]));
      const salvo = registro ? await api(def.chave).alterar(registro.id, registro.versao, dados) : await api(def.chave).criar(dados, paiId);
      aoSalvar(salvo);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
      {erro && <Aviso tom="erro" titulo="Não foi possível salvar">{erro}</Aviso>}
      <div className={cn('grid gap-4', compacto ? 'items-end md:grid-cols-[1fr_auto]' : 'md:grid-cols-2')}>
        <div className={cn('grid gap-4', compacto ? 'md:grid-flow-col md:auto-cols-fr' : 'contents')}>
          {lista.map((c) => {
            const id = `${base}-${c.chave}`;
            const invalido = tentou && faltando.includes(c);
            return (
              <div key={c.chave} className={cn('flex min-w-0 flex-col gap-2', !compacto && larga(c.tipo, c.tamanho) && 'md:col-span-2')}>
                {c.tipo !== 'booleano' && (
                  <Label htmlFor={id}>
                    {c.rotulo}
                    {c.obrigatorio && <span className="text-destructive">*</span>}
                  </Label>
                )}
                <EntradaCampo id={id} campo={c} valor={valores[c.chave]} invalido={invalido}
                  aoMudar={(v) => setValores((a) => ({ ...a, [c.chave]: v }))} />
                {invalido ? (
                  <span className="text-xs text-destructive">Preencha {c.rotulo.toLowerCase()}.</span>
                ) : c.ajuda ? (
                  <span className="text-xs text-muted-foreground">{c.ajuda}</span>
                ) : null}
              </div>
            );
          })}
        </div>
        {compacto && (
          <div className={cn('flex gap-2', tentou && faltando.length ? 'md:mb-6' : '')}>
            <Button variant="outline" onClick={aoCancelar} disabled={salvando}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? <Spinner /> : <Check />} {rotuloSalvar ?? 'Salvar'}</Button>
          </div>
        )}
      </div>
      {!compacto && (
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={aoCancelar} disabled={salvando}><X /> Cancelar</Button>
          <Button type="submit" disabled={salvando}>{salvando ? <Spinner /> : <Check />} {rotuloSalvar ?? 'Salvar'}</Button>
        </div>
      )}
    </form>
  );
};
