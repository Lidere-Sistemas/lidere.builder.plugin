import { Alert, Box, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';

/** Página do painel no padrão das telas do portal. */
export const Pagina = ({ titulo, subtitulo, acoes, children }: { titulo: string; subtitulo?: string; acoes?: ReactNode; children: ReactNode }) => (
  <Box sx={{ p: { xs: 1.5, sm: 2 }, display: 'grid', gap: 2.5, width: '100%', boxSizing: 'border-box' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} gap={2}>
      <Box>
        <Typography variant="h3" component="h1">
          {titulo}
        </Typography>
        {subtitulo && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, maxWidth: '80ch' }}>
            {subtitulo}
          </Typography>
        )}
      </Box>
      {acoes && <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">{acoes}</Stack>}
    </Stack>
    {children}
  </Box>
);

export const Cartao = ({ titulo, acao, children, sx }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; sx?: object }) => (
  <Card sx={{ minWidth: 0, ...sx }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.75 }}>
      {(titulo || acao) && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
          {titulo && <Typography variant="h5">{titulo}</Typography>}
          {acao}
        </Stack>
      )}
      {children}
    </CardContent>
  </Card>
);

export interface Indicador {
  rotulo: string;
  valor: ReactNode;
  nota?: ReactNode;
  cor?: 'primary' | 'error' | 'warning' | 'success';
}

export const Indicadores = ({ itens }: { itens: Indicador[] }) => (
  <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
    {itens.map((i) => (
      <Card key={i.rotulo}>
        <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
          <Typography variant="subtitle2" color="text.secondary">
            {i.rotulo}
          </Typography>
          <Typography variant="h3" sx={{ fontVariantNumeric: 'tabular-nums', mt: 0.5, color: i.cor ? `${i.cor}.dark` : 'text.primary' }}>
            {i.valor}
          </Typography>
          {i.nota && (
            <Typography variant="body2" color="text.disabled">
              {i.nota}
            </Typography>
          )}
        </CardContent>
      </Card>
    ))}
  </Box>
);

/** Grade responsiva: colunas de 12; abaixo de 1024px vira uma coluna só. */
export const Grade = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' } }}>{children}</Box>
);

export const Coluna = ({ span, children }: { span: number; children: ReactNode }) => (
  <Box sx={{ gridColumn: { xs: 'auto', md: `span ${span}` }, minWidth: 0, display: 'grid' }}>{children}</Box>
);

export const Chips = ({ itens }: { itens: { rotulo: ReactNode; alerta?: boolean }[] }) => (
  <Stack direction="row" gap={1} flexWrap="wrap">
    {itens.map((c, n) => (
      <Chip key={n} size="small" label={c.rotulo} color={c.alerta ? 'warning' : 'default'} variant={c.alerta ? 'outlined' : 'filled'} />
    ))}
  </Stack>
);

/** Campos rotulados (ficha de detalhe, cabeçalho de um registro no drill). */
export const Campos = ({ itens, minimo = 180 }: { itens: { rotulo: string; valor: ReactNode }[]; minimo?: number }) => (
  <Box component="dl" sx={{ m: 0, display: 'grid', gap: '10px 20px', gridTemplateColumns: `repeat(auto-fill, minmax(${minimo}px, 1fr))` }}>
    {itens.map((i) => (
      <Box key={i.rotulo} sx={{ minWidth: 0 }}>
        <Typography component="dt" variant="subtitle2" color="text.disabled">
          {i.rotulo}
        </Typography>
        <Typography component="dd" variant="body1" sx={{ m: 0, overflowWrap: 'anywhere' }}>
          {i.valor === null || i.valor === undefined || i.valor === '' ? '–' : i.valor}
        </Typography>
      </Box>
    ))}
  </Box>
);

/** Os três estados obrigatórios: carregando, erro (mensagem do servidor) e vazio. */
export const Estado = ({
  carregando,
  erro,
  vazio,
  mensagemVazio = 'Nenhum dado com esses filtros.',
  children
}: {
  carregando?: boolean;
  erro?: string | null;
  vazio?: boolean;
  mensagemVazio?: string;
  children?: ReactNode;
}) => {
  if (erro) return <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>{erro}</Alert>;
  if (carregando)
    return (
      <Stack direction="row" gap={1.5} alignItems="center" sx={{ p: 3, justifyContent: 'center', color: 'text.secondary' }}>
        <CircularProgress size={20} /> <Typography>Carregando dados do ERP…</Typography>
      </Stack>
    );
  if (vazio)
    return (
      <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
        {mensagemVazio}
      </Typography>
    );
  return <>{children}</>;
};
