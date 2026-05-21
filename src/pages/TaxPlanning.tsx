import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Calculator, Loader2, Search, Building2, Briefcase, FolderPlus, Folder, MoreVertical, Layers, FileUp, Package, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaxPlanningProductXML } from "@/components/TaxPlanningProductXML";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedRegime, setSelectedRegime] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("none");
  const [newGroupName, setNewGroupName] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["tax_planning_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_planning_groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: plannings = [], isLoading } = useQuery({
    queryKey: ["tax_planning"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_planning")
        .select("*, companies(nome_fantasia), tax_planning_groups(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("tax_planning_groups")
        .insert([{ name }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax_planning_groups"] });
      toast.success("Grupo criado com sucesso!");
      setIsGroupDialogOpen(false);
      setNewGroupName("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar grupo");
    },
  });

  const updatePlanningGroupMutation = useMutation({
    mutationFn: async ({ planningId, groupId }: { planningId: string, groupId: string | null }) => {
      const { error } = await supabase
        .from("tax_planning")
        .update({ group_id: groupId })
        .eq("id", planningId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax_planning"] });
      toast.success("Grupo atualizado com sucesso!");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (planningData: any) => {
      const { groupId, ...rest } = planningData;
      const newPlanning = {
        ...rest,
        group_id: groupId === "none" ? null : groupId
      };
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
      setSelectedGroupId("none");
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
      groupId: selectedGroupId,
    });
  };

  const filteredPlannings = plannings.filter((p: any) => 
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.companies?.nome_fantasia.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 px-4 py-6 sm:px-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Planejamento Tributário</h1>
          <p className="text-muted-foreground">Compare regimes e simule economias.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderPlus className="mr-2 h-4 w-4" /> Novo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={(e) => { e.preventDefault(); createGroupMutation.mutate(newGroupName); }}>
                <DialogHeader>
                  <DialogTitle>Novo Grupo</DialogTitle>
                  <DialogDescription>
                    Crie um grupo para organizar seus planejamentos.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="group_name">Nome do Grupo</Label>
                    <Input 
                      id="group_name" 
                      placeholder="Ex: Projetos 2026" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createGroupMutation.isPending}>
                    {createGroupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar Grupo
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
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
                  <div className="grid gap-2">
                    <Label>Grupo (Opcional)</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {groups.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
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
      </div>

      <div className="w-full px-4 py-6 sm:px-6 space-y-6 overflow-x-hidden">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar planejamentos..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            <TabsTrigger value="products">Por Produto (XML)</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <TaxPlanningProductXML />
          </TabsContent>

          <TabsContent value="all" className="mt-6">
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
                  <Card 
                    key={p.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer border-border/50 group relative"
                    onClick={() => navigate(`/planejamento/${p.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                          <Briefcase className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={p.status === 'draft' ? 'secondary' : 'default'}>
                            {p.status === 'draft' ? 'Rascunho' : 'Finalizado'}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled className="text-xs font-semibold">
                                Mover para Grupo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updatePlanningGroupMutation.mutate({ planningId: p.id, groupId: null })}>
                                Nenhum
                              </DropdownMenuItem>
                              {groups.map((g: any) => (
                                <DropdownMenuItem 
                                  key={g.id} 
                                  onClick={() => updatePlanningGroupMutation.mutate({ planningId: p.id, groupId: g.id })}
                                >
                                  {g.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <CardTitle className="mt-4 text-lg line-clamp-1">{p.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {p.companies?.nome_fantasia}
                      </CardDescription>
                      {p.tax_planning_groups && (
                        <CardDescription className="flex items-center gap-1 mt-1 text-primary">
                          <Folder className="h-3 w-3" />
                          {p.tax_planning_groups.name}
                        </CardDescription>
                      )}
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
          </TabsContent>

          <TabsContent value="groups" className="mt-6">
            {groups.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <Layers className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Nenhum grupo encontrado</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Crie grupos para organizar seus planejamentos tributários por projeto ou ano.
                  </p>
                  <Button onClick={() => setIsGroupDialogOpen(true)}>
                    <FolderPlus className="mr-2 h-4 w-4" /> Criar Primeiro Grupo
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group: any) => {
                  const itemsInGroup = plannings.filter((p: any) => p.group_id === group.id);
                  return (
                    <Card key={group.id} className="hover:shadow-md transition-shadow border-primary/10">
                      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg">
                            <Folder className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{group.name}</CardTitle>
                            <CardDescription>{itemsInGroup.length} planejamento(s)</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {itemsInGroup.slice(0, 3).map((p: any) => (
                            <div 
                              key={p.id} 
                              className="text-sm p-2 rounded border border-border/50 hover:bg-muted cursor-pointer truncate"
                              onClick={() => navigate(`/planejamento/${p.id}`)}
                            >
                              {p.title}
                            </div>
                          ))}
                          {itemsInGroup.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center">
                              + {itemsInGroup.length - 3} outros
                            </div>
                          )}
                          {itemsInGroup.length === 0 && (
                            <div className="text-sm text-muted-foreground italic text-center py-4">
                              Pasta vazia
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardFooter className="pt-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => {
                            setSearch(group.name);
                          }}
                        >
                          Ver Tudo no Grupo
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
