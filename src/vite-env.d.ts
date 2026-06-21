/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;
  /**
   * URL pública (web) do app, usada por links/QR/redirects de auth.
   * Vazio no build web → cai em `window.location.origin`.
   * Definir nos builds desktop (Tauri), ex.: `https://app.imperial.com.br`.
   */
  readonly VITE_PUBLIC_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
