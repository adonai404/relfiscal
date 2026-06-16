import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wrench, Search, CalendarDays, TableProperties, FileDown,
  Plus, Pencil, Trash2, Link as LinkIcon, FileText, Calculator, ChartBar,
  Database, Folder, Globe, Mail, Settings, Briefcase, BookOpen, Cloud,
  Lock, Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Wrench, Search, CalendarDays, TableProperties, FileDown, LinkIcon, FileText,
  Calculator, ChartBar, Database, Folder, Globe, Mail, Settings, Briefcase, BookOpen, Cloud,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

type UserTool = {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  visibility: "private" | "public";
  user_id: string;
};

function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Wrench;
  return <Icon className={className} />;
}

export default function Tools() {
  const { user } = useAuth();
  const [tools, setTools] = useState<UserTool[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserTool | null>(null);
  const [deleting, setDeleting] = useState<UserTool | null>(null);
  const [form, setForm] = useState({ title: "", description: "", url: "", icon: "Wrench", visibility: "private" as "private" | "public" });
  const [saving, setSaving] = useState(false);

  const loadTools = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_tools")
      .select("id,title,description,url,icon,visibility,user_id")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar ferramentas", description: error.message, variant: "destructive" });
      return;
    }
    setTools((data ?? []) as UserTool[]);
  };

  useEffect(() => { loadTools(); /* eslint-disable-next-line */ }, [user?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", url: "", icon: "Wrench", visibility: "private" });
    setDialogOpen(true);
  };

  const openEdit = (tool: UserTool) => {
    setEditing(tool);
    setForm({ title: tool.title, description: tool.description, url: tool.url, icon: tool.icon, visibility: tool.visibility });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const title = form.title.trim();
    const url = form.url.trim();
    if (!title || !url) {
      toast({ title: "Preencha título e URL", variant: "destructive" });
      return;
    }
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      toast({ title: "URL inválida", variant: "destructive" });
      return;
    }
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    setSaving(true);
    const payload = { title, description: form.description.trim(), url: finalUrl, icon: form.icon, visibility: form.visibility };
    const { error } = editing
      ? await supabase.from("user_tools").update(payload).eq("id", editing.id)
      : await supabase.from("user_tools").insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    toast({ title: editing ? "Ferramenta atualizada" : "Ferramenta adicionada" });
    loadTools();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("user_tools").delete().eq("id", deleting.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ferramenta excluída" });
    setDeleting(null);
    loadTools();
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ferramentas</h1>
            <p className="text-muted-foreground">
              Acesse ferramentas úteis para auxiliar no seu dia a dia fiscal.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Adicionar ferramenta
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <a
            href="https://consulta-notas.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
              <CardHeader>
                <Search className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Consulta de Notas Fiscais</CardTitle>
                <CardDescription>
                  Pesquise e baixe XMLs de notas fiscais através da chave de acesso.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ferramenta externa para consulta rápida de documentos fiscais eletrônicos.
                </p>
              </CardContent>
            </Card>
          </a>

          <a
            href="https://fiscal-planner.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
              <CardHeader>
                <CalendarDays className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Fiscal Planner</CardTitle>
                <CardDescription>
                  Planejamento e organização de rotinas fiscais e obrigações.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ferramenta externa para gestão de prazos e tarefas do departamento fiscal.
                </p>
              </CardContent>
            </Card>
          </a>

          <a
            href="https://gerador-planilha.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
              <CardHeader>
                <TableProperties className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Gerador de Planilhas</CardTitle>
                <CardDescription>
                  Criação e exportação de planilhas personalizadas para controle fiscal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ferramenta externa para geração rápida de arquivos de dados estruturados.
                </p>
              </CardContent>
            </Card>
          </a>

          <a
            href="https://declaration-data.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
              <CardHeader>
                <FileDown className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Extrator de Declarações Fiscais</CardTitle>
                <CardDescription>
                  Extraia automaticamente dados de declarações fiscais em lote.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ferramenta externa para processamento de PDFs, conferência de listas e exportação para Excel.
                </p>
              </CardContent>
            </Card>
          </a>

          {tools.map((tool) => (
            <div key={tool.id} className="relative group">
              <a href={tool.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <ToolIcon name={tool.icon} className="h-8 w-8 text-primary" />
                      <Badge variant="secondary" className="gap-1 text-xs">
                        {tool.visibility === "public"
                          ? (<><Users className="h-3 w-3" /> Pública</>)
                          : (<><Lock className="h-3 w-3" /> Privada</>)}
                      </Badge>
                    </div>
                    <CardTitle className="pr-16">{tool.title}</CardTitle>
                    <CardDescription>{tool.description || tool.url}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground break-all">{tool.url}</p>
                  </CardContent>
                </Card>
              </a>
              {tool.user_id === user?.id && (
                <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.preventDefault(); openEdit(tool); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.preventDefault(); setDeleting(tool); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={openCreate}
            className="text-left"
            type="button"
          >
            <Card className="border-dashed hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer h-full flex items-center justify-center min-h-[180px]">
              <CardContent className="flex flex-col items-center justify-center text-center pt-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <p className="font-medium">Adicionar ferramenta</p>
                <p className="text-sm text-muted-foreground">Inclua um link, ícone e descrição</p>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar ferramenta" : "Nova ferramenta"}</DialogTitle>
            <DialogDescription>Adicione um link rápido à sua lista de ferramentas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tool-title">Título</Label>
              <Input id="tool-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Consulta CNPJ" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tool-url">Link</Label>
              <Input id="tool-url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tool-desc">Descrição</Label>
              <Textarea id="tool-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Para que serve esta ferramenta?" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="grid grid-cols-8 gap-2">
                {ICON_OPTIONS.map((name) => {
                  const Icon = ICON_MAP[name];
                  const selected = form.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: name }))}
                      className={cn(
                        "h-10 w-10 rounded-md border flex items-center justify-center hover:bg-accent transition-colors",
                        selected && "border-primary bg-primary/10 text-primary",
                      )}
                      aria-label={name}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="tool-visibility" className="flex items-center gap-2">
                  {form.visibility === "public" ? <Users className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {form.visibility === "public" ? "Pública" : "Privada"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {form.visibility === "public"
                    ? "Todos os usuários poderão ver esta ferramenta."
                    : "Apenas você poderá ver esta ferramenta."}
                </p>
              </div>
              <Switch
                id="tool-visibility"
                checked={form.visibility === "public"}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, visibility: checked ? "public" : "private" }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ferramenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A ferramenta "{deleting?.title}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}