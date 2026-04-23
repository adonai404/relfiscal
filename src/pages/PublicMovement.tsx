import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { brl, displayCompetencia, formatCNPJ } from "@/lib/format";
import {
  ALL_COLUMNS, TAX_COLUMNS, type ColumnKey,
  type FiscalConfig, isColumnVisible, getColumnLabel,
  isComputedColumn, computeColumnValue, formatPercent, getColumnCategory,
} from "@/hooks/useFiscalConfig";
import { useCustomColumns, useCustomColumnValues, buildRowResolver } from "@/hooks/useCustomColumns";
import { formatCustomValue } from "@/lib/format";

interface Company {
  id: string;
  slug: string;
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

export default function PublicMovement() {
  const { slug } = useParams<{ slug: string }>();

  const { data: company, isLoading: loadingCompany } = useQuery({
    queryKey: ["public_company", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, slug, cnpj, nome_fantasia, razao_social, uf")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as Company | null;
    },
  });

  const companyId = company?.id;

  const { data: config } = useQuery({
    queryKey: ["public_fiscal_config", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_config").select("*").eq("company_id", companyId!).maybeSingle();
      if (error) throw error;
      return data as FiscalConfig | null;
    },
  });

  const { data: rawRows = [], isLoading: loadingRows } = useQuery({
    queryKey: ["public_fiscal_movement", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement").select("*").eq("company_id", companyId!)
        .order("competencia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MovementRow[];
    },
  });

  const rows = useMemo(() => {
    if (!config?.auto_calculate_simples_nacional) return rawRows;
    const a = Number(config.aliquota_simples_nacional || 0) / 100;
    return rawRows.map((r) => ({
      ...r,
      simples_nacional: Number((Number(r.saida || 0) * a).toFixed(2)),
    }));
  }, [rawRows, config]);

  const visibleCols: ColumnKey[] = useMemo(
    () => ALL_COLUMNS.filter((c) => isColumnVisible(config ?? undefined, c)),
    [config]
  );

  const { data: customCols = [] } = useCustomColumns(companyId);
  const { data: customValues = [] } = useCustomColumnValues(companyId);
  const valuesByMov = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    customValues.forEach((v) => { (out[v.movement_id] ||= {})[v.column_id] = Number(v.value || 0); });
    return out;
  }, [customValues]);
  const visibleCustom = useMemo(
    () => [...customCols].filter((c) => c.visible).sort((a, b) => a.position - b.position),
    [customCols]
  );

  const totals = useMemo(() => {
    const byCol: Record<string, number> = {};
    ALL_COLUMNS.forEach((c) => {
      if (isComputedColumn(c)) {
        byCol[c] = 0;
      } else {
        byCol[c] = rows.reduce((s, r) => s + Number((r as unknown as Record<string, number>)[c] || 0), 0);
      }
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
    const totalImpostos = TAX_COLUMNS.reduce((s, c) => s + (byCol[c] || 0), 0);
    const totalSimples = byCol.simples_nacional || 0;
    return { byCol, totalImpostos, totalSimples, economia: totalImpostos - totalSimples };
  }, [rows, visibleCustom, customCols, valuesByMov]);

  const anyTaxVisible = TAX_COLUMNS.some((c) => isColumnVisible(config ?? undefined, c));
  const showSimplesCard = isColumnVisible(config ?? undefined, "simples_nacional");
  const showEconomiaCard = anyTaxVisible && showSimplesCard;

  // SEO: dynamic title + meta description + canonical
  useEffect(() => {
    if (!company) return;
    document.title = `${company.nome_fantasia} — Movimento Fiscal`;
    const desc = `Painel público de movimento fiscal de ${company.nome_fantasia} (${formatCNPJ(company.cnpj)}). Entradas, saídas, impostos e Simples Nacional.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc.slice(0, 160));
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.href);
  }, [company]);

  if (loadingCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <h1 className="text-xl font-semibold mb-2">Empresa não encontrada</h1>
            <p className="text-sm text-muted-foreground">
              O link público informado não corresponde a nenhuma empresa cadastrada.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const publicUrl = typeof window !== "undefined" ? window.location.href : "";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(publicUrl)}`;
  const generatedAt = new Date().toLocaleString("pt-BR");

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="no-print border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold leading-tight">{company.nome_fantasia}</h1>
              <div className="text-xs text-muted-foreground">
                {formatCNPJ(company.cnpj)} · {company.uf} · Painel público
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </header>

      {/* Print-only header */}
      <div className="print-only print-header">
        <div className="print-header-info">
          <h1 className="print-title">{company.nome_fantasia}</h1>
          <div className="print-sub">{company.razao_social}</div>
          <div className="print-sub">{formatCNPJ(company.cnpj)} · {company.uf}</div>
          <div className="print-sub">Movimento Fiscal · gerado em {generatedAt}</div>
        </div>
        <img src={qrSrc} alt="QR Code do painel público" className="print-qr" width={110} height={110} />
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 print-main">
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 print-cards">
          <SummaryCard label="Total Entrada" value={totals.byCol.entrada || 0} accent="success" />
          <SummaryCard label="Total Saída" value={totals.byCol.saida || 0} />
          {anyTaxVisible && <SummaryCard label="Total Impostos" value={totals.totalImpostos} accent="warning" />}
          {showSimplesCard && <SummaryCard label="Total Simples Nacional" value={totals.totalSimples} accent="primary" />}
          {showEconomiaCard && (
            <SummaryCard
              label={totals.economia >= 0 ? "No Simples paga MENOS" : "No Simples paga MAIS"}
              value={Math.abs(totals.economia)}
              accent={totals.economia >= 0 ? "success" : "destructive"}
            />
          )}
        </section>

        <Card className="print-container">
          <CardHeader>
            <CardTitle>Movimento Fiscal</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto fiscal-table-wrap">
            {loadingRows ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma competência registrada.</p>
            ) : (
              <Table className="fiscal-table">
                <TableHeader>
                  <TableRow>
                    <TableHead data-col-cat="competencia">{config?.label_competencia ?? "Competência"}</TableHead>
                    {visibleCols.map((c) => (
                      <TableHead key={c} data-col-cat={getColumnCategory(c)} className="text-right whitespace-nowrap">
                        {getColumnLabel(config ?? undefined, c)}
                      </TableHead>
                    ))}
                    {visibleCustom.map((cc) => (
                      <TableHead key={cc.id} data-col-cat="custom" className="text-right whitespace-nowrap">{cc.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell data-col-cat="competencia" className="font-medium">{displayCompetencia(r.competencia)}</TableCell>
                      {visibleCols.map((c) => {
                        const value = computeColumnValue(r, c);
                        return (
                          <TableCell key={c} data-col-cat={getColumnCategory(c)} className="text-right whitespace-nowrap tabular-nums">
                            {isComputedColumn(c) ? formatPercent(value) : brl(value)}
                          </TableCell>
                        );
                      })}
                      {visibleCustom.map((cc) => {
                        const resolver = buildRowResolver(r, customCols, valuesByMov[r.id] ?? {});
                        return (
                          <TableCell key={cc.id} data-col-cat="custom" className="text-right whitespace-nowrap tabular-nums">
                            {formatCustomValue(resolver(cc.key), cc.format, cc.decimals)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow className="total-row font-semibold">
                    <TableCell data-col-cat="competencia">TOTAL</TableCell>
                    {visibleCols.map((c) => (
                      <TableCell key={c} data-col-cat={getColumnCategory(c)} className="text-right whitespace-nowrap tabular-nums">
                        {isComputedColumn(c) ? formatPercent(totals.byCol[c] || 0) : brl(totals.byCol[c] || 0)}
                      </TableCell>
                    ))}
                    {visibleCustom.map((cc) => (
                      <TableCell key={cc.id} data-col-cat="custom" className="text-right whitespace-nowrap tabular-nums">
                        {formatCustomValue(totals.byCol[cc.key] || 0, cc.format, cc.decimals)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <footer className="print-only print-footer">
          Documento gerado em {generatedAt} · {publicUrl}
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
