/**
 * Componentes base no estilo shadcn (new-york) do portal web2: mesmas classes e tokens dos
 * `components/ui` do portal. Use estes em vez de HTML cru para o painel ter a cara do portal.
 */
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, ChevronDown, Info, Loader2, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import { cn } from '../utils';

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive-foreground text-destructive hover:bg-destructive-foreground/70 dark:bg-destructive-foreground dark:text-destructive dark:hover:bg-destructive/50',
        outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline !p-0 w-max'
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
);

export function Button({ className, variant, size, type = 'button', ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type={type} data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

const campoBase =
  'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(campoBase, 'h-9', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(campoBase, 'min-h-20 py-2', className)} {...props} />;
}

/** Seleção nativa com a cara do Select do portal (funciona dentro do iframe sem camada flutuante). */
export function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select data-slot="select" className={cn(campoBase, 'h-9 cursor-pointer appearance-none pr-8 [&>option]:bg-popover [&>option]:text-popover-foreground')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground opacity-70" />
    </div>
  );
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label data-slot="label" className={cn('flex items-center gap-2 text-sm leading-none font-medium select-none', className)} {...props} />;
}

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive/15 text-destructive border-destructive/20 dark:bg-destructive/20',
        outline: 'border-border text-foreground',
        sucesso: 'bg-sucesso/15 text-sucesso border-sucesso/25',
        alerta: 'bg-alerta/15 text-alerta border-alerta/30',
        destaque: 'bg-brand-accent/15 text-foreground border-brand-accent/30'
      }
    },
    defaultVariants: { variant: 'secondary' }
  }
);

export type VarianteBadge = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('flex min-w-0 flex-col gap-4 rounded-xl border bg-card py-5 text-card-foreground shadow-xs', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-wrap items-start justify-between gap-3 px-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('text-base leading-tight font-semibold', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('min-w-0 px-5', className)} {...props} />;
}

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}
export const TableHeader = ({ className, ...props }: React.ComponentProps<'thead'>) => (
  <thead data-slot="table-header" className={cn('border-b [&>tr:first-child]:bg-transparent', className)} {...props} />
);
export const TableBody = ({ className, ...props }: React.ComponentProps<'tbody'>) => (
  <tbody data-slot="table-body" className={cn(className)} {...props} />
);
export const TableFooter = ({ className, ...props }: React.ComponentProps<'tfoot'>) => (
  <tfoot data-slot="table-footer" className={cn('border-t bg-muted/50 font-medium', className)} {...props} />
);
export const TableRow = ({ className, ...props }: React.ComponentProps<'tr'>) => (
  <tr data-slot="table-row" className={cn('transition-colors odd:bg-muted/40 hover:bg-muted/70 data-[state=selected]:bg-muted', className)} {...props} />
);
export const TableHead = ({ className, ...props }: React.ComponentProps<'th'>) => (
  <th
    data-slot="table-head"
    className={cn('h-10 px-3 text-left align-middle text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase', className)}
    {...props}
  />
);
export const TableCell = ({ className, ...props }: React.ComponentProps<'td'>) => (
  <td data-slot="table-cell" className={cn('px-3 py-2.5 align-middle whitespace-nowrap', className)} {...props} />
);

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('animate-pulse rounded-md bg-accent', className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 role="status" aria-label="Carregando" className={cn('size-4 animate-spin', className)} />;
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full shrink-0 bg-border', className)} />;
}

const tons = {
  info: { classe: 'border-brand-accent/30 bg-brand-accent/10', icone: Info, cor: 'text-brand-accent' },
  sucesso: { classe: 'border-sucesso/30 bg-sucesso/10', icone: CheckCircle2, cor: 'text-sucesso' },
  alerta: { classe: 'border-alerta/30 bg-alerta/10', icone: TriangleAlert, cor: 'text-alerta' },
  erro: { classe: 'border-destructive/30 bg-destructive/10', icone: AlertCircle, cor: 'text-destructive' }
};

/** Aviso em caixa (o Callout do portal): info, sucesso, alerta ou erro. */
export function Aviso({ tom = 'info', titulo, children, className }: { tom?: keyof typeof tons; titulo?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const t = tons[tom];
  const Icone = t.icone;
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', t.classe, className)}>
      <Icone className={cn('mt-0.5 size-4 shrink-0', t.cor)} />
      <div className="min-w-0 space-y-0.5">
        {titulo && <div className="font-medium">{titulo}</div>}
        {children && <div className="whitespace-pre-wrap text-foreground/80">{children}</div>}
      </div>
    </div>
  );
}
