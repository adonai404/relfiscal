import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  | "honorarios" | "folha" | "encargos_patronal" | "difal" | "pis"
  | "cofins" | "irpj" | "csll";

export const ALL_COLUMNS: ColumnKey[] = [
  "entrada", "saida", "icms", "impostos_federais", "simples_nacional",
  "honorarios", "folha", "encargos_patronal", "difal", "pis", "cofins", "irpj", "csll",
];

// entrada and saida are always visible
export const TOGGLEABLE_COLUMNS: ColumnKey[] = [
  "icms", "impostos_federais", "simples_nacional", "honorarios", "folha",
  "encargos_patronal", "difal", "pis", "cofins", "irpj", "csll",
];

export const TAX_COLUMNS: ColumnKey[] = ["icms", "difal", "pis", "cofins", "irpj", "csll"];

export const isColumnVisible = (cfg: FiscalConfig | undefined, col: ColumnKey): boolean => {
  if (!cfg) return true;
  if (col === "entrada" || col === "saida") return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cfg as any)[`show_${col}_column`] ?? true;
};

export const getColumnLabel = (cfg: FiscalConfig | undefined, col: ColumnKey): string => {
  const defaults: Record<ColumnKey, string> = {
    entrada: "Entrada", saida: "Saída", icms: "ICMS", impostos_federais: "Impostos Federais",
    simples_nacional: "Simples Nacional", honorarios: "Honorários", folha: "Folha",
    encargos_patronal: "Encargos Patronal", difal: "DIFAL", pis: "PIS",
    cofins: "COFINS", irpj: "IRPJ", csll: "CSLL",
  };
  if (!cfg) return defaults[col];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cfg as any)[`label_${col}`] || defaults[col];
};

export function useFiscalConfig(companyId: string | undefined) {
  return useQuery({
    queryKey: ["fiscal_config", companyId],
    enabled: !!companyId,
    queryFn: async () => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("fiscal_config").update(patch as any).eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiscal_config", companyId] }),
  });
}
