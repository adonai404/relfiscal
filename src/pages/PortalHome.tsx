import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Receipt,
  X,
  ChevronRight,
  PiggyBank,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { PeriodFilter, type PeriodFilterValue } from "@/components/PeriodFilter";

interface Company {
  id: string;
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  uf: string;
}

interface Movement {
  company_id: string;
  competencia: string;
  entrada: number;
  saida: number;
  icms: number;
  difal: number;
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
  impostos_federais: number;
  simples_nacional: number;
  encargos_patronal: number;
}

type TaxKey =
  | "icms"
  | "difal"
  | "pis"
  | "cofins"
  | "irpj"
  | "csll"
  | "impostos_federais"
  | "simples_nacional"
  | "encargos_patronal";

const TAX_KEYS: TaxKey[] = [
  "icms",
  "difal",
  "pis",
  "cofins",
  "irpj",
  "csll",
  "impostos_federais",
  "simples_nacional",
  "encargos_patronal",
];

const TAX_LABEL: Record<TaxKey, string> = {
  icms: "ICMS",
  difal: "DIFAL",
  pis: "PIS",
  cofins: "COFINS",
  irpj: "IRPJ",
  csll: "CSLL",
  impostos_federais: "Impostos Federais",
  simples_nacional: "Simples Nacional",
  encargos_patronal: "Encargos Patronais",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success, 142 70% 45%))",
  "hsl(var(--warning, 38 92% 50%))",
  "hsl(var(--destructive))",
  "hsl(217 91% 60%)",
  "hsl(280 70% 60%)",
  "hsl(174 60% 45%)",
  "hsl(25 80% 55%)",
  "hsl(340 75% 55%)",
];

export default function PortalHome() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilterValue>({ from: "", to: "" });
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [taxFilter, setTaxFilter] = useState<TaxKey | null>(null);
  const [showAllTax, setShowAllTax] = useState(false);
  const [showAllBuy, setShowAllBuy] = useState(false);
  const [showAllSell, setShowAllSell] = useState(false);

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["portal_companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, cnpj, nome_fantasia, razao_social, uf")
        .order("nome_fantasia");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
    staleTime: 60_000,
  });

  const companyIds = useMemo(() => companies.map((c) => c.id), [companies]);

  const { data: movements = [], isLoading: loadingMov } = useQuery({
    queryKey: ["portal_movements_all", companyIds],
    enabled: companyIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement")
        .select(
          "company_id, competencia, entrada, saida, icms, difal, pis, cofins, irpj, csll, impostos_federais, simples_nacional, encargos_patronal",
        )
        .in("company_id", companyIds);
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });

  const companyMap = useMemo(() => {
    const m = new Map<string, Company>();
    companies.forEach((c) => m.set(c.id, c));
    return m;
  }, [companies]);

  const visibleCompanies = useMemo(() => {
    const t = search.trim().toLowerCase();
    let list = companies;
    if (companyFilter !== "all") list = list.filter((c) => c.id === companyFilter);
    if (t)
      list = list.filter(
        (c) =>
          c.nome_fantasia?.toLowerCase().includes(t) ||
          c.razao_social?.toLowerCase().includes(t) ||
          c.cnpj?.includes(t.replace(/\D/g, "")),
      );
    return list;
  }, [companies, companyFilter, search]);

  const visibleIds = useMemo(() => new Set(visibleCompanies.map((c) => c.id)), [visibleCompanies]);

  const filteredMov = useMemo(() => {
    return movements.filter((r) => {
      if (!visibleIds.has(r.company_id)) return false;
      if (period.from && r.competencia < period.from) return false;
      if (period.to && r.competencia > period.to) return false;
      return true;
    });
  }, [movements, visibleIds, period]);

  const totals = useMemo(() => {
    let entrada = 0;
    let saida = 0;
    const byTax: Record<TaxKey, number> = {
      icms: 0,
      difal: 0,
      pis: 0,
      cofins: 0,
      irpj: 0,
      csll: 0,
      impostos_federais: 0,
      simples_nacional: 0,
      encargos_patronal: 0,
    };
    filteredMov.forEach((r) => {
      entrada += Number(r.entrada || 0);
      saida += Number(r.saida || 0);
      TAX_KEYS.forEach((k) => {
        byTax[k] += Number((r as unknown as Record<string, number>)[k] || 0);
      });
    });
    const totalImpostos = taxFilter
      ? byTax[taxFilter]
      : TAX_KEYS.reduce((s, k) => s + byTax[k], 0);
    return { entrada, saida, byTax, totalImpostos };
  }, [filteredMov, taxFilter]);

  const pieData = useMemo(
    () =>
      TAX_KEYS.map((k) => ({ key: k, name: TAX_LABEL[k], value: totals.byTax[k] })).filter(
        (d) => d.value > 0,
      ),
    [totals],
  );

  const evolutionData = useMemo(() => {
    const byComp = new Map<string, { entrada: number; saida: number; impostos: number }>();
    filteredMov.forEach((r) => {
      const cur = byComp.get(r.competencia) ?? { entrada: 0, saida: 0, impostos: 0 };
      cur.entrada += Number(r.entrada || 0);
      cur.saida += Number(r.saida || 0);
      const imp = taxFilter
        ? Number((r as unknown as Record<string, number>)[taxFilter] || 0)
        : TAX_KEYS.reduce(
            (s, k) => s + Number((r as unknown as Record<string, number>)[k] || 0),
            0,
          );
      cur.impostos += imp;
      byComp.set(r.competencia, cur);
    });
    return Array.from(byComp.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([competencia, v]) => {
        const [y, m] = competencia.split("-");
        const label = m && y ? `${m}/${y.slice(2)}` : competencia;
        return { competencia, label, ...v };
      });
  }, [filteredMov, taxFilter]);

  const rankings = useMemo(() => {
    const byCompany = new Map<string, { entrada: number; saida: number; impostos: number }>();
    filteredMov.forEach((r) => {
      const cur = byCompany.get(r.company_id) ?? { entrada: 0, saida: 0, impostos: 0 };
      cur.entrada += Number(r.entrada || 0);
      cur.saida += Number(r.saida || 0);
      const imp = taxFilter
        ? Number((r as unknown as Record<string, number>)[taxFilter] || 0)
        : TAX_KEYS.reduce((s, k) => s + Number((r as unknown as Record<string, number>)[k] || 0), 0);
      cur.impostos += imp;
      byCompany.set(r.company_id, cur);
    });
    const arr = Array.from(byCompany.entries()).map(([id, v]) => ({
      id,
      name: companyMap.get(id)?.nome_fantasia ?? "—",
      ...v,
    }));
    return {
      tax: [...arr].sort((a, b) => b.impostos - a.impostos),
      buy: [...arr].sort((a, b) => b.entrada - a.entrada),
      sell: [...arr].sort((a, b) => b.saida - a.saida),
    };
  }, [filteredMov, companyMap, taxFilter]);

  const hasFilters =
    period.from || period.to || companyFilter !== "all" || search || taxFilter;

  const clearFilters = () => {
    setPeriod({ from: "", to: "" });
    setCompanyFilter("all");
    setSearch("");
    setTaxFilter(null);
  };

  const loading = loadingCompanies || loadingMov;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada das suas empresas
            {taxFilter && (
              <>
                {" · filtrando por "}
                <span className="font-medium text-foreground">{TAX_LABEL[taxFilter]}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-48"
          />
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_fantasia}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PeriodFilter
            value={period}
            onChange={setPeriod}
            available={movements.map((m) => m.competencia)}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<Building2 className="h-5 w-5" />}
          label="Empresas"
          value={visibleCompanies.length.toString()}
          tone="primary"
        />
        <KpiCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="Total de Entradas"
          value={brl(totals.entrada)}
          tone="info"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total de Saídas"
          value={brl(totals.saida)}
          tone="success"
        />
        <KpiCard
          icon={<Receipt className="h-5 w-5" />}
          label={taxFilter ? `Total ${TAX_LABEL[taxFilter]}` : "Total de Impostos"}
          value={brl(totals.totalImpostos)}
          tone="warning"
        />
      </section>

      {/* Composição Tributária + Evolução Consolidada */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Composição Tributária</CardTitle>
            {taxFilter && (
              <Button variant="ghost" size="sm" onClick={() => setTaxFilter(null)}>
                <X className="mr-1 h-3.5 w-3.5" /> Limpar tributo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pieData.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <PiggyBank className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Nenhum tributo registrado no período.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_minmax(180px,220px)] sm:items-center">
                <div className="h-[260px] w-full sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="88%"
                        paddingAngle={2}
                        onClick={(d) => setTaxFilter((d as { key: TaxKey }).key)}
                        className="cursor-pointer outline-none"
                      >
                        {pieData.map((d, i) => (
                          <Cell
                            key={d.key}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            opacity={!taxFilter || taxFilter === d.key ? 1 : 0.25}
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, _n, p) => [
                          brl(Number(v)),
                          (p as { payload?: { name?: string } })?.payload?.name ?? "",
                        ]}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {pieData
                    .slice()
                    .sort((a, b) => b.value - a.value)
                    .map((d) => {
                      const total = pieData.reduce((s, x) => s + x.value, 0) || 1;
                      const pct = (d.value / total) * 100;
                      const i = pieData.findIndex((x) => x.key === d.key);
                      const active = !taxFilter || taxFilter === d.key;
                      return (
                        <button
                          key={d.key}
                          onClick={() =>
                            setTaxFilter((prev) => (prev === d.key ? null : d.key))
                          }
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                            active ? "" : "opacity-50"
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {pct.toFixed(1)}%
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução Consolidada</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : evolutionData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum movimento no período.
              </p>
            ) : (
              <div className="h-[280px] w-full sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gEntrada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSaida" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142 70% 45%)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(142 70% 45%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gImpostos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      width={70}
                      tickFormatter={(v) =>
                        v >= 1000000
                          ? `${(v / 1000000).toFixed(1)}M`
                          : v >= 1000
                            ? `${(v / 1000).toFixed(0)}k`
                            : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(v: number) => brl(Number(v))}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                    <Area
                      type="monotone"
                      dataKey="entrada"
                      name="Entradas"
                      stroke="hsl(217 91% 60%)"
                      strokeWidth={2}
                      fill="url(#gEntrada)"
                    />
                    <Area
                      type="monotone"
                      dataKey="saida"
                      name="Saídas"
                      stroke="hsl(142 70% 45%)"
                      strokeWidth={2}
                      fill="url(#gSaida)"
                    />
                    <Area
                      type="monotone"
                      dataKey="impostos"
                      name={taxFilter ? TAX_LABEL[taxFilter] : "Impostos"}
                      stroke="hsl(38 92% 50%)"
                      strokeWidth={2}
                      fill="url(#gImpostos)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Rankings */}
      <section className="grid gap-4 lg:grid-cols-3">
        <RankingCard
          title="Mais pagam impostos"
          items={rankings.tax}
          valueKey="impostos"
          showAll={showAllTax}
          onToggle={() => setShowAllTax((v) => !v)}
          onOpen={(id) => navigate(`/portal/empresa/${id}`)}
          total={totals.totalImpostos}
          showPercent
        />
        <RankingCard
          title="Mais compram"
          items={rankings.buy}
          valueKey="entrada"
          showAll={showAllBuy}
          onToggle={() => setShowAllBuy((v) => !v)}
          onOpen={(id) => navigate(`/portal/empresa/${id}`)}
        />
        <RankingCard
          title="Mais vendem"
          items={rankings.sell}
          valueKey="saida"
          showAll={showAllSell}
          onToggle={() => setShowAllSell((v) => !v)}
          onOpen={(id) => navigate(`/portal/empresa/${id}`)}
        />
      </section>

      {/* Listagem de empresas */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Minhas empresas</h2>
            <p className="text-xs text-muted-foreground">
              Selecione uma empresa para ver os detalhes do movimento.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {visibleCompanies.length} {visibleCompanies.length === 1 ? "empresa" : "empresas"}
          </span>
        </div>
        {loadingCompanies ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : visibleCompanies.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma empresa encontrada com os filtros atuais.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/portal/empresa/${c.id}`)}
                className="group text-left"
              >
                <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{c.nome_fantasia}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {c.cnpj}
                        {c.uf ? ` · ${c.uf}` : ""}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "info" | "success" | "warning";
}) {
  const toneClass: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankingCard({
  title,
  items,
  valueKey,
  showAll,
  onToggle,
  onOpen,
  total,
  showPercent,
}: {
  title: string;
  items: Array<{ id: string; name: string; entrada: number; saida: number; impostos: number }>;
  valueKey: "entrada" | "saida" | "impostos";
  showAll: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
  total?: number;
  showPercent?: boolean;
}) {
  const filled = items.filter((i) => i[valueKey] > 0);
  const list = showAll ? filled : filled.slice(0, 10);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {list.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Sem dados.</p>
        ) : (
          list.map((item, idx) => {
            const v = item[valueKey];
            const pct = showPercent && total && total > 0 ? (v / total) * 100 : null;
            return (
              <button
                key={item.id}
                onClick={() => onOpen(item.id)}
                className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{item.name}</div>
                  <div className="text-[11px] tabular-nums text-muted-foreground">
                    {brl(v)}
                    {pct !== null && <span className="ml-1">· {pct.toFixed(1)}%</span>}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })
        )}
        {filled.length > 10 && (
          <Button variant="ghost" size="sm" className="w-full" onClick={onToggle}>
            {showAll ? "Mostrar Top 10" : `Ver todas (${filled.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}