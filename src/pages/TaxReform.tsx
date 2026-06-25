import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Scale, Tags, CalendarPlus, GitBranch, LayoutList } from "lucide-react";
import { toast } from "sonner";
import { CategoryManagerDialog } from "@/components/tax-reform/CategoryManagerDialog";
import { MonthCard } from "@/components/tax-reform/MonthCard";
import { ChangeDetailSheet } from "@/components/tax-reform/ChangeDetailSheet";
import { TaxReformCanvas } from "@/components/tax-reform/canvas/TaxReformCanvas";
import type {
  TaxReformCategory,
  TaxReformChange,
  TaxReformMonth,
} from "@/components/tax-reform/types";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 1 + i);

export default function TaxReform() {
  const qc = useQueryClient();
  const [view, setView]                               = useState<"changes" | "canvas">("changes");
  const [canvasHeight, setCanvasHeight]               = useState(0);
  const headerRef                                     = useRef<HTMLDivElement>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [addMonthOpen, setAddMonthOpen]               = useState(false);
  const [selectedChange, setSelectedChange]           = useState<TaxReformChange | null>(null);
  const [sheetOpen, setSheetOpen]                     = useState(false);

  const [newYear, setNewYear]       = useState(String(CURRENT_YEAR));
  const [newMonth, setNewMonth]     = useState(String(new Date().getMonth() + 1));
  const [savingMonth, setSavingMonth] = useState(false);

  // Mede o espaço real disponível abaixo do header para o canvas
  useEffect(() => {
    const measure = () => {
      if (!headerRef.current) return;
      const bottom = headerRef.current.getBoundingClientRect().bottom;
      setCanvasHeight(window.innerHeight - bottom - 8); // 8px de margem inferior
    };

    if (view === "canvas") {
      measure();
      const ro = new ResizeObserver(measure);
      if (headerRef.current) ro.observe(headerRef.current);
      window.addEventListener("resize", measure);
      return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
    }
  }, [view]);

  const { data: categories = [] } = useQuery({
    queryKey: ["tax_reform_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_reform_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as TaxReformCategory[];
    },
  });

  const { data: months = [], isLoading: loadingMonths } = useQuery({
    queryKey: ["tax_reform_months"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_reform_months")
        .select("*")
        .order("year")
        .order("month");
      if (error) throw error;
      return data as TaxReformMonth[];
    },
  });

  const { data: changes = [], isLoading: loadingChanges } = useQuery({
    queryKey: ["tax_reform_changes"],
    enabled: months.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_reform_changes")
        .select("*, tax_reform_categories(*)")
        .order("position")
        .order("exact_date");
      if (error) throw error;
      return data as TaxReformChange[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tax_reform_months"] });
    qc.invalidateQueries({ queryKey: ["tax_reform_changes"] });
  };

  const handleAddMonth = async () => {
    const year  = parseInt(newYear);
    const month = parseInt(newMonth);
    const label = `${MONTH_NAMES[month - 1]} ${year}`;
    setSavingMonth(true);
    const { error } = await supabase.from("tax_reform_months").insert({
      year,
      month,
      label,
      position: months.length,
    });
    setSavingMonth(false);
    if (error) {
      toast.error(error.code === "23505" ? "Esse mês já foi adicionado." : "Erro ao criar mês");
    } else {
      setAddMonthOpen(false);
      refresh();
    }
  };

  const handleChangeClick = (change: TaxReformChange) => {
    setSelectedChange(change);
    setSheetOpen(true);
  };

  const changesByMonth = changes.reduce<Record<string, TaxReformChange[]>>(
    (acc, c) => { (acc[c.month_id] ??= []).push(c); return acc; },
    {},
  );

  const isLoading = loadingMonths || (months.length > 0 && loadingChanges);

  return (
    <div className="flex w-full flex-col">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div ref={headerRef} className="mb-6 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-md shadow-primary/30">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                Reforma Tributária
              </h1>
              <p className="text-sm text-muted-foreground">
                Planejamento e acompanhamento das mudanças
              </p>
            </div>
          </div>

          {view === "changes" && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoryManagerOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-border/50 bg-white/70 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Tags className="h-3.5 w-3.5" /> Categorias
              </button>
              <button
                type="button"
                onClick={() => setAddMonthOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:brightness-110"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Novo mês
              </button>
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="mt-5 flex w-fit gap-1 rounded-xl bg-muted/60 p-1">
          {(
            [
              { key: "changes", label: "Mudanças", Icon: LayoutList },
              { key: "canvas",  label: "Fluxo",    Icon: GitBranch  },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all",
                view === key
                  ? "bg-white text-foreground shadow-sm dark:bg-white/15"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Canvas view ──────────────────────────────────────────────── */}
      {view === "canvas" && (
        <div
          style={{ height: canvasHeight > 0 ? canvasHeight : undefined }}
          className="min-h-[400px] w-full overflow-hidden rounded-2xl border border-border/30"
        >
          <TaxReformCanvas />
        </div>
      )}

      {/* ── Mudanças view ────────────────────────────────────────────── */}
      {view === "changes" && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : months.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/50">
                <Scale className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-base font-semibold text-foreground">Nenhum mês cadastrado</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Adicione o primeiro mês para começar a organizar as mudanças da reforma tributária.
              </p>
              <button
                type="button"
                onClick={() => setAddMonthOpen(true)}
                className="mt-5 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:brightness-110"
              >
                <CalendarPlus className="h-4 w-4" /> Adicionar primeiro mês
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {months.map((month) => (
                <MonthCard
                  key={month.id}
                  month={month}
                  changes={changesByMonth[month.id] ?? []}
                  categories={categories}
                  onChangeClick={handleChangeClick}
                  onRefresh={refresh}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Dialogs & Sheets ─────────────────────────────────────────── */}
      <CategoryManagerDialog
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />

      <Dialog open={addMonthOpen} onOpenChange={setAddMonthOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Novo Mês</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <Select value={newMonth} onValueChange={setNewMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Select value={newYear} onValueChange={setNewYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMonthOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddMonth} disabled={savingMonth}>
              {savingMonth && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangeDetailSheet
        change={selectedChange}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedChange(null); }}
        onRefresh={refresh}
      />
    </div>
  );
}
