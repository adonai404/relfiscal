import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft, Layers, LogOut, Loader2, Trophy, TrendingUp, TrendingDown,
  Percent, Building2, Sparkles, Crown, Medal, Award,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PeriodFilter, filterByPeriod, type PeriodFilterValue } from "@/components/PeriodFilter";
import { brl, displayCompetencia } from "@/lib/format";

interface MovementLite {
  company_id: string; competencia: string;
  entrada: number; saida: number; icms: number; impostos_federais: number;
  simples_nacional: number; honorarios: number; folha: number;
  encargos_patronal: number; difal: number; pis: number; cofins: number;
  irpj: number; csll: number;
}

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(160 60% 45%)",
  "hsl(30 80% 55%)",
  "hsl(280 65% 60%)",
  "hsl(340 75% 55%)",
  "hsl(200 70% 50%)",
  "hsl(50 90% 55%)",
  "hsl(0 70% 55%)",
];

export default function Combo() {
  const { user, loading, signOut } = useAuth();
  const { companies } = useCompany();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [period, setPeriod] = useState<PeriodFilterValue>({ from: "", to: "" });

  const { data: rawMovements = [], isLoading } = useQuery({
    queryKey: ["combo_movements", selectedIds.sort().join(",")],
    enabled: selectedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement")
        .select("company_id, competencia, entrada, saida, icms, impostos_federais, simples_nacional, honorarios, folha, encargos_patronal, difal, pis, cofins, irpj, csll")
        .in("company_id", selectedIds);
      if (error) throw error;
      return (data ?? []) as MovementLite[];
    },
  });

  const availableComps = useMemo(
    () => Array.from(new Set(rawMovements.map((m) => m.competencia))).sort(),
    [rawMovements],
  );
  const movements = useMemo(() => filterByPeriod(rawMovements, period), [rawMovements, period]);

  const selectedCompanies = useMemo(
    () => companies.filter((c) => selectedIds.includes(c.id)),
    [companies, selectedIds],
  );

  const filteredCompanies = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return companies;
    return companies.filter((c) =>
      c.nome_fantasia.toLowerCase().includes(f) ||
      c.razao_social.toLowerCase().includes(f) ||
      c.uf.toLowerCase().includes(f),
    );
  }, [companies, filter]);

  const data = useMemo(() => {
    if (selectedCompanies.length === 0) return null;

    // Per company aggregates
    const byCompany = selectedCompanies.map((c) => {
      const ms = movements.filter((m) => m.company_id === c.id);
      const t = ms.reduce(
        (a, m) => {
          a.entrada += +m.entrada || 0;
          a.saida += +m.saida || 0;
          a.icms += +m.icms || 0;
          a.impostos_federais += +m.impostos_federais || 0;
          a.simples_nacional += +m.simples_nacional || 0;
          a.honorarios += +m.honorarios || 0;
          a.folha += +m.folha || 0;
          a.encargos_patronal += +m.encargos_patronal || 0;
          a.difal += +m.difal || 0;
          a.pis += +m.pis || 0;
          a.cofins += +m.cofins || 0;
          a.irpj += +m.irpj || 0;
          a.csll += +m.csll || 0;
          return a;
        },
        {
          entrada: 0, saida: 0, icms: 0, impostos_federais: 0, simples_nacional: 0,
          honorarios: 0, folha: 0, encargos_patronal: 0, difal: 0, pis: 0,
          cofins: 0, irpj: 0, csll: 0,
        },
      );
      const impostos = t.icms + t.impostos_federais + t.simples_nacional +
        t.difal + t.pis + t.cofins + t.irpj + t.csll;
      const custos = t.honorarios + t.folha + t.encargos_patronal;
      const margem = t.saida - t.entrada;
      const liquido = margem - impostos - custos;
      const carga = t.saida > 0 ? impostos / t.saida : 0;
      const aliqEfetiva = t.saida > 0 ? t.simples_nacional / t.saida : 0;
      const eficiencia = t.saida > 0 ? liquido / t.saida : 0; // % líquido sobre faturamento
      return {
        ...c, ...t, impostos, custos, margem, liquido, carga, aliqEfetiva, eficiencia,
        meses: ms.length,
      };
    });

    // Time series: each company as a line
    const compSet = new Set<string>();
    movements.forEach((m) => compSet.add(m.competencia));
    const competencias = Array.from(compSet).sort();
    const serie = competencias.map((comp) => {
      const row: Record<string, number | string> = { competencia: comp, label: displayCompetencia(comp) };
      selectedCompanies.forEach((c) => {
        const m = movements.find((x) => x.company_id === c.id && x.competencia === comp);
        row[c.id] = m ? +m.saida || 0 : 0;
      });
      return row;
    });

    // Radar comparison (normalized 0-100 across selection)
    const metricsKeys = ["saida", "margem", "eficiencia", "carga", "aliqEfetiva"] as const;
    const metricLabels: Record<string, string> = {
      saida: "Faturamento",
      margem: "Margem Bruta",
      eficiencia: "Eficiência %",
      carga: "Carga Trib. (inv.)",
      aliqEfetiva: "Alíq. Simples (inv.)",
    };
    const maxMap: Record<string, number> = {};
    metricsKeys.forEach((k) => {
      maxMap[k] = Math.max(...byCompany.map((c) => Math.abs(Number(c[k]) || 0)), 1);
    });
    const radar = metricsKeys.map((k) => {
      const row: Record<string, number | string> = { metric: metricLabels[k] };
      byCompany.forEach((c) => {
        let v = Number(c[k]) || 0;
        // For carga/aliquota, lower is better → invert
        if (k === "carga" || k === "aliqEfetiva") v = 1 - v;
        const max = maxMap[k] || 1;
        const score = Math.max(0, Math.min(100, (Math.abs(v) / max) * 100));
        row[c.id] = +score.toFixed(1);
      });
      return row;
    });

    // Stacked bar: composição de impostos por empresa
    const taxComposition = byCompany.map((c) => ({
      name: c.nome_fantasia,
      ICMS: c.icms,
      "Imp. Federais": c.impostos_federais,
      "Simples Nac.": c.simples_nacional,
      DIFAL: c.difal,
      PIS: c.pis,
      COFINS: c.cofins,
      IRPJ: c.irpj,
      CSLL: c.csll,
    }));

    // Totals consolidados
    const totals = byCompany.reduce(
      (a, c) => {
        a.saida += c.saida; a.entrada += c.entrada;
        a.impostos += c.impostos; a.custos += c.custos;
        a.liquido += c.liquido;
        return a;
      },
      { saida: 0, entrada: 0, impostos: 0, custos: 0, liquido: 0 },
    );

    // Awards (criativo)
    const award = (key: keyof typeof byCompany[number], dir: "max" | "min" = "max") => {
      const sorted = [...byCompany].sort((a, b) =>
        dir === "max" ? Number(b[key]) - Number(a[key]) : Number(a[key]) - Number(b[key]),
      );
      return sorted[0];
    };
    const awards = byCompany.length > 0 ? {
      maiorFaturamento: award("saida"),
      maisEficiente: award("eficiencia"),
      menorCarga: award("carga", "min"),
      maiorMargem: award("margem"),
    } : null;

    // Quem lidera mais competências?
    const winsByCompany: Record<string, number> = {};
    byCompany.forEach((c) => (winsByCompany[c.id] = 0));
    competencias.forEach((comp) => {
      let bestId: string | null = null;
      let bestVal = -Infinity;
      selectedCompanies.forEach((c) => {
        const m = movements.find((x) => x.company_id === c.id && x.competencia === comp);
        const v = m ? +m.saida || 0 : 0;
        if (v > bestVal) { bestVal = v; bestId = c.id; }
      });
      if (bestId) winsByCompany[bestId] = (winsByCompany[bestId] || 0) + 1;
    });

    return { byCompany, serie, radar, taxComposition, totals, awards, winsByCompany, competencias };
  }, [selectedCompanies, movements]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const toggle = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const clearAll = () => setSelectedIds([]);
  const selectAll = () => setSelectedIds(filteredCompanies.map((c) => c.id));

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/empresas")} aria-label="Voltar">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Layers className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Combo Comparativo</h1>
            {selectedIds.length > 0 && (
              <Badge variant="secondary" className="ml-2">{selectedIds.length} selecionada(s)</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} available={availableComps} />
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="grid w-full gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar - selector */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Selecionar Empresas
            </CardTitle>
            <CardDescription>Escolha 2 ou mais para comparar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Buscar empresa..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={selectAll}>Todas</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={clearAll}>Limpar</Button>
            </div>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-1">
                {filteredCompanies.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma empresa.</p>
                ) : filteredCompanies.map((c, idx) => {
                  const checked = selectedIds.includes(c.id);
                  const colorIdx = selectedIds.indexOf(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 transition ${
                        checked ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} />
                      {checked && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: PALETTE[colorIdx % PALETTE.length] }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.nome_fantasia}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.uf}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main comparison area */}
        <div className="space-y-6">
          {selectedIds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="mb-3 h-10 w-10 text-primary/60" />
                <p className="text-lg font-medium">Selecione empresas para começar</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Marque duas ou mais empresas no painel à esquerda para visualizar comparações lado a lado, gráficos, ranking e prêmios.
                </p>
              </CardContent>
            </Card>
          ) : isLoading || !data ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : selectedIds.length === 1 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Selecione pelo menos mais uma empresa para comparar.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Awards */}
              {data.awards && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <AwardCard icon={<Crown className="h-5 w-5 text-amber-500" />} title="Maior Faturamento"
                    company={data.awards.maiorFaturamento.nome_fantasia}
                    value={brl(data.awards.maiorFaturamento.saida)} />
                  <AwardCard icon={<Trophy className="h-5 w-5 text-emerald-500" />} title="Mais Eficiente"
                    company={data.awards.maisEficiente.nome_fantasia}
                    value={`${(data.awards.maisEficiente.eficiencia * 100).toFixed(2)}%`} />
                  <AwardCard icon={<Medal className="h-5 w-5 text-blue-500" />} title="Menor Carga Tributária"
                    company={data.awards.menorCarga.nome_fantasia}
                    value={`${(data.awards.menorCarga.carga * 100).toFixed(2)}%`} />
                  <AwardCard icon={<Award className="h-5 w-5 text-purple-500" />} title="Maior Margem Bruta"
                    company={data.awards.maiorMargem.nome_fantasia}
                    value={brl(data.awards.maiorMargem.margem)} />
                </div>
              )}

              {/* Consolidated KPIs */}
              <div className="grid gap-4 md:grid-cols-4">
                <MiniStat label="Faturamento Combinado" value={brl(data.totals.saida)} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} />
                <MiniStat label="Impostos Combinados" value={brl(data.totals.impostos)} icon={<Percent className="h-4 w-4 text-amber-500" />} />
                <MiniStat label="Resultado Combinado"
                  value={brl(data.totals.liquido)}
                  icon={data.totals.liquido >= 0
                    ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                    : <TrendingDown className="h-4 w-4 text-destructive" />} />
                <MiniStat label="Carga Média"
                  value={`${(data.totals.saida > 0 ? (data.totals.impostos / data.totals.saida) * 100 : 0).toFixed(2)}%`}
                  icon={<Percent className="h-4 w-4 text-primary" />} />
              </div>

              {/* Side-by-side cards per company */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumo por Empresa</CardTitle>
                  <CardDescription>Métricas-chave lado a lado</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.byCompany.map((c, i) => {
                      const wins = data.winsByCompany[c.id] || 0;
                      return (
                        <div key={c.id} className="rounded-lg border p-4 transition hover:shadow-md"
                          style={{ borderTopWidth: 3, borderTopColor: PALETTE[i % PALETTE.length] }}>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="truncate font-medium">{c.nome_fantasia}</p>
                            <Badge variant="outline">{c.uf}</Badge>
                          </div>
                          <div className="space-y-1.5 text-sm">
                            <Row k="Faturamento" v={brl(c.saida)} />
                            <Row k="Margem Bruta" v={brl(c.margem)} positive={c.margem >= 0} />
                            <Row k="Impostos" v={brl(c.impostos)} />
                            <Row k="Líquido" v={brl(c.liquido)} positive={c.liquido >= 0} bold />
                            <Row k="Carga Trib." v={`${(c.carga * 100).toFixed(2)}%`} />
                            <Row k="Eficiência" v={`${(c.eficiencia * 100).toFixed(2)}%`} positive={c.eficiencia >= 0} />
                            <Row k="Competências" v={`${c.meses}`} />
                            {data.competencias.length > 0 && (
                              <Row k="Líder em" v={`${wins}/${data.competencias.length} mês(es)`} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Time series comparison */}
              <Card>
                <CardHeader>
                  <CardTitle>Evolução do Faturamento</CardTitle>
                  <CardDescription>Saída por competência — uma linha por empresa</CardDescription>
                </CardHeader>
                <CardContent className="h-[340px]">
                  {data.serie.length === 0 ? (
                    <Empty />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.serie}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                          formatter={(v: number) => brl(v)}
                        />
                        <Legend />
                        {data.byCompany.map((c, i) => (
                          <Line key={c.id} type="monotone" dataKey={c.id} name={c.nome_fantasia}
                            stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Radar + Composição tributária */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Perfil Multidimensional</CardTitle>
                    <CardDescription>Score 0-100 (carga e alíquota invertidas: maior = melhor)</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={data.radar}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {data.byCompany.map((c, i) => (
                          <Radar key={c.id} name={c.nome_fantasia} dataKey={c.id}
                            stroke={PALETTE[i % PALETTE.length]}
                            fill={PALETTE[i % PALETTE.length]} fillOpacity={0.2} />
                        ))}
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Composição de Impostos</CardTitle>
                    <CardDescription>Distribuição empilhada por tributo</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.taxComposition}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                          formatter={(v: number) => brl(v)}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {["ICMS", "Imp. Federais", "Simples Nac.", "DIFAL", "PIS", "COFINS", "IRPJ", "CSLL"].map((k, i) => (
                          <Bar key={k} dataKey={k} stackId="t" fill={PALETTE[i % PALETTE.length]}>
                            {data.taxComposition.map((_, idx) => <Cell key={idx} />)}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Faturamento bar comparison */}
              <Card>
                <CardHeader>
                  <CardTitle>Ranking de Faturamento</CardTitle>
                  <CardDescription>Comparação direta de saída total no período</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...data.byCompany].sort((a, b) => b.saida - a.saida)} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <YAxis type="category" dataKey="nome_fantasia" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        formatter={(v: number) => brl(v)}
                      />
                      <Bar dataKey="saida" radius={[0, 6, 6, 0]}>
                        {[...data.byCompany].sort((a, b) => b.saida - a.saida).map((c, i) => (
                          <Cell key={c.id} fill={PALETTE[data.byCompany.findIndex((x) => x.id === c.id) % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function AwardCard({ icon, title, company, value }: { icon: React.ReactNode; title: string; company: string; value: string }) {
  return (
    <Card className="overflow-hidden border-primary/20" style={{ background: "var(--gradient-subtle)" }}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          {icon}
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        </div>
        <p className="truncate text-base font-semibold">{company}</p>
        <p className="text-sm text-muted-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
        <div className="rounded-md bg-muted/60 p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Row({ k, v, positive, bold }: { k: string; v: string; positive?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${
        positive === undefined ? "" : positive ? "text-emerald-500" : "text-destructive"
      }`}>{v}</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Sem dados para o período.
    </div>
  );
}
