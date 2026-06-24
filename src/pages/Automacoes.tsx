import { useEffect, useRef, useState } from "react";
import {
  Zap,
  Folder,
  FolderOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Monitor,
  FileBarChart2,
  FileText,
  Loader2,
  Play,
  FolderSearch,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isTauri, pickFolder } from "@/lib/desktop";
import {
  getAutomacaoSettings,
  saveAutomacaoSettings,
  getAutomacaoLog,
  clearAutomacaoLog,
  type LogEntry,
} from "@/hooks/useFolderWatcher";
import {
  getAutoReportSettings,
  saveAutoReportSettings,
  getAutoReportLog,
  clearAutoReportLog,
  generateReport,
  resolvePeriod,
  type AutoReportSettings,
  type AutoReportLogEntry,
} from "@/hooks/useAutoReport";

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtPeriodo(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  return `${MESES[parseInt(m, 10) - 1] ?? m}/${y}`;
}

const fmtTs = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// ─── Paleta da aba Automações ─────────────────────────────────────────────────
// Cores extraídas da paleta personalizada:
//  #5A738E  aço azul   → primary / acento pasta
//  #6E6E73  cinza      → acento relatório (light)
//  #BFC0C0  prata      → acento relatório (dark) / bordas

type FolderId = "pasta-pdf" | "relatorio-mensal";

interface FolderStyles {
  text:        string;  // classe text-*
  bgOpen:      string;  // fundo do card aberto
  iconBgOpen:  string;  // fundo do ícone aberto
  iconBgClosed:string;  // fundo do ícone fechado (hover)
  badgeBg:     string;  // fundo do badge de status
  cardBorder:  string;  // borda do painel detalhe
  panelHeader: string;  // fundo do cabeçalho do painel
}

interface FolderDef {
  id:       FolderId;
  title:    string;
  subtitle: string;
  styles:   FolderStyles;
  icon:     React.ElementType;
}

const FOLDER_STYLES: Record<FolderId, FolderStyles> = {
  "pasta-pdf": {
    text:         "text-[#5A738E] dark:text-[#7A9AB0]",
    bgOpen:       "bg-[#5A738E]/8  dark:bg-[#5A738E]/12",
    iconBgOpen:   "bg-[#5A738E]/15 dark:bg-[#5A738E]/20",
    iconBgClosed: "group-hover:bg-[#5A738E]/10",
    badgeBg:      "bg-[#5A738E]",
    cardBorder:   "border-[#5A738E]/35",
    panelHeader:  "bg-[#5A738E]/6 dark:bg-[#5A738E]/10",
  },
  "relatorio-mensal": {
    text:         "text-[#6E6E73] dark:text-[#BFC0C0]",
    bgOpen:       "bg-[#6E6E73]/8  dark:bg-[#6E6E73]/12",
    iconBgOpen:   "bg-[#6E6E73]/15 dark:bg-[#6E6E73]/20",
    iconBgClosed: "group-hover:bg-[#6E6E73]/10",
    badgeBg:      "bg-[#6E6E73] dark:bg-[#BFC0C0]",
    cardBorder:   "border-[#6E6E73]/35",
    panelHeader:  "bg-[#6E6E73]/6 dark:bg-[#6E6E73]/10",
  },
};

const FOLDERS: FolderDef[] = [
  {
    id:       "pasta-pdf",
    title:    "Pasta Monitorada",
    subtitle: "Importação de PDFs",
    styles:   FOLDER_STYLES["pasta-pdf"],
    icon:     FolderSearch,
  },
  {
    id:       "relatorio-mensal",
    title:    "Relatório Mensal",
    subtitle: "PDF consolidado",
    styles:   FOLDER_STYLES["relatorio-mensal"],
    icon:     FileBarChart2,
  },
];

// ─── Status helpers ───────────────────────────────────────────────────────────

function getImportStatus(enabled: boolean, folder: string | null) {
  if (!isTauri()) return "desktop" as const;
  if (!enabled)   return "off"     as const;
  if (!folder)    return "warn"    as const;
  return "on" as const;
}

function getReportStatus(enabled: boolean, folder: string | null) {
  return getImportStatus(enabled, folder);
}

const STATUS_DOT: Record<string, string> = {
  on:      "bg-green-500",
  warn:    "bg-yellow-500",
  off:     "bg-muted-foreground/40",
  desktop: "bg-muted-foreground/30",
};

const STATUS_LABEL: Record<string, string> = {
  on:      "Ativo",
  warn:    "Sem pasta",
  off:     "Inativo",
  desktop: "Desktop only",
};

// ─── Componente: card de pasta (grid) ─────────────────────────────────────────

function FolderCard({
  def,
  status,
  isOpen,
  onClick,
}: {
  def: FolderDef;
  status: "on" | "off" | "warn" | "desktop";
  isOpen: boolean;
  onClick: () => void;
}) {
  const Icon = def.icon;
  const s    = def.styles;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-2xl border-2 px-6 py-5 text-center",
        "transition-all duration-200 select-none",
        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isOpen
          ? cn("shadow-md", s.bgOpen, s.cardBorder)
          : "border-border bg-card hover:border-border/60 hover:bg-muted/20",
      )}
    >
      {/* Ponto de status */}
      <span className={cn(
        "absolute right-3 top-3 h-2.5 w-2.5 rounded-full transition-colors",
        STATUS_DOT[status],
        status === "on" && "ring-2 ring-green-500/20",
      )} />

      {/* Ícone de pasta */}
      <div className={cn(
        "flex h-14 w-14 items-center justify-center rounded-xl transition-colors",
        isOpen ? s.iconBgOpen : cn("bg-muted", s.iconBgClosed),
      )}>
        {isOpen
          ? <FolderOpen className={cn("h-7 w-7", s.text)} />
          : <Folder     className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-foreground/70" />
        }
      </div>

      {/* Badge do tipo (mini ícone) */}
      <div className={cn(
        "absolute bottom-[52px] right-[22px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-background shadow-sm transition-colors",
        isOpen ? s.badgeBg : "bg-muted-foreground/50",
      )}>
        <Icon className="h-2.5 w-2.5 text-white" />
      </div>

      <div>
        <p className={cn(
          "text-sm font-semibold leading-tight transition-colors",
          isOpen ? s.text : "text-foreground",
        )}>
          {def.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{def.subtitle}</p>
      </div>

      <Badge
        variant={status === "on" ? "outline" : "secondary"}
        className={cn(
          "text-[10px] px-2 py-0 h-5 gap-1",
          status === "on"   && "border-green-500/40 text-green-600 dark:text-green-400",
          status === "warn" && "border-yellow-500/40 text-yellow-600 dark:text-yellow-400",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[status])} />
        {STATUS_LABEL[status]}
      </Badge>

      <ChevronRight className={cn(
        "h-4 w-4 text-muted-foreground/50 transition-transform duration-200",
        isOpen && "rotate-90",
      )} />
    </button>
  );
}

// ─── Componente: painel de configuração — Pasta Monitorada ────────────────────

function PastaPdfPanel() {
  const [settings, setSettings] = useState(getAutomacaoSettings);
  const [log, setLog]           = useState<LogEntry[]>(getAutomacaoLog);

  useEffect(() => {
    const onLog = () => setLog(getAutomacaoLog());
    window.addEventListener("automacao-log-changed", onLog);
    return () => window.removeEventListener("automacao-log-changed", onLog);
  }, []);

  const isDesktop = isTauri();

  const toggle = (enabled: boolean) => {
    const next = { ...settings, enabled };
    setSettings(next);
    saveAutomacaoSettings(next);
  };

  const pickDir = async () => {
    if (!isDesktop) return;
    const folder = await pickFolder("Escolha a pasta a monitorar");
    if (!folder) return;
    const next = { ...settings, watchFolder: folder };
    setSettings(next);
    saveAutomacaoSettings(next);
  };

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Ativar monitoramento</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Importa extratos PGDAS-D automaticamente ao detectar novos PDFs.
            </p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={toggle} disabled={!isDesktop} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Pasta monitorada</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground truncate min-w-0">
              {settings.watchFolder ?? "Nenhuma pasta selecionada"}
            </div>
            <Button variant="outline" size="sm" onClick={pickDir} disabled={!isDesktop} className="shrink-0">
              <FolderOpen className="mr-1.5 h-4 w-4" />
              {settings.watchFolder ? "Alterar" : "Selecionar"}
            </Button>
          </div>
        </div>

        {!isDesktop && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" /> Requer o app desktop instalado.
          </p>
        )}

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Como funciona</p>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            {[
              "Salve um extrato PGDAS-D na pasta configurada.",
              "O sistema detecta e extrai CNPJ, competência e valores.",
              "Localiza ou cria a empresa pelo CNPJ no banco.",
              "Lança o movimento e notifica via pop-up.",
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold mt-0.5">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Separator />

      {/* Histórico */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Histórico de importações</p>
          {log.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { clearAutomacaoLog(); setLog([]); }} className="text-muted-foreground h-7 text-xs">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>

        {log.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Nenhuma importação registrada ainda.
          </div>
        ) : (
          <ScrollArea className="max-h-64 pr-1">
            <div className="space-y-2">
              {log.map((e) => {
                const icon =
                  e.status === "success" ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> :
                  e.status === "no-data" ? <AlertCircle  className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" /> :
                                           <XCircle      className="h-4 w-4 text-destructive shrink-0 mt-0.5" />;
                return (
                  <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    {icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium truncate">{e.fileName}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{fmtTs(e.timestamp)}</span>
                      </div>
                      {e.status === "success" && (
                        <div className="mt-1 text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <span className="text-foreground font-medium col-span-2">{e.companyName ?? e.cnpj}</span>
                          {e.competencia && <span>Competência: <span className="text-foreground">{fmtPeriodo(e.competencia)}</span></span>}
                          {(e.saida ?? 0) > 0 && <span>Faturamento: <span className="text-foreground">{fmtBrl(e.saida!)}</span></span>}
                          {(e.simplNacional ?? 0) > 0 && <span>DAS: <span className="text-foreground">{fmtBrl(e.simplNacional!)}</span></span>}
                        </div>
                      )}
                      {e.errorMessage && <p className="mt-0.5 text-xs text-muted-foreground">{e.errorMessage}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// ─── Componente: painel de configuração — Relatório Mensal ────────────────────

function RelatorioMensalPanel() {
  const [settings, setSettings] = useState<AutoReportSettings>(getAutoReportSettings);
  const [log, setLog]           = useState<AutoReportLogEntry[]>(getAutoReportLog);
  const [generating, setGenerating] = useState(false);

  const [customMonth, setCustomMonth] = useState(() => {
    const p = getAutoReportSettings().customPeriod ?? "";
    return p ? parseInt(p.split("-")[1], 10) : new Date().getMonth() + 1;
  });
  const [customYear, setCustomYear] = useState(() => {
    const p = getAutoReportSettings().customPeriod ?? "";
    return p ? parseInt(p.split("-")[0], 10) : currentYear;
  });

  useEffect(() => {
    const onLog = () => setLog(getAutoReportLog());
    window.addEventListener("autoreport-log-changed", onLog);
    return () => window.removeEventListener("autoreport-log-changed", onLog);
  }, []);

  const isDesktop = isTauri();
  const save = (next: AutoReportSettings) => { setSettings(next); saveAutoReportSettings(next); };

  const pickDir = async () => {
    if (!isDesktop) return;
    const folder = await pickFolder("Escolha onde salvar os relatórios");
    if (!folder) return;
    save({ ...settings, saveFolder: folder });
  };

  const handleCustomMonth = (val: string) => {
    const m = parseInt(val, 10);
    setCustomMonth(m);
    save({ ...settings, period: "custom", customPeriod: `${customYear}-${String(m).padStart(2, "0")}` });
  };

  const handleCustomYear = (val: string) => {
    const y = parseInt(val, 10);
    setCustomYear(y);
    save({ ...settings, period: "custom", customPeriod: `${y}-${String(customMonth).padStart(2, "0")}` });
  };

  const handleGenerateNow = async () => {
    if (!settings.saveFolder) { toast.error("Selecione uma pasta de destino."); return; }
    setGenerating(true);
    try {
      await generateReport(settings);
    } catch (err) {
      toast.error(`Falha ao gerar: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const previewPeriod = (() => {
    try { return fmtPeriodo(resolvePeriod(settings)); } catch { return "—"; }
  })();

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Ativar geração automática</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gera um PDF consolidado de todas as empresas ativas no dia configurado.
            </p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => save({ ...settings, enabled: v })} disabled={!isDesktop} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Pasta de destino</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground truncate min-w-0">
              {settings.saveFolder ?? "Nenhuma pasta selecionada"}
            </div>
            <Button variant="outline" size="sm" onClick={pickDir} disabled={!isDesktop} className="shrink-0">
              <FolderOpen className="mr-1.5 h-4 w-4" />
              {settings.saveFolder ? "Alterar" : "Selecionar"}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Período do relatório</Label>
          <Select value={settings.period} onValueChange={(v) => save({ ...settings, period: v as AutoReportSettings["period"] })}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="previous_month">Mês anterior (automático)</SelectItem>
              <SelectItem value="current_month">Mês atual</SelectItem>
              <SelectItem value="custom">Período específico</SelectItem>
            </SelectContent>
          </Select>

          {settings.period === "custom" && (
            <div className="flex items-center gap-2 mt-2">
              <Select value={String(customMonth)} onValueChange={handleCustomMonth}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(customYear)} onValueChange={handleCustomYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Período selecionado: <span className="text-foreground font-medium">{previewPeriod}</span>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Gerar automaticamente no dia</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={1} max={28}
              value={settings.triggerDay}
              onChange={(e) => save({ ...settings, triggerDay: Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
              className="w-20"
              disabled={!isDesktop}
            />
            <span className="text-sm text-muted-foreground">de cada mês (1–28)</span>
          </div>
        </div>

        {!isDesktop && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" /> Requer o app desktop instalado.
          </p>
        )}

        <Separator />

        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateNow}
            disabled={!isDesktop || generating || !settings.saveFolder}
            variant="secondary"
            className="gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {generating ? "Gerando…" : "Gerar agora"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Gera o relatório de <span className="text-foreground font-medium">{previewPeriod}</span> imediatamente.
          </p>
        </div>
      </div>

      <Separator />

      {/* Histórico */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Histórico de relatórios</p>
          {log.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { clearAutoReportLog(); setLog([]); }} className="text-muted-foreground h-7 text-xs">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>

        {log.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Nenhum relatório gerado ainda. Configure a pasta e clique em "Gerar agora".
          </div>
        ) : (
          <ScrollArea className="max-h-64 pr-1">
            <div className="space-y-2">
              {log.map((e) => (
                <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  {e.status === "success"
                    ? <FileText className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    : <XCircle  className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-medium">
                        {e.status === "success"
                          ? `${fmtPeriodo(e.period)} · ${e.companies} empresa(s)`
                          : "Falha na geração"}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{fmtTs(e.timestamp)}</span>
                    </div>
                    {e.status === "success" && e.filePath && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{e.filePath}</p>
                    )}
                    {e.errorMessage && <p className="mt-0.5 text-xs text-muted-foreground">{e.errorMessage}</p>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Automacoes() {
  const [open, setOpen] = useState<FolderId | null>(null);
  const detailRef       = useRef<HTMLDivElement>(null);

  // Rola suavemente para o painel ao abrir uma pasta
  useEffect(() => {
    if (open) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [open]);

  const handleFolder = (id: FolderId) => setOpen((prev) => (prev === id ? null : id));

  // Status de cada pasta
  const importSettings = getAutomacaoSettings();
  const reportSettings = getAutoReportSettings();

  const statuses: Record<FolderId, "on" | "off" | "warn" | "desktop"> = {
    "pasta-pdf":       getImportStatus(importSettings.enabled, importSettings.watchFolder),
    "relatorio-mensal": getReportStatus(reportSettings.enabled, reportSettings.saveFolder),
  };

  const openDef = FOLDERS.find((f) => f.id === open);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          Automações
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Clique em uma pasta para configurar e ver o histórico.
        </p>
      </div>

      {/* Grid de pastas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {FOLDERS.map((def) => (
          <FolderCard
            key={def.id}
            def={def}
            status={statuses[def.id]}
            isOpen={open === def.id}
            onClick={() => handleFolder(def.id)}
          />
        ))}
      </div>

      {/* Painel de detalhe — abre abaixo do grid ao clicar numa pasta */}
      {open && openDef && (
        <div ref={detailRef}>
          <Card className={cn("border-2 transition-all", openDef.styles.cardBorder)}>
            <CardHeader className={cn("pb-4 rounded-t-xl", openDef.styles.panelHeader)}>
              <div className="flex items-center justify-between">
                <CardTitle className={cn("flex items-center gap-2 text-base", openDef.styles.text)}>
                  <FolderOpen className="h-5 w-5" />
                  {openDef.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(null)}
                  className="text-muted-foreground h-7 text-xs"
                >
                  Fechar
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {open === "pasta-pdf"        && <PastaPdfPanel />}
              {open === "relatorio-mensal" && <RelatorioMensalPanel />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
