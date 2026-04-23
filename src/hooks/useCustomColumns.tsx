import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Formula } from "@/lib/formula";

export interface CustomColumn {
  id: string;
  company_id: string;
  key: string;
  label: string;
  kind: "manual" | "formula";
  formula: Formula;
  position: number;
  visible: boolean;
  decimals: number;
}

export interface CustomColumnValue {
  id: string;
  movement_id: string;
  column_id: string;
  value: number;
}

export function useCustomColumns(companyId: string | undefined) {
  return useQuery({
    queryKey: ["custom_columns", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("custom_columns")
        .select("*")
        .eq("company_id", companyId!)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomColumn[];
    },
  });
}

export function useCustomColumnValues(companyId: string | undefined) {
  return useQuery({
    queryKey: ["custom_column_values", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      // Get all movement ids for the company, then values
      const { data: movs, error: e1 } = await supabase
        .from("fiscal_movement")
        .select("id")
        .eq("company_id", companyId);
      if (e1) throw e1;
      const ids = (movs ?? []).map((m) => m.id);
      if (ids.length === 0) return [] as CustomColumnValue[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("custom_column_values")
        .select("*")
        .in("movement_id", ids);
      if (error) throw error;
      return (data ?? []) as CustomColumnValue[];
    },
  });
}

export function useUpsertCustomValue(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ movement_id, column_id, value }: { movement_id: string; column_id: string; value: number }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("custom_column_values")
        .upsert({ movement_id, column_id, value }, { onConflict: "movement_id,column_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_column_values", companyId] }),
  });
}

export function useCreateCustomColumn(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      key: string; label: string; kind: "manual" | "formula"; formula?: Formula; position?: number; decimals?: number;
    }) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("custom_columns").insert({
        company_id: companyId,
        key: input.key,
        label: input.label,
        kind: input.kind,
        formula: input.formula ?? { tokens: [] },
        position: input.position ?? 0,
        decimals: input.decimals ?? 2,
        visible: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_columns", companyId] }),
  });
}

export function useUpdateCustomColumn(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CustomColumn> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("custom_columns").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_columns", companyId] }),
  });
}

export function useDeleteCustomColumn(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("custom_columns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_columns", companyId] }),
  });
}

// Build a per-row resolver: given a movement row + custom values map, returns f(key) -> number.
// Built-in keys are read directly from row; custom keys from values map; formula columns are evaluated lazily.
import type { ColumnKey } from "@/hooks/useFiscalConfig";
import { computeColumnValue } from "@/hooks/useFiscalConfig";
import { evaluateFormula } from "@/lib/formula";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRowResolver(row: any, columns: CustomColumn[], valuesByCol: Record<string, number>) {
  const memo: Record<string, number> = {};
  const stack = new Set<string>();

  const resolve = (key: string): number => {
    if (key in memo) return memo[key];
    if (stack.has(key)) return 0; // circular guard
    stack.add(key);
    let val = 0;
    const custom = columns.find((c) => c.key === key);
    if (custom) {
      if (custom.kind === "manual") {
        val = Number(valuesByCol[custom.id] ?? 0);
      } else {
        val = evaluateFormula(custom.formula, resolve);
      }
    } else {
      // built-in (or computed)
      val = computeColumnValue(row, key as ColumnKey);
    }
    stack.delete(key);
    memo[key] = val;
    return val;
  };
  return resolve;
}