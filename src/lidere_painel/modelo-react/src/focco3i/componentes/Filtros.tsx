import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { Parametros } from '../runtime';

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
}

interface Props {
  campos: CampoFiltro[];
  valores: Parametros;
  aoAplicar: (valores: Parametros) => void;
  /** Valores do "Limpar" (ex.: situação volta para ABERTO). Padrão: tudo vazio. */
  padrao?: Parametros;
}

/**
 * Formulário de filtros. Campo vazio = filtro não aplicado: o parâmetro não é enviado
 * e chega como NULL no SQL ( :p IS NULL OR ... ). Aplica no botão ou com Enter.
 */
export const Filtros = ({ campos, valores, aoAplicar, padrao = {} }: Props) => {
  const [rascunho, setRascunho] = useState<Parametros>(valores);
  useEffect(() => setRascunho(valores), [valores]);

  const aplicar = (e?: FormEvent) => {
    e?.preventDefault();
    aoAplicar(rascunho);
  };

  return (
    <Box component="form" onSubmit={aplicar} noValidate>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', alignItems: 'end' }}>
        {campos.map((c) => (
          <TextField
            key={c.nome}
            size="small"
            label={c.rotulo}
            type={c.tipo === 'data' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
            select={c.tipo === 'selecao'}
            value={rascunho[c.nome] ?? ''}
            placeholder={c.placeholder}
            onChange={(e) => setRascunho({ ...rascunho, [c.nome]: e.target.value })}
            InputLabelProps={{ shrink: true }}
            SelectProps={c.tipo === 'selecao' ? { displayEmpty: true } : undefined}
            fullWidth
          >
            {c.tipo === 'selecao' && [
              ...(c.semTodos ? [] : [<MenuItem key="" value="">{c.rotuloTodos ?? 'Todos'}</MenuItem>]),
              ...(c.opcoes ?? []).map((o) => (
                <MenuItem key={String(o.valor)} value={o.valor}>{o.rotulo}</MenuItem>
              ))
            ]}
          </TextField>
        ))}
        <Stack direction="row" gap={1}>
          <Button type="submit" variant="contained">Aplicar</Button>
          <Button onClick={() => { setRascunho(padrao); aoAplicar(padrao); }}>Limpar</Button>
        </Stack>
      </Box>
    </Box>
  );
};
