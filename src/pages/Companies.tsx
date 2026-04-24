import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, LayoutDashboard, Layers, LogOut, Plus, Loader2, Search, Users, FileSpreadsheet, Trash2, LayoutGrid, List, Rows3, Presentation as PresentationIcon, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { CompanyTagsPicker, CompanyTagsChips } from "@/components/CompanyTagsPicker";
import { Tag as TagIcon } from "lucide-react";

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
  const [toDelete, setToDelete] = useState<typeof companies[number] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toEdit, setToEdit] = useState<typeof companies[number] | null>(null);
  const [editForm, setEditForm] = useState({ cnpj: "", razao_social: "", nome_fantasia: "", uf: "", regime: "simples_nacional" });
  const [updating, setUpdating] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "table">(
    () => (typeof window !== "undefined" && (localStorage.getItem("companies:view") as any)) || "grid"
  );

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("companies:view", viewMode);
  }, [viewMode]);

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

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("companies").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Empresa excluída");
    setToDelete(null);
    qc.invalidateQueries({ queryKey: ["companies"] });
    refetch();
  };

  const openEdit = (c: typeof companies[number]) => {
    setEditForm({
      cnpj: c.cnpj ?? "",
      razao_social: c.razao_social ?? "",
      nome_fantasia: c.nome_fantasia ?? "",
      uf: c.uf ?? "",
      regime: ((c as any).regime as string) ?? "simples_nacional",
    });
    setToEdit(c);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEdit) return;
    setUpdating(true);
    const { error } = await supabase
      .from("companies")
      .update(editForm as never)
      .eq("id", toEdit.id);
    setUpdating(false);
    if (error) return toast.error(error.message);
    toast.success("Empresa atualizada");
    setToEdit(null);
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
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
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
            <Button variant="outline" size="sm" onClick={() => navigate("/apresentacao")}>
              <PresentationIcon className="mr-2 h-4 w-4" /> Apresentação
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

      <main className="w-full px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Suas empresas</h2>
            <p className="text-sm text-muted-foreground">Escolha uma empresa para gerenciar o movimento fiscal</p>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setBatchOpen(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Importação
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
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, CNPJ, UF ou regime..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {filtered.length} {filtered.length === 1 ? "empresa" : "empresas"}
            </span>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as any)}
              variant="outline"
              size="sm"
              aria-label="Modo de visualização"
            >
              <ToggleGroupItem value="grid" aria-label="Cartões"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Lista"><Rows3 className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Tabela"><List className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
          </div>
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
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((c) => {
              const regime = (c as any).regime as string | undefined;
              const canDelete = isSuperAdmin || (c as any).created_by === user.id;
              return (
                <Card key={c.id} className="cursor-pointer transition hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5" onClick={() => select(c)}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{c.nome_fantasia}</CardTitle>
                        <CardDescription className="line-clamp-1">{c.razao_social}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {regime && (
                          <Badge variant="secondary">{regimeLabels[regime] ?? regime}</Badge>
                        )}
                        <CompanyTagsPicker
                          companyId={c.id}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Gerenciar tags"
                            >
                              <TagIcon className="h-4 w-4" />
                            </Button>
                          }
                        />
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setToDelete(c); }}
                            aria-label="Excluir empresa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <div>CNPJ: {formatCNPJ(c.cnpj)}</div>
                    <div>UF: {c.uf}</div>
                    <div className="pt-1"><CompanyTagsChips companyId={c.id} /></div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : viewMode === "list" ? (
          <div className="flex flex-col divide-y rounded-lg border bg-card">
            {filtered.map((c) => {
              const regime = (c as any).regime as string | undefined;
              const canDelete = isSuperAdmin || (c as any).created_by === user.id;
              return (
                <div
                  key={c.id}
                  onClick={() => select(c)}
                  className="group flex cursor-pointer items-center gap-4 px-4 py-3 transition hover:bg-accent/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{c.nome_fantasia}</span>
                      {regime && <Badge variant="secondary" className="shrink-0">{regimeLabels[regime] ?? regime}</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.razao_social} · CNPJ {formatCNPJ(c.cnpj)} · {c.uf}
                    </div>
                    <div className="mt-1"><CompanyTagsChips companyId={c.id} /></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <CompanyTagsPicker
                      companyId={c.id}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" aria-label="Gerenciar tags">
                          <TagIcon className="h-4 w-4" />
                        </Button>
                      }
                    />
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setToDelete(c)}
                        aria-label="Excluir empresa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead className="w-16">UF</TableHead>
                  <TableHead>Regime</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const regime = (c as any).regime as string | undefined;
                  const canDelete = isSuperAdmin || (c as any).created_by === user.id;
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => select(c)}>
                      <TableCell className="font-medium">{c.nome_fantasia}</TableCell>
                      <TableCell className="text-muted-foreground">{c.razao_social}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCNPJ(c.cnpj)}</TableCell>
                      <TableCell>{c.uf}</TableCell>
                      <TableCell>
                        {regime && <Badge variant="secondary">{regimeLabels[regime] ?? regime}</Badge>}
                      </TableCell>
                      <TableCell><CompanyTagsChips companyId={c.id} /></TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <CompanyTagsPicker
                            companyId={c.id}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" aria-label="Gerenciar tags">
                                <TagIcon className="h-4 w-4" />
                              </Button>
                            }
                          />
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setToDelete(c)}
                              aria-label="Excluir empresa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <BatchImportDialog open={batchOpen} onOpenChange={setBatchOpen} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{toDelete?.nome_fantasia}</strong>? Todos os movimentos fiscais e configurações vinculados também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
