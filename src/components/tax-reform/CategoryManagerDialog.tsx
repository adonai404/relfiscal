import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tags, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TaxReformCategory } from "./types";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#a78bfa", "#64748b",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CategoryManagerDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["tax_reform_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_reform_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as TaxReformCategory[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["tax_reform_categories"] });

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("tax_reform_categories")
      .insert({ name: name.trim(), color });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar categoria");
    } else {
      setName("");
      refresh();
    }
  };

  const handleDelete = async (cat: TaxReformCategory) => {
    const { error } = await supabase
      .from("tax_reform_categories")
      .delete()
      .eq("id", cat.id);
    if (error) {
      toast.error("Erro ao excluir categoria");
    } else {
      refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            Gerenciar Categorias
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add form */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: ICMS, Folha de Pagamento..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                      color === c ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!name.trim() || saving}
              className="w-full gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Adicionar
            </Button>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma categoria cadastrada ainda.
              </p>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(cat)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
