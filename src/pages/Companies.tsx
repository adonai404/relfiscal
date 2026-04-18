import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, LayoutDashboard, Layers, LogOut, Plus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useUserRole } from "@/hooks/useUserRole";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatCNPJ } from "@/lib/format";

export default function Companies() {
  const { user, loading, signOut } = useAuth();
  const { companies, loadingCompanies, setSelectedCompany, refetch } = useCompany();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cnpj: "", razao_social: "", nome_fantasia: "", uf: "" });
  const [creating, setCreating] = useState(false);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const select = (c: typeof companies[number]) => {
    setSelectedCompany(c);
    navigate("/movimento");
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { error } = await supabase.from("companies").insert({
      ...form,
      created_by: user.id,
    } as never);
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Empresa criada");
    setOpen(false);
    setForm({ cnpj: "", razao_social: "", nome_fantasia: "", uf: "" });
    qc.invalidateQueries({ queryKey: ["companies"] });
    refetch();
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Selecionar Empresa</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </Button>
            )}
            <Button variant="default" size="sm" onClick={() => navigate("/combo")}>
              <Layers className="mr-2 h-4 w-4" /> Combo
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Suas empresas</h2>
            <p className="text-sm text-muted-foreground">Escolha uma empresa para gerenciar o movimento fiscal</p>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Nova empresa</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Cadastrar empresa</DialogTitle></DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>CNPJ</Label>
                    <Input required value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Razão Social</Label>
                    <Input required value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome Fantasia</Label>
                    <Input required value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Input required maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={creating}>
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loadingCompanies ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {isAdmin ? "Nenhuma empresa ainda. Cadastre a primeira." : "Nenhuma empresa vinculada a você. Peça ao administrador."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Card key={c.id} className="cursor-pointer transition hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5" onClick={() => select(c)}>
                <CardHeader>
                  <CardTitle className="text-lg">{c.nome_fantasia}</CardTitle>
                  <CardDescription className="line-clamp-1">{c.razao_social}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <div>CNPJ: {formatCNPJ(c.cnpj)}</div>
                  <div>UF: {c.uf}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
