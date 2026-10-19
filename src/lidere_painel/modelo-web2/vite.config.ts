import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Padrão visual web2 (React 19 + Tailwind 4, tokens do portal).
// O painel vira UM index.html + UM js + UM css: o portal embute tudo num documento
// unico (iframe srcdoc, sem rede). Por isso: base relativa, fonte embutida e sem code splitting.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'build',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
