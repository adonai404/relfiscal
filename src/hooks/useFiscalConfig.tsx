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
  show_nfe_saida_column: boolean;
  show_nfe_entrada_column: boolean;
  show_cupom_column: boolean;
  show_servico_column: boolean;
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
  label_nfe_saida: string;
  label_nfe_entrada: string;
  label_cupom: string;
  label_servico: string;
  aliquota_simples_nacional: number;
  auto_calculate_simples_nacional: boolean;
  /**
   * Lista de colunas que entram nos cálculos de "impostos" (totais, cards,
   * gráficos). Permite excluir colunas que servem apenas para demonstração.
   * Default: todas as colunas tributárias do sistema.
   */
   tax_columns?: ColumnKey[];
   column_order?: string[];
}

export type ColumnKey =
  | "entrada" | "saida" | "nfe_saida" | "nfe_entrada" | "cupom" | "servico"
  | "icms" | "impostos_federais" | "simples_nacional"
  | "aliquota_simples_calc"
  | "honorarios" | "folha" | "encargos_patronal" | "difal" | "pis"
  | "cofins" | "irpj" | "csll";

export const ALL_COLUMNS: ColumnKey[] = [
  "entrada", "saida", "nfe_saida", "nfe_entrada", "cupom", "servico",
  "icms", "impostos_federais", "simples_nacional", "aliquota_simples_calc",
  "honorarios", "folha", "encargos_patronal", "difal", "pis", "cofins", "irpj", "csll",
];

// entrada and saida are always visible
export const TOGGLEABLE_COLUMNS: ColumnKey[] = [
  "nfe_saida", "nfe_entrada", "cupom", "servico",
  "icms", "impostos_federais", "simples_nacional", "aliquota_simples_calc", "honorarios", "folha",
  "encargos_patronal", "difal", "pis", "cofins", "irpj", "csll",
];

export const TAX_COLUMNS: ColumnKey[] = ["icms", "difal", "pis", "cofins", "irpj", "csll"];

// Conjunto completo de colunas que PODEM ser marcadas como "imposto".
// Inclui as clássicas tributárias + impostos_federais + simples_nacional.
export const TAX_ELIGIBLE_COLUMNS: ColumnKey[] = [
  "icms", "difal", "pis", "cofins", "irpj", "csll",
  "impostos_federais", "simples_nacional",
];

// Default usado quando o config ainda não tem `tax_columns` salvo.
const DEFAULT_TAX_COLUMNS: ColumnKey[] = [...TAX_ELIGIBLE_COLUMNS];

/**
 * Retorna as colunas que devem ser somadas como "impostos" para esta empresa.
 * Respeita a configuração `tax_columns` do fiscal_config; se não houver,
 * volta ao default (todas as colunas tributárias).
 */
export const getTaxColumns = (cfg: FiscalConfig | undefined | null): ColumnKey[] => {
  const raw = cfg?.tax_columns;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_TAX_COLUMNS;
  // Filtra apenas valores válidos para evitar lixo no banco.
  return raw.filter((c): c is ColumnKey => TAX_ELIGIBLE_COLUMNS.includes(c as ColumnKey));
};

// Computed (virtual) columns are not stored in DB and not editable
export const COMPUTED_COLUMNS: ColumnKey[] = ["aliquota_simples_calc"];
export const isComputedColumn = (col: ColumnKey) => COMPUTED_COLUMNS.includes(col);

// Categoria visual usada para tint das colunas na tabela.
export type ColumnCategory =
  | "competencia" | "entrada" | "saida" | "tax" | "simples"
  | "aliquota" | "payroll" | "custom";

export const getColumnCategory = (col: ColumnKey): ColumnCategory => {
  if (col === "entrada" || col === "nfe_entrada") return "entrada";
  if (col === "saida" || col === "nfe_saida" || col === "cupom" || col === "servico") return "saida";
  if (col === "simples_nacional") return "simples";
  if (col === "aliquota_simples_calc") return "aliquota";
  if (col === "honorarios" || col === "folha" || col === "encargos_patronal") return "payroll";
  if (col === "impostos_federais") return "tax";
  if (TAX_COLUMNS.includes(col)) return "tax";
  return "tax";
};

export const isColumnVisible = (cfg: FiscalConfig | undefined, col: ColumnKey): boolean => {
  if (!cfg) return true;
  if (col === "entrada" || col === "saida") return true;
  if (col === "aliquota_simples_calc") {
    // Visible only when Simples Nacional column is visible
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
    entrada: "Entrada", saida: "Saída", 
    nfe_saida: "NF-e Saída", nfe_entrada: "NF-e Entrada",
    cupom: "Cupom", servico: "Serviço",
    icms: "ICMS", impostos_federais: "Impostos Federais",
    simples_nacional: "Simples Nacional", aliquota_simples_calc: "Alíquota Simples",
    honorarios: "Honorários", folha: "Folha",
    encargos_patronal: "Encargos Patronal", difal: "DIFAL", pis: "PIS",
    cofins: "COFINS", irpj: "IRPJ", csll: "CSLL",
  };
  if (!cfg) return defaults[col];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cfg as any)[`label_${col}`] || defaults[col];
};

// Compute the value of a column (handles virtual columns).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const computeColumnValue = (row: any, col: ColumnKey): number => {
  if (col === "aliquota_simples_calc") {
    const saida = Number(row?.saida || 0);
    const sn = Number(row?.simples_nacional || 0);
    if (!saida) return 0;
    return sn / saida; // ratio (0.10 = 10%)
  }
  return Number(row?.[col] || 0);
};

export const formatPercent = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

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
