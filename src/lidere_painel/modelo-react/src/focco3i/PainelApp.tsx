import { Box, CircularProgress, CssBaseline, ThemeProvider } from '@mui/material';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { ContextoPainel, pronto } from './runtime';
import { coresSerie, criarTema } from './tema';

interface ValorContexto {
  contexto: ContextoPainel;
  corPrimaria: string;
  cores: string[];
}

const Contexto = createContext<ValorContexto | null>(null);

/** Envolve o painel: espera o portal mandar o contexto e aplica o tema com a cor da empresa. */
export const PainelApp = ({ children }: { children: ReactNode }) => {
  const [contexto, setContexto] = useState<ContextoPainel | null>(null);

  useEffect(() => {
    pronto().then(setContexto);
  }, []);

  const corPrimaria = contexto?.portal?.cor_primaria || '#674596';
  const tema = useMemo(() => criarTema(corPrimaria), [corPrimaria]);

  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      {contexto ? (
        <Contexto.Provider value={{ contexto, corPrimaria, cores: coresSerie(corPrimaria) }}>{children}</Contexto.Provider>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}
    </ThemeProvider>
  );
};

export const usePainel = () => {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('usePainel precisa estar dentro de <PainelApp>.');
  return valor;
};
