import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronLeft, Download, FileSpreadsheet, LogOut, Plus, Printer, Settings, Trash2, Loader2, Share2, Upload } from "lucide-react";
import { downloadTemplate, exportMovementToXlsx, parseXlsxFile, type ParsedRow } from "@/lib/xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { ThemeToggle } from "@/components/ThemeToggle";
import { brl, displayCompetencia, formatCNPJ } from "@/lib/format";
import {
  ALL_COLUMNS, TAX_COLUMNS, type ColumnKey,
  isColumnVisible, getColumnLabel, useFiscalConfig,
} from "@/hooks/useFiscalConfig";

interface MovementRow {
  id: string;
  competencia: string;
  entrada: number;
  saida: number;
  icms: number;
  impostos_federais: number;
  simples_nacional: number;
  honorarios: number;
  folha: number;
  encargos_patronal: number;
  difal: number;
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
}

export default function Movement() {
  const { signOut } = useAuth();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newComp, setNewComp] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const companyId = selectedCompany?.id;
  const { data: config } = useFiscalConfig(companyId);

  const { data: rawRows = [], isLoading } = useQuery({
    queryKey: ["fiscal_movement", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement")
        .select("*")
        .eq("company_id", companyId!)
        .order("competencia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MovementRow[];
    },
  });

  // Apply auto-calculate Simples Nacional if enabled (display-only)
  const rows = useMemo(() => {
    if (!config?.auto_calculate_simples_nacional) return rawRows;
    const a = Number(config.aliquota_simples_nacional || 0) / 100;
    return rawRows.map((r) => ({
      ...r,
      simples_nacional: Number((Number(r.saida || 0) * a).toFixed(2)),
    }));
  }, [rawRows, config]);

  const updateCell = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: keyof MovementRow; value: number }) => {
      const payload: Record<string, number> = { [field]: value };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("fiscal_movement").update(payload as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiscal_movement", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addRow = useMutation({
    mutationFn: async (competencia: string) => {
      if (!companyId) return;
      const { error } = await supabase.from("fiscal_movement").insert({ company_id: companyId, competencia });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal_movement", companyId] });
      toast.success("Competência adicionada");
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fiscal_movement").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal_movement", companyId] });
      toast.success("Linha excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Visible columns based on config
  const visibleCols: ColumnKey[] = useMemo(
    () => ALL_COLUMNS.filter((c) => isColumnVisible(config ?? undefined, c)),
    [config]
  );

  const totals = useMemo(() => {
    const byCol: Record<string, number> = {};
    ALL_COLUMNS.forEach((c) => (byCol[c] = rows.reduce((s, r) => s + Number(r[c] || 0), 0)));
    const totalImpostos = TAX_COLUMNS.reduce((s, c) => s + (byCol[c] || 0), 0);
    const totalSimples = byCol.simples_nacional || 0;
    const economia = totalImpostos - totalSimples;
    return { byCol, totalImpostos, totalSimples, economia };
  }, [rows]);

  // Card visibility rules
  const anyTaxVisible = TAX_COLUMNS.some((c) => isColumnVisible(config ?? undefined, c));
  const showSimplesCard = isColumnVisible(config ?? undefined, "simples_nacional");
  const showEconomiaCard = anyTaxVisible && showSimplesCard;

  if (!selectedCompany) return <Navigate to="/empresas" replace />;

  const sharePublic = () => {
    const url = `${window.location.origin}/p/${selectedCompany.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link público copiado!");
  };

  // Cell editor disabled for simples_nacional when auto-calc is on
  const isCellReadonly = (col: ColumnKey) =>
    col === "simples_nacional" && !!config?.auto_calculate_simples_nacional;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="no-print border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/empresas")} aria-label="Voltar">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold leading-tight">{selectedCompany.nome_fantasia}</div>
              <div className="text-xs text-muted-foreground">{formatCNPJ(selectedCompany.cnpj)} · {selectedCompany.uf}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes")}>
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </Button>
            <Button variant="outline" size="sm" onClick={sharePublic}>
              <Share2 className="mr-2 h-4 w-4" /> Página pública
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <SummaryCard label="Total Entrada" value={totals.byCol.entrada || 0} accent="success" />
          <SummaryCard label="Total Saída" value={totals.byCol.saida || 0} />
          {anyTaxVisible && (
            <SummaryCard label="Total Impostos" value={totals.totalImpostos} accent="warning" />
          )}
          {showSimplesCard && (
            <SummaryCard label="Total Simples Nacional" value={totals.totalSimples} accent="primary" />
          )}
          {showEconomiaCard && (
            <SummaryCard
              label={totals.economia >= 0 ? "No Simples paga MENOS" : "No Simples paga MAIS"}
              value={Math.abs(totals.economia)}
              accent={totals.economia >= 0 ? "success" : "destructive"}
            />
          )}
        </div>

        <Card className="print-container">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Movimento Fiscal</CardTitle>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate(config ?? undefined)}
                title="Baixa um modelo de planilha respeitando seus rótulos e colunas visíveis"
              >
                <Download className="mr-2 h-4 w-4" /> Baixar Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing || importRows.isPending}
                title="Importar planilha XLSX (upsert por mês de referência)"
              >
                {importing || importRows.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Importar XLSX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportMovementToXlsx(rows, config ?? undefined, `movimento-${selectedCompany.slug}.xlsx`)}
                disabled={rows.length === 0}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Adicionar Competência</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova competência</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <Label>Mês de referência</Label>
                    <Input type="month" value={newComp} onChange={(e) => setNewComp(e.target.value)} />
                  </div>
                  <DialogFooter>
                    <Button onClick={() => addRow.mutate(newComp)} disabled={addRow.isPending}>
                      {addRow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">{config?.label_competencia ?? "Competência"}</TableHead>
                    {visibleCols.map((c) => (
                      <TableHead key={c} className="text-right whitespace-nowrap">
                        {getColumnLabel(config ?? undefined, c)}
                      </TableHead>
                    ))}
                    <TableHead className="no-print"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={visibleCols.length + 2} className="text-center text-muted-foreground py-8">
                        Nenhuma competência ainda. Clique em "Adicionar Competência".
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="sticky left-0 bg-card font-medium">{displayCompetencia(r.competencia)}</TableCell>
                      {visibleCols.map((c) => (
                        <TableCell key={c} className="p-1">
                          <CellEditor
                            value={Number(r[c] || 0)}
                            readonly={isCellReadonly(c)}
                            onCommit={(v) => updateCell.mutate({ id: r.id, field: c, value: v })}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="no-print">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Excluir competência ${displayCompetencia(r.competencia)}?`)) deleteRow.mutate(r.id);
                          }}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length > 0 && (
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell className="sticky left-0 bg-muted/50">TOTAL</TableCell>
                      {visibleCols.map((c) => (
                        <TableCell key={c} className="text-right whitespace-nowrap">{brl(totals.byCol[c] || 0)}</TableCell>
                      ))}
                      <TableCell className="no-print" />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: "success" | "warning" | "destructive" | "primary" }) {
  const accentClass =
    accent === "success" ? "text-success" :
    accent === "warning" ? "text-warning" :
    accent === "destructive" ? "text-destructive" :
    accent === "primary" ? "text-primary" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`mt-1 text-xl font-bold ${accentClass}`}>{brl(value)}</div>
      </CardContent>
    </Card>
  );
}

function CellEditor({ value, onCommit, readonly }: { value: number; onCommit: (v: number) => void; readonly?: boolean }) {
  const [v, setV] = useState(String(value));
  const [editing, setEditing] = useState(false);
  if (readonly) {
    return (
      <div className="w-full text-right px-2 py-1.5 text-sm tabular-nums text-muted-foreground italic" title="Calculado automaticamente">
        {brl(value)}
      </div>
    );
  }
  if (!editing) {
    return (
      <button
        type="button"
        className="w-full text-right px-2 py-1.5 rounded hover:bg-accent transition text-sm tabular-nums"
        onClick={() => { setV(String(value)); setEditing(true); }}
      >
        {brl(value)}
      </button>
    );
  }
  const commit = () => {
    const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
    setEditing(false);
    if (!isNaN(n) && n !== value) onCommit(n);
  };
  return (
    <Input
      autoFocus
      type="number"
      step="0.01"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-8 text-right tabular-nums"
    />
  );
}
