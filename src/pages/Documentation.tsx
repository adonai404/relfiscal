import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
import { Plus, Pencil, Trash2, FileText, Search, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DocRow {
  id: string;
  company_id: string;
  title: string;
  content: string;
  position: number;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
}

export default function Documentation() {
  const { user } = useAuth();
  const { companies } = useCompany();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<DocRow | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documentation", companies.map((c) => c.id).join(",")],
    enabled: !!user && companies.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_documentation")
        .select("*")
        .in("company_id", companies.map((c) => c.id))
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
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, companyFilter, statusFilter]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["documentation"] });

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Documentação
          </h2>
          <p className="text-sm text-muted-foreground">
            Cadastre informações em Markdown para cada empresa. Esses conteúdos aparecem automaticamente na aba Apresentação.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={companies.length === 0}>
          <Plus className="h-4 w-4" /> Nova informação
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="published">Publicado</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma informação encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Criado em</TableHead>
                    <TableHead className="hidden lg:table-cell">Atualizado em</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.title}</TableCell>
                      <TableCell className="text-muted-foreground">{companyById[d.company_id] ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={d.status === "published" ? "default" : "secondary"}>
                          {d.status === "published" ? "Publicado" : "Rascunho"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {new Date(d.updated_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(d)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(d)} aria-label="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {(creating || editing) && (
        <DocDialog
          doc={editing}
          open
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { refresh(); }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir informação?</AlertDialogTitle>
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

// ---------- Dialog (Create / Edit) ----------

interface DocDialogProps {
  doc: DocRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function DocDialog({ doc, open, onClose, onSaved }: DocDialogProps) {
  const { user } = useAuth();
  const { companies, selectedCompany } = useCompany();

  const [title, setTitle] = useState(doc?.title ?? "");
  const [companyId, setCompanyId] = useState<string>(doc?.company_id ?? selectedCompany?.id ?? "");
  const [position, setPosition] = useState<number>(doc?.position ?? 0);
  const [status, setStatus] = useState<"draft" | "published">(doc?.status ?? "published");
  const [content, setContent] = useState<string>(doc?.content ?? "");
  const [savedId, setSavedId] = useState<string | null>(doc?.id ?? null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialKey = useRef(JSON.stringify({ title, companyId, position, status, content }));

  // Auto-save (debounced)
  useEffect(() => {
    if (!open) return;
    const key = JSON.stringify({ title, companyId, position, status, content });
    if (key === initialKey.current) return;
    if (!title.trim() || !companyId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      const payload = {
        title: title.trim(),
        company_id: companyId,
        position: Number(position) || 0,
        status,
        content,
      };
      try {
        if (savedId) {
          const { error } = await supabase
            .from("company_documentation")
            .update(payload)
            .eq("id", savedId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("company_documentation")
            .insert({ ...payload, created_by: user?.id })
            .select("id")
            .single();
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
  }, [title, companyId, position, status, content, open, savedId, user?.id, onSaved]);

  const handleManualSave = async () => {
    if (!title.trim() || !companyId) {
      toast({ title: "Preencha título e empresa", variant: "destructive" });
      return;
    }
    const payload = {
      title: title.trim(),
      company_id: companyId,
      position: Number(position) || 0,
      status,
      content,
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[98vw] w-full h-[98vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="px-1">
          <DialogTitle>{doc ? "Editar informação" : "Nova informação"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-6 space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Resumo executivo" />
          </div>
          <div className="md:col-span-4 space-y-1.5">
            <Label>Empresa *</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Ordem</Label>
            <Input
              type="number" value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
            />
          </div>
          <div className="md:col-span-3 space-y-1.5">
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