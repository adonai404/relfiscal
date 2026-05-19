 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { ArrowLeft, Loader2, Users, Building2, Search, X, Check, UserPlus, Trash2, Plus, UserCircle } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
       // 1. Create the auth user
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
 
       // 2. The profile is usually created by a trigger, but we need to update it with the customer_id
       // We might need to wait a bit or use a retry logic if the trigger hasn't finished
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
       <header className="border-b bg-card/60 backdrop-blur">
         <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
           <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" onClick={() => navigate("/app")} aria-label="Voltar">
               <ArrowLeft className="h-4 w-4" />
             </Button>
             <Users className="h-5 w-5 text-primary" />
             <h1 className="text-lg font-semibold">Gerenciar Clientes</h1>
           </div>
           <div className="flex items-center gap-2">
             <ThemeToggle />
             <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
               <Plus className="h-4 w-4" /> Novo Cliente
             </Button>
           </div>
         </div>
       </header>
 
       <main className="w-full px-4 py-8 sm:px-6 space-y-6 max-w-7xl mx-auto">
         <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
           <div className="relative w-full sm:max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="Pesquisar clientes..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-9"
             />
           </div>
         </div>
 
         <Card>
           <CardContent className="p-0">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Nome</TableHead>
                   <TableHead>Email</TableHead>
                   <TableHead>Telefone</TableHead>
                   <TableHead>Data Cadastro</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {isLoading ? (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center py-8">
                       <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                     </TableCell>
                   </TableRow>
                 ) : filteredCustomers.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                       Nenhum cliente encontrado.
                     </TableCell>
                   </TableRow>
                 ) : (
                   filteredCustomers.map((c) => (
                     <TableRow key={c.id}>
                       <TableCell className="font-medium">{c.name}</TableCell>
                       <TableCell className="text-muted-foreground">{c.email || "-"}</TableCell>
                       <TableCell className="text-muted-foreground">{c.phone || "-"}</TableCell>
                       <TableCell className="text-muted-foreground text-sm">
                         {new Date(c.created_at).toLocaleDateString("pt-BR")}
                       </TableCell>
                       <TableCell className="text-right space-x-2">
                         <div className="flex gap-2 justify-end">
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => {
                               setSelectedCustomerForUser(c);
                               setIsCreateUserOpen(true);
                             }}
                             title="Criar acesso para este cliente"
                           >
                             <UserPlus className="mr-1 h-4 w-4" /> Usuário
                           </Button>
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => setLinkingCustomer(c)}
                           >
                             <Building2 className="mr-1 h-4 w-4" /> Empresas
                           </Button>
                         </div>
 
       {/* Dialog: Criar Usuário para Cliente */}
       <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Criar Acesso para Cliente</DialogTitle>
             <DialogDescription>
               Crie um login para <strong>{selectedCustomerForUser?.name}</strong>. 
               Ele poderá acessar apenas as empresas vinculadas a este cliente.
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label htmlFor="reg-username">Nome de Usuário</Label>
               <Input 
                 id="reg-username" 
                 placeholder="ex: joaosilva"
                 value={newUser.username} 
                 onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="reg-email">Email</Label>
               <Input 
                 id="reg-email" 
                 type="email"
                 placeholder="cliente@email.com"
                 value={newUser.email} 
                 onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="reg-password">Senha Temporária</Label>
               <Input 
                 id="reg-password" 
                 type="password"
                 value={newUser.password} 
                 onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsCreateUserOpen(false)}>Cancelar</Button>
             <Button 
               onClick={createUserForCustomer} 
               disabled={isCreatingUser || !newUser.username || !newUser.email || !newUser.password}
             >
               {isCreatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Acesso"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
                         <Button
                           size="sm"
                           variant="ghost"
                           className="text-destructive hover:text-destructive hover:bg-destructive/10"
                           onClick={() => {
                             if (confirm("Deseja realmente excluir este cliente?")) {
                               deleteCustomer.mutate(c.id);
                             }
                           }}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))
                 )}
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       </main>
 
       {/* Dialog: Novo Cliente */}
       <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Novo Cliente</DialogTitle>
             <DialogDescription>Cadastre as informações básicas do novo cliente.</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label htmlFor="name">Nome completo</Label>
               <Input 
                 id="name" 
                 value={newCustomer.name} 
                 onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="email">Email (opcional)</Label>
               <Input 
                 id="email" 
                 type="email"
                 value={newCustomer.email} 
                 onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="phone">Telefone (opcional)</Label>
               <Input 
                 id="phone" 
                 value={newCustomer.phone} 
                 onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
             <Button onClick={() => createCustomer.mutate(newCustomer)} disabled={!newCustomer.name}>Criar</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Dialog: Vincular Empresas ao Cliente */}
       <Dialog open={!!linkingCustomer} onOpenChange={(open) => !open && setLinkingCustomer(null)}>
         <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
           <DialogHeader>
             <DialogTitle>Vincular Empresas ao Cliente</DialogTitle>
             <DialogDescription>
               Gerencie quais empresas pertencem ao cliente <strong>{linkingCustomer?.name}</strong>.
             </DialogDescription>
           </DialogHeader>
           
           <div className="relative my-2">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="Pesquisar empresa..." 
               value={companySearch}
               onChange={(e) => setCompanySearch(e.target.value)}
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
                     const isLinked = customerLinks.includes(c.id);
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
                             disabled={toggleCompanyLink.isPending}
                             onClick={() => toggleCompanyLink.mutate({ 
                               customerId: linkingCustomer!.id, 
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
             <Button onClick={() => setLinkingCustomer(null)}>Fechar</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }