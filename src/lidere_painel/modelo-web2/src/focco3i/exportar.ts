/**
 * Exportar de dentro do painel: Excel, imagem e impressão. As bibliotecas vão no pacote
 * (o painel não tem rede). O iframe do portal libera download e impressão (allow-downloads,
 * allow-modals); nada sai do navegador do usuário.
 */
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';

const baixar = (url: string, nome: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const hoje = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

export interface PlanilhaExcel {
  nome: string;
  /** Linhas como objetos; as chaves viram o cabeçalho (use `colunas` para escolher e rotular). */
  linhas: Record<string, unknown>[];
  colunas?: { chave: string; titulo: string }[];
}

/** Gera um .xlsx com uma ou mais abas (números continuam números na planilha). */
export const exportarExcel = (arquivo: string, planilhas: PlanilhaExcel[]) => {
  const livro = XLSX.utils.book_new();
  planilhas.forEach((p) => {
    const linhas = p.colunas
      ? p.linhas.map((l) => Object.fromEntries(p.colunas!.map((c) => [c.titulo, l[c.chave]])))
      : p.linhas;
    XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(linhas), p.nome.slice(0, 31));
  });
  const binario = XLSX.write(livro, { bookType: 'xlsx', type: 'array' });
  const url = URL.createObjectURL(new Blob([binario], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  baixar(url, `${arquivo}_${hoje()}.xlsx`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Baixa um PNG do elemento (um cartão, a página inteira), no tema que está na tela. */
export const exportarImagem = async (elemento: HTMLElement, arquivo: string, escala = 2) => {
  const fundo = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#ffffff';
  const url = await toPng(elemento, {
    pixelRatio: escala,
    backgroundColor: fundo,
    cacheBust: false,
    filter: (no) => !(no instanceof HTMLElement && no.classList.contains('pf-sem-impressao'))
  });
  baixar(url, `${arquivo}_${hoje()}.png`);
};

/** Abre a impressão do navegador para o painel (filtros e botões com `pf-sem-impressao` somem). */
export const imprimir = () => window.print();
