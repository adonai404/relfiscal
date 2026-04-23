import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseXlsxFile, type ParsedRow } from "@/lib/xlsx";
import type { FiscalConfig } from "@/hooks/useFiscalConfig";
import type { CustomColumn } from "@/hooks/useCustomColumns";

export function useXlsxImport(
  companyId: string | undefined,
  config: FiscalConfig | null | undefined,
  customCols: CustomColumn[] = []
) {
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importRows = useMutation({
    mutationFn: async (parsed: ParsedRow[]) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      if (parsed.length === 0) throw new Error("Nenhuma linha válida encontrada na planilha");
      const payload = parsed.map((p) => ({
        company_id: companyId,
        competencia: p.competencia,
        ...p.values,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: upserted, error } = await supabase
        .from("fiscal_movement")
        .upsert(payload as any, { onConflict: "company_id,competencia" })
        .select("id, competencia");
      if (error) throw error;

      // Persist custom column values (manual ones)
      const manualCols = customCols.filter((c) => c.kind === "manual");
      if (manualCols.length > 0 && upserted) {
        const idByComp = new Map<string, string>();
        upserted.forEach((m) => idByComp.set(m.competencia, m.id));
        const ccvPayload: Array<{ movement_id: string; column_id: string; value: number }> = [];
        for (const p of parsed) {
          const movId = idByComp.get(p.competencia);
          if (!movId) continue;
          for (const cc of manualCols) {
            const v = p.customByKey?.[cc.key];
            if (typeof v === "number") {
              ccvPayload.push({ movement_id: movId, column_id: cc.id, value: v });
            }
          }
        }
        if (ccvPayload.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: e2 } = await (supabase as any)
            .from("custom_column_values")
            .upsert(ccvPayload, { onConflict: "movement_id,column_id" });
          if (e2) throw e2;
        }
      }
      return parsed.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["fiscal_movement", companyId] });
      qc.invalidateQueries({ queryKey: ["custom_column_values", companyId] });
      toast.success(`${count} competência(s) importada(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseXlsxFile(file, config ?? undefined, customCols);
      await importRows.mutateAsync(parsed);
    } catch (err) {
      toast.error((err as Error).message || "Falha ao importar planilha");
    } finally {
      setImporting(false);
    }
  };

  return {
    fileInputRef,
    onFileChange,
    isImporting: importing || importRows.isPending,
    triggerPicker: () => fileInputRef.current?.click(),
  };
}
