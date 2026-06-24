import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { isTauri } from "@/lib/desktop";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateImportCompanies } from "@/lib/companyImport";
import { extractLocally } from "@/lib/pdfLocalFallback";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AutomacaoSettings {
  enabled: boolean;
  watchFolder: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  fileName: string;
  filePath: string;
  status: "success" | "error" | "no-data";
  cnpj?: string;
  companyName?: string;
  competencia?: string;
  saida?: number;
  simplNacional?: number;
  errorMessage?: string;
}

// ─── Chaves localStorage ──────────────────────────────────────────────────────

const SETTINGS_KEY = "imperial.automacoes";
const LOG_KEY      = "imperial.automacoes.log";
const MAX_LOG      = 100;

// ─── Utilitários de configuração ──────────────────────────────────────────────

export function getAutomacaoSettings(): AutomacaoSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as AutomacaoSettings;
  } catch {}
  return { enabled: false, watchFolder: null };
}

export function saveAutomacaoSettings(settings: AutomacaoSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("automacao-settings-changed"));
}

// ─── Utilitários de log ───────────────────────────────────────────────────────

export function getAutomacaoLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw) as LogEntry[];
  } catch {}
  return [];
}

export function clearAutomacaoLog(): void {
  localStorage.removeItem(LOG_KEY);
  window.dispatchEvent(new Event("automacao-log-changed"));
}

function appendLogEntry(entry: LogEntry): void {
  const current = getAutomacaoLog();
  const updated  = [entry, ...current].slice(0, MAX_LOG);
  localStorage.setItem(LOG_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("automacao-log-changed"));
}

// ─── Hook principal ────────────────────────────────────────────────────────────

export function useFolderWatcher() {
  const qc = useQueryClient();

  const recentlyProcessed = useCallback(() => new Map<string, number>(), []);
  const processedMap = recentlyProcessed();

  const processPdf = useCallback(
    async (filePath: string) => {
      const now  = Date.now();
      const last = processedMap.get(filePath) ?? 0;
      if (now - last < 10_000) return;
      processedMap.set(filePath, now);

      const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

      try {
        // Lê o PDF do disco via Rust
        const bytes  = await invoke<number[]>("read_binary_file", { path: filePath });
        const uint8  = new Uint8Array(bytes);
        const file   = new File([uint8], fileName, { type: "application/pdf" });

        // Extração local: suporta PGDAS-D (Receita Federal) e SITTAX
        const data = await extractLocally(file);

        if (!data?.cnpj || !data?.competencia) {
          appendLogEntry({
            id: crypto.randomUUID(), timestamp: new Date().toISOString(),
            fileName, filePath, status: "no-data",
            errorMessage: "CNPJ ou competência não encontrados no PDF.",
          });
          toast.warning(`${fileName}: dados insuficientes para importar.`);
          return;
        }

        // Campos extraídos:
        //   saida          = Receita Bruta do PA (RPA) - Competência (total)
        //   simples_nacional = Total do Débito Exigível (SITTAX) OU Arrecadação do DAS (PGDAS-D)
        const saida        = data.rpa?.total ?? 0;
        const simplNacional = data.valor_pago_das ?? 0;

        // Localiza ou cria empresa pelo CNPJ
        const { idByCnpj } = await getOrCreateImportCompanies([
          {
            cnpj:          data.cnpj,
            razao_social:  data.razao_social ?? "A definir",
            nome_fantasia: data.razao_social ?? `Empresa ${data.cnpj.replace(/\D/g, "").slice(-4)}`,
            uf:            "SP",
            regime:        "simples_nacional",
          },
        ]);

        const company_id = idByCnpj.get(data.cnpj.replace(/\D/g, ""));
        if (!company_id) throw new Error("Falha ao localizar/criar empresa no banco.");

        // Upsert — mesmos campos que PdfImportTab usa
        const { error: upErr } = await supabase.from("fiscal_movement").upsert(
          { company_id, competencia: data.competencia, saida, simples_nacional: simplNacional } as never,
          { onConflict: "company_id,competencia" }
        );
        if (upErr) throw upErr;

        qc.invalidateQueries({ queryKey: ["fiscal_movement"] });
        qc.invalidateQueries({ queryKey: ["companies"] });

        appendLogEntry({
          id: crypto.randomUUID(), timestamp: new Date().toISOString(),
          fileName, filePath, status: "success",
          cnpj: data.cnpj, companyName: data.razao_social ?? undefined,
          competencia: data.competencia, saida, simplNacional,
        });

        const compName  = data.razao_social ?? data.cnpj;
        const [year, month] = (data.competencia ?? "").split("-");
        const compLabel = month && year ? `${month}/${year}` : data.competencia;

        toast.success(`Importado: ${compName} • ${compLabel}`);

        try {
          await sendNotification({
            title: "Importação automática",
            body:  `${fileName} → ${compName} (${compLabel})`,
          });
        } catch {}
      } catch (err) {
        const msg = (err as Error).message ?? "Erro desconhecido";
        appendLogEntry({
          id: crypto.randomUUID(), timestamp: new Date().toISOString(),
          fileName, filePath, status: "error", errorMessage: msg,
        });
        toast.error(`Falha ao importar ${fileName}: ${msg}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc]
  );

  useEffect(() => {
    if (!isTauri()) return;

    let unlistenFn: (() => void) | null = null;
    let cancelled = false;

    const startWatching = async () => {
      if (unlistenFn) { unlistenFn(); unlistenFn = null; }
      try { await invoke("stop_folder_watch"); } catch {}

      if (cancelled) return;

      const settings = getAutomacaoSettings();
      if (!settings.enabled || !settings.watchFolder) return;

      try {
        await invoke("start_folder_watch", { path: settings.watchFolder });
      } catch (err) {
        toast.error(`Pasta monitorada: ${(err as Error).message}`);
        return;
      }

      if (cancelled) return;

      const unlisten = await listen<string>("pdf-watcher-file", (event) => {
        void processPdf(event.payload);
      });
      unlistenFn = unlisten;
    };

    void startWatching();

    const onSettingsChange = () => void startWatching();
    window.addEventListener("automacao-settings-changed", onSettingsChange);

    return () => {
      cancelled = true;
      window.removeEventListener("automacao-settings-changed", onSettingsChange);
      if (unlistenFn) unlistenFn();
      invoke("stop_folder_watch").catch(() => {});
    };
  }, [processPdf]);
}
