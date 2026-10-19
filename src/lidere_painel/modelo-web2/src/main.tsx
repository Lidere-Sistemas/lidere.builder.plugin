import { createRoot } from 'react-dom/client';
import { PainelApp } from './focco3i';
import { Painel } from './Painel';

createRoot(document.getElementById('root')!).render(
  <PainelApp>
    <Painel />
  </PainelApp>
);
