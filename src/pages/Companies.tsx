import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
   Building2, LayoutDashboard, Layers, LogOut, Plus, Loader2, Search, Users, FileSpreadsheet,
   Trash2, LayoutGrid, List, Rows3, Presentation as PresentationIcon, Pencil, Folder, FolderPlus,
   FolderOpen, MoreVertical, Copy, Archive, ArchiveRestore, Power, PowerOff, Inbox, Tag as TagIcon,
   ChevronLeft
} from "lucide-react";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany, type Company } from "@/hooks/useCompany";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfile } from "@/hooks/useProfile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BatchImportDialog } from "@/components/BatchImportDialog";
import { formatCNPJ } from "@/lib/format";
import { CompanyTagsPicker, CompanyTagsChips } from "@/components/CompanyTagsPicker";
import { cn } from "@/lib/utils";

type CompanyStatus = "ativa" | "inativa" | "arquivada";

interface FolderRow {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
  position: number;
}

const STATUS_LABELS: Record<CompanyStatus, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  arquivada: "Arquivada",
};

const STATUS_BADGE_CLASSES: Record<CompanyStatus, string> = {
  ativa: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
  inativa: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
  arquivada: "bg-muted text-muted-foreground border-border",
};

export default function Companies() {
  const { user, loading, signOut } = useAuth();
  const { companies, loadingCompanies, setSelectedCompany, refetch } = useCompany();
  const { isSuperAdmin } = useUserRole();
  const { profile, isActive } = useProfile();
  const isCustomer = !!profile?.customer_id;
  const canCreate = (isActive || isSuperAdmin) && !isCustomer;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [form, setForm] = useState({ cnpj: "", razao_social: "", nome_fantasia: "", uf: "", regime: "simples_nacional" });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompanyStatus>("ativa");
  const [activeFolder, setActiveFolder] = useState<string | "all" | "none">("all");

  const [toDelete, setToDelete] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toEdit, setToEdit] = useState<Company | null>(null);
  const [editForm, setEditForm] = useState({ cnpj: "", razao_social: "", nome_fantasia: "", uf: "", regime: "simples_nacional" });
  const [updating, setUpdating] = useState(false);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderForm, setFolderForm] = useState({ name: "", color: "#3B82F6" });
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<FolderRow | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderRow | null>(null);

  const [draggedCompany, setDraggedCompany] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | "none" | null>(null);

  const [viewMode, setViewMode] = useState<"grid" | "list" | "table">(
    () => (typeof window !== "undefined" && (localStorage.getItem("companies:view") as any)) || "grid"
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("companies:view", viewMode);
      // Auto switch from table to grid on small screens
      if (viewMode === "table" && window.innerWidth < 640) {
        setViewMode("grid");
      }
    }
  }, [viewMode]);

  // Folders query
  const { data: folders = [] } = useQuery({
    queryKey: ["company_folders", user?.id, isSuperAdmin],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("company_folders" as any)
        .select("id, name, color, created_by, position")
        .order("position")
        .order("name");
      if (!isSuperAdmin) query = query.eq("created_by", user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as FolderRow[];
    },
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

    const select = (c: Company) => {
      setSelectedCompany(c);
      const searchParams = new URLSearchParams(window.location.search);
      const redirectTo = searchParams.get("redirect");
      if (redirectTo) {
        navigate(redirectTo);
      } else {
        navigate(`/movimento?company=${c.id}`);
      }
    };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const payload: any = { ...form, created_by: user.id };
    if (activeFolder !== "all" && activeFolder !== "none") payload.folder_id = activeFolder;
    const { error } = await supabase.from("companies").insert(payload as never);
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

  const openEdit = (c: Company) => {
    setEditForm({
      cnpj: c.cnpj ?? "",
      razao_social: c.razao_social ?? "",
      nome_fantasia: c.nome_fantasia ?? "",
      uf: c.uf ?? "",
      regime: (c.regime as string) ?? "simples_nacional",
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

  const updateStatus = async (c: Company, status: CompanyStatus) => {
    const { error } = await supabase
      .from("companies")
      .update({ status } as never)
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(`Empresa marcada como ${STATUS_LABELS[status]}`);
    qc.invalidateQueries({ queryKey: ["companies"] });
    refetch();
  };

  const moveToFolder = async (companyId: string, folderId: string | null) => {
    const { error } = await supabase
      .from("companies")
      .update({ folder_id: folderId } as never)
      .eq("id", companyId);
    if (error) return toast.error(error.message);
    toast.success(folderId ? "Empresa movida" : "Empresa removida da pasta");
    qc.invalidateQueries({ queryKey: ["companies"] });
    refetch();
  };

   const duplicateCompany = async (c: Company) => {
     const loadingToast = toast.loading("Duplicando empresa e todos os seus dados...");
     try {
       const baseName = c.nome_fantasia;
       const newName = `${baseName} (cópia)`;
       const cnpjBase = c.cnpj.replace(/\D/g, "");
       const suffix = Math.floor(Math.random() * 9000 + 1000);
       const newCnpj = `${cnpjBase.slice(0, 10)}${suffix}`;
 
       const { data: newCompany, error: companyError } = await supabase
         .from("companies")
         .insert({
           cnpj: newCnpj,
           razao_social: `${c.razao_social} (cópia)`,
           nome_fantasia: newName,
           uf: c.uf,
           regime: c.regime ?? "simples_nacional",
           status: c.status ?? "ativa",
           folder_id: c.folder_id ?? null,
           created_by: user.id,
         } as never)
         .select()
         .single();
 
       if (companyError) throw companyError;
       const newId = newCompany.id;
 
       const [fiscalConfigRes, customColsRes, movementsRes, tagsRes] = await Promise.all([
         supabase.from("fiscal_config").select("*").eq("company_id", c.id).maybeSingle(),
         (supabase as any).from("custom_columns").select("*").eq("company_id", c.id),
         supabase.from("fiscal_movement").select("*").eq("company_id", c.id),
         (supabase as any).from("company_tags").select("*").eq("company_id", c.id),
       ]);
 
       const promises: any[] = [];
 
        if (fiscalConfigRes.data) {
          // O trigger create_default_fiscal_config já criou um fiscal_config em branco
          // para a nova empresa. Precisamos ATUALIZAR essa linha em vez de inserir
          // (insert seria ignorado pelo ON CONFLICT DO NOTHING do trigger).
          const { id: _, company_id: __, created_at: ___, updated_at: ____, ...configData } = fiscalConfigRes.data;
          promises.push(
            supabase
              .from("fiscal_config")
              .update(configData as never)
              .eq("company_id", newId)
              .then(({ error }) => { if (error) throw error; })
          );
        }
 
       const customColIdMap: Record<string, string> = {};
       if (customColsRes.data?.length) {
         for (const col of customColsRes.data) {
           const { id: oldId, company_id: _, created_at: __, ...colData } = col;
           const { data: newCol, error: colErr } = await (supabase as any)
             .from("custom_columns")
             .insert({ ...colData, company_id: newId })
             .select()
             .single();
           if (!colErr && newCol) customColIdMap[oldId] = newCol.id;
         }
       }
 
       if (movementsRes.data?.length) {
         for (const mov of movementsRes.data) {
           const { id: oldMovId, company_id: _, created_at: __, ...movData } = mov;
           const { data: newMov, error: movErr } = await supabase
             .from("fiscal_movement")
             .insert({ ...movData, company_id: newId } as never)
             .select()
             .single();
 
           if (!movErr && newMov) {
             const { data: customValues } = await (supabase as any)
               .from("custom_column_values")
               .select("*")
               .eq("movement_id", oldMovId);
 
             if (customValues?.length) {
               const newValues = customValues
                 .map((v: any) => ({
                   movement_id: newMov.id,
                   column_id: customColIdMap[v.column_id],
                   value: v.value,
                 }))
                 .filter((v: any) => v.column_id);
 
               if (newValues.length) {
                 promises.push((supabase as any).from("custom_column_values").insert(newValues).then(({ error }: any) => { if (error) throw error; }));
               }
             }
           }
         }
       }
 
       if (tagsRes.data?.length) {
         const newTags = tagsRes.data.map((t: any) => ({ company_id: newId, tag_id: t.tag_id }));
         promises.push((supabase as any).from("company_tags").insert(newTags).then(({ error }: any) => { if (error) throw error; }));
       }
 
       await Promise.all(promises);
       toast.success("Empresa e dados duplicados com sucesso", { id: loadingToast });
       qc.invalidateQueries({ queryKey: ["companies"] });
       refetch();
     } catch (err: any) {
       console.error("Duplication error:", err);
       toast.error("Erro ao duplicar dados: " + err.message, { id: loadingToast });
     }
   };

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingFolder(true);
    if (folderToEdit) {
      const { error } = await supabase
        .from("company_folders" as any)
        .update({ name: folderForm.name, color: folderForm.color } as never)
        .eq("id", folderToEdit.id);
      setCreatingFolder(false);
      if (error) return toast.error(error.message);
      toast.success("Pasta atualizada");
    } else {
      const { error } = await supabase
        .from("company_folders" as any)
        .insert({ name: folderForm.name, color: folderForm.color, created_by: user.id } as never);
      setCreatingFolder(false);
      if (error) return toast.error(error.message);
      toast.success("Pasta criada");
    }
    setFolderDialogOpen(false);
    setFolderToEdit(null);
    setFolderForm({ name: "", color: "#3B82F6" });
    qc.invalidateQueries({ queryKey: ["company_folders"] });
  };

  const deleteFolder = async () => {
    if (!folderToDelete) return;
    const { error } = await supabase
      .from("company_folders" as any)
      .delete()
      .eq("id", folderToDelete.id);
    if (error) return toast.error(error.message);
    toast.success("Pasta excluída");
    if (activeFolder === folderToDelete.id) setActiveFolder("all");
    setFolderToDelete(null);
    qc.invalidateQueries({ queryKey: ["company_folders"] });
    qc.invalidateQueries({ queryKey: ["companies"] });
    refetch();
  };

  const openEditFolder = (f: FolderRow) => {
    setFolderToEdit(f);
    setFolderForm({ name: f.name, color: f.color });
    setFolderDialogOpen(true);
  };

  const openCreateFolder = () => {
    setFolderToEdit(null);
    setFolderForm({ name: "", color: "#3B82F6" });
    setFolderDialogOpen(true);
  };

  const regimeLabels: Record<string, string> = {
    simples_nacional: "Simples Nacional",
    lucro_presumido: "Lucro Presumido",
    lucro_real: "Lucro Real",
    mei: "MEI",
  };

  // Counts per status (respecting folder filter)
  const statusCounts = useMemo(() => {
    const inFolder = companies.filter((c) => {
      if (activeFolder === "all") return true;
      if (activeFolder === "none") return !c.folder_id;
      return c.folder_id === activeFolder;
    });
    return {
      ativa: inFolder.filter((c) => (c.status ?? "ativa") === "ativa").length,
      inativa: inFolder.filter((c) => c.status === "inativa").length,
      arquivada: inFolder.filter((c) => c.status === "arquivada").length,
    };
  }, [companies, activeFolder]);

  const folderCounts = useMemo(() => {
    const map: Record<string, number> = { all: 0, none: 0 };
    for (const c of companies) {
      if ((c.status ?? "ativa") !== statusFilter) continue;
      map.all++;
      if (!c.folder_id) map.none++;
      else map[c.folder_id] = (map[c.folder_id] ?? 0) + 1;
    }
    return map;
  }, [companies, statusFilter]);

  const q = search.trim().toLowerCase();
  const filtered = companies.filter((c) => {
    if ((c.status ?? "ativa") !== statusFilter) return false;
    if (activeFolder === "none" && c.folder_id) return false;
    if (activeFolder !== "all" && activeFolder !== "none" && c.folder_id !== activeFolder) return false;
    if (!q) return true;
    return [c.nome_fantasia, c.razao_social, c.cnpj, c.uf, c.regime ? regimeLabels[c.regime] : ""]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const handleDragStart = (id: string) => setDraggedCompany(id);
  const handleDragEnd = () => { setDraggedCompany(null); setDragOverFolder(null); };
  const handleDropOnFolder = (folderId: string | null) => {
    if (!draggedCompany) return;
    moveToFolder(draggedCompany, folderId);
    setDraggedCompany(null);
    setDragOverFolder(null);
  };

  const renderCompanyActions = (c: Company) => {
    if (isCustomer) return null;
    const canEdit = isSuperAdmin || c.created_by === user.id;
    const status = (c.status ?? "ativa") as CompanyStatus;
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <CompanyTagsPicker
          companyId={c.id}
          trigger={
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-primary" aria-label="Gerenciar tags">
              <TagIcon className="h-4 w-4" />
            </Button>
          }
        />
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-primary" aria-label="Mais ações">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <DropdownMenuItem onClick={() => openEdit(c)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateCompany(c)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {status !== "ativa" && (
                <DropdownMenuItem onClick={() => updateStatus(c, "ativa")}>
                  <Power className="mr-2 h-4 w-4" /> Marcar como Ativa
                </DropdownMenuItem>
              )}
              {status !== "inativa" && (
                <DropdownMenuItem onClick={() => updateStatus(c, "inativa")}>
                  <PowerOff className="mr-2 h-4 w-4" /> Marcar como Inativa
                </DropdownMenuItem>
              )}
              {status !== "arquivada" ? (
                <DropdownMenuItem onClick={() => updateStatus(c, "arquivada")}>
                  <Archive className="mr-2 h-4 w-4" /> Arquivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => updateStatus(c, "ativa")}>
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Desarquivar
                </DropdownMenuItem>
              )}
              {folders.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-xs text-muted-foreground">Mover para</div>
                  {c.folder_id && (
                    <DropdownMenuItem onClick={() => moveToFolder(c.id, null)}>
                      <Inbox className="mr-2 h-4 w-4" /> Sem pasta
                    </DropdownMenuItem>
                  )}
                  {folders.filter((f) => f.id !== c.folder_id).map((f) => (
                    <DropdownMenuItem key={f.id} onClick={() => moveToFolder(c.id, f.id)}>
                      <Folder className="mr-2 h-4 w-4" style={{ color: f.color }} /> {f.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setToDelete(c)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
           <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" onClick={() => navigate("/app")} aria-label="Voltar">
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <Building2 className="h-5 w-5 text-primary" />
             <h1 className="text-lg font-semibold">Gerenciar Empresas</h1>
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

      <main className="w-full px-2 py-3 sm:px-6 sm:py-6 overflow-x-hidden">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Suas empresas</h2>
            <p className="text-[10px] sm:text-sm text-muted-foreground">Organize pastas e selecione uma para o movimento</p>
          </div>
          {canCreate && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Button variant="outline" size="xs" onClick={openCreateFolder} className="h-8 text-[10px] sm:h-9 sm:text-xs">
                <FolderPlus className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> Pasta
              </Button>
              <Button variant="outline" size="xs" onClick={() => setBatchOpen(true)} className="h-8 text-[10px] sm:h-9 sm:text-xs">
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> Importar
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="xs" className="h-8 text-[10px] sm:h-9 sm:text-xs"><Plus className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> Empresa</Button>
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

        <div className={cn("grid gap-4 sm:gap-6", !isCustomer ? "lg:grid-cols-[260px_1fr]" : "grid-cols-1")}>
          {/* Sidebar de pastas */}
          {!isCustomer && (
            <aside className="space-y-2">
            <div className="rounded-lg border bg-card p-2">
              <div className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pastas
              </div>
              <FolderItem
                icon={<LayoutGrid className="h-4 w-4" />}
                label="Todas as empresas"
                count={folderCounts.all}
                active={activeFolder === "all"}
                onClick={() => setActiveFolder("all")}
                onDragOver={(e) => e.preventDefault()}
              />
              <FolderItem
                icon={<Inbox className="h-4 w-4" />}
                label="Sem pasta"
                count={folderCounts.none}
                active={activeFolder === "none"}
                isDropTarget={dragOverFolder === "none"}
                onClick={() => setActiveFolder("none")}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolder("none"); }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={() => handleDropOnFolder(null)}
              />
              {folders.length > 0 && <div className="my-2 border-t" />}
              {folders.map((f) => (
                <FolderItem
                  key={f.id}
                  icon={<Folder className="h-4 w-4" style={{ color: f.color }} fill={f.color} fillOpacity={0.2} />}
                  label={f.name}
                  count={folderCounts[f.id] ?? 0}
                  active={activeFolder === f.id}
                  isDropTarget={dragOverFolder === f.id}
                  onClick={() => setActiveFolder(f.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverFolder(f.id); }}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={() => handleDropOnFolder(f.id)}
                  trailing={
                    (isSuperAdmin || f.created_by === user.id) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => openEditFolder(f)}>
                            <Pencil className="mr-2 h-4 w-4" /> Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setFolderToDelete(f)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir pasta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }
                />
              ))}
              {canCreate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-start text-muted-foreground"
                  onClick={openCreateFolder}
                >
                  <FolderPlus className="mr-2 h-4 w-4" /> Nova pasta
                </Button>
              )}
            </div>
          </aside>
          )}

          {/* Conteúdo */}
          <div className="min-w-0">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as CompanyStatus)} className="w-full sm:w-auto">
                <TabsList className="w-full sm:w-auto h-8 sm:h-10">
                  <TabsTrigger value="ativa" className="flex-1 sm:flex-initial text-[10px] sm:text-xs">Ativas <span className="ml-1 sm:ml-2 rounded-full bg-emerald-500/20 px-1 text-[9px] sm:text-[10px] text-emerald-700 dark:text-emerald-400">{statusCounts.ativa}</span></TabsTrigger>
                  <TabsTrigger value="inativa" className="flex-1 sm:flex-initial text-[10px] sm:text-xs">Inativas <span className="ml-1 sm:ml-2 rounded-full bg-amber-500/20 px-1 text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-400">{statusCounts.inativa}</span></TabsTrigger>
                  <TabsTrigger value="arquivada" className="flex-1 sm:flex-initial text-[10px] sm:text-xs">Arq. <span className="ml-1 sm:ml-2 rounded-full bg-muted px-1 text-[9px] sm:text-[10px]">{statusCounts.arquivada}</span></TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-full sm:max-w-[200px]">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
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
                  className="hidden sm:inline-flex"
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
                  Nenhuma empresa encontrada nesta visualização.
                </CardContent>
              </Card>
            ) : viewMode === "grid" ? (
              <div className="grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filtered.map((c) => {
                  const regime = c.regime;
                  const status = (c.status ?? "ativa") as CompanyStatus;
                  return (
                    <Card
                      key={c.id}
                      draggable
                      onDragStart={() => handleDragStart(c.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "cursor-pointer transition hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5",
                        draggedCompany === c.id && "opacity-50",
                      )}
                      onClick={() => select(c)}
                    >
                      <CardHeader className="p-3 sm:p-6 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-sm sm:text-lg truncate">{c.nome_fantasia}</CardTitle>
                            <CardDescription className="text-[10px] sm:text-xs line-clamp-1">{c.razao_social}</CardDescription>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="outline" className={cn(STATUS_BADGE_CLASSES[status], "h-5 text-[9px] sm:text-xs")}>
                              {STATUS_LABELS[status]}
                            </Badge>
                            {renderCompanyActions(c)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0 text-[11px] sm:text-sm text-muted-foreground space-y-1">
                        <div>CNPJ: {formatCNPJ(c.cnpj)}</div>
                        <div className="flex items-center gap-2">
                          <span>UF: {c.uf}</span>
                          {regime && <Badge variant="secondary" className="text-[10px]">{regimeLabels[regime] ?? regime}</Badge>}
                        </div>
                        {!isCustomer && c.folder_id && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Folder className="h-3 w-3" style={{ color: folders.find((f) => f.id === c.folder_id)?.color }} />
                            {folders.find((f) => f.id === c.folder_id)?.name ?? "Pasta"}
                          </div>
                        )}
                        {!isCustomer && <div className="pt-1"><CompanyTagsChips companyId={c.id} /></div>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : viewMode === "list" ? (
              <div className="flex flex-col divide-y rounded-lg border bg-card">
                {filtered.map((c) => {
                  const regime = c.regime;
                  const status = (c.status ?? "ativa") as CompanyStatus;
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => handleDragStart(c.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => select(c)}
                      className={cn(
                        "group flex cursor-pointer items-center gap-4 px-4 py-3 transition hover:bg-accent/50",
                        draggedCompany === c.id && "opacity-50",
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{c.nome_fantasia}</span>
                          <Badge variant="outline" className={STATUS_BADGE_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
                          {regime && <Badge variant="secondary" className="shrink-0">{regimeLabels[regime] ?? regime}</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.razao_social} · CNPJ {formatCNPJ(c.cnpj)} · {c.uf}
                          {c.folder_id && ` · 📁 ${folders.find((f) => f.id === c.folder_id)?.name ?? ""}`}
                        </div>
                        <div className="mt-1"><CompanyTagsChips companyId={c.id} /></div>
                      </div>
                      {renderCompanyActions(c)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border bg-card overflow-x-auto hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome Fantasia</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pasta</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead className="w-16">UF</TableHead>
                      <TableHead>Regime</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const regime = c.regime;
                      const status = (c.status ?? "ativa") as CompanyStatus;
                      const folder = folders.find((f) => f.id === c.folder_id);
                      return (
                        <TableRow
                          key={c.id}
                          draggable
                          onDragStart={() => handleDragStart(c.id)}
                          onDragEnd={handleDragEnd}
                          className={cn("cursor-pointer", draggedCompany === c.id && "opacity-50")}
                          onClick={() => select(c)}
                        >
                          <TableCell className="font-medium">
                            <div className="truncate">{c.nome_fantasia}</div>
                            <div className="truncate text-xs text-muted-foreground">{c.razao_social}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_BADGE_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
                          </TableCell>
                          <TableCell>
                            {folder ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <Folder className="h-3 w-3" style={{ color: folder.color }} />
                                {folder.name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formatCNPJ(c.cnpj)}</TableCell>
                          <TableCell>{c.uf}</TableCell>
                          <TableCell>
                            {regime && <Badge variant="secondary">{regimeLabels[regime] ?? regime}</Badge>}
                          </TableCell>
                          <TableCell><CompanyTagsChips companyId={c.id} /></TableCell>
                          <TableCell className="text-right">{renderCompanyActions(c)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </main>

      <BatchImportDialog open={batchOpen} onOpenChange={setBatchOpen} />

      {/* Folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={(o) => { setFolderDialogOpen(o); if (!o) setFolderToEdit(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{folderToEdit ? "Editar pasta" : "Nova pasta"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createFolder} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                required
                autoFocus
                value={folderForm.name}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                placeholder="Ex: Clientes 2025"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={folderForm.color}
                  onChange={(e) => setFolderForm({ ...folderForm, color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border"
                />
                <Input
                  value={folderForm.color}
                  onChange={(e) => setFolderForm({ ...folderForm, color: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)} disabled={creatingFolder}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creatingFolder}>
                {creatingFolder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {folderToEdit ? "Salvar" : "Criar pasta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit company dialog */}
      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar empresa</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input required value={editForm.cnpj} onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Razão Social</Label>
              <Input required value={editForm.razao_social} onChange={(e) => setEditForm({ ...editForm, razao_social: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome Fantasia</Label>
              <Input required value={editForm.nome_fantasia} onChange={(e) => setEditForm({ ...editForm, nome_fantasia: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input required maxLength={2} value={editForm.uf} onChange={(e) => setEditForm({ ...editForm, uf: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1.5">
              <Label>Regime Tributário</Label>
              <Select value={editForm.regime} onValueChange={(v) => setEditForm({ ...editForm, regime: v })}>
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
              <Button type="button" variant="outline" onClick={() => setToEdit(null)} disabled={updating}>Cancelar</Button>
              <Button type="submit" disabled={updating}>
                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

      <AlertDialog open={!!folderToDelete} onOpenChange={(o) => !o && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir a pasta <strong>{folderToDelete?.name}</strong>? As empresas dentro dela não serão excluídas — ficarão sem pasta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteFolder(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FolderItem({
  icon, label, count, active, isDropTarget, onClick, onDragOver, onDragLeave, onDrop, trailing,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active?: boolean;
  isDropTarget?: boolean;
  onClick: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
        isDropTarget && "ring-2 ring-primary ring-offset-1 ring-offset-background bg-primary/10",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
      {trailing}
    </div>
  );
}
