import { GlobalStyles } from '@mui/material';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ID = 'pf-impressao';

/*
 * A folha vai num recipiente PROPRIO, fora da arvore da tela (portal em <body>), que so existe durante
 * a impressao. A visibilidade e do recipiente, com !important: o layout de dentro da folha (grid, flex,
 * sx) nunca vaza para a tela. Na impressao, so o recipiente aparece.
 */
const estilos = (
  <GlobalStyles
    styles={{
      [`@media screen`]: { [`#${ID}`]: { display: 'none !important' } },
      [`@media print`]: {
        '@page': { size: 'A4', margin: '14mm' },
        [`body > *:not(#${ID})`]: { display: 'none !important' },
        [`#${ID}`]: { display: 'block !important' },
        'html, body': { background: '#fff !important' }
      }
    }}
  />
);

/**
 * Impressão de um registro (ficha, ordem, etiqueta): a folha NUNCA aparece na tela, só no papel.
 *
 *   const { imprimir, folha } = useImpressao();
 *   ...
 *   <IconButton onClick={() => imprimir(<FichaAssistencia registro={l} />)}>...</IconButton>
 *   {folha}
 *
 * `imprimir` desenha a folha, abre a impressão do navegador e remove a folha quando ela termina.
 */
export function useImpressao() {
  const [conteudo, setConteudo] = useState<ReactNode | null>(null);

  useEffect(() => {
    if (conteudo === null) return;
    const terminar = () => setConteudo(null);
    window.addEventListener('afterprint', terminar);
    // Espera a folha desenhar (e as consultas dela responderem) antes de abrir a impressão.
    const t = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', terminar);
    };
  }, [conteudo]);

  const imprimir = useCallback((folha: ReactNode) => setConteudo(folha), []);

  const folha =
    conteudo === null
      ? null
      : createPortal(
          <div id={ID}>
            {estilos}
            {conteudo}
          </div>,
          document.body
        );

  return { imprimir, folha };
}
