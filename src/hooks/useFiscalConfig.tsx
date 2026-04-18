import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isDemoCompany } from "@/lib/demoData";

export interface FiscalConfig {
  id: string;
  company_id: string;
  show_icms_column: boolean;
  show_impostos_federais_column: boolean;
  show_simples_nacional_column: boolean;
  show_honorarios_column: boolean;
  show_folha_column: boolean;
  show_encargos_patronal_column: boolean;
  show_difal_column: boolean;
  show_pis_column: boolean;
  show_cofins_column: boolean;
  show_irpj_column: boolean;
  show_csll_column: boolean;
  label_competencia: string;
  label_entrada: string;
  label_saida: string;
  label_icms: string;
  label_impostos_federais: string;
  label_simples_nacional: string;
  label_honorarios: string;
  label_folha: string;
  label_encargos_patronal: string;
  label_difal: string;
  label_pis: string;
  label_cofins: string;
  label_irpj: string;
  label_csll: string;
  aliquota_simples_nacional: number;
  auto_calculate_simples_nacional: boolean;
}

export type ColumnKey =
  | "entrada" | "saida" | "icms" | "impostos_federais" | "simples_nacional"
  | "aliquota_simples_calc"
  | "honorarios" | "folha" | "encargos_patronal" | "difal" | "pis"
  | "cofins" | "irpj" | "csll";

export const ALL_COLUMNS: ColumnKey[] = [
  "entrada", "saida", "icms", "impostos_federais", "simples_nacional", "aliquota_simples_calc",
  "honorarios", "folha", "encargos_patronal", "difal", "pis", "cofins", "irpj", "csll",
];

export const TOGGLEABLE_COLUMNS: ColumnKey[] = [
  "icms", "impostos_federais", "simples_nacional", "aliquota_simples_calc", "honorarios", "folha",
  "encargos_patronal", "difal", "pis", "cofins", "irpj", "csll",
];

export const TAX_COLUMNS: ColumnKey[] = ["icms", "difal", "pis", "cofins", "irpj", "csll"];

export const COMPUTED_COLUMNS: ColumnKey[] = ["aliquota_simples_calc"];
export const isComputedColumn = (col: ColumnKey) => COMPUTED_COLUMNS.includes(col);

export const isColumnVisible = (cfg: FiscalConfig | undefined, col: ColumnKey): boolean => {
  if (!cfg) return true;
  if (col === "entrada" || col === "saida") return true;
  if (col === "aliquota_simples_calc") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const showAliq = (cfg as any).show_aliquota_simples_calc_column;
    const showSimples = cfg.show_simples_nacional_column ?? true;
    return (showAliq ?? true) && showSimples;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cfg as any)[`show_${col}_column`] ?? true;
};

export const getColumnLabel = (cfg: FiscalConfig | undefined, col: ColumnKey): string => {
  const defaults: Record<ColumnKey, string> = {
    entrada: "Entrada", saida: "Saída", icms: "ICMS", impostos_federais: "Impostos Federais",
    simples_nacional: "Simples Nacional", aliquota_simples_calc: "Alíquota Simples",
    honorarios: "Honorários", folha: "Folha",
    encargos_patronal: "Encargos Patronal", difal: "DIFAL", pis: "PIS",
    cofins: "COFINS", irpj: "IRPJ", csll: "CSLL",
  };
  if (!cfg) return defaults[col];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cfg as any)[`label_${col}`] || defaults[col];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const computeColumnValue = (row: any, col: ColumnKey): number => {
  if (col === "aliquota_simples_calc") {
    const saida = Number(row?.saida || 0);
    const sn = Number(row?.simples_nacional || 0);
    if (!saida) return 0;
    return sn / saida;
  }
  return Number(row?.[col] || 0);
};

export const formatPercent = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const DEMO_FISCAL_CONFIG: FiscalConfig = {
  id: "demo-config",
  company_id: "",
  show_icms_column: true,
  show_impostos_federais_column: true,
  show_simples_nacional_column: true,
  show_honorarios_column: true,
  show_folha_column: true,
  show_encargos_patronal_column: true,
  show_difal_column: true,
  show_pis_column: true,
  show_cofins_column: true,
  show_irpj_column: true,
  show_csll_column: true,
  label_competencia: "Competência",
  label_entrada: "Entrada",
  label_saida: "Saída",
  label_icms: "ICMS",
  label_impostos_federais: "Impostos Federais",
  label_simples_nacional: "Simples Nacional",
  label_honorarios: "Honorários",
  label_folha: "Folha",
  label_encargos_patronal: "Encargos Patronal",
  label_difal: "DIFAL",
  label_pis: "PIS",
  label_cofins: "COFINS",
  label_irpj: "IRPJ",
  label_csll: "CSLL",
  aliquota_simples_nacional: 6,
  auto_calculate_simples_nacional: false,
};

export function useFiscalConfig(companyId: string | undefined) {
  return useQuery({
    queryKey: ["fiscal_config", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (isDemoCompany(companyId)) {
        return { ...DEMO_FISCAL_CONFIG, company_id: companyId! } as FiscalConfig;
      }
      const { data, error } = await supabase
        .from("fiscal_config")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data as FiscalConfig | null;
    },
  });
}

export function useUpdateFiscalConfig(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<FiscalConfig>) => {
      if (!companyId) return;
      if (isDemoCompany(companyId)) {
        throw new Error("Modo demonstração — solicite acesso para alterar configurações.");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("fiscal_config").update(patch as any).eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiscal_config", companyId] }),
  });
}
