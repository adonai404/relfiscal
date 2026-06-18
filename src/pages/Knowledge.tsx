import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Tag, ChevronDown, Hash,
} from "lucide-react";
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

const DEFAULT_TYPES = ["Lei", "Norma", "Site", "Artigo", "Pesquisa", "Outro"];

// Icon + color per type
const TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
  Lei:     { icon: Scale,       bg: "bg-amber-100 dark:bg-amber-900/30",    text: "text-amber-700 dark:text-amber-400" },
  Norma:   { icon: FileText,    bg: "bg-purple-100 dark:bg-purple-900/30",  text: "text-purple-700 dark:text-purple-400" },
  Site:    { icon: Globe,       bg: "bg-emerald-100 dark:bg-emerald-900/30",text: "text-emerald-700 dark:text-emerald-400" },
  Artigo:  { icon: BookOpen,    bg: "bg-blue-100 dark:bg-blue-900/30",      text: "text-blue-700 dark:text-blue-400" },
  Pesquisa:{ icon: Microscope,  bg: "bg-rose-100 dark:bg-rose-900/30",      text: "text-rose-700 dark:text-rose-400" },
  Outro:   { icon: FlaskConical,bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-600 dark:text-slate-400" },
};

const TYPE_BADGE: Record<string, string> = {
  Lei:     "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Norma:   "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Site:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Artigo:  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Pesquisa:"bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Outro:   "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function typeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG["Outro"];
}
function typeBadge(type: string) {
  return TYPE_BADGE[type] ?? TYPE_BADGE["Outro"];
}

function formatUrl(url: string) {
  try { return new URL(url).hostname + new URL(url).pathname.slice(0, 30); }
  catch { return url.slice(0, 40); }
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

  const allTypes = useMemo(() => {
    const extra = items.map((i) => i.type).filter((t) => !DEFAULT_TYPES.includes(t));
    return [...DEFAULT_TYPES, ...Array.from(new Set(extra))];
  }, [items]);

  const allCategories = useMemo(() =>
    Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
  [items]);

  // Count per type (from all items, ignoring type filter)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => { counts[i.type] = (counts[i.type] ?? 0) + 1; });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (favOnly && !item.is_favorite) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (q) {
        const hit =
          item.title.toLowerCase().includes(q) ||
          (item.notes?.toLowerCase().includes(q) ?? false) ||
          item.tags.some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [items, search, typeFilter, categoryFilter, favOnly]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["knowledge"] });

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
    const { error } = await supabase.from("knowledge_items").delete().eq("id", toDelete.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Item excluído" });
      refresh();
    }
    setToDelete(null);
  };

  // Types that have at least one item
  const activeTypes = allTypes.filter((t) => typeCounts[t]);

  return (
    <div className="w-full space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2.5">
            <BookOpen className="h-8 w-8 text-primary" />
            Conhecimento
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Leis, normas, sites e referências para consulta rápida.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm" className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      {/* ── Type chips ── */}
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
                  "ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {typeCounts[t]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Search + filters ── */}
      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar título, conteúdo, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full"
          />
        </div>

        {/* Category dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1.5 shrink-0">
              {categoryFilter === "all" ? "Todas as categorias" : categoryFilter}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
              Todas as categorias
            </DropdownMenuItem>
            {allCategories.map((c) => (
              <DropdownMenuItem key={c} onClick={() => setCategoryFilter(c)}>{c}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Favorites toggle */}
        <Button
          variant={favOnly ? "default" : "outline"}
          onClick={() => setFavOnly((p) => !p)}
          className="gap-1.5 shrink-0"
        >
          <Star className={cn("h-4 w-4", favOnly && "fill-current")} />
          Favoritos
        </Button>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? 'Nenhum item cadastrado ainda. Clique em "Novo item" para começar.'
            : "Nenhum item encontrado com os filtros atuais."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onToggleFavorite={() => toggleFavorite(item)}
              onEdit={() => setEditing(item)}
              onDelete={() => setToDelete(item)}
            />
          ))}
        </div>
      )}

      {/* ── Dialogs ── */}
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

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  item: KnowledgeItem;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function KnowledgeCard({ item, onToggleFavorite, onEdit, onDelete }: CardProps) {
  const cfg = typeConfig(item.type);
  const Icon = cfg.icon;

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow overflow-hidden">

      {/* Top section */}
      <div className="flex items-start gap-3 p-4 pb-2">
        {/* Type icon */}
        <div className={cn("shrink-0 flex h-9 w-9 items-center justify-center rounded-lg", cfg.bg)}>
          <Icon className={cn("h-4.5 w-4.5", cfg.text)} style={{ width: 18, height: 18 }} />
        </div>

        {/* Title + category */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug line-clamp-2">{item.title}</p>
          {item.category && (
            <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">{item.category}</p>
          )}
        </div>

        {/* Favorite + actions (actions on hover) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={onToggleFavorite}
            className="rounded p-1 text-muted-foreground hover:text-amber-500 transition-colors"
            aria-label="Favoritar"
          >
            <Star className={cn("h-3.5 w-3.5", item.is_favorite && "fill-amber-400 text-amber-400")} />
          </button>
        </div>
      </div>

      {/* Notes */}
      {item.notes && (
        <p className="px-4 text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {item.notes}
        </p>
      )}

      {/* URL */}
      {item.url && (
        <div className="px-4 mt-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-full"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatUrl(item.url)}</span>
          </a>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto px-4 pt-3 pb-3 border-t border-border/60 flex items-center justify-between gap-2">
        {/* Tags */}
        <div className="flex flex-wrap gap-1 min-w-0">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              <Hash className="h-2.5 w-2.5" />{tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
          )}
        </div>

        {/* Type badge + date */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", typeBadge(item.type))}>
            {item.type}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {new Date(item.created_at).toLocaleDateString("pt-BR")}
          </span>
        </div>
      </div>
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
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState(item?.type ?? "");
  const [customType, setCustomType] = useState("");
  const [category, setCategory] = useState(item?.category || "__none__");
  const [customCategory, setCustomCategory] = useState("");
  const [url, setUrl] = useState(item?.url ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);

  const isCustomType = type === "__custom__";
  const isCustomCategory = category === "__custom__";
  const effectiveType = isCustomType ? customType.trim() : type;
  const effectiveCategory = isCustomCategory ? customCategory.trim() : (category === "__none__" ? "" : category);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput("");
  };

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: "Informe o título", variant: "destructive" }); return; }
    if (!effectiveType) { toast({ title: "Selecione ou informe o tipo", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      type: effectiveType,
      category: effectiveCategory || null,
      url: url.trim() || null,
      notes: notes.trim() || null,
      tags,
    };
    try {
      if (item) {
        const { error } = await supabase.from("knowledge_items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("knowledge_items").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
      toast({ title: item ? "Item atualizado" : "Item criado" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
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
              {isCustomType && (
                <Input className="mt-1" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Nome do novo tipo" />
              )}
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
              {isCustomCategory && (
                <Input className="mt-1" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Nome da nova categoria" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Link externo</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" />
          </div>

          <div className="space-y-1.5">
            <Label>Anotações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Resumo, vigência, observações práticas…"
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Ex: irpf, 2024, pessoa-física"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              />
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
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
