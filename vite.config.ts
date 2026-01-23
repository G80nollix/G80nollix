import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Configurazione per la build di produzione
    minify: 'esbuild',
  },
  esbuild: {
    // Rimuove tutti i console.* e debugger quando siamo in produzione
    // In sviluppo mantiene tutti i log per il debugging
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
