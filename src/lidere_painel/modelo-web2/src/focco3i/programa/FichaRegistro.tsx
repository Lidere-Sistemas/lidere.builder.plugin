import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';
import * as fmt from '../formato';
import { useEntidade } from '../hooks';
import { DefinicaoEntidade, DefinicaoModulo, entidade as api, Registro } from '../runtime';
import { Aviso, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '../ui';
import { Campos } from '../componentes/Layout';
import { AcoesFilhas } from './AcoesFilhas';
import { BadgeEtapa, plural, textoValor, tituloRegistro, vazio } from './comum';
import { Etapas } from './Etapas';
import { FormularioRegistro } from './FormularioRegistro';
import { Historico } from './Historico';

const ContagemFilhos = ({ def, pai, versao, children }: { def: DefinicaoEntidade; pai: { entidade: string; id: number }; versao: number; children: (total: number | null) => ReactNode }) => {
  const consulta = useMemo(() => ({ filtros: { [`${pai.entidade}_id`]: pai.id }, tamanho: 1, _v: versao }), [pai, versao]);
  const r = useEntidade(def.chave, consulta);
  return <>{children(r.carregando ? null : r.total)}</>;
};

/**
 * Ficha de um registro, na página: cabeçalho com etapa, o que falta para avançar e o que fazer
 * agora, dados, registros filhos (ações) e histórico. Mudar de etapa é ação secundária.
 */
export const FichaRegistro = ({
  modulo,
  def,
  registro: inicial,
  aoVoltar,
  aoExcluir,
  podeEditar = true,
  podeExcluir = true
}: {
  modulo: DefinicaoModulo;
  def: DefinicaoEntidade;
  registro: Registro;
  aoVoltar: () => void;
  aoExcluir?: () => void;
  podeEditar?: boolean;
  podeExcluir?: boolean;
}) => {
  const [registro, setRegistro] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [movendo, setMovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [versaoFilhos, setVersaoFilhos] = useState(0);
  const [novoFilho, setNovoFilho] = useState<string | null>(null);

  const filhos = Object.values(modulo.entidades).filter((e) => e.pai === def.chave);
  const pai = { entidade: def.chave, id: registro.id };
  const ordem = def.etapas ? Object.keys(def.etapas.lista) : [];
  const atual = ordem.indexOf(String(registro.etapa));
  const transicoes = def.etapas ? def.etapas.transicoes[String(registro.etapa)] || [] : [];
  // Para frente = próximas etapas; para trás (reabrir) vira ação discreta "Voltar para".
  const proximas = transicoes.filter((p) => ordem.indexOf(p) > atual);
  const anteriores = transicoes.filter((p) => ordem.indexOf(p) <= atual);
  const faltando = def.campos.filter((c) => c.obrigatorio && vazio(registro[c.chave]));
  const textoLongo = def.campos.filter((c) => c.tipo === 'texto_longo');
  const curtos = def.campos.filter((c) => c.tipo !== 'texto_longo');

  const mover = async (etapa: string) => {
    setErro(null);
    setAviso(null);
    setMovendo(etapa);
    try {
      const novo = await api(def.chave).mudarEtapa(registro.id, registro.versao, etapa);
      setRegistro(novo);
      setAviso(`Etapa alterada para ${def.etapas!.lista[etapa] || etapa}.`);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setMovendo(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={aoVoltar} className="-ml-2"><ArrowLeft /> Voltar para a lista</Button>
        {!editando && (
          <div className="flex items-center gap-2">
            {podeEditar && <Button variant="outline" size="sm" onClick={() => setEditando(true)}><Pencil /> Editar</Button>}
            {podeExcluir && !confirmar && <Button variant="ghost" size="sm" onClick={() => setConfirmar(true)}><Trash2 /> Excluir</Button>}
            {confirmar && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 py-1 pr-1 pl-3 text-sm">
                Excluir {registro.numero ? String(registro.numero) : 'este registro'}{filhos.length ? ' e o que está ligado a ele' : ''}?
                <Button variant="outline" size="sm" onClick={() => setConfirmar(false)}>Não</Button>
                <Button variant="destructive" size="sm" onClick={async () => {
                  try { await api(def.chave).excluir(registro.id); aoExcluir?.(); } catch (e: any) { setErro(String(e?.message || e)); setConfirmar(false); }
                }}>Excluir</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{tituloRegistro(def, registro)}</h1>
          {def.etapas && <BadgeEtapa def={def} etapa={registro.etapa} />}
        </div>
        <p className="text-sm text-muted-foreground">
          Registrado por {String(registro.criado_por ?? '–')} em {fmt.dataHora(registro.criado_em)}
          {registro.alterado_em ? ` · última alteração por ${String(registro.alterado_por ?? '–')} em ${fmt.dataHora(registro.alterado_em)}` : ''}
        </p>
      </header>

      {erro && <Aviso tom="erro" titulo="Não foi possível concluir">{erro}</Aviso>}
      {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}

      {def.etapas && !editando && (
        <Card className="gap-5">
          <CardContent className="flex flex-col gap-5">
            <Etapas def={def} atual={registro.etapa} />
            <ContagemFilhos def={filhos[0] ?? def} pai={pai} versao={versaoFilhos}>
              {(totalFilhos) => {
                const semFilhos = filhos.length > 0 && totalFilhos === 0;
                const pendencias = [
                  ...faltando.map((c) => `Preencher ${c.rotulo.toLowerCase()}`),
                  ...(semFilhos ? [`Registrar ao menos uma ${filhos[0].nome.toLowerCase()}`] : [])
                ];
                const final = transicoes.length === 0;
                return (
                  <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      {final || !pendencias.length ? (
                        <CircleCheck className="mt-0.5 size-5 shrink-0 text-sucesso" />
                      ) : (
                        <CircleAlert className="mt-0.5 size-5 shrink-0 text-alerta" />
                      )}
                      <div className="space-y-0.5 text-sm">
                        <div className="font-medium">
                          {final ? 'Concluído' : pendencias.length ? 'O que falta para avançar' : 'Nada pendente'}
                        </div>
                        <div className="text-muted-foreground">
                          {final
                            ? 'Não há próxima etapa. O histórico fica guardado ao lado.'
                            : pendencias.length
                              ? pendencias.join(' · ')
                              : proximas.length ? `Próxima etapa: ${proximas.map((p) => def.etapas!.lista[p]).join(' ou ')}.` : 'Sem próxima etapa.'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {semFilhos && podeEditar && (
                        <Button onClick={() => setNovoFilho(filhos[0].chave)}><Plus /> Adicionar {filhos[0].nome.toLowerCase()}</Button>
                      )}
                      {faltando.length > 0 && podeEditar && (
                        <Button onClick={() => setEditando(true)}><Pencil /> Completar dados</Button>
                      )}
                      {podeEditar && anteriores.map((p) => (
                        <Button key={p} variant="ghost" disabled={!!movendo} onClick={() => mover(p)}>
                          {movendo === p ? <Spinner /> : <Undo2 />} Voltar para {def.etapas!.lista[p] || p}
                        </Button>
                      ))}
                      {podeEditar && proximas.map((p) => (
                        <Button key={p} variant="outline" disabled={!!movendo} onClick={() => mover(p)}>
                          {movendo === p ? <Spinner /> : <ArrowRight />} Mover para {def.etapas!.lista[p] || p}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              }}
            </ContagemFilhos>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <Card>
            <CardHeader><CardTitle>{editando ? `Editar ${def.nome}` : 'Dados'}</CardTitle></CardHeader>
            <CardContent>
              {editando ? (
                <FormularioRegistro def={def} registro={registro} aoCancelar={() => setEditando(false)}
                  aoSalvar={(r) => { setRegistro(r); setEditando(false); setAviso('Alterações salvas.'); }} />
              ) : (
                <div className="flex flex-col gap-5">
                  <Campos itens={curtos.map((c) => ({ rotulo: c.rotulo, valor: textoValor(c, registro[c.chave]) }))} />
                  {textoLongo.map((c) => (
                    <div key={c.chave} className="space-y-1">
                      <div className="text-xs text-muted-foreground">{c.rotulo}</div>
                      <p className="text-sm whitespace-pre-wrap">{textoValor(c, registro[c.chave])}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {filhos.map((f) => (
            <Card key={f.chave}>
              <CardHeader><CardTitle>{plural(f.nome)}</CardTitle></CardHeader>
              <CardContent>
                <AcoesFilhas def={f} pai={pai} podeEditar={podeEditar} abrirNovo={novoFilho === f.chave}
                  aoFecharNovo={() => setNovoFilho(null)} aoMudar={() => setVersaoFilhos((v) => v + 1)} />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card>
            <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
            <CardContent><Historico def={def} id={registro.id} versao={registro.versao} /></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
