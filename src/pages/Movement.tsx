import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronLeft, Filter, FilterX, LogOut, Plus, Printer, Settings, Trash2, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PeriodFilter, filterByPeriod, type PeriodFilterValue } from "@/components/PeriodFilter";
import { brl, displayCompetencia, formatCNPJ, parseBrNumber, formatCustomValue } from "@/lib/format";
import {
  ALL_COLUMNS, TAX_COLUMNS, type ColumnKey,
  isColumnVisible, getColumnLabel, useFiscalConfig,
  isComputedColumn, computeColumnValue, formatPercent, getColumnCategory,
} from "@/hooks/useFiscalConfig";
import {
  type CustomColumn, useCustomColumns, useCustomColumnValues, useUpsertCustomValue,
  buildRowResolver,
} from "@/hooks/useCustomColumns";

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
  const [newComp, setNewComp] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [period, setPeriod] = useState<PeriodFilterValue>({ from: "", to: "" });
  type Op = "gte" | "lte" | "eq" | "between";
  const [colFilters, setColFilters] = useState<Record<string, { op: Op; a: string; b: string }>>({});

  const companyId = selectedCompany?.id;
  const { data: config } = useFiscalConfig(companyId);
  const { data: customCols = [] } = useCustomColumns(companyId);
  const { data: customValues = [] } = useCustomColumnValues(companyId);
  const upsertCustom = useUpsertCustomValue(companyId);

  // Map: movement_id -> column_id -> value
  const valuesByMov = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    customValues.forEach((v) => {
      (out[v.movement_id] ||= {})[v.column_id] = Number(v.value || 0);
    });
    return out;
  }, [customValues]);

  const visibleCustom: CustomColumn[] = useMemo(
    () => [...customCols].filter((c) => c.visible).sort((a, b) => a.position - b.position),
    [customCols]
  );

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
  const computedRows = useMemo(() => {
    if (!config?.auto_calculate_simples_nacional) return rawRows;
    const a = Number(config.aliquota_simples_nacional || 0) / 100;
    return rawRows.map((r) => ({
      ...r,
      simples_nacional: Number((Number(r.saida || 0) * a).toFixed(2)),
    }));
  }, [rawRows, config]);

  const availableComps = useMemo(
    () => Array.from(new Set(rawRows.map((r) => r.competencia))).sort(),
    [rawRows],
  );

  // Apply period + column filters
  const rows = useMemo(() => {
    let r = filterByPeriod(computedRows, period);
    const entries = Object.entries(colFilters);
    if (entries.length > 0) {
      r = r.filter((row) => {
        for (const [col, f] of entries) {
          const resolver = buildRowResolver(row, customCols, valuesByMov[row.id] ?? {});
          const val = resolver(col);
          const a = parseBrNumber(f.a);
          const b = parseBrNumber(f.b);
          if (f.op === "gte" && f.a !== "" && !(val >= a)) return false;
          if (f.op === "lte" && f.a !== "" && !(val <= a)) return false;
          if (f.op === "eq" && f.a !== "" && Math.abs(val - a) > 0.001) return false;
          if (f.op === "between" && f.a !== "" && f.b !== "" && !(val >= a && val <= b)) return false;
        }
        return true;
      });
    }
    return r;
  }, [computedRows, period, colFilters, customCols, valuesByMov]);

  const filtersActive = !!(period.from || period.to) || Object.keys(colFilters).length > 0;
  const clearAllFilters = () => { setPeriod({ from: "", to: "" }); setColFilters({}); };

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




  // Visible columns based on config
  const visibleCols: ColumnKey[] = useMemo(
    () => ALL_COLUMNS.filter((c) => isColumnVisible(config ?? undefined, c)),
    [config]
  );

  const totals = useMemo(() => {
    const byCol: Record<string, number> = {};
    ALL_COLUMNS.forEach((c) => {
      if (isComputedColumn(c)) {
        byCol[c] = 0; // computed below from aggregates if needed
      } else {
        byCol[c] = rows.reduce((s, r) => s + Number((r as unknown as Record<string, number>)[c] || 0), 0);
      }
    });
    // Aggregate aliquota: total simples / total saida
    if (byCol.saida) {
      byCol.aliquota_simples_calc = (byCol.simples_nacional || 0) / byCol.saida;
    }
    // Sum custom columns: per-row evaluation, then sum
    visibleCustom.forEach((cc) => {
      let s = 0;
      rows.forEach((r) => {
        const resolver = buildRowResolver(r, customCols, valuesByMov[r.id] ?? {});
        s += resolver(cc.key);
      });
      byCol[cc.key] = s;
    });
    const totalImpostos = TAX_COLUMNS.reduce((s, c) => s + (byCol[c] || 0), 0);
    const totalSimples = byCol.simples_nacional || 0;
    const economia = totalImpostos - totalSimples;
    return { byCol, totalImpostos, totalSimples, economia };
  }, [rows, visibleCustom, customCols, valuesByMov]);

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
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="no-print border-b bg-card/60 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
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

      {/* Print-only header */}
      <div className="print-only print-header">
        <div className="print-header-info">
          <h1 className="print-title">{selectedCompany.nome_fantasia}</h1>
          <div className="print-sub">{selectedCompany.razao_social}</div>
          <div className="print-sub">{formatCNPJ(selectedCompany.cnpj)} · {selectedCompany.uf}</div>
          <div className="print-sub">Movimento Fiscal · gerado em {new Date().toLocaleString("pt-BR")}</div>
        </div>
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
            `${window.location.origin}/p/${selectedCompany.slug}`
          )}`}
          alt="QR Code do painel público"
          className="print-qr"
          width={110}
          height={110}
        />
      </div>

      <main className="w-full px-4 py-6 sm:px-6 print-main">
        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 print-cards">
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
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Movimento Fiscal</CardTitle>
              {filtersActive && (
                <Badge variant="secondary" className="gap-1">
                  <Filter className="h-3 w-3" />
                  {rows.length}/{computedRows.length}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <PeriodFilter value={period} onChange={setPeriod} available={availableComps} />
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <FilterX className="mr-2 h-4 w-4" /> Limpar
                </Button>
              )}
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Competência
                  </Button>
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
          <CardContent className="overflow-x-auto fiscal-table-wrap">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table className="fiscal-table">
                <TableHeader>
                  <TableRow>
                    <TableHead data-col-cat="competencia" className="sticky left-0 bg-card">
                      {config?.label_competencia ?? "Competência"}
                    </TableHead>
                    {visibleCols.map((c) => {
                      const f = colFilters[c];
                      const active = !!f;
                      return (
                        <TableHead key={c} data-col-cat={getColumnCategory(c)} className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <span>{getColumnLabel(config ?? undefined, c)}</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-6 w-6 no-print ${active ? "text-primary" : "text-muted-foreground"}`}
                                  aria-label={`Filtrar ${getColumnLabel(config ?? undefined, c)}`}
                                >
                                  <Filter className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64" align="end">
                                <ColumnFilterEditor
                                  current={f}
                                  onApply={(next) => setColFilters((prev) => ({ ...prev, [c]: next }))}
                                  onClear={() => setColFilters((prev) => {
                                    const n = { ...prev }; delete n[c]; return n;
                                  })}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableHead>
                      );
                    })}
                    {visibleCustom.map((cc) => (
                      <TableHead key={cc.id} data-col-cat="custom" className="text-right whitespace-nowrap">
                        <span>{cc.label}</span>
                        {cc.kind === "formula" && (
                          <Badge variant="secondary" className="ml-1 no-print h-4 px-1 text-[10px]">f(x)</Badge>
                        )}
                      </TableHead>
                    ))}
                    <TableHead className="no-print"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={visibleCols.length + visibleCustom.length + 2} className="text-center text-muted-foreground py-8">
                        {filtersActive ? "Nenhum registro corresponde aos filtros." : "Nenhuma competência ainda. Clique em \"Adicionar Competência\"."}
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell data-col-cat="competencia" className="sticky left-0 font-medium">
                        {displayCompetencia(r.competencia)}
                      </TableCell>
                      {visibleCols.map((c) => {
                        const value = computeColumnValue(r, c);
                        if (isComputedColumn(c)) {
                          return (
                            <TableCell key={c} data-col-cat={getColumnCategory(c)} className="p-1">
                              <div className="w-full text-right px-2 py-1.5 text-sm tabular-nums text-muted-foreground italic" title="Calculado: simples_nacional / saída">
                                {formatPercent(value)}
                              </div>
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={c} data-col-cat={getColumnCategory(c)} className="p-1">
                            <CellEditor
                              value={value}
                              readonly={isCellReadonly(c)}
                              onCommit={(v) => updateCell.mutate({ id: r.id, field: c as keyof MovementRow, value: v })}
                            />
                          </TableCell>
                        );
                      })}
                      {visibleCustom.map((cc) => {
                        const valuesForRow = valuesByMov[r.id] ?? {};
                        if (cc.kind === "formula") {
                          const resolver = buildRowResolver(r, customCols, valuesForRow);
                          const v = resolver(cc.key);
                          return (
                            <TableCell key={cc.id} data-col-cat="custom" className="p-1">
                              <div className="w-full text-right px-2 py-1.5 text-sm tabular-nums text-muted-foreground italic" title="Coluna calculada">
                                {formatCustomValue(v, cc.format, cc.decimals)}
                              </div>
                            </TableCell>
                          );
                        }
                        const current = Number(valuesForRow[cc.id] ?? 0);
                        return (
                          <TableCell key={cc.id} data-col-cat="custom" className="p-1">
                            <CellEditor
                              value={current}
                              onCommit={(v) => upsertCustom.mutate({ movement_id: r.id, column_id: cc.id, value: v })}
                            />
                          </TableCell>
                        );
                      })}
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
                    <TableRow className="total-row font-semibold">
                      <TableCell data-col-cat="competencia" className="sticky left-0">TOTAL</TableCell>
                      {visibleCols.map((c) => (
                        <TableCell key={c} data-col-cat={getColumnCategory(c)} className="text-right whitespace-nowrap">
                          {isComputedColumn(c) ? formatPercent(totals.byCol[c] || 0) : brl(totals.byCol[c] || 0)}
                        </TableCell>
                      ))}
                      {visibleCustom.map((cc) => (
                        <TableCell key={cc.id} data-col-cat="custom" className="text-right whitespace-nowrap">
                          {formatCustomValue(totals.byCol[cc.key] || 0, cc.format, cc.decimals)}
                        </TableCell>
                      ))}
                      <TableCell className="no-print" />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <footer className="print-only print-footer">
          Documento gerado em {new Date().toLocaleString("pt-BR")}
        </footer>
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
  // Initialize with BR-formatted decimal string (comma as decimal separator)
  const toEditable = (n: number) =>
    n === 0 ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [v, setV] = useState(toEditable(value));
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
        onClick={() => { setV(toEditable(value)); setEditing(true); }}
      >
        {brl(value)}
      </button>
    );
  }
  const commit = () => {
    const n = parseBrNumber(v);
    setEditing(false);
    if (n !== value) onCommit(n);
  };
  return (
    <Input
      autoFocus
      type="text"
      inputMode="decimal"
      value={v}
      onChange={(e) => {
        // Allow only digits, separators, minus and parentheses while typing
        const cleaned = e.target.value.replace(/[^\d.,\-()\s]/g, "");
        setV(cleaned);
      }}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      placeholder="0,00"
      className="h-8 text-right tabular-nums"
    />
  );
}

type FilterOp = "gte" | "lte" | "eq" | "between";
function ColumnFilterEditor({
  current, onApply, onClear,
}: {
  current?: { op: FilterOp; a: string; b: string };
  onApply: (next: { op: FilterOp; a: string; b: string }) => void;
  onClear: () => void;
}) {
  const [op, setOp] = useState<FilterOp>(current?.op ?? "gte");
  const [a, setA] = useState(current?.a ?? "");
  const [b, setB] = useState(current?.b ?? "");
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Filtrar coluna</p>
        <p className="text-xs text-muted-foreground">Aplicado sobre o valor da linha</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Operador</Label>
        <Select value={op} onValueChange={(v) => setOp(v as FilterOp)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gte">Maior ou igual a (≥)</SelectItem>
            <SelectItem value="lte">Menor ou igual a (≤)</SelectItem>
            <SelectItem value="eq">Igual a (=)</SelectItem>
            <SelectItem value="between">Entre</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{op === "between" ? "De" : "Valor"}</Label>
          <Input inputMode="decimal" placeholder="0,00" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        {op === "between" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input inputMode="decimal" placeholder="0,00" value={b} onChange={(e) => setB(e.target.value)} />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => onApply({ op, a, b })} disabled={!a}>Aplicar</Button>
        {current && (
          <Button size="sm" variant="ghost" onClick={onClear}>
            <FilterX className="mr-1 h-3 w-3" /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
