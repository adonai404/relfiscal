import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, Send, Trash2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  PDF_API_LIMITS,
  describeError,
  extractPdfsSync,
  type ExtractSuccess,
  type ExtractError,
} from "@/lib/pdfExtract";

interface PreviewRow {
  id: string;
  selected: boolean;
  file_name: string;
  cnpj: string;
  razao_social: string;
  competencia: string;
  saida: number; // total RPA
  simples_nacional: number; // valor_pago_das
}

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtCnpj = (raw: string) => {
  const d = raw.replace(/\D/g, "").padStart(14, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
};

const fmtComp = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-");
  return y && m ? `${m}/${y}` : yyyymm;
};

export function PdfImportTab({ onDone }: { onDone?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [errors, setErrors] = useState<ExtractError[]>([]);

  const totalSelected = useMemo(() => rows.filter((r) => r.selected).length, [rows]);
  const allSelected = rows.length > 0 && totalSelected === rows.length;

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (list.length === 0) return;
    const merged = [...files, ...list].slice(0, PDF_API_LIMITS.maxFiles);
    setFiles(merged);
    setRows([]);
    setErrors([]);
  };

  const removeFile = (idx: number) => {
    setFiles((f) => f.filter((_, i) => i !== idx));
    setRows([]);
    setErrors([]);
  };

  const sendToApi = async () => {
    if (files.length === 0) {
      toast.error("Selecione ao menos um PDF.");
      return;
    }
    setExtracting(true);
    try {
      const resp = await extractPdfsSync(files);
      const previews: PreviewRow[] = (resp.results ?? [])
        .filter((r): r is ExtractSuccess => r.status === "success" && !!r.data?.cnpj && !!r.data?.competencia)
        .map((r, i) => ({
          id: `${r.data.cnpj}-${r.data.competencia}-${i}`,
          selected: true,
          file_name: r.file_name,
          cnpj: (r.data.cnpj ?? "").replace(/\D/g, ""),
          razao_social: r.data.razao_social ?? "A definir",
          competencia: r.data.competencia ?? "",
          saida: r.data.rpa?.total ?? 0,
          simples_nacional: r.data.valor_pago_das ?? 0,
        }));
      setRows(previews);
      setErrors(resp.errors ?? []);
      if (previews.length === 0 && (resp.errors?.length ?? 0) === 0) {
        toast.warning("A API processou os arquivos mas nenhum dado utilizável foi extraído.");
      } else if (previews.length > 0) {
        toast.success(`${previews.length} extrato(s) lido(s). Confira e importe.`);
      } else {
        toast.error("Nenhum extrato pôde ser lido. Veja os erros abaixo.");
      }
    } catch (err) {
      toast.error((err as Error).message || "Falha ao chamar a API de extração.");
    } finally {
      setExtracting(false);
    }
  };

  const toggleAll = (v: boolean) => setRows((rs) => rs.map((r) => ({ ...r, selected: v })));
  const toggleOne = (id: string, v: boolean) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, selected: v } : r)));

  const importSelected = async () => {
    if (!user) {
      toast.error("Faça login para importar.");
      return;
    }
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) {
      toast.error("Selecione ao menos uma linha para importar.");
      return;
    }
    setImporting(true);
    try {
      const cnpjs = Array.from(new Set(selected.map((r) => r.cnpj)));

      // 1) Empresas existentes
      const { data: existing, error: exErr } = await supabase
        .from("companies")
        .select("id, cnpj, created_by")
        .in("cnpj", cnpjs);
      if (exErr) throw exErr;

      const cnpjToId = new Map<string, string>();
      const notMine: string[] = [];
      (existing ?? []).forEach((c) => {
        if (c.created_by === user.id) cnpjToId.set(c.cnpj, c.id);
        else notMine.push(c.cnpj);
      });
      if (notMine.length > 0) {
        throw new Error(
          `CNPJ(s) pertencente(s) a outro usuário: ${notMine.slice(0, 3).join(", ")}${notMine.length > 3 ? "..." : ""}`
        );
      }

      // 2) Criar empresas faltantes (usa razão social vinda do PDF)
      const missing = selected.filter((r) => !cnpjToId.has(r.cnpj));
      const uniqueMissing = new Map<string, PreviewRow>();
      missing.forEach((r) => {
        if (!uniqueMissing.has(r.cnpj)) uniqueMissing.set(r.cnpj, r);
      });
      let createdCount = 0;
      if (uniqueMissing.size > 0) {
        const toInsert = Array.from(uniqueMissing.values()).map((r) => ({
          cnpj: r.cnpj,
          razao_social: r.razao_social || "A definir",
          nome_fantasia: r.razao_social || `Empresa ${r.cnpj.slice(-4)}`,
          uf: "SP",
          regime: "simples_nacional" as const,
          slug: "",
          created_by: user.id,
        }));
        const { data: created, error: cErr } = await supabase
          .from("companies")
          .insert(toInsert as never)
          .select("id, cnpj");
        if (cErr) throw cErr;
        (created ?? []).forEach((c: { id: string; cnpj: string }) => {
          cnpjToId.set(c.cnpj, c.id);
          createdCount++;
        });
      }

      // 3) Upsert do movimento (saída = RPA total, simples_nacional = valor pago do DAS)
      const payload = selected
        .map((r) => {
          const company_id = cnpjToId.get(r.cnpj);
          if (!company_id) return null;
          return {
            company_id,
            competencia: r.competencia,
            saida: r.saida,
            simples_nacional: r.simples_nacional,
          };
        })
        .filter(Boolean) as Array<Record<string, unknown>>;

      const { error: upErr } = await supabase
        .from("fiscal_movement")
        .upsert(payload as never, { onConflict: "company_id,competencia" });
      if (upErr) throw upErr;

      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["fiscal_movement"] });

      toast.success(
        `${payload.length} competência(s) importada(s)` +
          (createdCount > 0 ? ` • ${createdCount} empresa(s) criada(s) automaticamente` : "")
      );
      setFiles([]);
      setRows([]);
      setErrors([]);
      onDone?.();
    } catch (err) {
      toast.error((err as Error).message || "Falha ao importar dados extraídos.");
    } finally {
      setImporting(false);
    }
  };

  const busy = extracting || importing;

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardContent className="pt-6 space-y-3 text-sm">
          <p className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <strong>Importação automática via PDF</strong>
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>Envie até <strong>{PDF_API_LIMITS.maxFiles} PDFs</strong> de extratos PGDAS-D / DAS por vez (máx. 20MB cada).</li>
            <li>A API extrai CNPJ, razão social, competência, faturamento (RPA) e valor pago do DAS.</li>
            <li>Empresas inexistentes são criadas automaticamente.</li>
            <li>Competências repetidas são <strong>atualizadas</strong> (upsert).</li>
          </ul>
        </CardContent>
      </Card>

      <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onPickFiles} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
          <FileUp className="mr-2 h-4 w-4" /> Selecionar PDFs
        </Button>
        <Button onClick={sendToApi} disabled={busy || files.length === 0}>
          {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Extrair dados ({files.length})
        </Button>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
              <span className="truncate">{f.name} <span className="text-muted-foreground">• {(f.size / 1024 / 1024).toFixed(2)} MB</span></span>
              <Button size="icon" variant="ghost" onClick={() => removeFile(i)} disabled={busy} className="h-7 w-7">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <AlertCircle className="h-4 w-4" /> {errors.length} arquivo(s) com erro
            </div>
            <ul className="space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-muted-foreground">
                  <strong className="text-foreground">{e.file_name}:</strong> {describeError(e.error_code)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {rows.length} extrato(s) lido(s) — confira antes de importar
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} id="sel-all" />
                <label htmlFor="sel-all" className="cursor-pointer">Selecionar todos</label>
              </div>
            </div>

            <ScrollArea className="max-h-72 pr-2">
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                    <Checkbox
                      checked={r.selected}
                      onCheckedChange={(v) => toggleOne(r.id, Boolean(v))}
                      className="mt-0.5"
                    />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                      <div>
                        <div className="font-medium">{r.razao_social}</div>
                        <div className="text-muted-foreground">{fmtCnpj(r.cnpj)}</div>
                      </div>
                      <div className="md:text-right">
                        <Badge variant="secondary">Competência {fmtComp(r.competencia)}</Badge>
                      </div>
                      <div className="text-muted-foreground">
                        Saída (RPA total): <span className="text-foreground font-medium">{fmtBrl(r.saida)}</span>
                      </div>
                      <div className="text-muted-foreground md:text-right">
                        DAS pago: <span className="text-foreground font-medium">{fmtBrl(r.simples_nacional)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={importSelected} disabled={busy || totalSelected === 0}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Importar {totalSelected} selecionado(s)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
