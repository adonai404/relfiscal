 import React, { useState, useEffect } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { supabase } from "@/integrations/supabase/client";
 import { formatCurrency, displayCompetencia } from "@/lib/format";
 import { useQuery } from "@tanstack/react-query";
 import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
 import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
 
 export const SimplesNacionalPlanningForm = ({ planning, onSave }: { planning: any, onSave: (data: any) => void }) => {
   const companyId = planning?.company_id;
   const [year, setYear] = useState(planning?.data?.year || new Date().getFullYear().toString());
 
   const { data: movements, isLoading, isError, refetch } = useQuery({
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
 
   const { data: config } = useQuery({
     queryKey: ["fiscal_config_planning", companyId],
     enabled: !!companyId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("fiscal_config")
         .select("*")
         .eq("company_id", companyId)
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });
 
   const totals = movements?.reduce((acc, curr) => ({
     entrada: acc.entrada + Number(curr.entrada || 0),
     saida: acc.saida + Number(curr.saida || 0),
     simples_nacional: acc.simples_nacional + Number(curr.simples_nacional || 0),
     icms: acc.icms + Number(curr.icms || 0),
     pis: acc.pis + Number(curr.pis || 0),
     cofins: acc.cofins + Number(curr.cofins || 0),
     irpj: acc.irpj + Number(curr.irpj || 0),
     csll: acc.csll + Number(curr.csll || 0),
   }), {
     entrada: 0, saida: 0, simples_nacional: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0
   }) || { entrada: 0, saida: 0, simples_nacional: 0, icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0 };
 
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
 
   return (
     <div className="space-y-6">
       <div className="flex flex-col lg:flex-row gap-6">
         <Card className="flex-1 shadow-sm border-border/60">
           <CardHeader className="pb-3">
             <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Configuração do Planejamento</CardTitle>
           </CardHeader>
           <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="space-y-1.5">
               <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ano de Apuração</Label>
               <Input className="h-9 font-medium" value={year} onChange={e => setYear(e.target.value)} />
             </div>
             <div className="space-y-1.5">
               <Label className="text-[10px] uppercase font-bold text-muted-foreground">Regime Atual</Label>
               <div className="h-9 flex items-center px-3 font-bold text-sm bg-muted/20 rounded-md border border-input">Simples Nacional</div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="flex-1 shadow-sm border-border/60">
           <CardHeader className="pb-3">
             <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Resumo dos Dados (Aba Movimento)</CardTitle>
           </CardHeader>
           <CardContent className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
               <p className="text-[10px] uppercase font-bold text-muted-foreground">Total de Saídas</p>
               <p className="text-lg font-bold text-primary">{formatCurrency(totals.saida)}</p>
             </div>
             <div className="space-y-1">
               <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Simples Nacional</p>
               <p className="text-lg font-bold text-green-600">{formatCurrency(totals.simples_nacional)}</p>
             </div>
           </CardContent>
         </Card>
       </div>
 
       <Card className="shadow-sm border-border/60 overflow-hidden">
         <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
           <div>
             <CardTitle className="text-sm font-bold uppercase tracking-wider">Detalhamento por Competência</CardTitle>
             <CardDescription className="text-xs">Dados sincronizados diretamente da aba de Movimento</CardDescription>
           </div>
           <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-2">
             <RefreshCw className="h-3 w-3" /> Sincronizar
           </Button>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
           <table className="w-full border-collapse text-xs">
             <thead>
               <tr className="bg-muted/30 border-b">
                 <th className="p-3 border-r text-left">Competência</th>
                 <th className="p-3 border-r text-right">Entrada</th>
                 <th className="p-3 border-r text-right">Saída</th>
                 <th className="p-3 text-right font-bold text-primary">Simples Nacional</th>
               </tr>
             </thead>
             <tbody>
               {movements?.map((m, idx) => (
                 <tr key={idx} className="border-b hover:bg-muted/10 transition-colors">
                   <td className="p-3 font-medium border-r">{displayCompetencia(m.competencia)}</td>
                   <td className="p-3 border-r text-right">{formatCurrency(m.entrada)}</td>
                   <td className="p-3 border-r text-right">{formatCurrency(m.saida)}</td>
                   <td className="p-3 text-right font-bold text-green-700 bg-green-50/20">{formatCurrency(m.simples_nacional)}</td>
                 </tr>
               ))}
               {(!movements || movements.length === 0) && (
                 <tr>
                   <td colSpan={4} className="p-8 text-center text-muted-foreground">
                     Nenhum dado de movimento encontrado para esta empresa.
                   </td>
                 </tr>
               )}
             </tbody>
             {movements && movements.length > 0 && (
               <tfoot className="bg-muted/20 font-bold border-t-2">
                 <tr>
                   <td className="p-3 border-r">TOTAL ANUAL</td>
                   <td className="p-3 border-r text-right">{formatCurrency(totals.entrada)}</td>
                   <td className="p-3 border-r text-right">{formatCurrency(totals.saida)}</td>
                   <td className="p-3 text-right text-green-800">{formatCurrency(totals.simples_nacional)}</td>
                 </tr>
               </tfoot>
             )}
           </table>
         </CardContent>
       </Card>
 
       <div className="flex justify-end pt-4">
         <Button 
           onClick={() => onSave({ year, totals, movements: movements?.length })}
           className="h-11 px-8 rounded-lg font-bold shadow-lg"
         >
           Salvar Planejamento
         </Button>
       </div>
     </div>
   );
 };