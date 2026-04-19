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

    // Quais já existem? (para não tentar duplicar)
    const cnpjs = rows.map((r) => r.cnpj);
    const { data: existing, error: exErr } = await supabase
      .from("companies")
      .select("cnpj")
      .in("cnpj", cnpjs);
    if (exErr) throw exErr;
    const existingSet = new Set((existing ?? []).map((c) => c.cnpj));

    const toInsert = rows
      .filter((r) => !existingSet.has(r.cnpj))
      .map((r) => ({
        cnpj: r.cnpj,
        razao_social: r.razao_social,
        nome_fantasia: r.nome_fantasia,
        uf: r.uf,
        regime: r.regime,
        slug: "", // trigger gera
        created_by: user.id,
      }));

    if (toInsert.length === 0) {
      return { inserted: 0, skipped: rows.length };
    }

    const { error } = await supabase.from("companies").insert(toInsert as never);
    if (error) throw error;
    return { inserted: toInsert.length, skipped: rows.length - toInsert.length };
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

    const allCnpjs = Array.from(new Set(rows.map((r) => r.cnpj)));

    // 1) Buscar empresas que já existem (do usuário ou de qualquer um — RLS de SELECT é pública)
    const { data: existing, error: exErr } = await supabase
      .from("companies")
      .select("id, cnpj, created_by")
      .in("cnpj", allCnpjs);
    if (exErr) throw exErr;

    const cnpjToId = new Map<string, string>();
    const notMine: string[] = [];
    (existing ?? []).forEach((c) => {
      if (c.created_by === user.id) {
        cnpjToId.set(c.cnpj, c.id);
      } else {
        notMine.push(c.cnpj);
      }
    });

    if (notMine.length > 0) {
      throw new Error(
        `Os seguintes CNPJs já existem no sistema mas pertencem a outro usuário: ${notMine.slice(0, 3).join(", ")}${
          notMine.length > 3 ? "..." : ""
        }`
      );
    }

    // 2) Criar empresas faltantes automaticamente
    const missing = allCnpjs.filter((c) => !cnpjToId.has(c));
    let createdCount = 0;
    if (missing.length > 0) {
      const toInsert = missing.map((cnpj) => ({
        cnpj,
        razao_social: "A definir",
        nome_fantasia: `Empresa ${cnpj.slice(-4)}`,
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

    // 3) Inserir/atualizar movimento
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
              <FileText className="mr-2 h-4 w-4" /> PDF (Simples)
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
