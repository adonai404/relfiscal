import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, ChevronLeft, ChevronRight, Loader2, LogOut, Maximize2, Minimize2,
  Play, Presentation as PresentationIcon, Tag as TagIcon, Pause,
  TrendingUp, TrendingDown, Minus, Trophy, Receipt, Wallet, Activity, PieChart as PieIcon,
  ArrowRight, Sparkles, Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useTags, useCompanyTags } from "@/hooks/useTags";
import { ThemeToggle } from "@/components/ThemeToggle";
import { brl, displayCompetencia, formatCNPJ } from "@/lib/format";
import {
  ALL_COLUMNS, type ColumnKey,
  isColumnVisible, getColumnLabel, useFiscalConfig,
  isComputedColumn, computeColumnValue, formatPercent, getColumnCategory,
  type FiscalConfig,
  getTaxColumns,
} from "@/hooks/useFiscalConfig";
import { PeriodFilter, filterByPeriod, type PeriodFilterValue } from "@/components/PeriodFilter";

interface MovementRow {
  id: string;
  company_id: string;
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

export default function Presentation() {
  const { user, loading, signOut } = useAuth();
  const { companies } = useCompany();
  const { data: tags = [] } = useTags();
  const { data: companyTags = [] } = useCompanyTags();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"setup" | "running">("setup");
  const [filterTab, setFilterTab] = useState<"empresas" | "tags">("empresas");
  const [search, setSearch] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [intervalSec, setIntervalSec] = useState(8);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---- Customização da apresentação ----
  // Quais slides exibir
  const [includeOverview, setIncludeOverview] = useState(true);
  const [includeCompanySlides, setIncludeCompanySlides] = useState(true);
  const [includeComparison, setIncludeComparison] = useState(true);
  const [includeSideBySide, setIncludeSideBySide] = useState(true);
  // Slide de Cenários (Atual x Projetado) — foco em economia
  const [includeScenarios, setIncludeScenarios] = useState(true);
  const [scenarioALabel, setScenarioALabel] = useState("Cenário Atual");
  const [scenarioBLabel, setScenarioBLabel] = useState("Cenário Projetado");
  const [scenarioACompanyIds, setScenarioACompanyIds] = useState<string[]>([]);
  const [scenarioBCompanyIds, setScenarioBCompanyIds] = useState<string[]>([]);
  // Quais colunas/métricas entram no comparativo lado-a-lado
  // (default: principais métricas financeiras + impostos)
  const DEFAULT_METRICS: ColumnKey[] = [
    "entrada", "saida", "icms", "impostos_federais", "simples_nacional",
    "pis", "cofins", "irpj", "csll", "difal",
  ];
  const [comparisonMetrics, setComparisonMetrics] = useState<ColumnKey[]>(DEFAULT_METRICS);
  // Métricas derivadas opcionais
  const [includeDerived, setIncludeDerived] = useState({
    margem: true,
    margemPct: true,
    totalImpostos: true,
    cargaTrib: true,
  });

  // Quais empresas entram especificamente no comparativo lado-a-lado
  // (sub-conjunto das empresas selecionadas). null = "todas as selecionadas".
  const [comparisonCompanyIds, setComparisonCompanyIds] = useState<string[] | null>(null);
  // Como calcular a coluna "Consolidado": soma ou média das empresas comparadas
  const [consolidationMode, setConsolidationMode] = useState<"sum" | "avg">("sum");
  // Mostrar coluna "Consolidado" no comparativo
  const [showConsolidated, setShowConsolidated] = useState(true);
  // Mostrar gráfico visual no comparativo lado-a-lado
  const [showComparisonChart, setShowComparisonChart] = useState(true);
  // Mostrar tabela detalhada no comparativo lado-a-lado
  const [showComparisonTable, setShowComparisonTable] = useState(true);

  // Filtro de período (competência) aplicado a todos os slides
  const [period, setPeriod] = useState<PeriodFilterValue>({ from: "", to: "" });

  // Resolve final list based on chosen filter mode
  const finalCompanyIds = useMemo(() => {
    if (filterTab === "tags") {
      if (selectedTagIds.length === 0) return [];
      const ids = new Set<string>();
      companyTags.forEach((ct) => {
        if (selectedTagIds.includes(ct.tag_id)) ids.add(ct.company_id);
      });
      return Array.from(ids);
    }
    return selectedCompanyIds;
  }, [filterTab, selectedCompanyIds, selectedTagIds, companyTags]);

  const finalCompanies = useMemo(
    () => companies.filter((c) => finalCompanyIds.includes(c.id)),
    [companies, finalCompanyIds],
  );

  // Fetch movements for chosen companies
  const { data: movements = [], isLoading: loadingMov } = useQuery({
    queryKey: ["presentation_movements", finalCompanyIds.sort().join(",")],
    enabled: mode === "running" && finalCompanyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement")
        .select("*")
        .in("company_id", finalCompanyIds)
        .order("competencia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MovementRow[];
    },
  });

  // Fetch fiscal configs for all selected companies
  const { data: configs = [] } = useQuery({
    queryKey: ["presentation_configs", finalCompanyIds.sort().join(",")],
    enabled: mode === "running" && finalCompanyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_config")
        .select("*")
        .in("company_id", finalCompanyIds);
      if (error) throw error;
      return (data ?? []) as FiscalConfig[];
    },
  });

  const configByCompany = useMemo(() => {
    const map: Record<string, FiscalConfig> = {};
    configs.forEach((c) => { map[c.company_id] = c; });
    return map;
  }, [configs]);

  // Apply auto-calc Simples Nacional to all movements once
  const adjustedMovements = useMemo(() => {
    const filtered = filterByPeriod(movements, period);
    return filtered.map((m) => {
      const cfg = configByCompany[m.company_id];
      if (cfg?.auto_calculate_simples_nacional) {
        const a = Number(cfg.aliquota_simples_nacional || 0) / 100;
        return { ...m, simples_nacional: Number((Number(m.saida || 0) * a).toFixed(2)) };
      }
      return m;
    });
  }, [movements, configByCompany, period]);

  // Lista de competências disponíveis para presets do filtro
  const availableCompetencias = useMemo(() => {
    const set = new Set<string>();
    movements.forEach((m) => set.add(m.competencia));
    return Array.from(set).sort();
  }, [movements]);

  // Slide deck: overview + one per company + (comparison if 2+)
  type SlideKind =
    | { kind: "overview" }
    | { kind: "company"; companyId: string }
    | { kind: "comparison" }
    | { kind: "sidebyside" }
    | { kind: "scenarios" };

  const slides: SlideKind[] = useMemo(() => {
    if (finalCompanies.length === 0) return [];
    const out: SlideKind[] = [];
    if (includeOverview) out.push({ kind: "overview" });
    if (includeCompanySlides) {
      finalCompanies.forEach((c) => out.push({ kind: "company", companyId: c.id }));
    }
    if (includeScenarios && (scenarioACompanyIds.length > 0 || scenarioBCompanyIds.length > 0)) {
      out.push({ kind: "scenarios" });
    }
    if (finalCompanies.length >= 2 && includeSideBySide) out.push({ kind: "sidebyside" });
    if (finalCompanies.length >= 2 && includeComparison) out.push({ kind: "comparison" });
    // Garante pelo menos um slide se o usuário desmarcar tudo
    if (out.length === 0) out.push({ kind: "overview" });
    return out;
  }, [
    finalCompanies, includeOverview, includeCompanySlides, includeComparison, includeSideBySide,
    includeScenarios, scenarioACompanyIds, scenarioBCompanyIds,
  ]);

  const currentSlideDef = slides[currentSlide];
  const currentCompany = currentSlideDef?.kind === "company"
    ? finalCompanies.find((c) => c.id === currentSlideDef.companyId) ?? null
    : null;
  const currentRows = useMemo(() => {
    if (!currentCompany) return [] as MovementRow[];
    return adjustedMovements.filter((m) => m.company_id === currentCompany.id);
  }, [adjustedMovements, currentCompany]);

  // Empresas que entram no comparativo lado-a-lado.
  // Se nada explícito, usa todas as selecionadas.
  const comparisonCompanies = useMemo(() => {
    if (!comparisonCompanyIds || comparisonCompanyIds.length === 0) return finalCompanies;
    const set = new Set(comparisonCompanyIds);
    return finalCompanies.filter((c) => set.has(c.id));
  }, [finalCompanies, comparisonCompanyIds]);

  const toggleComparisonCompany = (id: string) => {
    setComparisonCompanyIds((prev) => {
      const base = prev ?? finalCompanies.map((c) => c.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  // Reset slide when selection changes
  useEffect(() => { setCurrentSlide(0); }, [finalCompanyIds.join(",")]);

  // Autoplay
  useEffect(() => {
    if (mode !== "running" || !autoplay || slides.length <= 1) return;
    const t = setInterval(() => {
      setCurrentSlide((s) => (s + 1) % slides.length);
    }, intervalSec * 1000);
    return () => clearInterval(t);
  }, [autoplay, intervalSec, slides.length, mode]);

  // Keyboard navigation in running mode
  useEffect(() => {
    if (mode !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setCurrentSlide((s) => Math.min(s + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentSlide((s) => Math.max(s - 1, 0));
      } else if (e.key === "Escape") {
        setMode("setup");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, slides.length]);

  // Track fullscreen state
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const filteredCompanyList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      [c.nome_fantasia, c.razao_social, c.cnpj, c.uf].some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [companies, search]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };
  const toggleTag = (id: string) => {
    setSelectedTagIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const startPresentation = () => {
    if (finalCompanyIds.length === 0) return;
    setCurrentSlide(0);
    setMode("running");
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  // ============== SETUP VIEW ==============
  if (mode === "setup") {
    return (
      <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
        <header className="border-b bg-card/60 backdrop-blur">
          <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/empresas")} aria-label="Voltar">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <PresentationIcon className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Apresentação</h1>
              {finalCompanyIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {finalCompanyIds.length} empresa(s)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Modo Apresentação</h2>
            <p className="text-sm text-muted-foreground">
              Selecione empresas individualmente ou por tag para apresentar todos os dados fiscais delas.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Escolha as empresas</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as "empresas" | "tags")}>
                <TabsList className="mb-4">
                  <TabsTrigger value="empresas">
                    <Building2 className="mr-2 h-4 w-4" /> Por Empresa
                  </TabsTrigger>
                  <TabsTrigger value="tags">
                    <TagIcon className="mr-2 h-4 w-4" /> Por Tag
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="empresas" className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Buscar empresa..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="max-w-sm"
                    />
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setSelectedCompanyIds(filteredCompanyList.map((c) => c.id))}
                      >
                        Selecionar todas
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setSelectedCompanyIds([])}
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[400px] rounded-md border">
                    <div className="divide-y">
                      {filteredCompanyList.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                          Nenhuma empresa.
                        </p>
                      ) : filteredCompanyList.map((c) => {
                        const checked = selectedCompanyIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-accent/50 ${
                              checked ? "bg-primary/5" : ""
                            }`}
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggleCompany(c.id)} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{c.nome_fantasia}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {c.razao_social} · {formatCNPJ(c.cnpj)} · {c.uf}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="tags" className="space-y-3">
                  {tags.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma tag criada ainda. Crie tags ao gerenciar empresas.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Selecione uma ou mais tags. Todas as empresas marcadas com essas tags entrarão na apresentação.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((t) => {
                          const active = selectedTagIds.includes(t.id);
                          const count = companyTags.filter((ct) => ct.tag_id === t.id).length;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggleTag(t.id)}
                              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                                active ? "border-transparent text-white" : "bg-background hover:bg-accent"
                              }`}
                              style={active ? { backgroundColor: t.color } : { borderColor: t.color }}
                            >
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: active ? "#fff" : t.color }}
                              />
                              {t.name}
                              <span className={`rounded px-1.5 text-xs ${active ? "bg-white/20" : "bg-muted"}`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedTagIds.length > 0 && (
                        <div className="rounded-md border bg-muted/30 p-3 text-sm">
                          <strong>{finalCompanyIds.length}</strong> empresa(s) correspondem às tags selecionadas.
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">2. Personalize a apresentação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="text-sm font-medium">Período</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Filtre os dados por competência. Vale para todos os slides (geral, individual, lado a lado e ranking).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <PeriodFilter
                    value={period}
                    onChange={setPeriod}
                    available={availableCompetencias}
                  />
                  {(period.from || period.to) && (
                    <span className="text-xs text-muted-foreground">
                      {period.from ? displayCompetencia(period.from) : "início"} → {period.to ? displayCompetencia(period.to) : "hoje"}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Slides incluídos</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Escolha quais tipos de slides farão parte da apresentação.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-accent/40">
                    <Checkbox checked={includeOverview} onCheckedChange={(v) => setIncludeOverview(!!v)} />
                    <div className="text-sm">
                      <p className="font-medium">Visão Geral Consolidada</p>
                      <p className="text-xs text-muted-foreground">KPIs, evolução e ranking de todas as empresas.</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-accent/40">
                    <Checkbox checked={includeCompanySlides} onCheckedChange={(v) => setIncludeCompanySlides(!!v)} />
                    <div className="text-sm">
                      <p className="font-medium">Slide individual por empresa</p>
                      <p className="text-xs text-muted-foreground">Detalhes completos com gráficos e tabela.</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-accent/40">
                    <Checkbox checked={includeSideBySide} onCheckedChange={(v) => setIncludeSideBySide(!!v)} />
                    <div className="text-sm">
                      <p className="font-medium">Comparativo Lado a Lado <Badge variant="secondary" className="ml-1">Novo</Badge></p>
                      <p className="text-xs text-muted-foreground">Empresas em colunas paralelas + total consolidado.</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-accent/40">
                    <Checkbox checked={includeComparison} onCheckedChange={(v) => setIncludeComparison(!!v)} />
                    <div className="text-sm">
                      <p className="font-medium">Ranking comparativo</p>
                      <p className="text-xs text-muted-foreground">Gráficos de ranking entre empresas.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-sm font-medium">Métricas no comparativo lado a lado</Label>
                    <p className="text-xs text-muted-foreground">
                      Selecione as colunas que serão mostradas para cada empresa.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => setComparisonMetrics(ALL_COLUMNS.filter((c) => !isComputedColumn(c)))}
                    >
                      Todas
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => setComparisonMetrics([])}
                    >
                      Nenhuma
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {ALL_COLUMNS.filter((c) => !isComputedColumn(c)).map((col) => {
                    const checked = comparisonMetrics.includes(col);
                    return (
                      <label
                        key={col}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent/40 ${
                          checked ? "border-primary/40 bg-primary/5" : ""
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setComparisonMetrics((p) =>
                              p.includes(col) ? p.filter((x) => x !== col) : [...p, col],
                            )
                          }
                        />
                        <span className="truncate">{getColumnLabel(undefined, col)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Empresas no comparativo lado a lado */}
              {includeSideBySide && finalCompanies.length > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <Label className="text-sm font-medium">Empresas no comparativo lado a lado</Label>
                      <p className="text-xs text-muted-foreground">
                        Selecione um sub-conjunto das empresas escolhidas acima para aparecerem em colunas paralelas.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => setComparisonCompanyIds(finalCompanies.map((c) => c.id))}
                      >
                        Todas
                      </Button>
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => setComparisonCompanyIds([])}
                      >
                        Nenhuma
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-auto">
                    {finalCompanies.map((c) => {
                      const activeIds = comparisonCompanyIds ?? finalCompanies.map((x) => x.id);
                      const checked = activeIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm bg-background hover:bg-accent/40 ${
                            checked ? "border-primary/50 ring-1 ring-primary/20" : ""
                          }`}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleComparisonCompany(c.id)} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{c.nome_fantasia}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{c.uf}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(comparisonCompanyIds ?? finalCompanies.map((c) => c.id)).length} empresa(s) no comparativo lado a lado.
                  </div>

                  {/* Opções de consolidação e exibição */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-primary/20">
                    <div>
                      <Label className="text-xs font-medium">Modo do consolidado</Label>
                      <div className="mt-1.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConsolidationMode("sum")}
                          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                            consolidationMode === "sum"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-accent"
                          }`}
                        >
                          Soma
                        </button>
                        <button
                          type="button"
                          onClick={() => setConsolidationMode("avg")}
                          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                            consolidationMode === "avg"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-accent"
                          }`}
                        >
                          Média
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Componentes do slide</Label>
                      <div className="flex flex-wrap gap-1.5">
                        <label className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                          showConsolidated ? "border-primary/50 bg-primary/10" : "bg-background"
                        }`}>
                          <Checkbox checked={showConsolidated} onCheckedChange={(v) => setShowConsolidated(!!v)} />
                          Coluna Consolidado
                        </label>
                        <label className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                          showComparisonChart ? "border-primary/50 bg-primary/10" : "bg-background"
                        }`}>
                          <Checkbox checked={showComparisonChart} onCheckedChange={(v) => setShowComparisonChart(!!v)} />
                          Gráfico
                        </label>
                        <label className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                          showComparisonTable ? "border-primary/50 bg-primary/10" : "bg-background"
                        }`}>
                          <Checkbox checked={showComparisonTable} onCheckedChange={(v) => setShowComparisonTable(!!v)} />
                          Tabela detalhada
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Métricas calculadas</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Indicadores derivados exibidos no comparativo lado a lado.
                </p>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["margem", "Margem (Saída − Entrada)"],
                    ["margemPct", "Margem %"],
                    ["totalImpostos", "Total de Impostos"],
                    ["cargaTrib", "Carga Tributária"],
                  ] as const).map(([key, label]) => {
                    const checked = includeDerived[key];
                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-accent/40 ${
                          checked ? "border-primary/50 bg-primary/5" : ""
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => setIncludeDerived((p) => ({ ...p, [key]: !!v }))}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">3. Opções de reprodução</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="autoplay"
                    checked={autoplay}
                    onCheckedChange={(v) => setAutoplay(!!v)}
                  />
                  <Label htmlFor="autoplay" className="cursor-pointer">Reprodução automática</Label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="interval" className="text-xs">Intervalo (segundos)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min={3}
                    max={120}
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Math.max(3, Math.min(120, Number(e.target.value) || 8)))}
                    className="w-28"
                    disabled={!autoplay}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Use as setas <kbd className="rounded border bg-muted px-1.5">←</kbd>{" "}
                <kbd className="rounded border bg-muted px-1.5">→</kbd> ou a barra de espaço para navegar.
                Pressione <kbd className="rounded border bg-muted px-1.5">Esc</kbd> para sair.
              </p>
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/empresas")}>Cancelar</Button>
            <Button
              size="lg"
              onClick={startPresentation}
              disabled={finalCompanyIds.length === 0}
            >
              <Play className="mr-2 h-4 w-4" />
              Iniciar Apresentação ({finalCompanyIds.length})
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ============== RUNNING VIEW ==============
  if (slides.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Nenhuma empresa selecionada.</p>
      </div>
    );
  }

  const goPrev = () => setCurrentSlide((s) => Math.max(s - 1, 0));
  const goNext = () => setCurrentSlide((s) => Math.min(s + 1, slides.length - 1));

  // Slide title for header
  const slideTitle = currentSlideDef?.kind === "overview"
    ? "Visão Geral Consolidada"
    : currentSlideDef?.kind === "comparison"
      ? "Comparativo entre Empresas"
      : currentSlideDef?.kind === "sidebyside"
        ? "Comparativo Lado a Lado"
        : currentSlideDef?.kind === "scenarios"
          ? "Cenários — Atual × Projetado"
          : currentCompany?.nome_fantasia ?? "";

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => setMode("setup")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Sair
            </Button>
            <PresentationIcon className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">
              {currentSlide + 1} / {slides.length} — {slideTitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setAutoplay((a) => !a)}
              disabled={slides.length <= 1}
            >
              {autoplay ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
              {autoplay ? "Pausar" : "Auto"}
            </Button>
            <Button variant="outline" size="icon" onClick={toggleFullscreen} aria-label="Tela cheia">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <ThemeToggle />
          </div>
        </div>
        {/* Progress */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-1 bg-primary transition-all"
            style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Slide content */}
      <main className="relative w-full px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-[1600px] space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" key={currentSlide}>
          {loadingMov ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : currentSlideDef?.kind === "overview" ? (
            <OverviewSlide
              companies={finalCompanies}
              movements={adjustedMovements}
              configByCompany={configByCompany}
            />
          ) : currentSlideDef?.kind === "comparison" ? (
            <ComparisonSlide
              companies={finalCompanies}
              movements={adjustedMovements}
              configByCompany={configByCompany}
            />
          ) : currentSlideDef?.kind === "sidebyside" ? (
            <SideBySideSlide
              companies={comparisonCompanies}
              movements={adjustedMovements}
              configByCompany={configByCompany}
              metrics={comparisonMetrics}
              derived={includeDerived}
              consolidationMode={consolidationMode}
              showConsolidated={showConsolidated}
              showChart={showComparisonChart}
              showTable={showComparisonTable}
            />
          ) : currentSlideDef?.kind === "scenarios" ? (
            <ScenariosSlide
              allCompanies={finalCompanies}
              scenarioACompanyIds={scenarioACompanyIds}
              scenarioBCompanyIds={scenarioBCompanyIds}
              scenarioALabel={scenarioALabel}
              scenarioBLabel={scenarioBLabel}
              movements={adjustedMovements}
              configByCompany={configByCompany}
            />
          ) : currentCompany ? (
            <CompanySlide
              company={currentCompany}
              rows={currentRows}
              cfg={configByCompany[currentCompany.id]}
            />
          ) : null}

          {/* Slide dots */}
          {slides.length > 1 && (
            <div className="flex flex-wrap justify-center gap-1.5 pt-2">
              {slides.map((_s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentSlide(i)}
                  aria-label={`Ir para slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted hover:bg-muted-foreground/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side nav arrows */}
        {slides.length > 1 && (
          <>
            <Button
              variant="outline" size="icon"
              onClick={goPrev}
              disabled={currentSlide === 0}
              className="fixed left-3 top-1/2 z-20 h-12 w-12 -translate-y-1/2 rounded-full shadow-lg"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="outline" size="icon"
              onClick={goNext}
              disabled={currentSlide === slides.length - 1}
              className="fixed right-3 top-1/2 z-20 h-12 w-12 -translate-y-1/2 rounded-full shadow-lg"
              aria-label="Próximo"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

// ============== Helpers ==============

type Tone = "entrada" | "saida" | "tax" | "aliquota" | "positive" | "negative" | "neutral";

const TONE_CLASSES: Record<Tone, { border: string; icon: string; bg: string }> = {
  entrada: { border: "border-l-blue-500", icon: "text-blue-500", bg: "bg-blue-500/10" },
  saida: { border: "border-l-emerald-500", icon: "text-emerald-500", bg: "bg-emerald-500/10" },
  tax: { border: "border-l-amber-500", icon: "text-amber-500", bg: "bg-amber-500/10" },
  aliquota: { border: "border-l-purple-500", icon: "text-purple-500", bg: "bg-purple-500/10" },
  positive: { border: "border-l-emerald-500", icon: "text-emerald-500", bg: "bg-emerald-500/10" },
  negative: { border: "border-l-destructive", icon: "text-destructive", bg: "bg-destructive/10" },
  neutral: { border: "border-l-muted-foreground", icon: "text-muted-foreground", bg: "bg-muted" },
};

// Chart palette (HSL constants for cross-theme legibility)
const CHART_COLORS = [
  "hsl(217 91% 60%)",  // blue
  "hsl(160 84% 39%)",  // emerald
  "hsl(45 93% 47%)",   // amber
  "hsl(280 65% 60%)",  // purple
  "hsl(0 84% 60%)",    // red
  "hsl(190 80% 45%)",  // cyan
  "hsl(330 80% 60%)",  // pink
  "hsl(20 90% 55%)",   // orange
  "hsl(140 60% 45%)",  // green
  "hsl(250 70% 65%)",  // indigo
];

function KPI({
  label, value, tone, sub, icon: Icon, trend, sparkline,
}: {
  label: string;
  value: string;
  tone: Tone;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: number; // positive/negative percent
  sparkline?: number[];
}) {
  const t = TONE_CLASSES[tone];
  const TrendIcon = trend === undefined ? null : trend > 0.001 ? TrendingUp : trend < -0.001 ? TrendingDown : Minus;
  const trendColor = trend === undefined
    ? ""
    : trend > 0.001 ? "text-emerald-500" : trend < -0.001 ? "text-destructive" : "text-muted-foreground";
  return (
    <Card className={`border-l-4 ${t.border} relative overflow-hidden`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {Icon && (
                <span className={`flex h-6 w-6 items-center justify-center rounded ${t.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${t.icon}`} />
                </span>
              )}
              <p className="text-xs uppercase tracking-wide text-muted-foreground truncate">{label}</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums truncate">{value}</p>
            {(sub || TrendIcon) && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {TrendIcon && (
                  <span className={`inline-flex items-center gap-0.5 font-medium ${trendColor}`}>
                    <TrendIcon className="h-3 w-3" />
                    {trend !== undefined ? `${(Math.abs(trend) * 100).toFixed(1)}%` : ""}
                  </span>
                )}
                {sub && <span className="truncate">{sub}</span>}
              </div>
            )}
          </div>
          {sparkline && sparkline.length > 1 && (
            <div className="h-12 w-20 shrink-0 opacity-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkline.map((v, i) => ({ i, v }))}>
                  <Line
                    type="monotone" dataKey="v" stroke={`currentColor`}
                    className={t.icon}
                    strokeWidth={2} dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =================== Aggregations ===================

function aggregateRows(rows: MovementRow[], cfg?: FiscalConfig) {
  const totals: Record<string, number> = {};
  ALL_COLUMNS.forEach((c) => {
    if (isComputedColumn(c)) {
      totals[c] = 0;
    } else {
      totals[c] = rows.reduce(
        (s, r) => s + Number((r as unknown as Record<string, number>)[c] || 0), 0,
      );
    }
  });
  if (totals.saida) totals.aliquota_simples_calc = (totals.simples_nacional || 0) / totals.saida;
  const taxCols = getTaxColumns(cfg);
  const totalImpostos = taxCols.reduce((s, c) => s + (totals[c] || 0), 0);
  const margem = (totals.saida || 0) - (totals.entrada || 0);
  const cargaTrib = totals.saida ? (totalImpostos / totals.saida) : 0;
  const margemPct = totals.saida ? (margem / totals.saida) : 0;
  return { totals, totalImpostos, margem, cargaTrib, margemPct };
}

function ChartCard({
  title, icon: Icon, children, className = "",
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
};

function fmtAxisBR(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

// =================== Company Slide ===================

function CompanySlide({
  company, rows, cfg,
}: {
  company: { id: string; nome_fantasia: string; razao_social: string; cnpj: string; uf: string };
  rows: MovementRow[];
  cfg: FiscalConfig | undefined;
}) {
  const visibleCols: ColumnKey[] = ALL_COLUMNS.filter((c) => isColumnVisible(cfg, c));
  const { totals, totalImpostos, margem, cargaTrib, margemPct } = aggregateRows(rows, cfg);
  const taxCols = getTaxColumns(cfg);

  // Trend: last vs previous competence
  const sortedByComp = [...rows].sort((a, b) => a.competencia.localeCompare(b.competencia));
  const last = sortedByComp[sortedByComp.length - 1];
  const prev = sortedByComp[sortedByComp.length - 2];
  const trendSaida = last && prev && Number(prev.saida) > 0
    ? (Number(last.saida) - Number(prev.saida)) / Number(prev.saida)
    : undefined;
  const trendEntrada = last && prev && Number(prev.entrada) > 0
    ? (Number(last.entrada) - Number(prev.entrada)) / Number(prev.entrada)
    : undefined;

  const sparkSaida = sortedByComp.map((r) => Number(r.saida || 0));
  const sparkEntrada = sortedByComp.map((r) => Number(r.entrada || 0));

  // Time-series chart data
  const chartData = sortedByComp.map((r) => {
    const tax = taxCols.reduce(
      (s, c) => s + Number((r as unknown as Record<string, number>)[c] || 0), 0,
    );
    return {
      periodo: displayCompetencia(r.competencia),
      Entrada: Number(r.entrada || 0),
      Saida: Number(r.saida || 0),
      Impostos: tax,
      Margem: Number(r.saida || 0) - Number(r.entrada || 0),
    };
  });

  // Tax composition (pie)
  const taxParts = taxCols
    .map((key) => ({
      key,
      label: getColumnLabel(cfg, key as ColumnKey),
      value: Number((totals as Record<string, number>)[key] || 0),
    }))
    .filter((p) => p.value > 0);

  // Pico
  const picoSaida = sortedByComp.reduce((acc, r) => Number(r.saida || 0) > Number(acc?.saida || 0) ? r : acc, sortedByComp[0]);

  return (
    <>
      {/* Title block */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Empresa</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{company.nome_fantasia}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {company.razao_social} · CNPJ {formatCNPJ(company.cnpj)} · {company.uf}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KPI label="Entrada" value={brl(totals.entrada || 0)} tone="entrada"
          icon={Wallet} trend={trendEntrada} sparkline={sparkEntrada} sub="Total no período" />
        <KPI label="Saída" value={brl(totals.saida || 0)} tone="saida"
          icon={TrendingUp} trend={trendSaida} sparkline={sparkSaida} sub="Faturamento" />
        <KPI label="Total Impostos" value={brl(totalImpostos)} tone="tax"
          icon={Receipt} sub={`${rows.length} competência(s)`} />
        <KPI label="Carga Tributária" value={formatPercent(cargaTrib)} tone="aliquota"
          icon={PieIcon} sub="Sobre faturamento" />
        <KPI label="Pico de Saída" value={picoSaida ? brl(Number(picoSaida.saida || 0)) : "—"} tone="neutral"
          icon={Trophy} sub={picoSaida ? displayCompetencia(picoSaida.competencia) : ""} />
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Evolução Entrada × Saída" icon={Activity} className="lg:col-span-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`grad-saida-${company.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={`grad-entrada-${company.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxisBR} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => brl(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Saida" name="Saída" stroke="hsl(160 84% 39%)" strokeWidth={2}
                    fill={`url(#grad-saida-${company.id})`} />
                  <Area type="monotone" dataKey="Entrada" stroke="hsl(217 91% 60%)" strokeWidth={2}
                    fill={`url(#grad-entrada-${company.id})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Composição Tributária" icon={PieIcon}>
            <div className="h-72">
              {taxParts.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sem impostos no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taxParts} dataKey="value" nameKey="label"
                      innerRadius={50} outerRadius={90} paddingAngle={2}
                    >
                      {taxParts.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>
      )}

      {/* Movements table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Movimento Fiscal — {rows.length} competência(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              Nenhum movimento cadastrado para esta empresa.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="fiscal-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">Competência</TableHead>
                    {visibleCols.map((col) => (
                      <TableHead
                        key={col}
                        className="text-right whitespace-nowrap"
                        data-cat={getColumnCategory(col)}
                      >
                        {getColumnLabel(cfg, col)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="sticky left-0 bg-card font-medium">
                        {displayCompetencia(r.competencia)}
                      </TableCell>
                      {visibleCols.map((col) => {
                        const v = computeColumnValue(r, col);
                        const isPct = col === "aliquota_simples_calc";
                        return (
                          <TableCell
                            key={col}
                            className="text-right tabular-nums whitespace-nowrap"
                            data-cat={getColumnCategory(col)}
                          >
                            {isPct ? formatPercent(v) : brl(v)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell className="sticky left-0 bg-card">Total</TableCell>
                    {visibleCols.map((col) => {
                      const v = totals[col] || 0;
                      const isPct = col === "aliquota_simples_calc";
                      return (
                        <TableCell
                          key={col}
                          className="text-right tabular-nums whitespace-nowrap"
                          data-cat={getColumnCategory(col)}
                        >
                          {isPct ? formatPercent(v) : brl(v)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// =================== Side-by-Side Slide ===================

function SideBySideSlide({
  companies, movements, configByCompany, metrics, derived,
  consolidationMode = "sum", showConsolidated = true, showChart = true, showTable = true,
}: {
  companies: Array<{ id: string; nome_fantasia: string; uf: string }>;
  movements: MovementRow[];
  configByCompany: Record<string, FiscalConfig>;
  metrics: ColumnKey[];
  derived: { margem: boolean; margemPct: boolean; totalImpostos: boolean; cargaTrib: boolean };
  consolidationMode?: "sum" | "avg";
  showConsolidated?: boolean;
  showChart?: boolean;
  showTable?: boolean;
}) {
  // Aggregations per company
  const perCompany = companies.map((c) => {
    const rs = movements.filter((m) => m.company_id === c.id);
    const agg = aggregateRows(rs, configByCompany[c.id]);
    return { company: c, rows: rs, agg };
  });

  // Consolidated totals
  const consolidated = useMemo(() => {
    const totals: Record<string, number> = {};
    const n = perCompany.length || 1;
    metrics.forEach((m) => {
      const sum = perCompany.reduce((s, p) => s + (p.agg.totals[m] || 0), 0);
      totals[m] = consolidationMode === "avg" ? sum / n : sum;
    });
    const sumEntrada = perCompany.reduce((s, p) => s + (p.agg.totals.entrada || 0), 0);
    const sumSaida = perCompany.reduce((s, p) => s + (p.agg.totals.saida || 0), 0);
    const sumImpostos = perCompany.reduce((s, p) => s + p.agg.totalImpostos, 0);
    const totalEntrada = consolidationMode === "avg" ? sumEntrada / n : sumEntrada;
    const totalSaida = consolidationMode === "avg" ? sumSaida / n : sumSaida;
    const totalImpostos = consolidationMode === "avg" ? sumImpostos / n : sumImpostos;
    const margem = totalSaida - totalEntrada;
    const margemPct = totalSaida ? margem / totalSaida : 0;
    const cargaTrib = sumSaida ? sumImpostos / sumSaida : 0;
    return { totals, totalEntrada, totalSaida, totalImpostos, margem, margemPct, cargaTrib };
  }, [perCompany, metrics, consolidationMode]);

  // Use first company's config for label fallback (labels may differ; prefer most common).
  const labelFor = (col: ColumnKey) => getColumnLabel(undefined, col);

  // Bar chart per-metric grouped by company
  const chartData = metrics.slice(0, 8).map((m) => {
    const row: Record<string, number | string> = { metric: labelFor(m) };
    perCompany.forEach((p) => {
      row[p.company.nome_fantasia] = p.agg.totals[m] || 0;
    });
    return row;
  });

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Trophy className="h-10 w-10 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Nenhuma empresa selecionada para o comparativo</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Volte ao setup e marque pelo menos uma empresa em "Empresas no comparativo lado a lado".
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold">Lado a Lado</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Comparativo Detalhado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {companies.length} empresa(s) · {metrics.length} métrica(s) selecionada(s)
          {showConsolidated && ` · Consolidado (${consolidationMode === "avg" ? "média" : "soma"})`}
        </p>
      </div>

      {/* Side-by-side cards */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${perCompany.length + (showConsolidated ? 1 : 0)}, minmax(220px, 1fr))` }}
      >
        {perCompany.map(({ company, agg }, idx) => {
          const color = CHART_COLORS[idx % CHART_COLORS.length];
          return (
            <Card key={company.id} className="overflow-hidden border-t-4" style={{ borderTopColor: color }}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <CardTitle className="text-sm truncate">{company.nome_fantasia}</CardTitle>
                </div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{company.uf}</p>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {metrics.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nenhuma métrica selecionada.</p>
                )}
                {metrics.map((m) => (
                  <div key={m} className="flex items-baseline justify-between border-b border-dashed py-1 last:border-0">
                    <span className="text-xs text-muted-foreground truncate pr-2">
                      {getColumnLabel(configByCompany[company.id], m)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {brl(agg.totals[m] || 0)}
                    </span>
                  </div>
                ))}
                {(derived.margem || derived.margemPct || derived.totalImpostos || derived.cargaTrib) && (
                  <div className="mt-3 space-y-1.5 rounded-md bg-muted/40 p-2">
                    {derived.margem && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Margem</span>
                        <span className={`text-sm font-semibold tabular-nums ${agg.margem >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {brl(agg.margem)}
                        </span>
                      </div>
                    )}
                    {derived.margemPct && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Margem %</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {(agg.margemPct * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {derived.totalImpostos && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Total Impostos</span>
                        <span className="text-sm font-semibold tabular-nums text-amber-600">
                          {brl(agg.totalImpostos)}
                        </span>
                      </div>
                    )}
                    {derived.cargaTrib && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Carga Trib.</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatPercent(agg.cargaTrib)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Consolidated column */}
        {showConsolidated && (
        <Card className="overflow-hidden border-t-4 border-primary bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Consolidado</CardTitle>
            </div>
            <p className="text-[10px] uppercase tracking-wide text-primary/80 font-semibold">
              {consolidationMode === "avg" ? "Média" : "Soma"} de {perCompany.length} empresa(s)
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {metrics.map((m) => (
              <div key={m} className="flex items-baseline justify-between border-b border-dashed py-1 last:border-0">
                <span className="text-xs text-muted-foreground truncate pr-2">{labelFor(m)}</span>
                <span className="text-sm font-bold tabular-nums">
                  {brl(consolidated.totals[m] || 0)}
                </span>
              </div>
            ))}
            {(derived.margem || derived.margemPct || derived.totalImpostos || derived.cargaTrib) && (
              <div className="mt-3 space-y-1.5 rounded-md bg-background/70 p-2 ring-1 ring-primary/20">
                {derived.margem && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Margem</span>
                    <span className={`text-sm font-bold tabular-nums ${consolidated.margem >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {brl(consolidated.margem)}
                    </span>
                  </div>
                )}
                {derived.margemPct && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Margem %</span>
                    <span className="text-sm font-bold tabular-nums">{(consolidated.margemPct * 100).toFixed(1)}%</span>
                  </div>
                )}
                {derived.totalImpostos && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Total Impostos</span>
                    <span className="text-sm font-bold tabular-nums text-amber-600">
                      {brl(consolidated.totalImpostos)}
                    </span>
                  </div>
                )}
                {derived.cargaTrib && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Carga Trib.</span>
                    <span className="text-sm font-bold tabular-nums">{formatPercent(consolidated.cargaTrib)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* Grouped bar chart: each metric, bars per company */}
      {showChart && metrics.length > 0 && perCompany.length > 0 && (
        <ChartCard title="Comparativo Visual por Métrica" icon={Activity}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="metric" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60}
                  stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxisBR} stroke="hsl(var(--muted-foreground))" />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {perCompany.map((p, i) => (
                  <Bar
                    key={p.company.id}
                    dataKey={p.company.nome_fantasia}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* Detailed comparison table */}
      {showTable && metrics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tabela Comparativa Detalhada</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Métrica</TableHead>
                  {perCompany.map((p) => (
                    <TableHead key={p.company.id} className="text-right whitespace-nowrap">
                      {p.company.nome_fantasia}
                    </TableHead>
                  ))}
                  {showConsolidated && (
                    <TableHead className="text-right whitespace-nowrap bg-primary/5 font-bold text-primary">
                      Consolidado
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((m) => (
                  <TableRow key={m}>
                    <TableCell className="sticky left-0 bg-card font-medium">{labelFor(m)}</TableCell>
                    {perCompany.map((p) => (
                      <TableCell key={p.company.id} className="text-right tabular-nums">
                        {brl(p.agg.totals[m] || 0)}
                      </TableCell>
                    ))}
                    {showConsolidated && (
                      <TableCell className="text-right tabular-nums font-bold bg-primary/5">
                        {brl(consolidated.totals[m] || 0)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {derived.totalImpostos && (
                  <TableRow className="bg-amber-500/5">
                    <TableCell className="sticky left-0 bg-amber-500/5 font-semibold">Total Impostos</TableCell>
                    {perCompany.map((p) => (
                      <TableCell key={p.company.id} className="text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                        {brl(p.agg.totalImpostos)}
                      </TableCell>
                    ))}
                    {showConsolidated && (
                      <TableCell className="text-right tabular-nums font-bold bg-primary/10 text-amber-700 dark:text-amber-400">
                        {brl(consolidated.totalImpostos)}
                      </TableCell>
                    )}
                  </TableRow>
                )}
                {derived.margem && (
                  <TableRow className="border-t-2">
                    <TableCell className="sticky left-0 bg-card font-semibold">Margem</TableCell>
                    {perCompany.map((p) => (
                      <TableCell key={p.company.id}
                        className={`text-right tabular-nums font-semibold ${p.agg.margem >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {brl(p.agg.margem)}
                      </TableCell>
                    ))}
                    {showConsolidated && (
                      <TableCell className={`text-right tabular-nums font-bold bg-primary/5 ${consolidated.margem >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {brl(consolidated.margem)}
                      </TableCell>
                    )}
                  </TableRow>
                )}
                {derived.margemPct && (
                  <TableRow>
                    <TableCell className="sticky left-0 bg-card font-semibold">Margem %</TableCell>
                    {perCompany.map((p) => (
                      <TableCell key={p.company.id} className="text-right tabular-nums">
                        {(p.agg.margemPct * 100).toFixed(1)}%
                      </TableCell>
                    ))}
                    {showConsolidated && (
                      <TableCell className="text-right tabular-nums font-bold bg-primary/5">
                        {(consolidated.margemPct * 100).toFixed(1)}%
                      </TableCell>
                    )}
                  </TableRow>
                )}
                {derived.cargaTrib && (
                  <TableRow>
                    <TableCell className="sticky left-0 bg-card font-semibold">Carga Tributária</TableCell>
                    {perCompany.map((p) => (
                      <TableCell key={p.company.id} className="text-right tabular-nums">
                        {formatPercent(p.agg.cargaTrib)}
                      </TableCell>
                    ))}
                    {showConsolidated && (
                      <TableCell className="text-right tabular-nums font-bold bg-primary/5">
                        {formatPercent(consolidated.cargaTrib)}
                      </TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// =================== Overview Slide ===================

function OverviewSlide({
  companies, movements, configByCompany,
}: {
  companies: Array<{ id: string; nome_fantasia: string; uf: string }>;
  movements: MovementRow[];
  configByCompany: Record<string, FiscalConfig>;
}) {
  // Helper: tax columns for a given company (falls back to default if missing)
  const taxColsFor = (companyId: string) => getTaxColumns(configByCompany[companyId]);

  // Compute per-row tax respecting each company's fiscal_config.
  const taxOf = (m: MovementRow) =>
    taxColsFor(m.company_id).reduce(
      (s, c) => s + Number((m as unknown as Record<string, number>)[c] || 0), 0,
    );

  // Totals (entrada/saida do agregado padrão; impostos recalculado por empresa)
  const { totals, margem, margemPct } = aggregateRows(movements);
  const totalImpostos = movements.reduce((s, m) => s + taxOf(m), 0);
  const cargaTrib = totals.saida ? totalImpostos / totals.saida : 0;

  // Aggregate by competencia across all companies
  const byComp: Record<string, { Entrada: number; Saida: number; Impostos: number }> = {};
  movements.forEach((m) => {
    const k = m.competencia;
    if (!byComp[k]) byComp[k] = { Entrada: 0, Saida: 0, Impostos: 0 };
    byComp[k].Entrada += Number(m.entrada || 0);
    byComp[k].Saida += Number(m.saida || 0);
    byComp[k].Impostos += taxOf(m);
  });
  const trendData = Object.entries(byComp)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ periodo: displayCompetencia(k), ...v }));

  // Companies ranking by saida
  const ranking = companies.map((c) => {
    const rs = movements.filter((m) => m.company_id === c.id);
    const sa = rs.reduce((s, r) => s + Number(r.saida || 0), 0);
    return { name: c.nome_fantasia, uf: c.uf, value: sa };
  }).sort((a, b) => b.value - a.value).slice(0, 8);

  // Periods covered
  const periods = Array.from(new Set(movements.map((m) => m.competencia))).sort();

  return (
    <>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold">Visão Geral</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Consolidado de {companies.length} Empresa(s)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {periods.length > 0
            ? `${displayCompetencia(periods[0])} → ${displayCompetencia(periods[periods.length - 1])}`
            : "Nenhum período disponível"}
          {" · "}{movements.length} registro(s)
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KPI label="Empresas" value={String(companies.length)} tone="neutral" icon={Building2} sub="No relatório" />
        <KPI label="Entrada Total" value={brl(totals.entrada || 0)} tone="entrada" icon={Wallet} />
        <KPI label="Saída Total" value={brl(totals.saida || 0)} tone="saida" icon={TrendingUp} />
        <KPI label="Margem" value={brl(margem)} tone={margem >= 0 ? "positive" : "negative"} icon={Activity}
          sub={`${(margemPct * 100).toFixed(1)}% sobre saída`} />
        <KPI label="Impostos" value={brl(totalImpostos)} tone="tax" icon={Receipt} />
        <KPI label="Carga Trib. Média" value={formatPercent(cargaTrib)} tone="aliquota" icon={PieIcon} />
      </div>

      {trendData.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Evolução Consolidada" icon={Activity}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="ov-saida" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ov-entrada" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxisBR} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => brl(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Saida" name="Saída" stroke="hsl(160 84% 39%)" strokeWidth={2} fill="url(#ov-saida)" />
                  <Area type="monotone" dataKey="Entrada" stroke="hsl(217 91% 60%)" strokeWidth={2} fill="url(#ov-entrada)" />
                  <Area type="monotone" dataKey="Impostos" stroke="hsl(45 93% 47%)" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Top Empresas por Faturamento" icon={Trophy}>
            <div className="h-72">
              {ranking.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ranking} layout="vertical" margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmtAxisBR} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120}
                      stroke="hsl(var(--muted-foreground))" />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => brl(v)} />
                    <Bar dataKey="value" name="Saída" radius={[0, 6, 6, 0]}>
                      {ranking.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>
      )}
    </>
  );
}

// =================== Comparison Slide ===================

function ComparisonSlide({
  companies, movements, configByCompany,
}: {
  companies: Array<{ id: string; nome_fantasia: string; uf: string }>;
  movements: MovementRow[];
  configByCompany: Record<string, FiscalConfig>;
}) {
  const perCompany = companies.map((c) => {
    const rs = movements.filter((m) => m.company_id === c.id);
    const agg = aggregateRows(rs, configByCompany[c.id]);
    return {
      id: c.id,
      name: c.nome_fantasia,
      uf: c.uf,
      Entrada: agg.totals.entrada || 0,
      Saida: agg.totals.saida || 0,
      Margem: agg.margem,
      Impostos: agg.totalImpostos,
      cargaTrib: agg.cargaTrib,
      margemPct: agg.margemPct,
    };
  });

  const sortedBySaida = [...perCompany].sort((a, b) => b.Saida - a.Saida);
  const champion = sortedBySaida[0];
  const bestMargin = [...perCompany].sort((a, b) => b.margemPct - a.margemPct)[0];
  const lowestTax = [...perCompany].filter((p) => p.Saida > 0).sort((a, b) => a.cargaTrib - b.cargaTrib)[0];

  return (
    <>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold">Comparativo</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Ranking entre Empresas</h1>
        <p className="mt-1 text-sm text-muted-foreground">{companies.length} empresas analisadas</p>
      </div>

      {/* Champions row */}
      <div className="grid gap-3 sm:grid-cols-3">
        {champion && (
          <KPI label="🥇 Maior Faturamento" value={champion.name} tone="saida"
            icon={Trophy} sub={brl(champion.Saida)} />
        )}
        {bestMargin && (
          <KPI label="📈 Melhor Margem" value={bestMargin.name} tone="positive"
            icon={Activity} sub={`${(bestMargin.margemPct * 100).toFixed(1)}%`} />
        )}
        {lowestTax && (
          <KPI label="🎯 Menor Carga Trib." value={lowestTax.name} tone="aliquota"
            icon={PieIcon} sub={formatPercent(lowestTax.cargaTrib)} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Faturamento × Impostos por Empresa" icon={Receipt}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedBySaida.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70}
                  stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxisBR} stroke="hsl(var(--muted-foreground))" />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Saida" name="Saída" fill="hsl(160 84% 39%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Impostos" fill="hsl(45 93% 47%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Distribuição de Faturamento" icon={PieIcon}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sortedBySaida} dataKey="Saida" nameKey="name"
                  innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {sortedBySaida.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tabela Comparativa</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>UF</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Saída</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
                <TableHead className="text-right">Impostos</TableHead>
                <TableHead className="text-right">Carga Trib.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBySaida.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.uf}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{brl(p.Entrada)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{brl(p.Saida)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${p.Margem >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {brl(p.Margem)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{(p.margemPct * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(p.Impostos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(p.cargaTrib)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}