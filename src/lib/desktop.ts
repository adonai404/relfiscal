import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

/**
 * True quando o app está rodando dentro da casca desktop (Tauri); false no
 * navegador. Detecta pela presença do bridge interno do Tauri 2.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Abre uma URL (ou caminho de arquivo) no aplicativo padrão do SO — navegador
 * externo para http/https. No desktop usa o shell do Tauri; no web cai em
 * window.open.
 */
export async function openExternal(target: string): Promise<void> {
  if (isTauri()) {
    await shellOpen(target);
    return;
  }
  window.open(target, "_blank", "noopener,noreferrer");
}

/* ------------------------------------------------------------------ *
 * Navegador interno (Opção A) + regras de download por site
 * ------------------------------------------------------------------ */

const RULES_KEY = "imperial.browserDownloadRules";

export interface DownloadRules {
  /** Pasta padrão dos downloads do navegador interno. */
  default?: string;
  /** Pasta por host (ex.: { "consulta-notas.lovable.app": "C:/.../Notas" }). */
  bySite?: Record<string, string>;
}

export function getDownloadRules(): DownloadRules {
  try {
    return JSON.parse(localStorage.getItem(RULES_KEY) || "{}") as DownloadRules;
  } catch {
    return {};
  }
}

export function setDownloadRules(rules: DownloadRules): void {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Resolve a pasta de download para uma URL: regra do site > padrão. */
export function downloadDirForUrl(url: string): string | undefined {
  const rules = getDownloadRules();
  const host = hostOf(url);
  return (host && rules.bySite?.[host]) || rules.default || undefined;
}

/**
 * Abre o site numa janela interna do app (navegador embutido). Os downloads
 * feitos ali vão automaticamente para a pasta da regra (site > padrão), sem o
 * diálogo "Salvar como". No web, cai em nova aba.
 */
export async function openInAppBrowser(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const label = `site-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await invoke("open_internal_browser", {
    url,
    label,
    dir: downloadDirForUrl(url) ?? null,
  });
}

/** Abre o seletor de pasta nativo (desktop). Retorna o caminho ou null. */
export async function pickFolder(title?: string): Promise<string | null> {
  if (!isTauri()) return null;
  const res = await openDialog({ directory: true, multiple: false, title });
  return typeof res === "string" ? res : null;
}

/**
 * Baixa/salva um arquivo de texto. No desktop abre "Salvar como" e grava via
 * comando Rust; no web dispara um download direto (Blob).
 * Retorna false se o usuário cancelar.
 */
export async function saveTextFile(
  suggestedName: string,
  contents: string,
  mime = "text/html",
): Promise<boolean> {
  if (isTauri()) {
    const path = await saveDialog({ defaultPath: suggestedName });
    if (!path) return false;
    await invoke("write_text_file", { path, contents });
    return true;
  }
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return true;
}

/**
 * Baixa/salva um arquivo binário (XLSX, PDF, etc). No desktop abre "Salvar como"
 * e grava via comando Rust; no web dispara um download direto (Blob).
 * Retorna false se o usuário cancelar.
 */
export async function saveBinaryFile(
  suggestedName: string,
  data: Uint8Array,
): Promise<boolean> {
  if (isTauri()) {
    const path = await saveDialog({ defaultPath: suggestedName });
    if (!path) return false;
    await invoke("write_binary_file", { path, data: Array.from(data) });
    return true;
  }
  const blob = new Blob([data], { type: "application/octet-stream" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return true;
}
