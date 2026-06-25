import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ChangeCard } from "./ChangeCard";
import type {
  TaxReformCategory,
  TaxReformChange,
  TaxReformMonth,
  TaxReformUrgency,
} from "./types";

const URGENCY_OPTIONS: { value: TaxReformUrgency; label: string }[] = [
  { value: "critical",      label: "Crítico" },
  { value: "important",     label: "Importante" },
  { value: "informational", label: "Informativo" },
];

interface Props {
  month: TaxReformMonth;
  changes: TaxReformChange[];
  categories: TaxReformCategory[];
  onChangeClick: (change: TaxReformChange) => void;
  onRefresh: () => void;
}

export function MonthCard({
  month,
  changes,
  categories,
  onChangeClick,
  onRefresh,
}: Props) {
  const [addOpen, setAddOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving]       = useState(false);

  const [title, setTitle]         = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate]           = useState("");
  const [urgency, setUrgency]     = useState<TaxReformUrgency>("informational");
  const [categoryId, setCategoryId] = useState("");

  const resetForm = () => {
    setTitle(""); setDescription(""); setDate("");
    setUrgency("informational"); setCategoryId("");
  };

  const handleAddChange = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    const { error } = await supabase.from("tax_reform_changes").insert({
      month_id:    month.id,
      title:       title.trim(),
      description: description.trim() || null,
      exact_date:  date,
      urgency,
      category_id: categoryId || null,
      position:    changes.length,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar mudança");
    } else {
      resetForm();
      setAddOpen(false);
      onRefresh();
    }
  };

  const handleDeleteChange = async (change: TaxReformChange) => {
    const { error } = await supabase
      .from("tax_reform_changes")
      .delete()
      .eq("id", change.id);
    if (error) {
      toast.error("Erro ao excluir mudança");
    } else {
      onRefresh();
    }
  };

  const handleDeleteMonth = async () => {
    const { error } = await supabase
      .from("tax_reform_months")
      .delete()
      .eq("id", month.id);
    if (error) {
      toast.error("Erro ao excluir mês");
    } else {
      onRefresh();
    }
    setDeleteOpen(false);
  };

  const sortedChanges = [...changes].sort(
    (a, b) => new Date(a.exact_date).getTime() - new Date(b.exact_date).getTime(),
  );

  return (
    <div className="space-y-2">
      {/* iOS section header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {month.label}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <Plus className="h-3 w-3" /> Nova mudança
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-full p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cards grid */}
      {sortedChanges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/40 py-8 text-center">
          <p className="text-sm text-muted-foreground/60">
            Nenhuma mudança cadastrada.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Adicionar primeira mudança
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sortedChanges.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              onClick={onChangeClick}
              onDelete={handleDeleteChange}
            />
          ))}
        </div>
      )}

      {/* Add Change Dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(v) => {
          if (!v) resetForm();
          setAddOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Mudança — {month.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ex: Vigência da alíquota do IBS..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Detalhes sobre a mudança..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Data exata <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Urgência</Label>
                <Select
                  value={urgency}
                  onValueChange={(v) => setUrgency(v as TaxReformUrgency)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setAddOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddChange}
              disabled={!title.trim() || !date || saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar mudança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Month Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {month.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir permanentemente o mês e todas as mudanças
              vinculadas, incluindo tarefas, checklists e anexos. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMonth}
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
