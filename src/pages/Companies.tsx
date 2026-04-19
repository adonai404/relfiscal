import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, LayoutDashboard, Layers, LogOut, Plus, Loader2, Search, Users, FileSpreadsheet } from "lucide-react";
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
import { useProfile } from "@/hooks/useProfile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BatchImportDialog } from "@/components/BatchImportDialog";
import { formatCNPJ } from "@/lib/format";

export default function Companies() {
  const { user, loading, signOut } = useAuth();
  const { companies, loadingCompanies, setSelectedCompany, refetch } = useCompany();
  const { isSuperAdmin } = useUserRole();
  const { isActive } = useProfile();
  const canCreate = isActive || isSuperAdmin;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [form, setForm] = useState({ cnpj: "", razao_social: "", nome_fantasia: "", uf: "", regime: "simples_nacional" });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

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
    setForm({ cnpj: "", razao_social: "", nome_fantasia: "", uf: "", regime: "simples_nacional" });
    qc.invalidateQueries({ queryKey: ["companies"] });
    refetch();
  };

  const regimeLabels: Record<string, string> = {
    simples_nacional: "Simples Nacional",
    lucro_presumido: "Lucro Presumido",
    lucro_real: "Lucro Real",
    mei: "MEI",
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? companies.filter((c) =>
        [c.nome_fantasia, c.razao_social, c.cnpj, c.uf, (c as any).regime ? regimeLabels[(c as any).regime] : ""]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : companies;

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
            {isSuperAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/usuarios")}>
                <Users className="mr-2 h-4 w-4" /> Usuários
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </Button>
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
          {canCreate && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setBatchOpen(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Importar planilha
              </Button>
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
                  <div className="space-y-1.5">
                    <Label>Regime Tributário</Label>
                    <Select value={form.regime} onValueChange={(v) => setForm({ ...form, regime: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                        <SelectItem value="mei">MEI</SelectItem>
                      </SelectContent>
                    </Select>
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

        <div className="mb-4 relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, CNPJ, UF ou regime..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loadingCompanies ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {canCreate ? "Nenhuma empresa ainda. Cadastre a primeira." : "Sua conta está bloqueada. Contate o administrador."}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma empresa encontrada para "{search}".
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const regime = (c as any).regime as string | undefined;
              return (
                <Card key={c.id} className="cursor-pointer transition hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5" onClick={() => select(c)}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{c.nome_fantasia}</CardTitle>
                        <CardDescription className="line-clamp-1">{c.razao_social}</CardDescription>
                      </div>
                      {regime && (
                        <Badge variant="secondary" className="shrink-0">{regimeLabels[regime] ?? regime}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <div>CNPJ: {formatCNPJ(c.cnpj)}</div>
                    <div>UF: {c.uf}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
