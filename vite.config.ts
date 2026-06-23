import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Detecta build/dev rodando dentro do Tauri (a CLI do Tauri define TAURI_ENV_*).
const isTauri = !!process.env.TAURI_ENV_PLATFORM;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // No Tauri os assets são servidos via protocolo próprio (tauri://) a partir do
  // bundle local, então o caminho precisa ser relativo. No web mantém raiz "/".
  base: isTauri ? "./" : "/",
  // Mantém o output do Vite visível quando rodando junto da CLI do Tauri.
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: {
    host: "::",
    port: 8080,
    // O Tauri carrega o devUrl fixo (8080); falhar é melhor que trocar de porta.
    strictPort: isTauri,
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
    // Desativado no build Tauri: o Service Worker não faz sentido (e atrapalha)
    // dentro do protocolo tauri:// — o desktop já é "app instalado".
    !isTauri &&
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
  build: {
    rollupOptions: {
      external: [
        "@tauri-apps/plugin-updater",
        "@tauri-apps/api/process",
        "@tauri-apps/api/core",
      ],
    },
  },
}));
