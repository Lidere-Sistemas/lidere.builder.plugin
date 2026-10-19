import { Inbox, LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { Aviso, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, VarianteBadge } from '../ui';
import { cn } from '../utils';

/**
 * Página do painel no padrão das telas do portal web2: largura total, título + descrição à
 * esquerda, filtros/ações à direita. O nome do painel já aparece no cabeçalho do portal; o
 * título aqui é a pergunta que a tela responde.
 */
export const Pagina = ({
  titulo,
  subtitulo,
  acoes,
  children,
  className
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <main className={cn('flex w-full flex-col gap-5 px-6 pt-6 pb-8', className)}>
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="max-w-[100ch] text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {acoes && <div className="pf-sem-impressao flex shrink-0 flex-wrap items-end gap-2 lg:justify-end">{acoes}</div>}
    </header>
    {children}
  </main>
);

/** Cartão com título, descrição opcional e ação à direita (exportar, alternar visão). */
export const Cartao = ({
  titulo,
  descricao,
  acao,
  children,
  className,
  conteudo
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Classe do conteúdo (ex.: 'px-0' para tabela de ponta a ponta). */
  conteudo?: string;
}) => (
  <Card className={className}>
    {(titulo || acao) && (
      <CardHeader>
        <div className="min-w-0 space-y-1">
          {titulo && <CardTitle>{titulo}</CardTitle>}
          {descricao && <CardDescription>{descricao}</CardDescription>}
        </div>
        {acao && <div className="pf-sem-impressao flex items-center gap-2">{acao}</div>}
      </CardHeader>
    )}
    <CardContent className={conteudo}>{children}</CardContent>
  </Card>
);

export interface Indicador {
  rotulo: string;
  valor: ReactNode;
  nota?: ReactNode;
  icone?: LucideIcon;
  /** Destaque do valor: padrão, positivo, alerta ou negativo. */
  tom?: 'padrao' | 'sucesso' | 'alerta' | 'erro';
}

const corTom = { padrao: 'text-foreground', sucesso: 'text-sucesso', alerta: 'text-alerta', erro: 'text-destructive' };

/** Faixa de KPIs (cards do portal). Quebra sozinha conforme a largura. */
export const Indicadores = ({ itens, carregando }: { itens: Indicador[]; carregando?: boolean }) => (
  <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
    {itens.map((i) => {
      const Icone = i.icone;
      return (
        <Card key={i.rotulo} className="gap-1.5 py-4">
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="truncate">{i.rotulo}</span>
              {Icone && <Icone className="size-4 shrink-0 opacity-70" />}
            </div>
            {carregando ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className={cn('text-2xl font-semibold tracking-tight tabular-nums', corTom[i.tom ?? 'padrao'])}>{i.valor}</div>
            )}
            {i.nota && <div className="truncate text-xs text-muted-foreground">{i.nota}</div>}
          </CardContent>
        </Card>
      );
    })}
  </div>
);

/** Grade de 12 colunas; abaixo de 1024px vira uma coluna só. */
export const Grade = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-12', className)}>{children}</div>
);

const spans: Record<number, string> = {
  3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6', 7: 'lg:col-span-7',
  8: 'lg:col-span-8', 9: 'lg:col-span-9', 12: 'lg:col-span-12'
};

export const Coluna = ({ span, children }: { span: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12; children: ReactNode }) => (
  <div className={cn('grid min-w-0', spans[span])}>{children}</div>
);

/** Etiquetas de contexto (período, regra aplicada, aviso de mês parcial). */
export const Chips = ({ itens }: { itens: { rotulo: ReactNode; tom?: VarianteBadge }[] }) => (
  <div className="flex flex-wrap gap-2">
    {itens.map((c, n) => (
      <Badge key={n} variant={c.tom ?? 'secondary'} className="px-2.5 py-1 text-xs font-normal">
        {c.rotulo}
      </Badge>
    ))}
  </div>
);

/** Campos rotulados (ficha de detalhe, cabeçalho de um registro). */
export const Campos = ({ itens, minimo = 180 }: { itens: { rotulo: string; valor: ReactNode }[]; minimo?: number }) => (
  <dl className="m-0 grid gap-x-6 gap-y-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minimo}px, 1fr))` }}>
    {itens.map((i) => (
      <div key={i.rotulo} className="min-w-0 space-y-1">
        <dt className="text-xs text-muted-foreground">{i.rotulo}</dt>
        <dd className="m-0 text-sm break-words whitespace-pre-wrap">{i.valor === null || i.valor === undefined || i.valor === '' ? '–' : i.valor}</dd>
      </div>
    ))}
  </dl>
);

/** Vazio no padrão do portal: ícone, frase curta e (opcional) uma ação. */
export const Vazio = ({ mensagem = 'Nenhum dado com esses filtros.', acao, icone: Icone = Inbox }: { mensagem?: ReactNode; acao?: ReactNode; icone?: LucideIcon }) => (
  <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-sm text-muted-foreground">
    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
      <Icone className="size-5" />
    </div>
    <p>{mensagem}</p>
    {acao}
  </div>
);

/** Carregando no formato da tela (esqueleto de KPIs + bloco), como o portal faz. */
export const Carregando = ({ kpis = 4 }: { kpis?: number }) => (
  <div className="flex flex-col gap-4" aria-busy="true">
    {kpis > 0 && (
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {Array.from({ length: kpis }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )}
    <Skeleton className="h-80 rounded-xl" />
  </div>
);

/** Os três estados obrigatórios: carregando, erro (mensagem do servidor) e vazio. */
export const Estado = ({
  carregando,
  erro,
  vazio,
  mensagemVazio = 'Nenhum dado com esses filtros.',
  kpis = 4,
  children
}: {
  carregando?: boolean;
  erro?: string | null;
  vazio?: boolean;
  mensagemVazio?: string;
  kpis?: number;
  children?: ReactNode;
}) => {
  if (erro) return <Aviso tom="erro" titulo="Não foi possível carregar os dados">{erro}</Aviso>;
  if (carregando) return <Carregando kpis={kpis} />;
  if (vazio)
    return (
      <Card className="py-0">
        <Vazio mensagem={mensagemVazio} />
      </Card>
    );
  return <>{children}</>;
};
