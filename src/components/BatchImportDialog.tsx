import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, Loader2, FileSpreadsheet, Building2, Layers, FileText } from "lucide-react";
import { PdfImportTab } from "./PdfImportTab";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreateImportCompanies } from "@/lib/companyImport";
import {
  downloadCompaniesTemplate,
  downloadBatchMovementTemplate,
  parseCompaniesFile,
  parseBatchMovementFile,
  type ParsedCompanyRow,
  type ParsedBatchMovementRow,
} from "@/lib/xlsxBatch";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function BatchImportDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const companiesFileRef = useRef<HTMLInputElement>(null);
  const movementFileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // ---------- Importar empresas ----------
  const importCompanies = async (rows: ParsedCompanyRow[]) => {
    if (!user) throw new Error("Não autenticado");
    if (rows.length === 0) throw new Error("Nenhuma empresa válida na planilha.");

    const { createdCount } = await getOrCreateImportCompanies(rows);
    return { inserted: createdCount, skipped: rows.length - createdCount };
  };

  const onCompaniesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseCompaniesFile(file);
      const { inserted, skipped } = await importCompanies(parsed);
      qc.invalidateQueries({ queryKey: ["companies"] });
      if (inserted > 0) {
        toast.success(
          `${inserted} empresa(s) cadastrada(s)` + (skipped > 0 ? ` • ${skipped} já existia(m)` : "")
        );
      } else {
        toast.info(`Nenhuma empresa nova. ${skipped} já estava(m) cadastrada(s).`);
      }
    } catch (err) {
      toast.error((err as Error).message || "Falha ao importar empresas");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Importar movimento em lote ----------
  const importBatchMovement = async (rows: ParsedBatchMovementRow[]) => {
    if (!user) throw new Error("Não autenticado");
    if (rows.length === 0) throw new Error("Nenhuma linha válida na planilha de movimento.");

    const { idByCnpj: cnpjToId, createdCount } = await getOrCreateImportCompanies(
      rows.map((r) => ({
        cnpj: r.cnpj,
        razao_social: "A definir",
        nome_fantasia: `Empresa ${r.cnpj.slice(-4)}`,
        uf: "SP",
        regime: "simples_nacional",
      }))
    );

    // Inserir/atualizar movimento
    const payload = rows
      .map((r) => {
        const companyId = cnpjToId.get(r.cnpj);
        if (!companyId) return null;
        return {
          company_id: companyId,
          competencia: r.competencia,
          ...r.values,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const { error: upErr } = await supabase
      .from("fiscal_movement")
      .upsert(payload as never, { onConflict: "company_id,competencia" });
    if (upErr) throw upErr;

    return { rows: payload.length, companiesCreated: createdCount, companiesAffected: cnpjToId.size };
  };

  const onMovementFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseBatchMovementFile(file, null);
      const result = await importBatchMovement(parsed);
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["fiscal_movement"] });
      toast.success(
        `${result.rows} competência(s) importada(s) em ${result.companiesAffected} empresa(s)` +
          (result.companiesCreated > 0 ? ` • ${result.companiesCreated} empresa(s) criada(s) automaticamente` : "")
      );
    } catch (err) {
      toast.error((err as Error).message || "Falha ao importar movimento");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Importação em lote
          </DialogTitle>
          <DialogDescription>
            Cadastre várias empresas ou importe movimento de várias empresas de uma só vez via planilha XLSX.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pdf" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pdf">
              <FileText className="mr-2 h-4 w-4" /> Extrato Simples Nacional
            </TabsTrigger>
            <TabsTrigger value="companies">
              <Building2 className="mr-2 h-4 w-4" /> Empresas
            </TabsTrigger>
            <TabsTrigger value="movement">
              <Layers className="mr-2 h-4 w-4" /> Movimento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pdf">
            <PdfImportTab onDone={() => onOpenChange(false)} />
          </TabsContent>

          <TabsContent value="companies" className="space-y-4 pt-4">
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm">
                <p>
                  <strong>Colunas esperadas:</strong> CNPJ, Razão Social, Nome Fantasia, UF, Regime.
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>CNPJs já cadastrados são ignorados (não duplica).</li>
                  <li>Regime aceita: Simples Nacional, Lucro Presumido, Lucro Real, MEI.</li>
                  <li>Se faltar Razão Social, vira "A definir" — você ajusta depois.</li>
                </ul>
              </CardContent>
            </Card>
            <input
              ref={companiesFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onCompaniesFile}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadCompaniesTemplate()} disabled={busy}>
                <Download className="mr-2 h-4 w-4" /> Baixar modelo
              </Button>
              <Button onClick={() => companiesFileRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Selecionar planilha
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="movement" className="space-y-4 pt-4">
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm">
                <p>
                  <strong>Colunas esperadas:</strong> CNPJ, Competência (MM/AAAA) e qualquer coluna fiscal (Entrada, Saída, ICMS, PIS, COFINS, etc).
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Cada linha vai para a empresa cujo CNPJ bate.</li>
                  <li>CNPJs ainda não cadastrados serão criados automaticamente (você ajusta os dados depois).</li>
                  <li>Competências já existentes são <strong>atualizadas</strong> (upsert).</li>
                </ul>
              </CardContent>
            </Card>
            <input
              ref={movementFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onMovementFile}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadBatchMovementTemplate(null)} disabled={busy}>
                <Download className="mr-2 h-4 w-4" /> Baixar modelo
              </Button>
              <Button onClick={() => movementFileRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Selecionar planilha
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
