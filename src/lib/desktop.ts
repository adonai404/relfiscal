import { open as shellOpen } from "@tauri-apps/plugin-shell";

/**
 * True quando o app está rodando dentro da casca desktop (Tauri); false no
 * navegador. Detecta pela presença do bridge interno do Tauri 2.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Abre uma URL (ou caminho de arquivo) no aplicativo padrão do SO — navegador
 * externo para http/https. No desktop usa o shell do Tauri (a janela do app NÃO
 * navega para fora de /app); no web cai em window.open.
 *
 * Usado para Portal (/portal) e página pública (/p/:slug), que continuam sendo
 * "web" mesmo com o app empacotado.
 */
export async function openExternal(target: string): Promise<void> {
  if (isTauri()) {
    await shellOpen(target);
    return;
  }
  window.open(target, "_blank", "noopener,noreferrer");
}
