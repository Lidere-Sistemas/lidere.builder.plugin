import { FileSpreadsheet, ImageDown, Printer } from 'lucide-react';
import { RefObject, useState } from 'react';
import { exportarExcel, exportarImagem, imprimir, PlanilhaExcel } from '../exportar';
import { Button, Spinner } from '../ui';

/**
 * Botões de exportar no padrão do portal (outline, pequenos). Passe só o que fizer sentido:
 * `planilhas` para Excel, `alvo` para PNG, `impressao` para imprimir.
 */
export const Exportar = ({
  arquivo,
  planilhas,
  alvo,
  impressao
}: {
  arquivo: string;
  planilhas?: () => PlanilhaExcel[];
  alvo?: RefObject<HTMLElement | null>;
  impressao?: boolean;
}) => {
  const [gerando, setGerando] = useState(false);
  return (
    <div className="pf-sem-impressao flex items-center gap-2">
      {planilhas && (
        <Button variant="outline" size="sm" onClick={() => exportarExcel(arquivo, planilhas())}>
          <FileSpreadsheet /> Excel
        </Button>
      )}
      {alvo && (
        <Button
          variant="outline"
          size="sm"
          disabled={gerando}
          onClick={async () => {
            if (!alvo.current) return;
            setGerando(true);
            try {
              await exportarImagem(alvo.current, arquivo);
            } finally {
              setGerando(false);
            }
          }}
        >
          {gerando ? <Spinner /> : <ImageDown />} Imagem
        </Button>
      )}
      {impressao && (
        <Button variant="outline" size="sm" onClick={imprimir}>
          <Printer /> Imprimir
        </Button>
      )}
    </div>
  );
};
