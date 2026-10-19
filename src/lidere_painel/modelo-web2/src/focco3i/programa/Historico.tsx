import { ArrowRightLeft, FilePlus2, PencilLine, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as fmt from '../formato';
import { DefinicaoEntidade, entidade as api } from '../runtime';
import { Aviso, Skeleton } from '../ui';
import { CONTROLE, textoValor } from './comum';

type Evento = { operacao: string; usuario: string; data: string; antes: any; depois: any };

const descrever = (def: DefinicaoEntidade, ev: Evento) => {
  const op = ev.operacao || '';
  if (op === 'CRIAR') return { icone: FilePlus2, texto: 'Registrou', detalhe: null as string | null };
  if (op === 'EXCLUIR') return { icone: Trash2, texto: 'Excluiu', detalhe: null };
  if (op.startsWith('ETAPA')) {
    const [de, para] = op.replace('ETAPA', '').trim().split('>');
    const rot = (k?: string) => def.etapas?.lista[k ?? ''] || k || '–';
    return { icone: ArrowRightLeft, texto: `Mudou a etapa para ${rot(para)}`, detalhe: `Antes: ${rot(de)}` };
  }
  const mudados = def.campos.filter((c) => !CONTROLE.has(c.chave) && JSON.stringify(ev.antes?.[c.chave] ?? null) !== JSON.stringify(ev.depois?.[c.chave] ?? null));
  const detalhe = mudados.map((c) => `${c.rotulo}: ${textoValor(c, ev.depois?.[c.chave])}`).join(' · ');
  return { icone: PencilLine, texto: mudados.length ? `Alterou ${mudados.map((c) => c.rotulo.toLowerCase()).join(', ')}` : 'Alterou', detalhe: detalhe || null };
};

/** Linha do tempo do registro (quem fez o quê e quando), lida da auditoria do portal. */
export const Historico = ({ def, id, versao }: { def: DefinicaoEntidade; id: number; /** muda → relê */ versao?: number }) => {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api(def.chave)
      .historico(id)
      .then((h) => ativo && setEventos([...(h as Evento[])].reverse()))
      .catch((e) => ativo && setErro(String(e?.message || e)));
    return () => {
      ativo = false;
    };
  }, [def.chave, id, versao]);

  if (erro) return <Aviso tom="erro">{erro}</Aviso>;
  if (!eventos)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
      </div>
    );
  if (!eventos.length) return <p className="text-sm text-muted-foreground">Sem movimentações.</p>;
  return (
    <ol className="relative flex flex-col gap-4">
      {eventos.map((ev, i) => {
        const { icone: Icone, texto, detalhe } = descrever(def, ev);
        return (
          <li key={i} className="relative flex gap-3">
            {i < eventos.length - 1 && <span className="absolute top-8 bottom-[-1rem] left-[15px] w-px bg-border" />}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card">
              <Icone className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="text-sm font-medium">{texto}</div>
              {detalhe && <div className="text-xs break-words text-muted-foreground">{detalhe}</div>}
              <div className="text-xs text-muted-foreground">
                {ev.usuario} · {fmt.dataHora(ev.data)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
