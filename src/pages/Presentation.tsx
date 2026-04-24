import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, ChevronLeft, ChevronRight, Loader2, LogOut, Maximize2, Minimize2,
  Play, Presentation as PresentationIcon, Tag as TagIcon, Pause,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useTags, useCompanyTags } from "@/hooks/useTags";
import { ThemeToggle } from "@/components/ThemeToggle";
import { brl, displayCompetencia, formatCNPJ } from "@/lib/format";
import {
  ALL_COLUMNS, TAX_COLUMNS, type ColumnKey,
  isColumnVisible, getColumnLabel, useFiscalConfig,
  isComputedColumn, computeColumnValue, formatPercent, getColumnCategory,
  type FiscalConfig,
} from "@/hooks/useFiscalConfig";

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

  // Slides: one per company
  const slides = finalCompanies;
  const currentCompany = slides[currentSlide];
  const currentRows = useMemo(() => {
    if (!currentCompany) return [] as MovementRow[];
    return movements
      .filter((m) => m.company_id === currentCompany.id)
      .map((m) => {
        const cfg = configByCompany[m.company_id];
        if (cfg?.auto_calculate_simples_nacional) {
          const a = Number(cfg.aliquota_simples_nacional || 0) / 100;
          return { ...m, simples_nacional: Number((Number(m.saida || 0) * a).toFixed(2)) };
        }
        return m;
      });
  }, [movements, currentCompany, configByCompany]);

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
              <CardTitle className="text-base">2. Opções da apresentação</CardTitle>
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

  const cfg = configByCompany[currentCompany.id];
  const visibleCols: ColumnKey[] = ALL_COLUMNS.filter((c) => isColumnVisible(cfg, c));

  // Totals for current company
  const totals: Record<string, number> = {};
  ALL_COLUMNS.forEach((c) => {
    if (isComputedColumn(c)) {
      totals[c] = 0;
    } else {
      totals[c] = currentRows.reduce(
        (s, r) => s + Number((r as unknown as Record<string, number>)[c] || 0),
        0,
      );
    }
  });
  if (totals.saida) totals.aliquota_simples_calc = (totals.simples_nacional || 0) / totals.saida;

  const totalImpostos = TAX_COLUMNS.reduce((s, c) => s + (totals[c] || 0), 0)
    + (totals.impostos_federais || 0) + (totals.simples_nacional || 0);
  const margem = (totals.saida || 0) - (totals.entrada || 0);
  const cargaTrib = totals.saida ? (totalImpostos / totals.saida) : 0;

  const goPrev = () => setCurrentSlide((s) => Math.max(s - 1, 0));
  const goNext = () => setCurrentSlide((s) => Math.min(s + 1, slides.length - 1));

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
              {currentSlide + 1} / {slides.length} — {currentCompany.nome_fantasia}
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
        <div className="mx-auto max-w-[1600px] space-y-6">
          {/* Title block */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Empresa</p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{currentCompany.nome_fantasia}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentCompany.razao_social} · CNPJ {formatCNPJ(currentCompany.cnpj)} · {currentCompany.uf}
            </p>
          </div>

          {loadingMov ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <KPI label="Entrada" value={brl(totals.entrada || 0)} tone="entrada" />
                <KPI label="Saída" value={brl(totals.saida || 0)} tone="saida" />
                <KPI label="Margem Bruta" value={brl(margem)} tone={margem >= 0 ? "positive" : "negative"} />
                <KPI label="Total Impostos" value={brl(totalImpostos)} tone="tax" />
                <KPI label="Carga Trib." value={formatPercent(cargaTrib)} tone="aliquota" />
              </div>

              {/* Movements table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Movimento Fiscal — {currentRows.length} competência(s)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {currentRows.length === 0 ? (
                    <p className="p-12 text-center text-sm text-muted-foreground">
                      Nenhum movimento cadastrado para esta empresa.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="fiscal-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-card">
                              {getColumnLabel(cfg, "entrada") && "Competência"}
                            </TableHead>
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
                          {currentRows.map((r) => (
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
                          {/* Totals row */}
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
          )}

          {/* Slide dots */}
          {slides.length > 1 && (
            <div className="flex flex-wrap justify-center gap-1.5 pt-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
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

function KPI({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone: "entrada" | "saida" | "tax" | "aliquota" | "positive" | "negative";
}) {
  const toneClass: Record<typeof tone, string> = {
    entrada: "border-l-blue-500",
    saida: "border-l-emerald-500",
    tax: "border-l-amber-500",
    aliquota: "border-l-purple-500",
    positive: "border-l-emerald-500",
    negative: "border-l-destructive",
  };
  return (
    <Card className={`border-l-4 ${toneClass[tone]}`}>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}