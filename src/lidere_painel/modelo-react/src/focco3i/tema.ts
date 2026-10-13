import { alpha, createTheme, darken, lighten } from '@mui/material/styles';

/**
 * Tema MUI espelhando o tema do portal padrão Lidere (template.web):
 * Inter, escala slate, primária = cor da empresa, cards raio 10, botões/campos raio 8.
 */
const cinza = {
  0: '#ffffff', 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
  500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1f2937', 900: '#0f172a'
};

export const criarTema = (corPrimaria = '#674596') => {
  const base = createTheme({
    palette: {
      mode: 'light',
      primary: { main: corPrimaria, light: lighten(corPrimaria, 0.2), dark: darken(corPrimaria, 0.1), contrastText: '#fff' },
      secondary: { main: cinza[500] },
      error: { main: '#ff4d4f', dark: '#cf1322' },
      warning: { main: '#faad14', dark: '#ad6800' },
      success: { main: '#52c41a', dark: '#237804' },
      info: { main: '#13c2c2' },
      text: { primary: cinza[900], secondary: cinza[700], disabled: cinza[500] },
      divider: cinza[200],
      background: { default: cinza[50], paper: cinza[0] },
      grey: cinza as never
    },
    shape: { borderRadius: 5 },
    breakpoints: { values: { xs: 0, sm: 768, md: 1024, lg: 1266, xl: 1536 } },
    typography: {
      fontFamily: "'Inter', 'Public Sans', 'Roboto', sans-serif",
      htmlFontSize: 16,
      h1: { fontWeight: 600, fontSize: '2.375rem', lineHeight: 1.21 },
      h2: { fontWeight: 600, fontSize: '1.875rem', lineHeight: 1.27 },
      h3: { fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.33 },
      h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
      h5: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },
      h6: { fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.57 },
      body1: { fontSize: '0.875rem', lineHeight: 1.57 },
      body2: { fontSize: '0.75rem', lineHeight: 1.66 },
      subtitle1: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.57 },
      subtitle2: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.66 },
      caption: { fontSize: '0.75rem', lineHeight: 1.66 },
      button: { textTransform: 'none' }
    }
  });
  return createTheme(base, {
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', borderRadius: 10 } } },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 10, border: `1px solid ${cinza[200]}`, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)' }
        }
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
          contained: { boxShadow: '0 10px 18px rgba(15, 23, 42, 0.12)' }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: cinza[0],
            '& .MuiOutlinedInput-notchedOutline': { borderColor: cinza[200] },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: cinza[300] },
            '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(corPrimaria, 0.12)}` }
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: cinza[200] },
          head: { fontSize: '0.75rem', fontWeight: 600, color: cinza[700], textTransform: 'uppercase', letterSpacing: '.02em', backgroundColor: cinza[50] }
        }
      }
    }
  });
};

/** Cores de série para gráficos: primária primeiro, depois as do tema. */
export const coresSerie = (corPrimaria: string) => [corPrimaria, '#13c2c2', '#faad14', '#52c41a', '#94a3b8', '#ff7875'];
