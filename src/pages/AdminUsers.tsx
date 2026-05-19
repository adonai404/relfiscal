import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Lock, Unlock, Users, Building2, Search, X, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

type Row = {
  user_id: string;
  email: string | null;
  username: string | null;
  customer_id: string | null;
  status: "ativo" | "bloqueado";
  created_at: string;
  isSuperAdmin: boolean;
};

interface Company {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
       const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: customers, error: cErr }] = await Promise.all([
        supabase
           .from("profiles" as any)
           .select("user_id, email, username, status, created_at, customer_id")
          .order("created_at", { ascending: false }),
         supabase.from("user_roles").select("user_id, role"),
         supabase.from("customers").select("id, name"),
      ]);
       if (pErr) throw pErr;
       if (rErr) throw rErr;
       if (cErr) throw cErr;
       const superAdmins = new Set((roles ?? []).filter((r: any) => r.role === "super_admin").map((r: any) => r.user_id));
       const customerMap = new Map((customers ?? []).map((c: any) => [c.id, c.name]));
       return (profiles ?? []).map((p: any) => ({
         ...p,
         isSuperAdmin: superAdmins.has(p.user_id),
         customerName: p.customer_id ? customerMap.get(p.customer_id) : null,
       })) as (Row & { customerName: string | null })[];
    },
  });

  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [customerUser, setCustomerUser] = useState<(Row & { customerName: string | null }) | null>(null);
  const [linkUser, setLinkUser] = useState<(Row & { customerName: string | null }) | null>(null);
  
  const { data: allCustomers = [] } = useQuery({
    queryKey: ["admin-all-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const setCustomerMutation = useMutation({
    mutationFn: async ({ userId, customerId }: { userId: string; customerId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ customer_id: customerId } as any).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo com cliente atualizado");
      setIsCustomerDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [linkSearch, setLinkSearch] = useState("");

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["admin-all-companies"],
    enabled: !!linkUser,
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, nome_fantasia, razao_social, cnpj");
      if (error) throw error;
      return data as Company[];
    },
  });

  const { data: userLinks = [] } = useQuery({
    queryKey: ["user-links", linkUser?.user_id],
    enabled: !!linkUser,
    queryFn: async () => {
      const { data, error } = await supabase.from("company_users").select("company_id").eq("user_id", linkUser!.user_id);
      if (error) throw error;
      return (data ?? []).map((d: any) => d.company_id);
    },
  });

  const toggleLink = useMutation({
    mutationFn: async ({ userId, companyId, linked }: { userId: string; companyId: string; linked: boolean }) => {
      if (linked) {
        const { error } = await supabase.from("company_users").delete().eq("user_id", userId).eq("company_id", companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_users").insert({ user_id: userId, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredCompanies = useMemo(() => {
    const q = linkSearch.toLowerCase().trim();
    if (!q) return allCompanies;
    return allCompanies.filter(c => 
      c.nome_fantasia.toLowerCase().includes(q) || 
      c.razao_social.toLowerCase().includes(q) || 
      c.cnpj.includes(q)
    );
  }, [allCompanies, linkSearch]);

  const setStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "ativo" | "bloqueado" }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "ativo" ? "Usuário ativado" : "Usuário bloqueado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderTable = (data: (Row & { customerName: string | null })[], emptyMsg: string) => (
    <div className="overflow-x-auto">
      <Table className="hidden sm:table">
        <TableHeader>
          <TableRow>
             <TableHead>Usuário</TableHead>
             <TableHead>Email</TableHead>
            <TableHead>Cadastro</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                {emptyMsg}
              </TableCell>
            </TableRow>
          ) : (
            data.map((r) => {
              const isSelf = r.user_id === user?.id;
              return (
                <TableRow key={r.user_id}>
                   <TableCell>
                     <div className="font-medium">
                       {r.username ?? "-"}
                       {r.isSuperAdmin && <Badge className="ml-2 h-5 text-[10px] uppercase font-black">super admin</Badge>}
                     </div>
                     {r.customerName && (
                       <div className="text-[10px] text-blue-600 font-black uppercase italic">Cliente: {r.customerName}</div>
                     )}
                   </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.email ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {r.status === "ativo" ? (
                      <Badge variant="secondary" className="h-5 text-[10px] uppercase font-black">ativo</Badge>
                    ) : (
                      <Badge variant="destructive" className="h-5 text-[10px] uppercase font-black">bloqueado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {!isSelf && !r.isSuperAdmin && (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setCustomerUser(r);
                            setIsCustomerDialogOpen(true);
                          }}
                        >
                          <Users className="mr-1 h-3 w-3" /> Cliente
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setLinkUser(r)}
                        >
                          <Building2 className="mr-1 h-3 w-3" /> Empresas
                        </Button>
                      </>
                    )}
                    {isSelf || r.isSuperAdmin ? (
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">{isSelf ? "(você)" : "—"}</span>
                    ) : r.status === "ativo" ? (
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => setStatus.mutate({ userId: r.user_id, status: "bloqueado" })}
                      >
                        <Lock className="mr-1 h-3 w-3" /> Bloquear
                      </Button>
                    ) : (
                      <Button size="xs" onClick={() => setStatus.mutate({ userId: r.user_id, status: "ativo" })}>
                        <Unlock className="mr-1 h-3 w-3" /> Ativar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      
      {/* Mobile view */}
      <div className="sm:hidden space-y-3 px-1">
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-xs italic">{emptyMsg}</p>
        ) : (
          data.map((r) => {
            const isSelf = r.user_id === user?.id;
            return (
              <Card key={r.user_id} className="shadow-none border-border/50 bg-card/40">
                <CardContent className="p-3 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                       <div className="font-black text-xs uppercase flex items-center gap-2">
                         {r.username ?? "-"}
                         {r.isSuperAdmin && <Badge className="h-4 text-[8px] uppercase font-black">admin</Badge>}
                       </div>
                       <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{r.email}</div>
                    </div>
                    {r.status === "ativo" ? (
                      <Badge variant="secondary" className="h-4 text-[8px] uppercase font-black">ativo</Badge>
                    ) : (
                      <Badge variant="destructive" className="h-4 text-[8px] uppercase font-black">bloqueado</Badge>
                    )}
                  </div>
                  
                  {r.customerName && (
                    <div className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded font-black uppercase italic border border-blue-100">
                      Cliente: {r.customerName}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-black uppercase">
                    <Calendar className="h-3 w-3" />
                    Desde {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </div>

                  {!isSelf && !r.isSuperAdmin && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                       <Button size="xs" variant="outline" className="h-8 text-[9px] font-black uppercase" onClick={() => { setCustomerUser(r); setIsCustomerDialogOpen(true); }}>
                         <Users className="mr-1 h-3 w-3" /> Cliente
                       </Button>
                       <Button size="xs" variant="outline" className="h-8 text-[9px] font-black uppercase" onClick={() => setLinkUser(r)}>
                         <Building2 className="mr-1 h-3 w-3" /> Empresas
                       </Button>
                       {r.status === "ativo" ? (
                         <Button size="xs" variant="destructive" className="h-8 text-[9px] font-black uppercase col-span-2" onClick={() => setStatus.mutate({ userId: r.user_id, status: "bloqueado" })}>
                           <Lock className="mr-1 h-3 w-3" /> Bloquear Acesso
                         </Button>
                       ) : (
                         <Button size="xs" variant="default" className="h-8 text-[9px] font-black uppercase col-span-2" onClick={() => setStatus.mutate({ userId: r.user_id, status: "ativo" })}>
                           <Unlock className="mr-1 h-3 w-3" /> Ativar Usuário
                         </Button>
                       )}
                    </div>
                  )}
                  {isSelf && <div className="text-center text-[9px] font-black text-muted-foreground uppercase py-1 bg-muted/30 rounded italic">(Você)</div>}
                  {!isSelf && r.isSuperAdmin && <div className="text-center text-[9px] font-black text-muted-foreground uppercase py-1 bg-muted/30 rounded italic">Acesso Restrito</div>}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-50">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate("/empresas")} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-sm sm:text-lg font-black uppercase tracking-widest">Usuários</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

       <main className="w-full px-2 py-4 sm:px-6 sm:py-8 space-y-4 sm:space-y-6">
         <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
           <DialogContent className="sm:max-w-md p-4 sm:p-6">
             <DialogHeader>
               <DialogTitle className="text-sm sm:text-lg font-black uppercase tracking-widest">Vincular Cliente</DialogTitle>
               <DialogDescription className="text-xs sm:text-sm">
                 Vincule <strong>{customerUser?.username || customerUser?.email}</strong> a um cliente.
               </DialogDescription>
             </DialogHeader>
             <div className="py-4">
               <Select 
                 value={customerUser?.customer_id || "none"} 
                 onValueChange={(val) => setCustomerMutation.mutate({ userId: customerUser!.user_id, customerId: val === "none" ? null : val })}
               >
                 <SelectTrigger className="h-10 text-xs font-bold uppercase">
                   <SelectValue placeholder="Selecione um cliente" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="none" className="text-xs font-bold uppercase">Acesso padrão (Nenhum)</SelectItem>
                   {allCustomers.map(c => (
                     <SelectItem key={c.id} value={c.id} className="text-xs font-bold uppercase">{c.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <DialogFooter className="flex sm:flex-row gap-2">
               <Button variant="outline" size="sm" className="flex-1 sm:flex-none uppercase font-black text-[10px]" onClick={() => setIsCustomerDialogOpen(false)}>Fechar</Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
  
        <Dialog open={!!linkUser} onOpenChange={(open) => !open && setLinkUser(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-lg font-black uppercase tracking-widest">Gerenciar Empresas</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Acesso de <strong>{linkUser?.username}</strong>.
              </DialogDescription>
            </DialogHeader>
            
            <div className="relative my-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar empresa..." 
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
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
                      const isLinked = userLinks.includes(c.id);
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
                              disabled={toggleLink.isPending}
                              className="h-8 uppercase font-black text-[9px]"
                              onClick={() => toggleLink.mutate({ 
                                userId: linkUser!.user_id, 
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
              <Button size="sm" className="w-full sm:w-auto uppercase font-black text-[10px]" onClick={() => setLinkUser(null)}>Finalizar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <Card className="shadow-sm border-border/60 overflow-hidden">
              <CardHeader className="p-4 sm:p-6 border-b bg-muted/5">
                <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  Ativos <Badge variant="secondary" className="h-5 ml-1">{rows.filter(r => r.status === "ativo").length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                {renderTable(rows.filter(r => r.status === "ativo"), "Nenhum usuário ativo.")}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60 overflow-hidden">
              <CardHeader className="p-4 sm:p-6 border-b bg-muted/5">
                <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-2 text-rose-600">
                  Bloqueados <Badge variant="destructive" className="h-5 ml-1">{rows.filter(r => r.status === "bloqueado").length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                {renderTable(rows.filter(r => r.status === "bloqueado"), "Nenhum usuário bloqueado.")}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}