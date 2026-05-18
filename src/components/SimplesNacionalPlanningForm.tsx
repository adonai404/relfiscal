import React, { useState, useMemo } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { supabase } from "@/integrations/supabase/client";
import { brl as formatCurrency, displayCompetencia, formatCustomValue } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, AlertCircle, TrendingUp } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  ALL_COLUMNS, 
  isColumnVisible, 
  getColumnLabel, 
  useFiscalConfig, 
  isComputedColumn, 
  computeColumnValue, 
  getColumnCategory,
  getTaxColumns,
  type ColumnKey
} from "@/hooks/useFiscalConfig";
import { 
  useCustomColumns, 
  useCustomColumnValues, 
  buildRowResolver 
} from "@/hooks/useCustomColumns";
 
 export const SimplesNacionalPlanningForm = ({ planning, onSave }: { planning: any, onSave: (data: any) => void }) => {
   const companyId = planning?.company_id;
  const qc = useQueryClient();
   const [year, setYear] = useState(planning?.data?.year || new Date().getFullYear().toString());
 
  const { data: movements, isLoading: loadingMovs, isError, refetch } = useQuery({
     queryKey: ["fiscal_movement_planning", companyId],
     enabled: !!companyId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("fiscal_movement")
         .select("*")
         .eq("company_id", companyId)
         .order("competencia", { ascending: true });
       if (error) throw error;
       return data;
     },
   });
 
  const { data: config, isLoading: loadingConfig } = useFiscalConfig(companyId);
  const { data: customCols = [], isLoading: loadingCustomCols } = useCustomColumns(companyId);
  const { data: customValues = [], isLoading: loadingValues } = useCustomColumnValues(companyId);
 
  const isLoading = loadingMovs || loadingConfig || loadingCustomCols || loadingValues;
 
  // Map: movement_id -> column_id -> value
  const valuesByMov = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    customValues.forEach((v) => {
      (out[v.movement_id] ||= {})[v.column_id] = Number(v.value || 0);
    });
    return out;
  }, [customValues]);

  const visibleCustom = useMemo(
    () => [...customCols].filter((c) => c.visible).sort((a, b) => a.position - b.position),
    [customCols]
  );

  const visibleCols: ColumnKey[] = useMemo(
    () => ALL_COLUMNS.filter((c) => isColumnVisible(config ?? undefined, c)),
    [config]
  );

  const allVisibleColumns = useMemo(() => {
    const std = visibleCols.map((c) => ({
      id: c,
      label: getColumnLabel(config ?? undefined, c),
      kind: "standard" as const,
      category: getColumnCategory(c),
      key: c
    }));

    const cust = visibleCustom.map((c) => ({
      id: c.id,
      label: c.label,
      kind: "custom" as const,
      key: c.key,
      category: "custom" as const,
      isFormula: c.kind === "formula",
      format: c.format,
      decimals: c.decimals,
    }));

    const combined = [...std, ...cust];
    const order = config?.column_order as string[] | undefined;
    
    if (order && Array.isArray(order) && order.length > 0) {
      const orderMap = new Map(order.map((id, index) => [id, index]));
      return combined.sort((a, b) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 1000;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 1000;
        return idxA - idxB;
      });
    }
    return combined;
  }, [visibleCols, visibleCustom, config]);

  const taxCols = useMemo(() => getTaxColumns(config ?? undefined), [config]);

  const totals = useMemo(() => {
    const rows = movements || [];
    const byCol: Record<string, number> = {};
    
    ALL_COLUMNS.forEach((c) => {
      if (isComputedColumn(c)) {
        byCol[c] = 0;
      } else {
        byCol[c] = rows.reduce((s, r) => s + Number((r as any)[c] || 0), 0);
      }
    });

    if (byCol.saida) {
      byCol.aliquota_simples_calc = (byCol.simples_nacional || 0) / byCol.saida;
    }

    const totalsRow: Record<string, number> = { ...byCol };
    const totalsValuesByCol: Record<string, number> = {};
    
    visibleCustom.forEach((cc) => {
      if (cc.kind === "manual") {
        let s = 0;
        rows.forEach((r) => {
          s += Number(valuesByMov[r.id]?.[cc.id] ?? 0);
        });
        byCol[cc.key] = s;
        totalsValuesByCol[cc.id] = s;
      }
    });

    visibleCustom.forEach((cc) => {
      if (cc.kind !== "manual") {
        const resolver = buildRowResolver(totalsRow, customCols, totalsValuesByCol);
        byCol[cc.key] = resolver(cc.key);
      }
    });

    const totalImpostos = taxCols.reduce((s, c) => s + (byCol[c] || 0), 0);
    const totalSimples = byCol.simples_nacional || 0;
    const economia = totalImpostos - totalSimples;
    
    return { byCol, totalImpostos, totalSimples, economia };
  }, [movements, visibleCustom, customCols, valuesByMov, taxCols]);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["fiscal_movement_planning", companyId] });
    qc.invalidateQueries({ queryKey: ["fiscal_config", companyId] });
    qc.invalidateQueries({ queryKey: ["custom_columns", companyId] });
    qc.invalidateQueries({ queryKey: ["custom_column_values", companyId] });
    refetch();
  };

  if (isLoading) {
     return (
       <div className="flex h-64 items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (isError) {
     return (
       <Alert variant="destructive">
         <AlertCircle className="h-4 w-4" />
         <AlertTitle>Erro</AlertTitle>
         <AlertDescription>
           Não foi possível carregar os dados de movimento para este planejamento.
         </AlertDescription>
       </Alert>
     );
   }
 
  const getCellColor = (category: string) => {
    switch (category) {
      case "entrada": return "bg-green-50/10";
      case "saida": return "bg-blue-50/10";
      case "simples": return "bg-green-50/20 font-bold text-green-700";
      case "tax": return "bg-orange-50/10";
      case "payroll": return "bg-purple-50/10";
      default: return "";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 shadow-sm border-border/60 overflow-hidden">
          <div className="h-1 bg-primary/20 w-full" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ano Base</Label>
              <Input className="h-10 font-bold bg-muted/5 border-primary/20 focus:border-primary transition-all" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Enquadramento Simulado</Label>
              <div className="h-10 flex items-center px-4 font-black text-xs bg-primary/10 text-primary rounded-md border border-primary/20 uppercase tracking-tighter italic">Simples Nacional</div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-sm border-border/60 overflow-hidden">
          <div className="h-1 bg-green-500/20 w-full" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3 w-3" /> Resumo Consolidado
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div className="space-y-1 border-l-2 border-primary/30 pl-3">
              <p className="text-[10px] uppercase font-black text-muted-foreground">Faturamento Anual</p>
              <p className="text-xl font-black text-foreground tracking-tighter">{formatCurrency(totals.byCol.saida)}</p>
            </div>
            <div className="space-y-1 border-l-2 border-green-500/30 pl-3">
              <p className="text-[10px] uppercase font-black text-muted-foreground">DAS Total</p>
              <p className="text-xl font-black text-green-600 tracking-tighter">{formatCurrency(totals.totalSimples)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
 
      <Card className="shadow-lg border-border/60 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              Memória de Cálculo Sincronizada
            </CardTitle>
            <CardDescription className="text-[10px] font-medium uppercase text-muted-foreground/70">
              Refletindo exatamente a estrutura da aba de Movimento em tempo real
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9 px-4 gap-2 font-bold hover:bg-primary hover:text-primary-foreground transition-all shadow-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Sincronizar Agora
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/50 border-b uppercase tracking-tighter font-black">
                <th className="p-4 border-r text-left sticky left-0 bg-muted/80 backdrop-blur-sm z-10 w-32 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Competência</th>
                {allVisibleColumns.map((col) => (
                  <th key={col.id} className={`p-4 border-r text-right min-w-[110px] ${getCellColor(col.category)}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements?.map((row) => {
                const resolver = buildRowResolver(row, customCols, valuesByMov[row.id] ?? {});
                return (
                  <tr key={row.id} className="border-b hover:bg-primary/5 transition-colors group">
                    <td className="p-4 font-bold border-r sticky left-0 bg-background group-hover:bg-primary/5 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                      {displayCompetencia(row.competencia)}
                    </td>
                    {allVisibleColumns.map((col) => {
                      const val = resolver(col.key as string);
                      return (
                        <td key={col.id} className={`p-4 border-r text-right font-medium ${getCellColor(col.category)}`}>
                          {col.kind === 'custom' 
                            ? formatCustomValue(val, col.format, col.decimals)
                            : col.id === 'aliquota_simples_calc' 
                              ? (val * 100).toFixed(2) + '%'
                              : formatCurrency(val)
                          }
                        </td>
                      );
                    })}
                 </tr>
                );
              })}
              {(!movements || movements.length === 0) && (
                <tr>
                  <td colSpan={allVisibleColumns.length + 1} className="p-12 text-center text-muted-foreground font-medium italic">
                    Nenhum registro de movimento encontrado para esta empresa no período.
                  </td>
                </tr>
              )}
            </tbody>
            {movements && movements.length > 0 && (
              <tfoot className="bg-muted/40 font-black border-t-2 border-primary/20 sticky bottom-0 z-20 shadow-[0_-4px_6px_rgba(0,0,0,0.02)] uppercase tracking-tighter">
                <tr>
                  <td className="p-4 border-r sticky left-0 bg-muted/80 backdrop-blur-sm z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">TOTAL ACUMULADO</td>
                  {allVisibleColumns.map((col) => {
                    const val = totals.byCol[col.key as string] || 0;
                    return (
                      <td key={col.id} className={`p-4 border-r text-right ${getCellColor(col.category)}`}>
                        {col.kind === 'custom' 
                          ? formatCustomValue(val, col.format, col.decimals)
                          : col.id === 'aliquota_simples_calc' 
                            ? (val * 100).toFixed(2) + '%'
                            : formatCurrency(val)
                        }
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
 
      <div className="flex justify-end pt-4">
        <Button 
          onClick={() => onSave({ year, totals, movements: movements?.length })}
          className="h-12 px-10 rounded-xl font-black uppercase tracking-widest shadow-xl hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Gravar Planejamento
        </Button>
     </div>
    </div>
  );
};