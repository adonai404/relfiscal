import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { isTauri } from "@/lib/desktop";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateConsolidatedPdf } from "@/lib/reportPdf";
import type { ReportCompanyRow } from "@/lib/reportPdf";

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface AutoReportSettings {
  enabled: boolean;
  saveFolder: string | null;
  triggerDay: number;                                      // 1-28
  period: "previous_month" | "current_month" | "custom";
  customPeriod?: string;                                   // "YYYY-MM" se period==="custom"
}

export interface AutoReportLogEntry {
  id: string;
  timestamp: string;
  period: string;      // "YYYY-MM"
  companies: number;
  filePath: string;
  status: "success" | "error";
  errorMessage?: string;
}

interface AutoReportState {
  lastGeneratedMonth: string; // mês corrente em que o relatório foi gerado ("YYYY-MM")
}

// ─── Chaves localStorage ───────────────────────────────────────────────────────

const SETTINGS_KEY = "imperial.autoreport";
const STATE_KEY    = "imperial.autoreport.state";
const LOG_KEY      = "imperial.autoreport.log";

// ─── Utilitários de configuração ──────────────────────────────────────────────

export function getAutoReportSettings(): AutoReportSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as AutoReportSettings;
  } catch {}
  return { enabled: false, saveFolder: null, triggerDay: 5, period: "previous_month" };
}

export function saveAutoReportSettings(settings: AutoReportSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("autoreport-settings-changed"));
}

// ─── Utilitários de log ────────────────────────────────────────────────────────

export function getAutoReportLog(): AutoReportLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw) as AutoReportLogEntry[];
  } catch {}
  return [];
}

export function clearAutoReportLog(): void {
  localStorage.removeItem(LOG_KEY);
  window.dispatchEvent(new Event("autoreport-log-changed"));
}

function appendReportLog(entry: AutoReportLogEntry): void {
  const current = getAutoReportLog();
  const updated  = [entry, ...current].slice(0, 50);
  localStorage.setItem(LOG_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("autoreport-log-changed"));
}

// ─── Estado de geração ─────────────────────────────────────────────────────────

function getAutoReportState(): AutoReportState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as AutoReportState;
  } catch {}
  return { lastGeneratedMonth: "" };
}

function setAutoReportState(state: AutoReportState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function resolvePeriod(settings: AutoReportSettings): string {
  if (settings.period === "custom" && settings.customPeriod) {
    return settings.customPeriod;
  }
  const now = new Date();
  if (settings.period === "previous_month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  // current_month
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Geração do relatório (exportada para uso manual na página) ───────────────

export async function generateReport(settings: AutoReportSettings): Promise<void> {
  if (!settings.saveFolder) throw new Error("Nenhuma pasta de destino configurada.");

  const period     = resolvePeriod(settings);
  const [year, m]  = period.split("-");
  const fileName   = `relatorio_fiscal_${year}_${m}.pdf`;
  const filePath   = `${settings.saveFolder}/${fileName}`;

  // Busca empresas ativas
  const { data: companies, error: compErr } = await supabase
    .from("companies")
    .select("id, razao_social, nome_fantasia, cnpj, regime")
    .eq("status", "ativa");

  if (compErr) throw compErr;
  if (!companies || companies.length === 0) throw new Error("Nenhuma empresa ativa encontrada.");

  // Busca movimentos do período (YYYY-MM)
  const { data: movements, error: movErr } = await supabase
    .from("fiscal_movement")
    .select(
      "company_id, entrada, saida, simples_nacional, icms, impostos_federais, honorarios, folha, encargos_patronal"
    )
    .eq("competencia", period);

  if (movErr) throw movErr;

  const movByCompany = new Map(
    (movements ?? []).map((mv) => [mv.company_id as string, mv])
  );

  const rows: ReportCompanyRow[] = companies.map((c) => {
    const mv = movByCompany.get(c.id) as Record<string, number> | undefined;
    return {
      id:                c.id,
      razao_social:      c.razao_social,
      nome_fantasia:     c.nome_fantasia ?? "",
      cnpj:              c.cnpj,
      regime:            c.regime ?? "simples_nacional",
      entrada:           mv?.entrada           ?? 0,
      saida:             mv?.saida             ?? 0,
      simples_nacional:  mv?.simples_nacional  ?? 0,
      icms:              mv?.icms              ?? 0,
      impostos_federais: mv?.impostos_federais ?? 0,
      honorarios:        mv?.honorarios        ?? 0,
      folha:             mv?.folha             ?? 0,
      encargos_patronal: mv?.encargos_patronal ?? 0,
    };
  });

  const pdfBytes = generateConsolidatedPdf(rows, { periodo: period, geradoEm: new Date() });

  await invoke("write_binary_file", {
    path: filePath,
    data: Array.from(pdfBytes),
  });

  appendReportLog({
    id:        crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    period,
    companies: rows.length,
    filePath,
    status:    "success",
  });

  toast.success(`Relatório gerado: ${fileName} (${rows.length} empresas)`);

  try {
    await sendNotification({
      title: "Relatório gerado",
      body:  `${fileName} salvo com sucesso.`,
    });
  } catch {}
}

// ─── Hook de auto-geração ──────────────────────────────────────────────────────

export function useAutoReport() {
  useEffect(() => {
    if (!isTauri()) return;

    const checkAndGenerate = async () => {
      const settings = getAutoReportSettings();
      if (!settings.enabled || !settings.saveFolder) return;

      const now      = new Date();
      const todayDay = now.getDate();
      if (todayDay < settings.triggerDay) return;

      // Verifica se já foi gerado neste mês corrente
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const state        = getAutoReportState();
      if (state.lastGeneratedMonth === currentMonth) return;

      try {
        await generateReport(settings);
        setAutoReportState({ lastGeneratedMonth: currentMonth });
      } catch (err) {
        const msg = (err as Error).message ?? "Erro desconhecido";
        appendReportLog({
          id:           crypto.randomUUID(),
          timestamp:    new Date().toISOString(),
          period:       resolvePeriod(settings),
          companies:    0,
          filePath:     "",
          status:       "error",
          errorMessage: msg,
        });
        toast.error(`Falha ao gerar relatório automático: ${msg}`);
      }
    };

    void checkAndGenerate();

    const onSettingsChange = () => void checkAndGenerate();
    window.addEventListener("autoreport-settings-changed", onSettingsChange);
    return () => window.removeEventListener("autoreport-settings-changed", onSettingsChange);
  }, []);
}
