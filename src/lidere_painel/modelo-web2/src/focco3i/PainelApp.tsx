import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { aoMudarTema, ContextoPainel, pronto } from './runtime';
import { Spinner } from './ui';
import './tema.css';

interface ValorContexto {
  contexto: ContextoPainel;
  tema: 'light' | 'dark';
  corPrimaria: string;
  /** Cores de série dos gráficos (tokens --chart-1..5 do portal, já resolvidos para o tema). */
  cores: string[];
}

const Contexto = createContext<ValorContexto | null>(null);
const RE_COR = /^#[0-9a-fA-F]{6}$/;
const PADRAO = '#2A2849';

/** Texto branco ou escuro sobre a cor da empresa (contraste). */
const textoSobre = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? 'oklch(0.21 0.012 265)' : 'oklch(0.985 0 0)';
};

const aplicarTema = (tema: 'light' | 'dark', cor: string) => {
  const raiz = document.documentElement;
  raiz.classList.toggle('dark', tema === 'dark');
  raiz.style.setProperty('--primary', cor);
  raiz.style.setProperty('--primary-foreground', textoSobre(cor));
};

const lerCores = () => {
  const estilo = getComputedStyle(document.documentElement);
  return [1, 2, 3, 4, 5].map((n) => estilo.getPropertyValue(`--chart-${n}`).trim() || PADRAO);
};

/** Envolve o painel: espera o contexto do portal e aplica tema (claro/escuro) e a cor da empresa. */
export const PainelApp = ({ children }: { children: ReactNode }) => {
  const [contexto, setContexto] = useState<ContextoPainel | null>(null);
  const [tema, setTema] = useState<'light' | 'dark'>('light');
  const [cores, setCores] = useState<string[]>([]);

  useEffect(() => {
    pronto().then((ctx) => {
      setTema(ctx.tema === 'dark' ? 'dark' : 'light');
      setContexto(ctx);
    });
    aoMudarTema((t) => setTema(t === 'dark' ? 'dark' : 'light'));
  }, []);

  const informada = contexto?.portal?.cor_primaria || '';
  const corPrimaria = RE_COR.test(informada) ? informada : PADRAO;

  useEffect(() => {
    aplicarTema(tema, corPrimaria);
    setCores(lerCores());
  }, [tema, corPrimaria]);

  if (!contexto || cores.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Spinner /> Carregando…
      </div>
    );
  }
  return <Contexto.Provider value={{ contexto, tema, corPrimaria, cores }}>{children}</Contexto.Provider>;
};

export const usePainel = () => {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('usePainel precisa estar dentro de <PainelApp>.');
  return valor;
};
