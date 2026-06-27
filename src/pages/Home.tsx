import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight, LayoutDashboard, Presentation, Calculator, UserCog,
  ChevronRight, TrendingUp, TrendingDown, Building2, FileText,
  Percent, Wallet, AlertTriangle, Trophy, Layers,
} from "lucide-react";
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  Bar, BarChart, Cell,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PeriodFilter, filterByPeriod, currentYearPeriod, type PeriodFilterValue } from "@/components/PeriodFilter";
import { brl, displayCompetencia } from "@/lib/format";
import { getTaxColumns, type ColumnKey, type FiscalConfig } from "@/hooks/useFiscalConfig";

// ── types ──────────────────────────────────────────────────────────────────────
interface CompanyLite { id: string; nome_fantasia: string; razao_social: string; uf: string; }
interface MovRow {
  company_id: string; competencia: string;
  entrada: number; saida: number; icms: number; impostos_federais: number;
  simples_nacional: number; honorarios: number; folha: number;
  encargos_patronal: number; difal: number; pis: number; cofins: number;
  irpj: number; csll: number;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(221 83% 53%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(291 64% 42%)",
];

function calcImpostos(m: MovRow, taxCols: ColumnKey[]) {
  return taxCols.reduce((s, k) => s + (+m[k as keyof MovRow] || 0), 0);
}

// ── helpers ────────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, trend, color = "text-primary",
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; trend?: "up" | "down" | "neutral"; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-xl p-2.5 bg-primary/10`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── main ───────────────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilterValue>(currentYearPeriod);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
    if (h >= 5 && h < 12) return `Bom dia, ${name}`;
    if (h >= 12 && h < 19) return `Boa tarde, ${name}`;
    return `Boa noite, ${name}`;
  }, [user]);

  // ── queries ──────────────────────────────────────────────────────────────────
  const { data: companies = [] } = useQuery({
    queryKey: ["home_companies"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, nome_fantasia, razao_social, uf");
      if (error) throw error;
      return (data ?? []) as CompanyLite[];
    },
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["home_configs"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_config").select("*");
      if (error) throw error;
      return (data ?? []) as FiscalConfig[];
    },
  });

  const { data: allMovements = [], isLoading: loadingMov } = useQuery({
    queryKey: ["home_movements"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement")
        .select("company_id, competencia, entrada, saida, icms, impostos_federais, simples_nacional, honorarios, folha, encargos_patronal, difal, pis, cofins, irpj, csll");
      if (error) throw error;
      return (data ?? []) as MovRow[];
    },
  });

  const { data: docCount = 0 } = useQuery({
    queryKey: ["home_doc_count"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase.from("company_documentation").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: planCount = 0 } = useQuery({
    queryKey: ["home_plan_count"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase.from("tax_planning").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // ── derived ───────────────────────────────────────────────────────────────────
  const configMap = useMemo(() => {
    const m = new Map<string, FiscalConfig>();
    configs.forEach((c) => m.set(c.company_id, c));
    return m;
  }, [configs]);

  const companyMap = useMemo(() => {
    const m = new Map<string, CompanyLite>();
    companies.forEach((c) => m.set(c.id, c));
    return m;
  }, [companies]);

  const availableComps = useMemo(
    () => Array.from(new Set(allMovements.map((m) => m.competencia))).sort(),
    [allMovements],
  );

  const movements = useMemo(() => filterByPeriod(allMovements, period), [allMovements, period]);

  const { totals, byCompany, byComp, companyStats } = useMemo(() => {
    const totals = { entrada: 0, saida: 0, impostos: 0 };
    const byCompany = new Map<string, { saida: number; impostos: number; entrada: number }>();
    const byComp = new Map<string, { saida: number; impostos: number; entrada: number }>();

    movements.forEach((m) => {
      const taxCols = getTaxColumns(configMap.get(m.company_id));
      const imp = calcImpostos(m, taxCols);
      const saida = +m.saida || 0;
      const entrada = +m.entrada || 0;

      totals.saida += saida;
      totals.entrada += entrada;
      totals.impostos += imp;

      // by company
      const prev = byCompany.get(m.company_id) ?? { saida: 0, impostos: 0, entrada: 0 };
      byCompany.set(m.company_id, { saida: prev.saida + saida, impostos: prev.impostos + imp, entrada: prev.entrada + entrada });

      // by competencia (for chart)
      const prevC = byComp.get(m.competencia) ?? { saida: 0, impostos: 0, entrada: 0 };
      byComp.set(m.competencia, { saida: prevC.saida + saida, impostos: prevC.impostos + imp, entrada: prevC.entrada + entrada });
    });

    const companyStats = Array.from(byCompany.entries())
      .map(([id, v]) => ({
        id,
        name: companyMap.get(id)?.nome_fantasia || companyMap.get(id)?.razao_social || id,
        uf: companyMap.get(id)?.uf ?? "",
        ...v,
        carga: v.saida > 0 ? v.impostos / v.saida : 0,
      }))
      .sort((a, b) => b.saida - a.saida);

    return { totals, byCompany, byComp, companyStats };
  }, [movements, configMap, companyMap]);

  const cargaGlobal = totals.saida > 0 ? totals.impostos / totals.saida : 0;
  const activeCompanies = byCompany.size;
  const highBurden = companyStats.filter((c) => c.carga >= 0.25).length;
  const lowBurden = companyStats.filter((c) => c.carga > 0 && c.carga < 0.15).length;

  // Chart data
  const trendData = useMemo(() =>
    Array.from(byComp.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([comp, v]) => ({
        name: displayCompetencia(comp),
        Faturamento: v.saida,
        Impostos: v.impostos,
        Compras: v.entrada,
      })),
    [byComp],
  );

  const top5 = companyStats.slice(0, 5);

  const menuItems = [
    { title: "Movimento", desc: "Lançamentos fiscais", icon: ArrowLeftRight, path: "/empresas", color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Dashboard", desc: "Indicadores consolidados", icon: LayoutDashboard, path: "/dashboard", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Apresentação", desc: "Cenários tributários", icon: Presentation, path: "/apresentacao", color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Planejamento", desc: "Simulações de regimes", icon: Calculator, path: "/planejamento", color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Minha Conta", desc: "Perfil e segurança", icon: UserCog, path: "/minha-conta", color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="w-full space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Painel Inicial</p>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumo geral do sistema.</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} available={availableComps} />
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Faturamento"
          value={brl(totals.saida)}
          sub={`${activeCompanies} empresa${activeCompanies !== 1 ? "s" : ""} no período`}
          icon={Wallet}
          color="text-emerald-500"
        />
        <KpiCard
          label="Total de Impostos"
          value={brl(totals.impostos)}
          sub={`Carga: ${(cargaGlobal * 100).toFixed(1)}%`}
          icon={Percent}
          color="text-red-500"
        />
        <KpiCard
          label="Total de Compras"
          value={brl(totals.entrada)}
          sub="Entradas consolidadas"
          icon={Layers}
          color="text-blue-500"
        />
        <KpiCard
          label="Empresas Ativas"
          value={String(activeCompanies)}
          sub={`de ${companies.length} cadastradas`}
          icon={Building2}
          color="text-primary"
        />
      </div>

      {/* Alertas de carga */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-emerald-600">{lowBurden}</p>
              <p className="text-xs text-muted-foreground">Empresa{lowBurden !== 1 ? "s" : ""} com baixa carga (&lt;15%)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-amber-600">{highBurden}</p>
              <p className="text-xs text-muted-foreground">Empresa{highBurden !== 1 ? "s" : ""} com alta carga (≥25%)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{docCount}</p>
              <p className="text-xs text-muted-foreground">Documento{docCount !== 1 ? "s" : ""} cadastrado{docCount !== 1 ? "s" : ""}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de evolução + ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolução */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução Consolidada</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                Sem dados no período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Line type="monotone" dataKey="Faturamento" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Impostos" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Compras" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-2 justify-center">
              {[["Faturamento", "hsl(var(--primary))"], ["Impostos", "hsl(0 84% 60%)"], ["Compras", "hsl(221 83% 53%)"]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top 5 faturamento */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Top Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {top5.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados.</p>
            ) : top5.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${top5[0].saida > 0 ? (c.saida / top5[0].saida) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{brl(c.saida)}</span>
                  </div>
                </div>
                <Badge
                  variant={c.carga >= 0.25 ? "destructive" : c.carga < 0.15 ? "default" : "secondary"}
                  className="text-[10px] shrink-0"
                >
                  {(c.carga * 100).toFixed(1)}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Carga por empresa (bar) */}
      {companyStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Carga Tributária por Empresa (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={companyStats.slice(0, 10).map((c) => ({ name: c.name, carga: parseFloat((c.carga * 100).toFixed(1)) }))}
                margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="carga" radius={[4, 4, 0, 0]}>
                  {companyStats.slice(0, 10).map((c, i) => (
                    <Cell
                      key={c.id}
                      fill={c.carga >= 0.25 ? "hsl(0 84% 60%)" : c.carga < 0.15 ? "hsl(142 71% 45%)" : "hsl(var(--primary))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Navegação rápida */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Acesso rápido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="group text-left animate-in fade-in slide-in-from-bottom-3 duration-500"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 h-full">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
