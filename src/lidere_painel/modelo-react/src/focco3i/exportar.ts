/**
 * Exportar de dentro do painel: Excel, imagem e impressão. As bibliotecas vão no pacote
 * (o painel não tem rede). O iframe do portal libera download e impressão (allow-downloads,
 * allow-modals); nada sai do navegador do usuário.
 */
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const baixar = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const hoje = () => new Date().toISOString().slice(0, 10);

export interface PlanilhaExcel {
  nome: string;
  /** Linhas como objetos; as chaves viram o cabeçalho (use `colunas` para escolher e rotular). */
  linhas: Record<string, unknown>[];
  colunas?: { chave: string; titulo: string }[];
}

/** Gera um .xlsx com uma ou mais abas. */
export const exportarExcel = (arquivo: string, planilhas: PlanilhaExcel[]) => {
  const livro = XLSX.utils.book_new();
  planilhas.forEach((p) => {
    const linhas = p.colunas
      ? p.linhas.map((l) => Object.fromEntries(p.colunas!.map((c) => [c.titulo, l[c.chave]])))
      : p.linhas;
    XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(linhas), p.nome.slice(0, 31));
  });
  const binario = XLSX.write(livro, { bookType: 'xlsx', type: 'array' });
  baixar(new Blob([binario], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${arquivo}_${hoje()}.xlsx`);
};

/** Baixa um PNG do elemento (um cartão, uma aba inteira). */
export const exportarImagem = async (elemento: HTMLElement, arquivo: string, escala = 2) => {
  const canvas = await html2canvas(elemento, { scale: escala, backgroundColor: '#ffffff', logging: false });
  await new Promise<void>((resolve) =>
    canvas.toBlob((blob) => {
      if (blob) baixar(blob, `${arquivo}_${hoje()}.png`);
      resolve();
    }, 'image/png')
  );
};

/** Abre a impressão do navegador para o painel (use CSS @media print para esconder filtros). */
export const imprimir = () => window.print();
