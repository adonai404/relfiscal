import { useMemo } from "react";
import { CalendarRange, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { displayCompetencia } from "@/lib/format";

export interface PeriodFilterValue {
  from: string; // 'YYYY-MM' or ''
  to: string;   // 'YYYY-MM' or ''
}

interface Props {
  value: PeriodFilterValue;
  onChange: (v: PeriodFilterValue) => void;
  className?: string;
  /** Optional list of available competencias (YYYY-MM) to power quick presets like "últimos 3 meses". */
  available?: string[];
}

const monthShift = (yyyymm: string, delta: number): string => {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) return yyyymm;
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function PeriodFilter({ value, onChange, className, available }: Props) {
  const active = !!(value.from || value.to);

  const summary = useMemo(() => {
    if (!active) return "Todo o período";
    const f = value.from ? displayCompetencia(value.from) : "início";
    const t = value.to ? displayCompetencia(value.to) : "hoje";
    return `${f} → ${t}`;
  }, [active, value]);

  const today = new Date();
  const todayYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const applyPreset = (months: number) => {
    const last = available && available.length > 0 ? available[available.length - 1] : todayYM;
    const from = monthShift(last, -(months - 1));
    onChange({ from, to: last });
  };

  const applyCurrentYear = () => {
    const y = today.getFullYear();
    onChange({ from: `${y}-01`, to: `${y}-12` });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={active ? "default" : "outline"} size="sm" className={className}>
          <CalendarRange className="mr-2 h-4 w-4" />
          {summary}
          {active && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">filtro</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-1.5rem))]" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Filtrar por competência</p>
            <p className="text-xs text-muted-foreground">Selecione o intervalo (mês/ano)</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">De</Label>
              <Input
                type="month"
                value={value.from}
                max={value.to || undefined}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Até</Label>
              <Input
                type="month"
                value={value.to}
                min={value.from || undefined}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Atalhos</p>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => applyPreset(3)}>3 meses</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyPreset(6)}>6 meses</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyPreset(12)}>12 meses</Button>
              <Button type="button" size="sm" variant="outline" onClick={applyCurrentYear}>Ano atual</Button>
            </div>
          </div>
          {active && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange({ from: "", to: "" })}>
              <X className="mr-2 h-4 w-4" /> Limpar filtro
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Helper: filter an array of items having a 'competencia' string ('YYYY-MM'). */
export function filterByPeriod<T extends { competencia: string }>(items: T[], { from, to }: PeriodFilterValue): T[] {
  if (!from && !to) return items;
  return items.filter((i) => {
    if (from && i.competencia < from) return false;
    if (to && i.competencia > to) return false;
    return true;
  });
}
