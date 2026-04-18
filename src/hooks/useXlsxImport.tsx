import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseXlsxFile, type ParsedRow } from "@/lib/xlsx";
import type { FiscalConfig } from "@/hooks/useFiscalConfig";

export function useXlsxImport(companyId: string | undefined, config: FiscalConfig | null | undefined) {
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
      const { error } = await supabase.from("fiscal_movement").upsert(payload as any, {
        onConflict: "company_id,competencia",
      });
      if (error) throw error;
      return parsed.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["fiscal_movement", companyId] });
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
      const parsed = await parseXlsxFile(file, config ?? undefined);
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
