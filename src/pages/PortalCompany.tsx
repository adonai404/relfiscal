import { useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, displayCompetencia, formatCNPJ } from "@/lib/format";
import {
  ALL_COLUMNS,
  type ColumnKey,
  type FiscalConfig,
  isColumnVisible,
  getColumnLabel,
  isComputedColumn,
  computeColumnValue,
  formatPercent,
  getColumnCategory,
  getTaxColumns,
} from "@/hooks/useFiscalConfig";
import { useCustomColumns, useCustomColumnValues, buildRowResolver } from "@/hooks/useCustomColumns";
import { formatCustomValue } from "@/lib/format";
import { PeriodFilter, type PeriodFilterValue } from "@/components/PeriodFilter";

interface Company {
  id: string;
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  uf: string;
}

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

export default function PortalCompany() {
  const { id } = useParams<{ id: string }>();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>({ from: "", to: "" });

  const { data: company, isLoading: loadingCompany } = useQuery({
    queryKey: ["portal_company", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, cnpj, nome_fantasia, razao_social, uf")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Company | null;
    },
  });

  const { data: config } = useQuery({
    queryKey: ["portal_fiscal_config", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_config")
        .select("*")
        .eq("company_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as FiscalConfig | null;
    },
  });

  const { data: rawRows = [], isLoading: loadingRows } = useQuery({
    queryKey: ["portal_fiscal_movement", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement")
        .select("*")
        .eq("company_id", id!)
        .order("competencia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MovementRow[];
    },
  });

  const computedRows = useMemo(() => {
    if (!config?.auto_calculate_simples_nacional) return rawRows;
    const a = Number(config.aliquota_simples_nacional || 0) / 100;
    return rawRows.map((r) => ({
      ...r,
      simples_nacional: Number((Number(r.saida || 0) * a).toFixed(2)),
    }));
  }, [rawRows, config]);

  const rows = useMemo(() => {
    const { from, to } = periodFilter;
    if (!from && !to) return computedRows;
    return computedRows.filter((r) => {
      if (from && r.competencia < from) return false;
      if (to && r.competencia > to) return false;
      return true;
    });
  }, [computedRows, periodFilter]);

  const visibleCols: ColumnKey[] = useMemo(
    () => ALL_COLUMNS.filter((c) => isColumnVisible(config ?? undefined, c)),
    [config],
  );

  const { data: customCols = [] } = useCustomColumns(id);
  const { data: customValues = [] } = useCustomColumnValues(id);
  const valuesByMov = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    customValues.forEach((v) => {
      (out[v.movement_id] ||= {})[v.column_id] = Number(v.value || 0);
    });
    return out;
  }, [customValues]);
  const visibleCustom = useMemo(
    () => [...customCols].filter((c) => c.visible).sort((a, b) => a.position - b.position),
    [customCols],
  );

  const taxCols = useMemo(() => getTaxColumns(config ?? undefined), [config]);

  const totals = useMemo(() => {
    const byCol: Record<string, number> = {};
    ALL_COLUMNS.forEach((c) => {
      if (isComputedColumn(c)) byCol[c] = 0;
      else byCol[c] = rows.reduce((s, r) => s + Number((r as unknown as Record<string, number>)[c] || 0), 0);
    });
    if (byCol.saida) byCol.aliquota_simples_calc = (byCol.simples_nacional || 0) / byCol.saida;
    visibleCustom.forEach((cc) => {
      let s = 0;
      rows.forEach((r) => {
        const resolver = buildRowResolver(r, customCols, valuesByMov[r.id] ?? {});
        s += resolver(cc.key);
      });
      byCol[cc.key] = s;
    });
    const totalImpostos = taxCols.reduce((s, c) => s + (byCol[c] || 0), 0);
    const totalSimples = byCol.simples_nacional || 0;
    return { byCol, totalImpostos, totalSimples, economia: totalImpostos - totalSimples };
  }, [rows, visibleCustom, customCols, valuesByMov, taxCols]);

  const anyTaxVisible = taxCols.some((c) => isColumnVisible(config ?? undefined, c));
  const showSimplesCard = isColumnVisible(config ?? undefined, "simples_nacional");

  if (loadingCompany) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!company) return <Navigate to="/portal" replace />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">{company.nome_fantasia}</h1>
            <div className="text-xs text-muted-foreground">
              {company.razao_social} · {formatCNPJ(company.cnpj)} · {company.uf}
            </div>
          </div>
        </div>
        <PeriodFilter
          value={periodFilter}
          onChange={setPeriodFilter}
          available={computedRows.map((r) => r.competencia)}
        />
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <SummaryCard label="Total Entrada" value={totals.byCol.entrada || 0} accent="success" />
        <SummaryCard label="Total Saída" value={totals.byCol.saida || 0} />
        {anyTaxVisible && (
          <SummaryCard label="Total Impostos" value={totals.totalImpostos} accent="warning" />
        )}
        {showSimplesCard && (
          <SummaryCard label="Simples Nacional" value={totals.totalSimples} accent="primary" />
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimento Fiscal</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loadingRows ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma competência registrada para este período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{config?.label_competencia ?? "Competência"}</TableHead>
                  {visibleCols.map((c) => (
                    <TableHead
                      key={c}
                      data-col-cat={getColumnCategory(c)}
                      className="whitespace-nowrap text-right"
                    >
                      {getColumnLabel(config ?? undefined, c)}
                    </TableHead>
                  ))}
                  {visibleCustom.map((cc) => (
                    <TableHead key={cc.id} className="whitespace-nowrap text-right">
                      {cc.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{displayCompetencia(r.competencia)}</TableCell>
                    {visibleCols.map((c) => {
                      const value = computeColumnValue(r, c);
                      return (
                        <TableCell
                          key={c}
                          className="whitespace-nowrap text-right tabular-nums"
                        >
                          {isComputedColumn(c) ? formatPercent(value) : brl(value)}
                        </TableCell>
                      );
                    })}
                    {visibleCustom.map((cc) => {
                      const resolver = buildRowResolver(r, customCols, valuesByMov[r.id] ?? {});
                      return (
                        <TableCell
                          key={cc.id}
                          className="whitespace-nowrap text-right tabular-nums"
                        >
                          {formatCustomValue(resolver(cc.key), cc.format, cc.decimals)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>TOTAL</TableCell>
                  {visibleCols.map((c) => (
                    <TableCell key={c} className="whitespace-nowrap text-right tabular-nums">
                      {isComputedColumn(c)
                        ? formatPercent(totals.byCol[c] || 0)
                        : brl(totals.byCol[c] || 0)}
                    </TableCell>
                  ))}
                  {visibleCustom.map((cc) => (
                    <TableCell key={cc.id} className="whitespace-nowrap text-right tabular-nums">
                      {formatCustomValue(totals.byCol[cc.key] || 0, cc.format, cc.decimals)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warning" | "primary";
}) {
  const accentClass =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning"
        : accent === "primary"
          ? "text-primary"
          : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-lg font-bold ${accentClass}`}>{brl(value)}</div>
      </CardContent>
    </Card>
  );
}