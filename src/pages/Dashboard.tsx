import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, ChevronLeft, LogOut, TrendingUp, TrendingDown, Activity,
   Trophy, AlertTriangle, Percent, Wallet, Layers, CalendarDays, Loader2, Info,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PeriodFilter, filterByPeriod, currentYearPeriod, type PeriodFilterValue } from "@/components/PeriodFilter";
import { brl, displayCompetencia } from "@/lib/format";
import { useTags, useCompanyTags } from "@/hooks/useTags";
import { tagBadgeStyle } from "@/components/CompanyTagsPicker";
import { X } from "lucide-react";
import { getTaxColumns, type ColumnKey, type FiscalConfig } from "@/hooks/useFiscalConfig";

interface CompanyLite { id: string; nome_fantasia: string; razao_social: string; uf: string; slug: string; }
interface MovementLite {
  company_id: string; competencia: string;
  entrada: number; saida: number; icms: number; impostos_federais: number;
  simples_nacional: number; honorarios: number; folha: number;
  encargos_patronal: number; difal: number; pis: number; cofins: number;
  irpj: number; csll: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilterValue>(currentYearPeriod);
   const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
   const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  const { data: tags = [] } = useTags();
  const { data: companyTagLinks = [] } = useCompanyTags();

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["dashboard_companies"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, nome_fantasia, razao_social, uf, slug");
      if (error) throw error;
      return (data ?? []) as CompanyLite[];
    },
  });
  const { data: configs = [] } = useQuery({
    queryKey: ["dashboard_configs"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_config").select("*");
      if (error) throw error;
      return (data ?? []) as FiscalConfig[];
    },
  });

  const configMap = useMemo(() => {
    const m = new Map<string, FiscalConfig>();
    configs.forEach((c) => m.set(c.company_id, c));
    return m;
  }, [configs]);


  const { data: allMovements = [], isLoading: loadingMov } = useQuery({
    queryKey: ["dashboard_movements"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement")
        .select("company_id, competencia, entrada, saida, icms, impostos_federais, simples_nacional, honorarios, folha, encargos_patronal, difal, pis, cofins, irpj, csll");
      if (error) throw error;
      return (data ?? []) as MovementLite[];
    },
  });

  // Filter companies by selected tags (OR / multi-select)
  const filteredCompanyIds = useMemo(() => {
    if (selectedTagIds.length === 0) return new Set(companies.map((c) => c.id));
    const sel = new Set(selectedTagIds);
    const ids = new Set<string>();
    companyTagLinks.forEach((ct) => { if (sel.has(ct.tag_id)) ids.add(ct.company_id); });
    return ids;
  }, [companies, companyTagLinks, selectedTagIds]);

  const filteredCompanies = useMemo(
    () => companies.filter((c) => filteredCompanyIds.has(c.id)),
    [companies, filteredCompanyIds]
  );

  const rawMovements = useMemo(
    () => allMovements.filter((m) => filteredCompanyIds.has(m.company_id)),
    [allMovements, filteredCompanyIds]
  );

  const availableComps = useMemo(
    () => Array.from(new Set(rawMovements.map((m) => m.competencia))).sort(),
    [rawMovements],
  );
  const movements = useMemo(() => filterByPeriod(rawMovements, period), [rawMovements, period]);

  const metrics = useMemo(() => {
    const companyTaxCols = new Map<string, ColumnKey[]>();
    filteredCompanies.forEach((c) => {
      companyTaxCols.set(c.id, getTaxColumns(configMap.get(c.id)));
    });

    const byCompany = new Map<string, MovementLite[]>();
    movements.forEach((m) => {
      const arr = byCompany.get(m.company_id) ?? [];
      arr.push(m);
      byCompany.set(m.company_id, arr);
    });

    const totals = movements.reduce(
      (acc, m) => {
        acc.entrada += +m.entrada || 0;
        acc.saida += +m.saida || 0;
        acc.icms += +m.icms || 0;
        acc.impostos_federais += +m.impostos_federais || 0;
        acc.simples_nacional += +m.simples_nacional || 0;
        acc.honorarios += +m.honorarios || 0;
        acc.folha += +m.folha || 0;
        acc.encargos_patronal += +m.encargos_patronal || 0;
        acc.difal += +m.difal || 0;
        acc.pis += +m.pis || 0;
        acc.cofins += +m.cofins || 0;
        acc.irpj += +m.irpj || 0;
        acc.csll += +m.csll || 0;
        return acc;
      },
      {
        entrada: 0, saida: 0, icms: 0, impostos_federais: 0, simples_nacional: 0,
        honorarios: 0, folha: 0, encargos_patronal: 0, difal: 0, pis: 0,
        cofins: 0, irpj: 0, csll: 0,
      },
    );

    const totalImpostos =
      totals.icms + totals.impostos_federais + totals.simples_nacional +
      totals.difal + totals.pis + totals.cofins + totals.irpj + totals.csll;
    const totalCustosOperacionais = totals.honorarios + totals.folha + totals.encargos_patronal;
    const margemBruta = totals.saida - totals.entrada;
    const resultadoLiquido = margemBruta - totalImpostos - totalCustosOperacionais;
    const cargaTributaria = totals.saida > 0 ? totalImpostos / totals.saida : 0;

    // Per company aggregated
    const perCompany = filteredCompanies.map((c) => {
      const ms = byCompany.get(c.id) ?? [];
      const t = ms.reduce(
        (a, m) => {
          a.entrada += +m.entrada || 0;
          a.saida += +m.saida || 0;
          const taxCols = companyTaxCols.get(m.company_id) || []; taxCols.forEach((col) => { a.imp += Number((m as any)[col] || 0); });
          a.simples += +m.simples_nacional || 0;
          return a;
        },
        { entrada: 0, saida: 0, imp: 0, simples: 0 },
      );
      const carga = t.saida > 0 ? t.imp / t.saida : 0;
      const aliqEfetiva = t.saida > 0 ? t.simples / t.saida : 0;
      return {
        ...c,
        ...t,
        carga,
        aliqEfetiva,
        margem: t.saida - t.entrada,
        meses: ms.length,
      };
    });

    const ativas = perCompany.filter((c) => c.meses > 0);
    const inativas = perCompany.filter((c) => c.meses === 0);

    const topFaturamento = [...perCompany].sort((a, b) => b.saida - a.saida).slice(0, 5);
    const topEntrada = [...perCompany].sort((a, b) => b.entrada - a.entrada).slice(0, 5);
    const topCarga = [...ativas].sort((a, b) => b.carga - a.carga).slice(0, 5);
    const menorCarga = [...ativas].sort((a, b) => a.carga - b.carga).slice(0, 5);

    // Per UF
    const ufMap = new Map<string, { uf: string; saida: number; impostos: number; count: number }>();
    perCompany.forEach((c) => {
      const e = ufMap.get(c.uf) ?? { uf: c.uf, saida: 0, impostos: 0, count: 0 };
      e.saida += c.saida;
      e.impostos += c.imp;
      e.count += 1;
      ufMap.set(c.uf, e);
    });
    const porUf = Array.from(ufMap.values()).sort((a, b) => b.saida - a.saida);

    // Time series — sum across companies per competencia
    const compMap = new Map<string, { competencia: string; entrada: number; saida: number; impostos: number }>();
    movements.forEach((m) => {
      const e = compMap.get(m.competencia) ?? { competencia: m.competencia, entrada: 0, saida: 0, impostos: 0 };
      e.entrada += +m.entrada || 0;
      e.saida += +m.saida || 0;
      const taxCols = companyTaxCols.get(m.company_id) || []; taxCols.forEach((col) => { e.impostos += Number((m as any)[col] || 0); });
      compMap.set(m.competencia, e);
    });
    const serie = Array.from(compMap.values()).sort((a, b) => a.competencia.localeCompare(b.competencia));
    const serieFmt = serie.map((s) => ({ ...s, label: displayCompetencia(s.competencia) }));

    // Composição de impostos
    const taxKeys: { key: ColumnKey; name: string }[] = [
      { key: "icms", name: "ICMS" },
      { key: "simples_nacional", name: "Simples Nacional" },
      { key: "impostos_federais", name: "Impostos Federais" },
      { key: "pis", name: "PIS" },
      { key: "cofins", name: "COFINS" },
      { key: "irpj", name: "IRPJ" },
      { key: "csll", name: "CSLL" },
      { key: "difal", name: "DIFAL" },
    ];
    const composicaoMap = new Map<string, number>();
    movements.forEach((m) => {
      const taxCols = companyTaxCols.get(m.company_id) || [];
      taxKeys.forEach(({ key, name }) => {
        if (taxCols.includes(key)) {
          const val = Number((m as any)[key] || 0);
          composicaoMap.set(name, (composicaoMap.get(name) || 0) + val);
        }
      });
    });
    const composicao = Array.from(composicaoMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0);

     // Saúde financeira
     const saudaveis = ativas.filter((c) => c.carga < 0.15).length;
      const alertCompanies = ativas.filter((c) => c.carga >= 0.25);
     const alerta = alertCompanies.length;

    return {
      totals, totalImpostos, totalCustosOperacionais, margemBruta, resultadoLiquido, cargaTributaria,
      perCompany, ativas, inativas, topFaturamento, topEntrada, topCarga, menorCarga,
       porUf, serieFmt, composicao, saudaveis, alerta, alertCompanies,
    };
  }, [filteredCompanies, movements, configMap]);

  if (loading || loadingCompanies || loadingMov) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/empresas" replace />;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Administrativo</h1>
        <PeriodFilter value={period} onChange={setPeriod} available={availableComps} />
      </div>

        {/* Tag filter */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/50 p-3">
            <span className="text-xs font-medium text-muted-foreground">Filtrar por tag:</span>
            {tags.map((t) => {
              const active = selectedTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTagIds((prev) =>
                    prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                  )}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active ? "ring-2 ring-offset-1 ring-offset-background" : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: active ? t.color : `${t.color}22`,
                    color: active ? "#fff" : t.color,
                    borderColor: `${t.color}55`,
                  }}
                >
                  {t.name}
                </button>
              );
            })}
            {selectedTagIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedTagIds([])} className="ml-auto h-7">
                <X className="mr-1 h-3 w-3" /> Limpar ({selectedTagIds.length})
              </Button>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Building2 className="h-5 w-5" />}
            title="Empresas Monitoradas"
            value={String(filteredCompanies.length)}
            hint={`${metrics.ativas.length} ativas · ${metrics.inativas.length} sem dados`}
          />
          <KpiCard
           icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
           title="Faturamento Consolidado"
           value={brl(metrics.totals.saida)}
           hint={`Entradas ${brl(metrics.totals.entrada)}`}
         />
         <KpiCard
           icon={<Wallet className="h-5 w-5 text-primary" />}
           title="Total de Impostos"
           value={brl(metrics.totalImpostos)}
           hint="Conforme configuração fiscal"
         />
          <KpiCard
            icon={<Percent className="h-5 w-5 text-amber-500" />}
            title="Carga Tributária Global"
            value={`${(metrics.cargaTributaria * 100).toFixed(2)}%`}
            hint={`${brl(metrics.totalImpostos)} em tributos`}
          />
        </div>

         {/* Indicadores de Carga Tributária */}
         <div className="grid gap-4 md:grid-cols-3">
           <MiniCard
             tone="success"
             icon={<Trophy className="h-4 w-4" />}
             label="Baixa Carga Tributária"
             value={metrics.saudaveis}
             sub="Carga tributária < 15%"
           />
           <div onClick={() => setIsAlertModalOpen(true)} className="cursor-pointer">
             <MiniCard
               tone="warning"
               icon={<AlertTriangle className="h-4 w-4" />}
               label="Alta Carga Tributária"
               value={metrics.alerta}
               sub="Carga tributária ≥ 25%"
             />
           </div>
 
         <Dialog open={isAlertModalOpen} onOpenChange={setIsAlertModalOpen}>
           <DialogContent className="max-w-2xl">
             <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                 <AlertTriangle className="h-5 w-5 text-amber-500" /> Empresas com Alta Carga
               </DialogTitle>
               <DialogDescription>
                 Listagem de empresas com carga tributária elevada (≥ 25%).
               </DialogDescription>
             </DialogHeader>
             <ScrollArea className="mt-4 max-h-[60vh] pr-4">
               <div className="space-y-3">
                 {metrics.alertCompanies.length === 0 ? (
                   <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma empresa em estado de alerta.</p>
                 ) : (
                   metrics.alertCompanies.map((c) => (
                     <div
                       key={c.id}
                       className="flex items-center justify-between rounded-lg border bg-card p-4 transition hover:bg-muted/50 cursor-pointer"
                       onClick={() => {
                         setIsAlertModalOpen(false);
                         navigate(`/p/${c.slug}`);
                       }}
                     >
                       <div className="space-y-1">
                         <p className="font-semibold">{c.nome_fantasia}</p>
                         <div className="flex items-center gap-2 text-xs text-muted-foreground">
                           <Badge variant="outline" className="h-5">{c.uf}</Badge>
                           <span>{c.meses} meses analisados</span>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-sm font-bold text-amber-600">
                           Carga: {(c.carga * 100).toFixed(1)}%
                         </p>
                       </div>
                     </div>
                   ))
                 )}
               </div>
             </ScrollArea>
           </DialogContent>
         </Dialog>
          <MiniCard
            tone="info"
            icon={<CalendarDays className="h-4 w-4" />}
            label="Competências Ativas"
            value={metrics.serieFmt.length}
            sub={metrics.serieFmt.length > 0
              ? `${metrics.serieFmt[0].label} → ${metrics.serieFmt[metrics.serieFmt.length - 1].label}`
              : "Sem dados"}
          />
        </div>

        {/* Time series + Composição */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolução Consolidada</CardTitle>
              <CardDescription>Entradas, saídas e impostos por competência (todas as empresas)</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {metrics.serieFmt.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.serieFmt}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: number) => brl(v)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="entrada" name="Entrada" stroke={COLORS[2]} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="saida" name="Saída" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="impostos" name="Impostos" stroke={COLORS[4]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Composição Tributária</CardTitle>
              <CardDescription>Distribuição dos tributos pagos</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {metrics.composicao.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={metrics.composicao} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {metrics.composicao.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: number) => brl(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rankings: Top faturamento, Top entrada, Top carga */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Top 5 Compras
              </CardTitle>
              <CardDescription>Empresas com maior volume de entrada</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {metrics.topEntrada.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.topEntrada} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <YAxis type="category" dataKey="nome_fantasia" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: number) => brl(v)}
                    />
                    <Bar dataKey="entrada" fill={COLORS[2]} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Top 5 Faturamento
              </CardTitle>
              <CardDescription>Empresas com maior volume de saída</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {metrics.topFaturamento.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.topFaturamento} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <YAxis type="category" dataKey="nome_fantasia" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: number) => brl(v)}
                    />
                    <Bar dataKey="saida" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Maiores Cargas Tributárias
              </CardTitle>
              <CardDescription>Empresas com maior % de impostos sobre saída</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {metrics.topCarga.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.topCarga.map((c) => ({ ...c, cargaPct: +(c.carga * 100).toFixed(2) }))} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="nome_fantasia" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: number) => `${v}%`}
                    />
                    <Bar dataKey="cargaPct" fill={COLORS[4]} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Distribuição por UF + Ranking detalhado */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Distribuição por UF
              </CardTitle>
              <CardDescription>Faturamento e carga por estado</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.porUf.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
              ) : (
                <ScrollArea className="h-[280px] pr-3">
                  <div className="space-y-3">
                    {metrics.porUf.map((u) => {
                      const carga = u.saida > 0 ? (u.impostos / u.saida) * 100 : 0;
                      const max = metrics.porUf[0].saida || 1;
                      const pct = (u.saida / max) * 100;
                      return (
                        <div key={u.uf} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">{u.uf || "—"}</Badge>
                              <span className="text-muted-foreground">{u.count} empresa(s)</span>
                            </div>
                            <span className="font-medium">{brl(u.saida)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs text-muted-foreground">Carga média: {carga.toFixed(2)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-500" /> Ranking Geral
              </CardTitle>
              <CardDescription>Visão consolidada por empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px] pr-3">
                <div className="space-y-2">
                  {metrics.perCompany
                    .slice()
                    .sort((a, b) => b.saida - a.saida)
                    .map((c, idx) => (
                      <div
                        key={c.id}
                        className="group flex cursor-pointer items-center justify-between rounded-md border bg-card/40 p-3 transition hover:border-primary hover:bg-card"
                        onClick={() => navigate(`/p/${c.slug}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{c.nome_fantasia}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.uf} · {c.meses} mês(es)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{brl(c.saida)}</p>
                          <p className="text-xs text-muted-foreground">{(c.carga * 100).toFixed(1)}% carga</p>
                        </div>
                      </div>
                    ))}
                  {metrics.perCompany.length === 0 && (
                    <p className="py-12 text-center text-sm text-muted-foreground">Sem empresas.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
    </div>

  );
}

const KPI_TONES = [
  { bg: "var(--gradient-kpi-blue)", chip: "bg-blue-500/15 text-blue-600", ring: "ring-blue-500/20" },
  { bg: "var(--gradient-kpi-green)", chip: "bg-emerald-500/15 text-emerald-600", ring: "ring-emerald-500/20" },
  { bg: "var(--gradient-kpi-amber)", chip: "bg-amber-500/15 text-amber-600", ring: "ring-amber-500/20" },
  { bg: "var(--gradient-kpi-violet)", chip: "bg-violet-500/15 text-violet-600", ring: "ring-violet-500/20" },
];
let __kpiIdx = 0;
function KpiCard({ icon, title, value, hint, tone }: { icon: React.ReactNode; title: string; value: string; hint?: string; tone?: number }) {
  const t = KPI_TONES[(tone ?? __kpiIdx++) % KPI_TONES.length];
  return (
    <Card className={`overflow-hidden border-0 shadow-[var(--shadow-soft)] ring-1 ${t.ring}`} style={{ background: t.bg }}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-foreground/70">{title}</p>
          <div className={`rounded-xl p-2.5 ${t.chip}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-foreground/60">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MiniCard({
  icon, label, value, sub, tone,
}: { icon: React.ReactNode; label: string; value: number | string; sub?: string; tone: "success" | "warning" | "info" }) {
  const toneClass =
    tone === "success" ? "border-emerald-500/30 bg-emerald-500/5"
    : tone === "warning" ? "border-amber-500/30 bg-amber-500/5"
    : "border-primary/30 bg-primary/5";
  return (
    <Card className={`border ${toneClass}`}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-md bg-card p-2">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Sem dados suficientes para exibir.
    </div>
  );
}
