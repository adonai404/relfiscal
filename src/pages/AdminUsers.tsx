import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Lock, Unlock, Users, Building2, Search, X, Check } from "lucide-react";
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

   const [linkUser, setLinkUser] = useState<(Row & { customerName: string | null }) | null>(null);
   const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
   const [customerUser, setCustomerUser] = useState<(Row & { customerName: string | null }) | null>(null);
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

  const ativos = rows.filter((r) => r.status === "ativo");
  const bloqueados = rows.filter((r) => r.status === "bloqueado");

   const renderTable = (data: (Row & { customerName: string | null })[], emptyMsg: string) => (
    <Table>
      <TableHeader>
        <TableRow>
           <TableHead>Usuário / Cliente</TableHead>
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
                     {r.isSuperAdmin && <Badge className="ml-2">super admin</Badge>}
                   </div>
                   {r.customerName && (
                     <div className="text-xs text-blue-600 font-medium">Cliente: {r.customerName}</div>
                   )}
                 </TableCell>
                   {!isSelf && !r.isSuperAdmin && (
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => {
                         setCustomerUser(r);
                         setIsCustomerDialogOpen(true);
                       }}
                     >
                       <Users className="mr-1 h-4 w-4" /> Cliente
                     </Button>
                   )}
                <TableCell className="text-muted-foreground">{r.email ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  {r.status === "ativo" ? (
                    <Badge variant="secondary">ativo</Badge>
                  ) : (
                    <Badge variant="destructive">bloqueado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2 flex items-center justify-end">
                  {!isSelf && !r.isSuperAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLinkUser(r)}
                    >
                      <Building2 className="mr-1 h-4 w-4" /> Empresas
                    </Button>
                  )}
                  {isSelf || r.isSuperAdmin ? (
                    <span className="text-xs text-muted-foreground">{isSelf ? "(você)" : "—"}</span>
                  ) : r.status === "ativo" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setStatus.mutate({ userId: r.user_id, status: "bloqueado" })}
                    >
                      <Lock className="mr-1 h-4 w-4" /> Bloquear
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setStatus.mutate({ userId: r.user_id, status: "ativo" })}>
                      <Unlock className="mr-1 h-4 w-4" /> Ativar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/empresas")} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Gerenciar Usuários</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

       <main className="w-full px-4 py-8 sm:px-6 space-y-6">
         <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Vincular Usuário a um Cliente</DialogTitle>
               <DialogDescription>
                 Selecione um cliente para vincular ao usuário <strong>{customerUser?.username || customerUser?.email}</strong>.
                 Isso permitirá que o usuário visualize as empresas vinculadas a este cliente.
               </DialogDescription>
             </DialogHeader>
             <div className="py-4">
               <Select 
                 value={customerUser?.customer_id || "none"} 
                 onValueChange={(val) => setCustomerMutation.mutate({ userId: customerUser!.user_id, customerId: val === "none" ? null : val })}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione um cliente" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="none">Nenhum cliente (Acesso padrão)</SelectItem>
                   {allCustomers.map(c => (
                     <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setIsCustomerDialogOpen(false)}>Fechar</Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
 
        <Dialog open={!!linkUser} onOpenChange={(open) => !open && setLinkUser(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Vincular Empresas</DialogTitle>
              <DialogDescription>
                Gerencie o acesso de <strong>{linkUser?.username || linkUser?.email}</strong> às empresas.
              </DialogDescription>
            </DialogHeader>
            
            <div className="relative my-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar empresa..." 
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-auto border rounded-md">
              <Table>
                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-center py-8 text-muted-foreground">
                        Nenhuma empresa encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map(c => {
                      const isLinked = userLinks.includes(c.id);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.nome_fantasia}</div>
                            <div className="text-xs text-muted-foreground">{c.razao_social} • {c.cnpj}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={isLinked ? "outline" : "default"}
                              disabled={toggleLink.isPending}
                              onClick={() => toggleLink.mutate({ 
                                userId: linkUser!.user_id, 
                                companyId: c.id, 
                                linked: isLinked 
                              })}
                            >
                              {isLinked ? (
                                <><X className="mr-1 h-3 w-3" /> Remover</>
                              ) : (
                                <><Check className="mr-1 h-3 w-3" /> Vincular</>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button onClick={() => setLinkUser(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Usuários ativos ({ativos.length})</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(ativos, "Nenhum usuário ativo.")}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Usuários bloqueados
                  {bloqueados.length > 0 && <Badge variant="destructive">{bloqueados.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderTable(bloqueados, "Nenhum usuário bloqueado.")}</CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
