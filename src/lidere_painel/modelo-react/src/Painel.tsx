import { Cartao, Chips, ColunaTabela, Estado, fmt, Grafico, Indicadores, Pagina, TabelaDados, useConsulta } from './focco3i';

/*
 * Ponto de partida GENÉRICO: lê o que a consulta `principal` devolver e já monta indicadores,
 * gráfico e tabela formatados. Serve para a primeira olhada; o painel de verdade troca isto por
 * KPIs, gráficos e filtros pensados para a pergunta do usuário (veja o guia_painel do MCP).
 */

type Linha = Record<string, unknown>;
type Tipo = NonNullable<ColunaTabela<Linha>['tipo']> | 'mes';

const RE_MES = /^\d{4}-\d{2}$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}/;
const RE_MOEDA = /(^|_)(vlr|valor|preco|custo|receita|total|saldo)(_|$)/;
const RE_PERCENTUAL = /(^|_)(perc|pct|percentual|margem|taxa)(_|$)/;

/** Tipo da coluna pelo primeiro valor preenchido e pelo nome. */
const tipoDa = (campo: string, linhas: Linha[]): Tipo => {
  const valor = linhas.find((l) => l[campo] != null)?.[campo];
  if (typeof valor === 'number') {
    if (RE_PERCENTUAL.test(campo)) return 'percentual';
    if (RE_MOEDA.test(campo)) return 'moeda';
    return Number.isInteger(valor) ? 'numero' : 'quantidade';
  }
  if (typeof valor === 'string' && RE_MES.test(valor)) return 'mes';
  if (typeof valor === 'string' && RE_DATA.test(valor)) return 'data';
  return 'texto';
};

/** "valor_total" -> "Valor total"; troque pelo rótulo de negócio no painel final. */
const rotulo = (campo: string) => campo.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const formatar = (tipo: Tipo, v: unknown) =>
  tipo === 'moeda' ? fmt.moeda(v)
  : tipo === 'percentual' ? fmt.percentual(v)
  : tipo === 'quantidade' ? fmt.quantidade(v)
  : tipo === 'numero' ? fmt.numero(v)
  : tipo === 'mes' ? fmt.mes(v)
  : tipo === 'data' ? fmt.data(v)
  : String(v ?? '–');

const numerico = (t: Tipo) => t === 'moeda' || t === 'numero' || t === 'quantidade' || t === 'percentual';

export const Painel = () => {
  const { dados, resultado, carregando, erro } = useConsulta<Linha>('principal', {});

  const campos = Object.keys(dados[0] ?? {});
  const tipos = Object.fromEntries(campos.map((c) => [c, tipoDa(c, dados)])) as Record<string, Tipo>;
  const medidas = campos.filter((c) => numerico(tipos[c]));
  const categoria = campos.find((c) => !numerico(tipos[c]));
  const principal = medidas.find((c) => tipos[c] === 'moeda') ?? medidas[0];

  const colunas: ColunaTabela<Linha>[] = campos.map((campo) => ({
    campo,
    titulo: rotulo(campo),
    tipo: tipos[campo] === 'mes' ? 'texto' : (tipos[campo] as ColunaTabela<Linha>['tipo']),
    render: tipos[campo] === 'mes' ? (l) => fmt.mes(l[campo]) : undefined
  }));

  // Totais só de medidas somáveis (percentual não soma).
  const indicadores = [
    { rotulo: 'Linhas', valor: fmt.numero(dados.length) },
    ...medidas
      .filter((c) => tipos[c] !== 'percentual')
      .slice(0, 3)
      .map((c) => ({ rotulo: `Total ${rotulo(c).toLowerCase()}`, valor: formatar(tipos[c], dados.reduce((a, l) => a + (Number(l[c]) || 0), 0)) }))
  ];

  const noTempo = categoria !== undefined && (tipos[categoria] === 'mes' || tipos[categoria] === 'data');
  const comGrafico = categoria !== undefined && principal !== undefined && dados.length > 1 && dados.length <= 60;

  return (
    <Pagina titulo="Novo painel" subtitulo="Primeira olhada no resultado da consulta. Troque pelo painel pensado para a pergunta do usuário.">
      <Estado carregando={carregando && !resultado} erro={erro} vazio={!carregando && dados.length === 0}>
        <Indicadores itens={indicadores} />
        {comGrafico && (
          <Cartao titulo={`${rotulo(principal)} por ${rotulo(categoria).toLowerCase()}`}>
            <Grafico
              tipo={noTempo ? 'line' : 'bar'}
              horizontal={!noTempo && dados.length > 8}
              categorias={dados.map((l) => formatar(tipos[categoria], l[categoria]))}
              series={[{ nome: rotulo(principal), valores: dados.map((l) => Number(l[principal]) || 0) }]}
              formatar={(v) => formatar(tipos[principal], v)}
            />
          </Cartao>
        )}
        <Cartao titulo="Detalhe">
          <TabelaDados colunas={colunas} linhas={dados} chave={(l) => JSON.stringify(l)} />
        </Cartao>
        {resultado && <Chips itens={[{ rotulo: `Lido ao vivo, só leitura · auditoria ${resultado.auditoria_id}` }]} />}
      </Estado>
    </Pagina>
  );
};
