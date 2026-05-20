import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LucroPresumidoForm } from "@/components/LucroPresumidoForm";
import { toast } from "sonner";

export default function TaxPlanningDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: planning, isLoading } = useQuery({
    queryKey: ["tax_planning", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_planning")
        .select("*, companies(nome_fantasia, razao_social)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const { error } = await supabase
        .from("tax_planning")
        .update({ data: updatedData, status: 'completed' })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax_planning", id] });
      toast.success("Planejamento salvo com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar: " + error.message);
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/planejamento")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="bg-primary/10 p-2 rounded-lg">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">{planning?.title}</h1>
              <p className="text-xs text-muted-foreground">{planning?.companies?.nome_fantasia}</p>
            </div>
          </div>
          <div className="text-xs font-bold text-primary uppercase bg-primary/10 px-3 py-1 rounded-full">
            {planning?.tax_regime}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6">
        {planning?.tax_regime === 'LUCRO PRESUMIDO' ? (
          <LucroPresumidoForm 
            planning={planning} 
            onSave={(data) => updateMutation.mutate(data)} 
          />
        ) : (
          <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
            <h2 className="text-xl font-semibold mb-2">Regime em desenvolvimento</h2>
            <p className="text-muted-foreground">O formulário para {planning?.tax_regime} ainda está sendo preparado.</p>
          </div>
        )}
      </main>
    </div>
  );
}
