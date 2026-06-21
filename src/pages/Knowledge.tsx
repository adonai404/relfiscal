import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen, Plus, Search, Star, ExternalLink, Pencil, Trash2,
  Loader2, X, Scale, Globe, FileText, FlaskConical, Microscope,
  ChevronDown, Hash, Upload, Download, FileSpreadsheet,
  File, Eye, Files, LayoutGrid,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeItem {
  id: string;
  user_id: string;
  title: string;
  type: string;
  category: string | null;
  url: string | null;
  notes: string | null;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface KnowledgeFile {
  id: string;
  item_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_mime: string | null;
  created_at: string;
}

const DEFAULT_TYPES = ["Lei", "Norma", "Site", "Artigo", "Pesquisa", "Outro"];
const BUCKET = "knowledge-files";
const MAX_FILE_MB = 20;

const TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
  Lei:      { icon: Scale,        bg: "bg-amber-100 dark:bg-amber-900/30",    text: "text-amber-700 dark:text-amber-400" },
  Norma:    { icon: FileText,     bg: "bg-purple-100 dark:bg-purple-900/30",  text: "text-purple-700 dark:text-purple-400" },
  Site:     { icon: Globe,        bg: "bg-emerald-100 dark:bg-emerald-900/30",text: "text-emerald-700 dark:text-emerald-400" },
  Artigo:   { icon: BookOpen,     bg: "bg-blue-100 dark:bg-blue-900/30",      text: "text-blue-700 dark:text-blue-400" },
  Pesquisa: { icon: Microscope,   bg: "bg-rose-100 dark:bg-rose-900/30",      text: "text-rose-700 dark:text-rose-400" },
  Outro:    { icon: FlaskConical, bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-600 dark:text-slate-400" },
};

const TYPE_BADGE: Record<string, string> = {
  Lei:      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Norma:    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Site:     "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Artigo:   "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Pesquisa: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Outro:    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function typeConfig(t: string) { return TYPE_CONFIG[t] ?? TYPE_CONFIG["Outro"]; }
function typeBadge(t: string)  { return TYPE_BADGE[t]   ?? TYPE_BADGE["Outro"];  }

function formatUrl(url: string) {
  try { return new URL(url).hostname + new URL(url).pathname.slice(0, 30); }
  catch { return url.slice(0, 40); }
}
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function fileIcon(mime: string | null): React.ElementType {
  if (!mime) return File;
  if (mime === "application/pdf") return FileText;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("word") || mime.includes("document")) return FileText;
  return File;
}
function isPdf(mime: string | null) { return mime === "application/pdf"; }

async function getSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Knowledge() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [favOnly, setFavOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [toDelete, setToDelete] = useState<KnowledgeItem | null>(null);

  // files modal
  const [filesItem, setFilesItem] = useState<KnowledgeItem | null>(null);
  // pdf viewer
  const [pdfFile, setPdfFile] = useState<KnowledgeFile | null>(null);
  const [pdfUrl, setPdfUrl]   = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["knowledge", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_items")
        .select("*")
        .order("is_favorite", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as KnowledgeItem[];
    },
  });

  // fetch files for all items in one shot
  const { data: allFiles = [] } = useQuery({
    queryKey: ["knowledge_files", user?.id],
    enabled: !!user && items.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const ids = items.map((i) => i.id);
      const { data, error } = await supabase
        .from("knowledge_item_files")
        .select("*")
        .in("item_id", ids)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as KnowledgeFile[];
    },
  });

  const filesByItem = useMemo(() => {
    const m: Record<string, KnowledgeFile[]> = {};
    allFiles.forEach((f) => { (m[f.item_id] ??= []).push(f); });
    return m;
  }, [allFiles]);

  const allTypes = useMemo(() => {
    const extra = items.map((i) => i.type).filter((t) => !DEFAULT_TYPES.includes(t));
    return [...DEFAULT_TYPES, ...Array.from(new Set(extra))];
  }, [items]);

  const allCategories = useMemo(() =>
    Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
  [items]);

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    items.forEach((i) => { c[i.type] = (c[i.type] ?? 0) + 1; });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (favOnly && !item.is_favorite) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (q) {
        const files = filesByItem[item.id] ?? [];
        const hit =
          item.title.toLowerCase().includes(q) ||
          (item.notes?.toLowerCase().includes(q) ?? false) ||
          item.tags.some((t) => t.toLowerCase().includes(q)) ||
          files.some((f) => f.file_name.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [items, search, typeFilter, categoryFilter, favOnly, filesByItem]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["knowledge"] });
    qc.invalidateQueries({ queryKey: ["knowledge_files"] });
  };

  const toggleFavorite = async (item: KnowledgeItem) => {
    const { error } = await supabase
      .from("knowledge_items")
      .update({ is_favorite: !item.is_favorite })
      .eq("id", item.id);
    if (error) toast({ title: "Erro ao atualizar favorito", variant: "destructive" });
    else refresh();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const files = filesByItem[toDelete.id] ?? [];
    if (files.length > 0) {
      await supabase.storage.from(BUCKET).remove(files.map((f) => f.file_path));
    }
    const { error } = await supabase.from("knowledge_items").delete().eq("id", toDelete.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Item excluído" });
      refresh();
    }
    setToDelete(null);
  };

  const openPdf = async (file: KnowledgeFile) => {
    setPdfFile(file);
    setPdfLoading(true);
    setPdfUrl(null);
    const url = await getSignedUrl(file.file_path);
    setPdfUrl(url);
    setPdfLoading(false);
  };

  const handleDownload = async (file: KnowledgeFile) => {
    const url = await getSignedUrl(file.file_path);
    if (!url) { toast({ title: "Erro ao gerar link", variant: "destructive" }); return; }
    const a = document.createElement("a");
    a.href = url; a.download = file.file_name; a.click();
  };

  const activeTypes = allTypes.filter((t) => typeCounts[t]);

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2.5">
            <BookOpen className="h-8 w-8 text-primary" /> Conhecimento
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Leis, normas, sites e referências para consulta rápida.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm" className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      {/* Type chips */}
      {activeTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeTypes.map((t) => {
            const cfg = typeConfig(t);
            const Icon = cfg.icon;
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(active ? "all" : t)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t}
                <span className={cn(
                  "ml-0.5 rounded-full px-1.5 text-[10px] font-semibold",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>{typeCounts[t]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar título, conteúdo, tags, arquivo…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1.5 shrink-0">
              {categoryFilter === "all" ? "Todas as categorias" : categoryFilter}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCategoryFilter("all")}>Todas as categorias</DropdownMenuItem>
            {allCategories.map((c) => <DropdownMenuItem key={c} onClick={() => setCategoryFilter(c)}>{c}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant={favOnly ? "default" : "outline"} onClick={() => setFavOnly((p) => !p)} className="gap-1.5 shrink-0">
          <Star className={cn("h-4 w-4", favOnly && "fill-current")} /> Favoritos
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {items.length === 0 ? 'Nenhum item cadastrado ainda. Clique em "Novo item" para começar.' : "Nenhum item encontrado com os filtros atuais."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              files={filesByItem[item.id] ?? []}
              onToggleFavorite={() => toggleFavorite(item)}
              onEdit={() => setEditing(item)}
              onDelete={() => setToDelete(item)}
              onOpenFiles={() => setFilesItem(item)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit */}
      {(creating || editing) && (
        <KnowledgeDialog
          item={editing}
          open
          allTypes={allTypes}
          allCategories={allCategories}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { refresh(); setCreating(false); setEditing(null); }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" será removido permanentemente
              {(filesByItem[toDelete?.id ?? ""]?.length ?? 0) > 0
                ? `, incluindo ${filesByItem[toDelete!.id].length} arquivo(s) anexado(s)`
                : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Files modal */}
      {filesItem && (
        <FilesModal
          item={filesItem}
          files={filesByItem[filesItem.id] ?? []}
          onClose={() => setFilesItem(null)}
          onViewPdf={openPdf}
          onDownload={handleDownload}
          onDeleted={refresh}
        />
      )}

      {/* PDF Viewer */}
      <Dialog open={!!pdfFile} onOpenChange={(o) => { if (!o) { setPdfFile(null); setPdfUrl(null); } }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
          <DialogHeader className="px-5 pt-4 pb-2 shrink-0 border-b">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="truncate text-base">{pdfFile?.file_name}</DialogTitle>
              <Button size="sm" variant="outline" onClick={() => pdfFile && handleDownload(pdfFile)} className="gap-1.5 shrink-0">
                <Download className="h-3.5 w-3.5" /> Baixar
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/30">
            {pdfLoading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-full border-0" title={pdfFile?.file_name ?? "PDF"} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Não foi possível carregar o arquivo.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  item: KnowledgeItem;
  files: KnowledgeFile[];
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenFiles: () => void;
}

function KnowledgeCard({ item, files, onToggleFavorite, onEdit, onDelete, onOpenFiles }: CardProps) {
  const cfg = typeConfig(item.type);
  const Icon = cfg.icon;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
      <div className={cn("h-1 w-full shrink-0", cfg.bg)} />

      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className={cn("shrink-0 flex h-10 w-10 items-center justify-center rounded-xl shadow-sm", cfg.bg)}>
          <Icon className={cn("h-5 w-5", cfg.text)} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-sm leading-snug line-clamp-2 flex-1">{item.title}</p>
            <span className={cn("shrink-0 mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", typeBadge(item.type))}>
              {item.type}
            </span>
          </div>
          {item.category && (
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-widest">{item.category}</p>
          )}
        </div>
      </div>

      <div className="mx-4 border-t border-border/50" />

      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-2.5 flex-1">
        {item.notes && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{item.notes}</p>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2 truncate max-w-full">
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{formatUrl(item.url)}</span>
          </a>
        )}

        {/* Files summary */}
        {files.length > 0 && (
          <button
            onClick={onOpenFiles}
            className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/50 px-3 py-2 text-left hover:bg-muted transition-colors w-full"
          >
            <div className={cn("shrink-0 flex h-7 w-7 items-center justify-center rounded-lg", cfg.bg)}>
              <Files className={cn("h-3.5 w-3.5", cfg.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">
                {files.length === 1 ? files[0].file_name : `${files.length} arquivos anexados`}
              </p>
              {files.length === 1 && files[0].file_size && (
                <p className="text-[10px] text-muted-foreground">{formatBytes(files[0].file_size)}</p>
              )}
              {files.length > 1 && (
                <p className="text-[10px] text-muted-foreground">Clique para ver e gerenciar</p>
              )}
            </div>
            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 min-w-0">
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-muted/80 border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Hash className="h-2.5 w-2.5" />{tag}
            </span>
          ))}
          {item.tags.length > 3 && <span className="text-[10px] text-muted-foreground self-center">+{item.tags.length - 3}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground tabular-nums mr-1">
            {new Date(item.created_at).toLocaleDateString("pt-BR")}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} title="Editar" className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} title="Excluir" className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={onToggleFavorite} title={item.is_favorite ? "Remover favorito" : "Favoritar"} className="rounded-lg p-1.5 text-muted-foreground hover:text-amber-500 transition-colors">
            <Star className={cn("h-3.5 w-3.5", item.is_favorite && "fill-amber-400 text-amber-400")} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PDF Thumbnail ────────────────────────────────────────────────────────────

function PdfThumbnail({ url, className }: { url: string | null; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await pdfjs.getDocument(url).promise;
        const page = await pdf.getPage(1);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1 });
        const canvas = canvasRef.current;
        // Fit into 200×260 box
        const scale = Math.min(200 / viewport.width, 260 / viewport.height);
        const vp = page.getViewport({ scale });
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp } as any).promise;
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (failed || !url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-lg", className)}>
        <FileText className="h-8 w-8 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className={cn("relative bg-white rounded-lg overflow-hidden", className)}>
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  );
}

// ─── Files Modal (Gallery) ────────────────────────────────────────────────────

interface FilesModalProps {
  item: KnowledgeItem;
  files: KnowledgeFile[];
  onClose: () => void;
  onViewPdf: (f: KnowledgeFile) => void;
  onDownload: (f: KnowledgeFile) => void;
  onDeleted: () => void;
}

function FilesModal({ item, files, onClose, onViewPdf, onDownload, onDeleted }: FilesModalProps) {
  const cfg = typeConfig(item.type);
  const [deleting, setDeleting] = useState<string | null>(null);
  // signed URLs for thumbnails keyed by file id
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const pdfFiles = files.filter((f) => isPdf(f.file_mime));
    if (pdfFiles.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        pdfFiles.map(async (f) => [f.id, await getSignedUrl(f.file_path)] as const)
      );
      setSignedUrls(Object.fromEntries(entries.filter(([, u]) => u) as [string, string][]));
    })();
  }, [files]);

  const handleDeleteFile = async (file: KnowledgeFile) => {
    setDeleting(file.id);
    await supabase.storage.from(BUCKET).remove([file.file_path]);
    const { error } = await supabase.from("knowledge_item_files").delete().eq("id", file.id);
    if (error) {
      toast({ title: "Erro ao remover arquivo", variant: "destructive" });
    } else {
      toast({ title: "Arquivo removido" });
      onDeleted();
    }
    setDeleting(null);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-4 w-4 text-primary" />
            Arquivos — <span className="truncate max-w-xs">{item.title}</span>
            <span className="ml-auto text-xs font-normal text-muted-foreground shrink-0">
              {files.length} arquivo{files.length !== 1 ? "s" : ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum arquivo anexado.</p>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.map((file) => {
                const pdf = isPdf(file.file_mime);
                const FIcon = fileIcon(file.file_mime);
                const isDeleting = deleting === file.id;

                return (
                  <div
                    key={file.id}
                    className="group relative flex flex-col rounded-xl border border-border bg-muted/30 overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    {/* Thumbnail area */}
                    <div className="relative aspect-[3/4] bg-muted/50">
                      {pdf ? (
                        <PdfThumbnail
                          url={signedUrls[file.id] ?? null}
                          className="absolute inset-0 w-full h-full"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", cfg.bg)}>
                            <FIcon className={cn("h-6 w-6", cfg.text)} />
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">
                            {file.file_name.split(".").pop()}
                          </span>
                        </div>
                      )}

                      {/* Hover overlay with actions */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {pdf && (
                          <button
                            onClick={() => { onViewPdf(file); onClose(); }}
                            title="Visualizar"
                            className="rounded-full bg-white/90 p-2 text-gray-800 hover:bg-white transition-colors shadow"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onDownload(file)}
                          title="Baixar"
                          className="rounded-full bg-white/90 p-2 text-gray-800 hover:bg-white transition-colors shadow"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file)}
                          title="Remover"
                          disabled={isDeleting}
                          className="rounded-full bg-white/90 p-2 text-red-600 hover:bg-white transition-colors shadow disabled:opacity-50"
                        >
                          {isDeleting
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* File info */}
                    <div className="px-2.5 py-2 border-t border-border/50 bg-card">
                      <p className="text-xs font-medium truncate leading-tight" title={file.file_name}>
                        {file.file_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {file.file_size ? formatBytes(file.file_size) : "—"}
                        {" · "}
                        {new Date(file.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-3 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

interface UploadingFile { file: File; progress: number; done: boolean; error: boolean; }

interface UploadZoneProps {
  onUploaded: (files: { path: string; name: string; size: number; mime: string }[]) => void;
  uploading: UploadingFile[];
  setUploading: React.Dispatch<React.SetStateAction<UploadingFile[]>>;
  userId: string;
}

function UploadZone({ onUploaded, uploading, setUploading, userId }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const processFiles = useCallback(async (files: File[]) => {
    const valid = files.filter((f) => {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast({ title: `"${f.name}" excede ${MAX_FILE_MB} MB`, variant: "destructive" });
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    const entries: UploadingFile[] = valid.map((f) => ({ file: f, progress: 0, done: false, error: false }));
    setUploading((p) => [...p, ...entries]);

    const results: { path: string; name: string; size: number; mime: string }[] = [];
    for (const entry of entries) {
      const ext = entry.file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      setUploading((p) => p.map((e) => e.file === entry.file ? { ...e, progress: 30 } : e));
      const { error } = await supabase.storage.from(BUCKET).upload(path, entry.file, { cacheControl: "3600" });
      if (error) {
        setUploading((p) => p.map((e) => e.file === entry.file ? { ...e, error: true, done: true } : e));
        toast({ title: `Erro ao enviar "${entry.file.name}"`, variant: "destructive" });
      } else {
        setUploading((p) => p.map((e) => e.file === entry.file ? { ...e, progress: 100, done: true } : e));
        results.push({ path, name: entry.file.name, size: entry.file.size, mime: entry.file.type });
      }
    }
    if (results.length > 0) onUploaded(results);
    setTimeout(() => setUploading((p) => p.filter((e) => !e.done)), 1500);
  }, [userId, onUploaded, setUploading]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
        )}
      >
        <Upload className="mx-auto h-5 w-5 text-muted-foreground mb-1.5" />
        <p className="text-xs text-muted-foreground">
          Arraste arquivos ou <span className="text-primary font-medium">clique para selecionar</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOCX, XLSX, CSV… até {MAX_FILE_MB} MB · múltiplos arquivos</p>
        <input ref={inputRef} type="file" className="hidden" multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.png,.jpg,.jpeg"
          onChange={handleChange} />
      </div>

      {uploading.length > 0 && (
        <div className="space-y-1.5">
          {uploading.map((u, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">{u.file.name}</span>
                {u.error ? <span className="text-destructive text-[10px]">Erro</span>
                  : u.done ? <span className="text-emerald-600 text-[10px]">Enviado</span>
                  : <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              {!u.done && <Progress value={u.progress} className="h-1" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

interface DialogProps {
  item: KnowledgeItem | null;
  open: boolean;
  allTypes: string[];
  allCategories: string[];
  onClose: () => void;
  onSaved: () => void;
}

function KnowledgeDialog({ item, open, allTypes, allCategories, onClose, onSaved }: DialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState(item?.type ?? "");
  const [customType, setCustomType] = useState("");
  const [category, setCategory] = useState(item?.category || "__none__");
  const [customCategory, setCustomCategory] = useState("");
  const [url, setUrl] = useState(item?.url ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);

  // Existing files for editing
  const { data: existingFiles = [] } = useQuery({
    queryKey: ["knowledge_files_dialog", item?.id],
    enabled: !!item?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase.from("knowledge_item_files").select("*").eq("item_id", item!.id).order("created_at");
      return (data ?? []) as KnowledgeFile[];
    },
  });

  const isCustomType = type === "__custom__";
  const isCustomCategory = category === "__custom__";
  const effectiveType = isCustomType ? customType.trim() : type;
  const effectiveCategory = isCustomCategory ? customCategory.trim() : (category === "__none__" ? "" : category);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput("");
  };

  const handleUploaded = async (
    files: { path: string; name: string; size: number; mime: string }[],
    itemId: string
  ) => {
    const rows = files.map((f) => ({
      item_id: itemId,
      file_path: f.path,
      file_name: f.name,
      file_size: f.size,
      file_mime: f.mime,
    }));
    await supabase.from("knowledge_item_files").insert(rows);
    qc.invalidateQueries({ queryKey: ["knowledge_files"] });
    qc.invalidateQueries({ queryKey: ["knowledge_files_dialog", itemId] });
  };

  // Buffer for files uploaded before save (new items)
  const pendingFiles = useRef<{ path: string; name: string; size: number; mime: string }[]>([]);

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: "Informe o título", variant: "destructive" }); return; }
    if (!effectiveType) { toast({ title: "Selecione ou informe o tipo", variant: "destructive" }); return; }
    if (uploading.some((u) => !u.done)) { toast({ title: "Aguarde o upload terminar", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        type: effectiveType,
        category: effectiveCategory || null,
        url: url.trim() || null,
        notes: notes.trim() || null,
        tags,
      };

      let savedId = item?.id;
      if (item) {
        const { error } = await supabase.from("knowledge_items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("knowledge_items").insert({ ...payload, user_id: user!.id }).select("id").single();
        if (error) throw error;
        savedId = data.id;
        if (pendingFiles.current.length > 0) {
          await handleUploaded(pendingFiles.current, savedId!);
          pendingFiles.current = [];
        }
      }
      toast({ title: item ? "Item atualizado" : "Item criado" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExistingFile = async (file: KnowledgeFile) => {
    await supabase.storage.from(BUCKET).remove([file.file_path]);
    await supabase.from("knowledge_item_files").delete().eq("id", file.id);
    qc.invalidateQueries({ queryKey: ["knowledge_files_dialog", item?.id] });
    qc.invalidateQueries({ queryKey: ["knowledge_files"] });
    toast({ title: "Arquivo removido" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lei 12.546/2011" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {allTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  <SelectItem value="__custom__">+ Criar novo tipo</SelectItem>
                </SelectContent>
              </Select>
              {isCustomType && <Input className="mt-1" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Nome do novo tipo" />}
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__custom__">+ Criar nova categoria</SelectItem>
                </SelectContent>
              </Select>
              {isCustomCategory && <Input className="mt-1" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Nome da nova categoria" />}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Link externo</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" />
          </div>

          {/* Existing files */}
          {existingFiles.length > 0 && (
            <div className="space-y-1.5">
              <Label>Arquivos anexados</Label>
              <div className="space-y-1.5">
                {existingFiles.map((f) => {
                  const FIcon = fileIcon(f.file_mime);
                  return (
                    <div key={f.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                      <FIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-xs truncate">{f.file_name}</span>
                      {f.file_size && <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(f.file_size)}</span>}
                      <button onClick={() => handleDeleteExistingFile(f)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload zone */}
          <div className="space-y-1.5">
            <Label>Adicionar arquivos</Label>
            <UploadZone
              userId={user?.id ?? ""}
              uploading={uploading}
              setUploading={setUploading}
              onUploaded={async (files) => {
                if (item?.id) {
                  await handleUploaded(files, item.id);
                } else {
                  pendingFiles.current = [...pendingFiles.current, ...files];
                  toast({ title: `${files.length} arquivo(s) prontos para salvar` });
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Anotações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Resumo, vigência, observações práticas…" rows={4} className="resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Ex: irpf, 2024, pessoa-física"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
              <Button type="button" variant="outline" onClick={addTag}>Adicionar</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 pl-2 pr-1">
                    {t}
                    <button onClick={() => setTags((p) => p.filter((x) => x !== t))} className="rounded hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading.some((u) => !u.done)}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
