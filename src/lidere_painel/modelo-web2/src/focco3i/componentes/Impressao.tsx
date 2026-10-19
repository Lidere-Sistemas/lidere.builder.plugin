import { ReactNode, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ID = 'pf-impressao';
const CSS = `
@media screen { #${ID} { display: none !important; } }
@media print {
  @page { size: A4; margin: 14mm; }
  body > *:not(#${ID}) { display: none !important; }
  #${ID} { display: block !important; }
  html, body { background: #fff !important; color: #111 !important; }
}`;

/**
 * Impressão de um registro (ficha, ordem, etiqueta): a folha NUNCA aparece na tela, só no papel.
 *
 *   const { imprimir, folha } = useImpressao();
 *   <Button onClick={() => imprimir(<FichaRnc registro={r} />)}>Imprimir</Button>
 *   {folha}
 */
export function useImpressao() {
  const [conteudo, setConteudo] = useState<ReactNode | null>(null);

  useEffect(() => {
    if (conteudo === null) return;
    const terminar = () => setConteudo(null);
    window.addEventListener('afterprint', terminar);
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
            <style>{CSS}</style>
            {conteudo}
          </div>,
          document.body
        );
  return { imprimir, folha };
}
