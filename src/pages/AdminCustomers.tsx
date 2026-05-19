import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Users, Building2, Search, X, Check, UserPlus, Trash2, Plus, UserCircle, Mail, Phone, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface Company {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
}

export default function AdminCustomers() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "" });
  const [linkingCustomer, setLinkingCustomer] = useState<Customer | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [selectedCustomerForUser, setSelectedCustomerForUser] = useState<Customer | null>(null);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "" });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const createUserForCustomer = async () => {
    if (!selectedCustomerForUser) return;
    setIsCreatingUser(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.username,
            username: newUser.username,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      const { error: profileError } = await supabase
        .from("profiles" as any)
        .update({ 
          customer_id: selectedCustomerForUser.id,
          username: newUser.username,
          status: "ativo"
        } as any)
        .eq("user_id", authData.user.id);

      if (profileError) throw profileError;

      toast.success("Usuário criado e vinculado ao cliente");
      setIsCreateUserOpen(false);
      setNewUser({ username: "", email: "", password: "" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["admin-all-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, nome_fantasia, razao_social, cnpj");
      if (error) throw error;
      return data as Company[];
    },
  });

  const { data: customerLinks = [] } = useQuery({
    queryKey: ["customer-links", linkingCustomer?.id],
    enabled: !!linkingCustomer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_companies")
        .select("company_id")
        .eq("customer_id", linkingCustomer!.id);
      if (error) throw error;
      return (data ?? []).map((d: any) => d.company_id);
    },
  });

  const createCustomer = useMutation({
    mutationFn: async (customer: typeof newCustomer) => {
      const { error } = await supabase.from("customers").insert(customer);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente criado com sucesso");
      setIsCreateOpen(false);
      setNewCustomer({ name: "", email: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleCompanyLink = useMutation({
    mutationFn: async ({ customerId, companyId, linked }: { customerId: string; companyId: string; linked: boolean }) => {
      if (linked) {
        const { error } = await supabase
          .from("customer_companies")
          .delete()
          .eq("customer_id", customerId)
          .eq("company_id", companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_companies")
          .insert({ customer_id: customerId, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCompanies = allCompanies.filter(c => 
    c.nome_fantasia.toLowerCase().includes(companySearch.toLowerCase()) ||
    c.cnpj.includes(companySearch)
  );

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-50">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate("/app")} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-sm sm:text-lg font-black uppercase tracking-widest">Clientes</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="xs" onClick={() => setIsCreateOpen(true)} className="h-8 uppercase font-black text-[10px] px-3">
              <Plus className="h-3 w-3 mr-1" /> Novo
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-2 py-4 sm:px-6 sm:py-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        <div className="relative w-full sm:max-w-md mx-auto sm:mx-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Pesquisar clientes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs font-bold uppercase"
          />
        </div>

        <Card className="shadow-sm border-border/60 overflow-hidden">
          <CardContent className="p-0">
            {/* Desktop Table */}
            <Table className="hidden sm:table">
              <TableHeader className="bg-muted/30">
                <TableRow className="uppercase text-[10px] font-black">
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12 uppercase text-xs font-black italic">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-bold text-xs uppercase">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{c.email || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{c.phone || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                          <Button
                            size="xs"
                            variant="outline"
                            className="uppercase font-black text-[9px] h-7"
                            onClick={() => {
                              setSelectedCustomerForUser(c);
                              setIsCreateUserOpen(true);
                            }}
                          >
                            <UserPlus className="mr-1 h-3 w-3" /> Acesso
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="uppercase font-black text-[9px] h-7"
                            onClick={() => setLinkingCustomer(c)}
                          >
                            <Building2 className="mr-1 h-3 w-3" /> Empresas
                          </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                          onClick={() => {
                            if (confirm("Deseja realmente excluir este cliente?")) {
                              deleteCustomer.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-2 p-2 bg-muted/5">
              {isLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filteredCustomers.length === 0 ? (
                <p className="text-center py-12 text-[10px] font-black uppercase text-muted-foreground italic">Nenhum cliente.</p>
              ) : (
                filteredCustomers.map((c) => (
                  <Card key={c.id} className="shadow-none border-border/50 bg-card/40 overflow-hidden">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="font-black text-xs uppercase tracking-tight">{c.name}</div>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-destructive"
                          onClick={() => {
                            if (confirm("Deseja realmente excluir este cliente?")) {
                              deleteCustomer.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-1.5 text-[9px] font-black uppercase text-muted-foreground/80">
                        {c.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-primary/60" /> {c.email}</div>}
                        {c.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-primary/60" /> {c.phone}</div>}
                        <div className="flex items-center gap-2"><Calendar className="h-3 w-3 text-primary/60" /> Cadastrado em {new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-muted/30">
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-8 uppercase font-black text-[9px]"
                          onClick={() => {
                            setSelectedCustomerForUser(c);
                            setIsCreateUserOpen(true);
                          }}
                        >
                          <UserPlus className="mr-1 h-3 w-3" /> Criar Login
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-8 uppercase font-black text-[9px]"
                          onClick={() => setLinkingCustomer(c)}
                        >
                          <Building2 className="mr-1 h-3 w-3" /> Empresas
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
  
      {/* Dialog: Novo Cliente */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg font-black uppercase tracking-widest">Novo Cliente</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Cadastre as informações básicas do cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome completo</Label>
              <Input 
                className="h-10 text-xs font-bold uppercase"
                value={newCustomer.name} 
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Email</Label>
              <Input 
                type="email"
                className="h-10 text-xs font-bold"
                value={newCustomer.email} 
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Telefone</Label>
              <Input 
                className="h-10 text-xs font-bold"
                value={newCustomer.phone} 
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex sm:flex-row gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none uppercase font-black text-[10px]" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button size="sm" className="flex-1 sm:flex-none uppercase font-black text-[10px]" onClick={() => createCustomer.mutate(newCustomer)} disabled={!newCustomer.name}>Criar Cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Criar Usuário para Cliente */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg font-black uppercase tracking-widest">Criar Acesso</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Novo login para <strong>{selectedCustomerForUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome de Usuário</Label>
              <Input 
                placeholder="ex: joaosilva"
                className="h-10 text-xs font-bold"
                value={newUser.username} 
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Email de Login</Label>
              <Input 
                type="email"
                placeholder="cliente@email.com"
                className="h-10 text-xs font-bold"
                value={newUser.email} 
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Senha Temporária</Label>
              <Input 
                type="password"
                className="h-10 text-xs font-bold"
                value={newUser.password} 
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex sm:flex-row gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none uppercase font-black text-[10px]" onClick={() => setIsCreateUserOpen(false)}>Cancelar</Button>
            <Button 
              size="sm"
              className="flex-1 sm:flex-none uppercase font-black text-[10px]"
              onClick={createUserForCustomer} 
              disabled={isCreatingUser || !newUser.username || !newUser.email || !newUser.password}
            >
              {isCreatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Vincular Empresas ao Cliente */}
      <Dialog open={!!linkingCustomer} onOpenChange={(open) => !open && setLinkingCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg font-black uppercase tracking-widest">Empresas do Cliente</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Gerencie as empresas de <strong>{linkingCustomer?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative my-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar empresa..." 
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="pl-9 h-10 text-xs font-bold uppercase"
            />
          </div>

          <div className="flex-1 overflow-auto border rounded-md bg-muted/5">
            <Table>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-center py-12 text-muted-foreground text-[10px] font-black uppercase italic">
                      Nenhuma empresa encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map(c => {
                    const isLinked = customerLinks.includes(c.id);
                    return (
                      <TableRow key={c.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="p-3">
                          <div className="font-black text-xs uppercase leading-tight">{c.nome_fantasia}</div>
                          <div className="text-[9px] text-muted-foreground uppercase font-medium">{c.razao_social} • {c.cnpj}</div>
                        </TableCell>
                        <TableCell className="text-right p-3">
                          <Button
                            size="xs"
                            variant={isLinked ? "outline" : "default"}
                            disabled={toggleCompanyLink.isPending}
                            className="h-8 uppercase font-black text-[9px]"
                            onClick={() => toggleCompanyLink.mutate({ 
                              customerId: linkingCustomer!.id, 
                              companyId: c.id, 
                              linked: isLinked 
                            })}
                          >
                            {isLinked ? "Remover" : "Vincular"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="pt-4">
            <Button size="sm" className="w-full sm:w-auto uppercase font-black text-[10px]" onClick={() => setLinkingCustomer(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}