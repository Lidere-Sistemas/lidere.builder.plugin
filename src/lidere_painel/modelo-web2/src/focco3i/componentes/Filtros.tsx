import { Eraser, Filter } from 'lucide-react';
import { FormEvent, useEffect, useId, useState } from 'react';
import { Parametros } from '../runtime';
import { Button, Input, Label, Select } from '../ui';
import { cn } from '../utils';

export interface CampoFiltro {
  nome: string;
  rotulo: string;
  tipo: 'texto' | 'data' | 'numero' | 'selecao';
  opcoes?: { valor: string | number; rotulo: string }[];
  placeholder?: string;
  /** Seleção sem a opção "Todos" (campo sempre tem um valor; combine com `padrao`). */
  semTodos?: boolean;
  /** Texto da opção vazia. Padrão: "Todos". */
  rotuloTodos?: string;
  /** Largura do campo em px (padrão 180). */
  largura?: number;
}

interface Props {
  campos: CampoFiltro[];
  valores: Parametros;
  aoAplicar: (valores: Parametros) => void;
  /** Valores do "Limpar". Padrão: tudo vazio. */
  padrao?: Parametros;
  /** Só seleções: aplica ao escolher, sem botão (cabeçalho da página). */
  imediato?: boolean;
  className?: string;
}

/**
 * Filtros do painel. Campo vazio = filtro não aplicado: o parâmetro não é enviado e chega como
 * NULL no SQL ( :p IS NULL OR ... ). Aplica no botão, com Enter ou, em `imediato`, ao escolher.
 */
export const Filtros = ({ campos, valores, aoAplicar, padrao = {}, imediato, className }: Props) => {
  const [rascunho, setRascunho] = useState<Parametros>(valores);
  const base = useId();
  useEffect(() => setRascunho(valores), [valores]);

  const aplicar = (e?: FormEvent) => {
    e?.preventDefault();
    aoAplicar(rascunho);
  };
  const mudar = (nome: string, valor: string) => {
    const novo = { ...rascunho, [nome]: valor };
    setRascunho(novo);
    if (imediato) aoAplicar(novo);
  };

  return (
    <form onSubmit={aplicar} noValidate className={cn('pf-sem-impressao flex flex-wrap items-end gap-2', className)}>
      {campos.map((c) => {
        const id = `${base}-${c.nome}`;
        const valor = rascunho[c.nome] ?? '';
        return (
          <div key={c.nome} className="flex flex-col gap-1.5" style={{ width: c.largura ?? 180 }}>
            <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">{c.rotulo}</Label>
            {c.tipo === 'selecao' ? (
              <Select id={id} value={String(valor)} onChange={(e) => mudar(c.nome, e.target.value)}>
                {!c.semTodos && <option value="">{c.rotuloTodos ?? 'Todos'}</option>}
                {(c.opcoes ?? []).map((o) => <option key={String(o.valor)} value={o.valor}>{o.rotulo}</option>)}
              </Select>
            ) : (
              <Input
                id={id}
                type={c.tipo === 'data' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
                value={String(valor)}
                placeholder={c.placeholder}
                onChange={(e) => setRascunho({ ...rascunho, [c.nome]: e.target.value })}
              />
            )}
          </div>
        );
      })}
      {!imediato && (
        <div className="flex gap-2">
          <Button type="submit"><Filter /> Aplicar</Button>
          <Button variant="outline" onClick={() => { setRascunho(padrao); aoAplicar(padrao); }}><Eraser /> Limpar</Button>
        </div>
      )}
    </form>
  );
};
