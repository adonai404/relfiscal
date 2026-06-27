import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import {
  Plus, Pencil, Trash2, FileText, Search, Loader2, CheckCircle2,
  Folder, FolderOpen, ChevronRight, ArrowLeft, FolderPlus, Printer,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MarkdownView } from "@/components/MarkdownView";

interface DocRow {
  id: string;
  company_id: string | null;
  title: string;
  content: string;
  position: number;
  status: "draft" | "published";
  folder: string | null;
  created_at: string;
  updated_at: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const UNFOLDERED = "__none__";

function folderLabel(f: string | null) {
  return f && f.trim() ? f.trim() : null;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Documentation() {
  const { user } = useAuth();
  const { companies } = useCompany();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [openFolder, setOpenFolder] = useState<string | null>(null); // null = root view
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [defaultFolder, setDefaultFolder] = useState<string | null>(null); // pre-fill folder when creating
  const [toDelete, setToDelete] = useState<DocRow | null>(null);
  const [printingDoc, setPrintingDoc] = useState<DocRow | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [addFolderOpen, setAddFolderOpen] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documentation", companies.map((c) => c.id).join(",")],
    enabled: !!user && companies.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const ids = companies.map((c) => c.id);
      const { data, error } = await supabase
        .from("company_documentation")
        .select("*")
        .or(`company_id.in.(${ids.join(",")}),company_id.is.null`)
        .order("position", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const companyById = useMemo(() => {
    const m: Record<string, string> = {};
    companies.forEach((c) => { m[c.id] = c.nome_fantasia || c.razao_social; });
    return m;
  }, [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (companyFilter !== "all" && d.company_id !== companyFilter) return false;
      if (q && !d.title.toLowerCase().includes(q) && !(d.folder ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, companyFilter]);

  // All distinct folder names (across filtered docs)
  const folders = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach((d) => { if (d.folder) set.add(d.folder); });
    return Array.from(set).sort();
  }, [filtered]);

  const docsByFolder = useMemo(() => {
    const map: Record<string, DocRow[]> = {};
    filtered.forEach((d) => {
      const key = d.folder ?? UNFOLDERED;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [filtered]);

  const docsInView = openFolder
    ? (docsByFolder[openFolder] ?? [])
    : (docsByFolder[UNFOLDERED] ?? []);

  const refresh = () => qc.invalidateQueries({ queryKey: ["documentation"] });

  const handleRenameFolder = async () => {
    if (!renamingFolder || !newFolderName.trim()) return;
    const ids = (docsByFolder[renamingFolder] ?? []).map((d) => d.id);
    if (ids.length) {
      const { error } = await supabase
        .from("company_documentation")
        .update({ folder: newFolderName.trim() })
        .in("id", ids);
      if (error) return toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
    }
    if (openFolder === renamingFolder) setOpenFolder(newFolderName.trim());
    refresh();
    setRenamingFolder(null);
    setNewFolderName("");
  };

  const handleDeleteFolder = async (folder: string) => {
    const ids = (docsByFolder[folder] ?? []).map((d) => d.id);
    if (!ids.length) { refresh(); return; }
    const { error } = await supabase
      .from("company_documentation")
      .update({ folder: null })
      .in("id", ids);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    if (openFolder === folder) setOpenFolder(null);
    refresh();
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    // Folder is virtual — just open it (docs created in it will set the folder)
    setOpenFolder(newFolderName.trim());
    setAddFolderOpen(false);
    setNewFolderName("");
  };

  // ── Root view (folders grid) ───────────────────────────────────────────────
  const RootView = (
    <div className="space-y-8">
      {/* Folder cards */}
      {folders.length > 0 && (
        <section>
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pastas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {folders.map((folder) => {
              const count = docsByFolder[folder]?.length ?? 0;
              return (
                <Card
                  key={folder}
                  className="group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200"
                  onClick={() => setOpenFolder(folder)}
                >
                  <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
                    <div className="relative">
                      <Folder className="h-14 w-14 text-amber-400 fill-amber-100 group-hover:fill-amber-200 transition-colors" />
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-amber-700 leading-none">
                        {count}
                      </span>
                    </div>
                    <div className="w-full">
                      <p className="text-sm font-medium truncate" title={folder}>{folder}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {count} {count === 1 ? "documento" : "documentos"}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); setRenamingFolder(folder); setNewFolderName(folder); }}
                        title="Renomear pasta"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                        title="Remover pasta (documentos ficam sem pasta)"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {/* Add folder card */}
            <Card
              className="cursor-pointer border-dashed hover:border-primary/50 hover:bg-muted/30 transition-all duration-200"
              onClick={() => { setNewFolderName(""); setAddFolderOpen(true); }}
            >
              <CardContent className="flex flex-col items-center justify-center gap-2 p-5 text-center h-full min-h-[140px]">
                <FolderPlus className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Nova pasta</p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Docs without folder */}
      {docsInView.length > 0 && (
        <section>
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sem pasta</h3>
          <DocGrid
            docs={docsInView}
            companyById={companyById}
            onEdit={setEditing}
            onDelete={setToDelete}
            onPrint={setPrintingDoc}
          />
        </section>
      )}

      {folders.length === 0 && docsInView.length === 0 && !isLoading && (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Nenhum documento encontrado. Crie uma pasta ou adicione um documento.
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );

  // ── Folder view ────────────────────────────────────────────────────────────
  const FolderView = openFolder && (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => setOpenFolder(null)}
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Documentação
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium flex items-center gap-1">
          <FolderOpen className="h-4 w-4 text-amber-400" /> {openFolder}
        </span>
      </div>

      {docsInView.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Nenhum documento nesta pasta.
        </div>
      ) : (
        <DocGrid
          docs={docsInView}
          companyById={companyById}
          onEdit={setEditing}
          onDelete={setToDelete}
          onPrint={setPrintingDoc}
        />
      )}
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Documentação
          </h2>
          <p className="text-sm text-muted-foreground">
            Organize seus documentos em pastas. O conteúdo aparece na aba Apresentação.
          </p>
        </div>
        <div className="flex gap-2">
          {!openFolder && (
            <Button variant="outline" onClick={() => { setNewFolderName(""); setAddFolderOpen(true); }}>
              <FolderPlus className="h-4 w-4" /> Nova pasta
            </Button>
          )}
          <Button
            onClick={() => { setDefaultFolder(openFolder); setCreating(true); }}
            disabled={companies.length === 0}
          >
            <Plus className="h-4 w-4" /> Novo documento
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar documentos ou pastas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Print overlay */}
      {printingDoc && <PrintOverlay doc={printingDoc} onClose={() => setPrintingDoc(null)} />}

      {/* Content */}
      {openFolder ? FolderView : RootView}

      {/* Dialogs */}
      {(creating || editing) && (
        <DocDialog
          doc={editing}
          defaultFolder={defaultFolder}
          folders={folders}
          open
          onClose={() => { setCreating(false); setEditing(null); setDefaultFolder(null); }}
          onSaved={refresh}
        />
      )}

      {/* Add folder dialog */}
      <Dialog open={addFolderOpen} onOpenChange={(o) => !o && setAddFolderOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Nome da pasta</Label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex: Fiscal, Contabilidade…"
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFolderOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename folder dialog */}
      <Dialog open={!!renamingFolder} onOpenChange={(o) => !o && setRenamingFolder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Renomear pasta</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Novo nome</Label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingFolder(null)}>Cancelar</Button>
            <Button onClick={handleRenameFolder} disabled={!newFolderName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete doc */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. "{toDelete?.title}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                const { error } = await supabase.from("company_documentation").delete().eq("id", toDelete.id);
                if (error) {
                  toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Excluído com sucesso" });
                  refresh();
                }
                setToDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Print overlay ─────────────────────────────────────────────────────────────

function PrintOverlay({ doc, onClose }: { doc: DocRow; onClose: () => void }) {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "doc-print-style";
    style.textContent = `
      @media print {
        body > *:not(#doc-print-portal) { display: none !important; }
        #doc-print-portal { display: block !important; }
        #doc-print-toolbar { display: none !important; }
        #doc-print-portal * {
          color: #000 !important;
          background: #fff !important;
          border-color: #ccc !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("doc-print-style")?.remove(); };
  }, []);

  const content = (
    <div id="doc-print-portal" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "white", display: "flex", flexDirection: "column" }}>
      <div id="doc-print-toolbar" className="flex items-center justify-between border-b px-6 py-3 bg-background">
        <span className="text-sm font-medium text-muted-foreground">Pré-visualização de impressão</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 32px" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
            {doc.title}
          </h1>
          <MarkdownView content={doc.content} />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ── Doc grid ──────────────────────────────────────────────────────────────────

function DocGrid({
  docs,
  companyById,
  onEdit,
  onDelete,
  onPrint,
}: {
  docs: DocRow[];
  companyById: Record<string, string>;
  onEdit: (d: DocRow) => void;
  onDelete: (d: DocRow) => void;
  onPrint: (d: DocRow) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {docs.map((d) => (
        <Card
          key={d.id}
          className="group flex flex-col hover:border-primary/40 hover:shadow-sm transition-all duration-200"
        >
          <CardHeader className="pb-2 flex-row items-start gap-3 space-y-0">
            <FileText className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">{d.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1 truncate">{(d.company_id && companyById[d.company_id]) || "Sem empresa"}</p>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-3">
            {d.content.trim() && (
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {d.content.replace(/[#*`>\[\]!_~]/g, "").slice(0, 150)}
              </p>
            )}
          </CardContent>
          <div className="flex items-center justify-between px-4 pb-3 pt-0">
            <Badge variant={d.status === "published" ? "default" : "secondary"} className="text-xs">
              {d.status === "published" ? "Publicado" : "Rascunho"}
            </Badge>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Imprimir" onClick={() => onPrint(d)}>
                <Printer className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(d)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(d)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Dialog (Create / Edit) ────────────────────────────────────────────────────

interface DocDialogProps {
  doc: DocRow | null;
  defaultFolder: string | null;
  folders: string[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function DocDialog({ doc, defaultFolder, folders, open, onClose, onSaved }: DocDialogProps) {
  const { user } = useAuth();
  const { companies, selectedCompany } = useCompany();

  const [title, setTitle] = useState(doc?.title ?? "");
  const [companyId, setCompanyId] = useState<string>(doc?.company_id ?? selectedCompany?.id ?? "");
  const [position, setPosition] = useState<number>(doc?.position ?? 0);
  const [status, setStatus] = useState<"draft" | "published">(doc?.status ?? "published");
  const [content, setContent] = useState<string>(doc?.content ?? "");
  const [folder, setFolder] = useState<string>(doc?.folder ?? defaultFolder ?? "");
  const [savedId, setSavedId] = useState<string | null>(doc?.id ?? null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialKey = useRef(JSON.stringify({ title, companyId, position, status, content, folder }));

  useEffect(() => {
    if (!open) return;
    const key = JSON.stringify({ title, companyId, position, status, content, folder });
    if (key === initialKey.current) return;
    if (!title.trim()) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      const payload = {
        title: title.trim(),
        company_id: companyId.trim() || null,
        position: Number(position) || 0,
        status,
        content,
        folder: folder.trim() || null,
      };
      try {
        if (savedId) {
          const { error } = await supabase.from("company_documentation").update(payload).eq("id", savedId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("company_documentation")
            .insert({ ...payload, created_by: user?.id })
            .select("id").single();
          if (error) throw error;
          setSavedId(data.id);
        }
        setLastSavedAt(new Date());
        initialKey.current = key;
        onSaved();
      } catch (e: any) {
        toast({ title: "Falha ao salvar", description: e.message, variant: "destructive" });
      } finally {
        setAutoSaving(false);
      }
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, companyId, position, status, content, folder, open, savedId, user?.id, onSaved]);

  const handleManualSave = async () => {
    if (!title.trim()) {
      toast({ title: "Preencha o título", variant: "destructive" });
      return;
    }
    const payload = {
      title: title.trim(),
      company_id: companyId.trim() || null,
      position: Number(position) || 0,
      status,
      content,
      folder: folder.trim() || null,
    };
    if (savedId) {
      const { error } = await supabase.from("company_documentation").update(payload).eq("id", savedId);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const { data, error } = await supabase
        .from("company_documentation")
        .insert({ ...payload, created_by: user?.id })
        .select("id").single();
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSavedId(data.id);
    }
    toast({ title: "Salvo com sucesso" });
    onSaved();
    onClose();
  };

  // Folder suggestions (datalist)
  const listId = "folder-suggestions";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[98vw] w-full h-[98vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="px-1">
          <DialogTitle>{doc ? "Editar documento" : "Novo documento"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-5 space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Resumo executivo" />
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label>Pasta</Label>
            <datalist id={listId}>
              {folders.map((f) => <option key={f} value={f} />)}
            </datalist>
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Nome da pasta…"
              list={listId}
            />
          </div>
          <div className="md:col-span-1 space-y-1.5">
            <Label>Ordem</Label>
            <Input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 space-y-1.5 overflow-hidden">
          <div className="flex items-center justify-between">
            <Label>Conteúdo (Markdown)</Label>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {autoSaving ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</>
              ) : lastSavedAt ? (
                <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Salvo {lastSavedAt.toLocaleTimeString("pt-BR")}</>
              ) : null}
            </div>
          </div>
          <MarkdownEditor value={content} onChange={setContent} className="flex-1 min-h-0" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handleManualSave}>Salvar e fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
