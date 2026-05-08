import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Calculator, Loader2, Search, Building2, Briefcase, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

export default function TaxPlanning() {
  const navigate = useNavigate();
  const { companies } = useCompany();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedRegime, setSelectedRegime] = useState("");

  const { data: plannings = [], isLoading } = useQuery({
    queryKey: ["tax_planning"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_planning")
        .select("*, companies(nome_fantasia)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newPlanning: any) => {
      const { data, error } = await supabase
        .from("tax_planning")
        .insert([newPlanning])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax_planning"] });
      toast.success("Planejamento criado com sucesso!");
      setIsDialogOpen(false);
      setTitle("");
      setSelectedCompanyId("");
      setSelectedRegime("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar planejamento");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedCompanyId || !selectedRegime) {
      return toast.error("Preencha todos os campos");
    }
    createMutation.mutate({
      title,
      company_id: selectedCompanyId,
      tax_regime: selectedRegime,
    });
  };

  const filteredPlannings = plannings.filter((p: any) => 
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.companies?.nome_fantasia.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/app")} aria-label="Voltar">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Calculator className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Planejamento Tributário</h1>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo Planejamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Novo Planejamento</DialogTitle>
                  <DialogDescription>
                    Crie uma simulação tributária para comparar regimes fiscais.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Título do Planejamento</Label>
                    <Input 
                      id="title" 
                      placeholder="Ex: Simulação 2026 - Empresa X" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Empresa</Label>
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome_fantasia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Regime Alvo</Label>
                    <Select value={selectedRegime} onValueChange={setSelectedRegime}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o regime" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SIMPLES NACIONAL">SIMPLES NACIONAL</SelectItem>
                        <SelectItem value="LUCRO REAL">LUCRO REAL</SelectItem>
                        <SelectItem value="LUCRO PRESUMIDO">LUCRO PRESUMIDO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Começar Planejamento
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>
+
      <main className="max-w-7xl mx-auto w-full px-4 py-8 sm:px-6 space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar planejamentos..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
+
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredPlannings.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Calculator className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Nenhum planejamento encontrado</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Comece criando um novo planejamento tributário para simular cenários de economia.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Criar Primeiro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlannings.map((p: any) => (
              <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer border-border/50 group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant={p.status === 'draft' ? 'secondary' : 'default'}>
                      {p.status === 'draft' ? 'Rascunho' : 'Finalizado'}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4 text-lg line-clamp-1">{p.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {p.companies?.nome_fantasia}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-sm font-medium text-muted-foreground">Regime Alvo:</div>
                  <div className="font-bold text-primary">{p.tax_regime}</div>
                </CardContent>
                <CardContent className="pt-0 text-xs text-muted-foreground border-t bg-muted/20 py-2">
                  Criado em: {new Date(p.created_at).toLocaleDateString()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}