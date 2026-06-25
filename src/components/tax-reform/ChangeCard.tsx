import { useState } from "react";
import { CalendarDays, ChevronRight, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { TaxReformChange, TaxReformUrgency } from "./types";

// Paleta do tema: carmesim #73030D · bordô #732F3B · cinza neutro #8C8C8C
const URGENCY_DOT: Record<TaxReformUrgency, string> = {
  critical:      "bg-[#73030D]",
  important:     "bg-[#732F3B]",
  informational: "bg-[#8C8C8C]",
};

const URGENCY_LABEL: Record<TaxReformUrgency, string> = {
  critical:      "Crítico",
  important:     "Importante",
  informational: "Informativo",
};

const URGENCY_PILL: Record<TaxReformUrgency, string> = {
  critical:
    "bg-[#73030D]/10 text-[#73030D] ring-1 ring-[#73030D]/20 dark:bg-[#73030D]/20 dark:text-rose-300 dark:ring-[#73030D]/30",
  important:
    "bg-[#732F3B]/10 text-[#732F3B] ring-1 ring-[#732F3B]/20 dark:bg-[#732F3B]/20 dark:text-rose-400 dark:ring-[#732F3B]/30",
  informational:
    "bg-[#8C8C8C]/10 text-[#5a5a5a] ring-1 ring-[#8C8C8C]/20 dark:bg-[#8C8C8C]/10 dark:text-stone-400 dark:ring-[#8C8C8C]/20",
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  change: TaxReformChange;
  onClick: (change: TaxReformChange) => void;
  onDelete: (change: TaxReformChange) => void;
}

export function ChangeCard({ change, onClick, onDelete }: Props) {
  const category = change.tax_reform_categories;
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="group relative w-full overflow-hidden rounded-2xl border border-border/30 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:shadow-md hover:border-border/50 dark:bg-white/[0.05] dark:border-white/10">
        {/* Delete button — aparece no hover */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground/30 opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          aria-label="Excluir mudança"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* Card body — clicável para abrir detalhe */}
        <button
          type="button"
          onClick={() => onClick(change)}
          className="w-full p-4 text-left space-y-3"
        >
          {/* Top row: urgency pill + chevron */}
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full shrink-0", URGENCY_DOT[change.urgency])} />
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", URGENCY_PILL[change.urgency])}>
                {URGENCY_LABEL[change.urgency]}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
          </div>

          {/* Title */}
          <p className="text-[15px] font-semibold leading-snug text-foreground line-clamp-2">
            {change.title}
          </p>

          {/* Description */}
          {change.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {change.description}
            </p>
          )}

          {/* Footer: date + category */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>{formatDate(change.exact_date)}</span>
            </div>
            {category && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            )}
          </div>
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mudança?</AlertDialogTitle>
            <AlertDialogDescription>
              "{change.title}" será excluída permanentemente, incluindo todas as
              tarefas, checklist e anexos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmOpen(false); onDelete(change); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
