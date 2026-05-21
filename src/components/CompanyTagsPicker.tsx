import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Tag as TagIcon, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useTags, useCompanyTags, useCreateTag, useToggleCompanyTag, useDeleteTag, type Tag,
} from "@/hooks/useTags";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

const COLOR_PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#64748B",
];

export function tagBadgeStyle(color: string): React.CSSProperties {
  return { backgroundColor: `${color}22`, color, borderColor: `${color}55` };
}

interface Props {
  companyId: string;
  // Used for click-stop-propagation when used inside a clickable card
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
}

export function CompanyTagsPicker({ companyId, trigger, align = "end" }: Props) {
  const { data: tags = [] } = useTags();
  const { data: companyTags = [] } = useCompanyTags();
  const createMut = useCreateTag();
  const toggleMut = useToggleCompanyTag();
  const deleteMut = useDeleteTag();
  const { isSuperAdmin } = useUserRole();
  const [search, setSearch] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null))
      .catch(() => setCurrentUserId(null));
  }, []);

  const assigned = useMemo(
    () => new Set(companyTags.filter((ct) => ct.company_id === companyId).map((ct) => ct.tag_id)),
    [companyTags, companyId]
  );

  const q = search.trim().toLowerCase();
  const filtered = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  const exactMatch = tags.find((t) => t.name.toLowerCase() === q);

  const toggle = (tag: Tag) => {
    const attach = !assigned.has(tag.id);
    toggleMut.mutate({ company_id: companyId, tag_id: tag.id, attach }, {
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const create = () => {
    if (!q || exactMatch) return;
    createMut.mutate({ name: search.trim(), color }, {
      onSuccess: (newTag) => {
        toggleMut.mutate({ company_id: companyId, tag_id: newTag.id, attach: true });
        setSearch("");
        toast.success(`Tag "${newTag.name}" criada e aplicada`);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <TagIcon className="mr-2 h-3 w-3" /> Tags
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72" align={align} onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Buscar ou criar tag</Label>
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && q && !exactMatch) create(); }}
              placeholder="Nome da tag…"
              className="mt-1"
            />
          </div>

          {q && !exactMatch && (
            <div className="rounded-md border p-2 space-y-2">
              <div className="text-xs text-muted-foreground">Cor da nova tag</div>
              <div className="flex flex-wrap gap-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition ${color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
              <Button size="sm" className="w-full" onClick={create} disabled={createMut.isPending}>
                {createMut.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />}
                Criar "{search.trim()}"
              </Button>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.length === 0 && !q && (
              <p className="text-xs text-center text-muted-foreground py-4">
                Nenhuma tag ainda. Digite acima para criar.
              </p>
            )}
            {filtered.map((t) => {
              const on = assigned.has(t.id);
              const canDelete = isSuperAdmin || t.created_by === currentUserId;
              return (
                <div key={t.id} className="flex items-center gap-2 rounded-md border p-2">
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                      {on && <Check className="h-3 w-3" />}
                    </div>
                    <Badge variant="outline" className="border" style={tagBadgeStyle(t.color)}>{t.name}</Badge>
                  </button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir tag "${t.name}" de todas as empresas?`)) {
                          deleteMut.mutate(t.id, {
                            onSuccess: () => toast.success("Tag excluída"),
                            onError: (e: Error) => toast.error(e.message),
                          });
                        }
                      }}
                      aria-label="Excluir tag"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Read-only chips for displaying assigned tags
export function CompanyTagsChips({ companyId, max = 99 }: { companyId: string; max?: number }) {
  const { data: tags = [] } = useTags();
  const { data: companyTags = [] } = useCompanyTags();
  const ids = new Set(companyTags.filter((ct) => ct.company_id === companyId).map((ct) => ct.tag_id));
  const list = tags.filter((t) => ids.has(t.id));
  if (list.length === 0) return null;
  const visible = list.slice(0, max);
  const overflow = list.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((t) => (
        <Badge key={t.id} variant="outline" className="text-[10px] px-1.5 py-0 border" style={tagBadgeStyle(t.color)}>
          {t.name}
        </Badge>
      ))}
      {overflow > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{overflow}</Badge>}
    </div>
  );
}