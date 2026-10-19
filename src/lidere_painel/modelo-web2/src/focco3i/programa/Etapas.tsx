import { Check } from 'lucide-react';
import { DefinicaoEntidade } from '../runtime';
import { cn } from '../utils';

/**
 * Trilha das etapas do registro (na ordem declarada no painel.json): concluídas com ✓, a atual
 * destacada na cor da empresa, as próximas apagadas. Etapa que volta (ex.: análise → aberta)
 * aparece pela posição atual.
 */
export const Etapas = ({ def, atual }: { def: DefinicaoEntidade; atual: unknown }) => {
  if (!def.etapas) return null;
  const chaves = Object.keys(def.etapas.lista);
  const posicao = Math.max(0, chaves.indexOf(String(atual ?? '')));
  return (
    <ol className="flex w-full items-center gap-2" aria-label="Etapas">
      {chaves.map((chave, i) => {
        const feita = i < posicao;
        const corrente = i === posicao;
        return (
          <li key={chave} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                feita && 'border-primary bg-primary text-primary-foreground',
                corrente && 'border-primary text-foreground ring-4 ring-primary/15',
                !feita && !corrente && 'text-muted-foreground'
              )}
              aria-current={corrente ? 'step' : undefined}
            >
              {feita ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('truncate text-sm', corrente ? 'font-semibold' : 'text-muted-foreground')}>{def.etapas!.lista[chave]}</span>
            {i < chaves.length - 1 && <span className={cn('h-px min-w-6 flex-1', feita ? 'bg-primary' : 'bg-border')} />}
          </li>
        );
      })}
    </ol>
  );
};
