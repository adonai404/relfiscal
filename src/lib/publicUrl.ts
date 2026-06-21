/**
 * Seam da URL pública (web) do app.
 *
 * Usada em tudo que precisa apontar para a versão WEB do app — links
 * compartilháveis (`/p/:slug`), QR codes e redirects de auth (e-mail de
 * confirmação / redefinição de senha) — e NÃO para o runtime onde o app
 * está rodando.
 *
 * No navegador, `window.location.origin` já é a URL web correta, então o
 * fallback resolve tudo sem configuração extra.
 *
 * Em builds desktop (Tauri/Fase 2+) o app roda sob um protocolo próprio
 * (ex.: `tauri://localhost` / `http://tauri.localhost`), então
 * `window.location.origin` deixa de ser a URL pública. Nesses builds, defina
 * `VITE_PUBLIC_WEB_URL` (ex.: `https://app.imperial.com.br`) para que links,
 * QR e redirects continuem apontando para a web.
 */
export function getPublicWebUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_WEB_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/**
 * Monta uma URL pública absoluta a partir de um caminho.
 * Ex.: `publicUrl("/p/acme")` → `https://app.imperial.com.br/p/acme`.
 */
export function publicUrl(path: string): string {
  const base = getPublicWebUrl();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
