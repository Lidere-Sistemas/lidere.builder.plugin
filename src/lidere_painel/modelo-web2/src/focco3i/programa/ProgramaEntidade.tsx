import { ArrowLeft } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Registro } from '../runtime';
import { Aviso, Button, Card, CardContent, CardHeader, CardTitle } from '../ui';
import { Pagina } from '../componentes/Layout';
import { useModulo } from './comum';
import { FichaRegistro } from './FichaRegistro';
import { FormularioRegistro } from './FormularioRegistro';
import { ListaRegistros } from './ListaRegistros';

type Tela = { tipo: 'lista' } | { tipo: 'novo' } | { tipo: 'ficha'; registro: Registro };

/**
 * Programa especial completo de uma entidade, no padrão do portal web2: lista filter-rich →
 * ficha do registro (etapas, o que falta, filhos, histórico) → formulário, tudo na página.
 * Quem precisa de outra cara monta com ListaRegistros, FichaRegistro, FormularioRegistro,
 * Etapas, AcoesFilhas e Historico (ou direto com useEntidade/entidade()).
 */
export const ProgramaEntidade = ({
  entidade,
  titulo,
  subtitulo,
  colunas,
  rotuloNovo,
  camposNovo,
  podeCriar = true,
  podeEditar = true,
  podeExcluir = true,
  extra
}: {
  entidade: string;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  colunas?: string[];
  rotuloNovo?: string;
  /** Campos do formulário de inclusão (padrão: todos). */
  camposNovo?: string[];
  podeCriar?: boolean;
  podeEditar?: boolean;
  podeExcluir?: boolean;
  extra?: { titulo: string; render: (r: Registro) => ReactNode };
}) => {
  const modulo = useModulo();
  const def = modulo.entidades[entidade];
  const [tela, setTela] = useState<Tela>({ tipo: 'lista' });
  const [versao, setVersao] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const voltar = (texto?: string) => {
    setVersao((v) => v + 1);
    setAviso(texto ?? null);
    setTela({ tipo: 'lista' });
  };

  if (!def) return <Pagina titulo={titulo}><Aviso tom="erro">Entidade "{entidade}" não existe no painel.json.</Aviso></Pagina>;

  if (tela.tipo === 'ficha') {
    return (
      <main className="flex w-full flex-col px-6 pt-4 pb-8">
        <FichaRegistro key={tela.registro.id} modulo={modulo} def={def} registro={tela.registro} podeEditar={podeEditar} podeExcluir={podeExcluir}
          aoVoltar={() => voltar()} aoExcluir={() => voltar(`${def.nome} ${tela.registro.numero ?? ''} excluído(a).`)} />
      </main>
    );
  }

  if (tela.tipo === 'novo') {
    return (
      <main className="flex w-full flex-col gap-5 px-6 pt-4 pb-8">
        <div><Button variant="ghost" size="sm" className="-ml-2" onClick={() => voltar()}><ArrowLeft /> Voltar para a lista</Button></div>
        <Card>
          <CardHeader><CardTitle className="text-lg">{rotuloNovo ?? `Nova ${def.nome}`}</CardTitle></CardHeader>
          <CardContent>
            <FormularioRegistro def={def} registro={null} campos={camposNovo} rotuloSalvar="Registrar"
              aoCancelar={() => voltar()} aoSalvar={(r) => { setVersao((v) => v + 1); setTela({ tipo: 'ficha', registro: r }); }} />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <Pagina titulo={titulo} subtitulo={subtitulo}>
      {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}
      <ListaRegistros def={def} colunas={colunas} versao={versao} extra={extra} rotuloNovo={rotuloNovo}
        aoNovo={podeCriar ? () => { setAviso(null); setTela({ tipo: 'novo' }); } : undefined}
        aoAbrir={(r) => { setAviso(null); setTela({ tipo: 'ficha', registro: r }); }} />
    </Pagina>
  );
};
