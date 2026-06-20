import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // PWA — Fase 0 (PoC desktop). Instalável APENAS na área interna (/app):
    // o manifest tem scope/start_url em /app e o app-shell offline (navigateFallback)
    // só vale para rotas /app. Portal (/portal) e página pública (/p/:slug)
    // seguem como web normal (vão direto à rede nas navegações).
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // Evita Service Worker em desenvolvimento (sem dor de cabeça de cache no dev).
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Imperial App — Imperial Contabilidade",
        short_name: "Imperial App",
        description:
          "Área interna da equipe da Imperial Contabilidade: gestão fiscal, movimento, planejamento e assistente.",
        lang: "pt-BR",
        scope: "/app",
        start_url: "/app",
        display: "standalone",
        orientation: "any",
        theme_color: "#15A65C",
        background_color: "#ffffff",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/pwa-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // Pré-cacheia apenas o app-shell estático (assets com hash no nome).
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,ico,woff2}"],
        // O bundle atual é grande (~2,8 MB, sem code-splitting) e o worker do PDF
        // (~1,2 MB). Elevamos o limite para que o app-shell seja precacheado.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // App-shell offline só para a área interna. Não interfere em /portal nem /p/:slug.
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^\/app/],
        // NÃO cacheamos chamadas ao Supabase/Edge Functions (dados fiscais sempre frescos).
        // Por isso não há runtimeCaching aqui de propósito.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
