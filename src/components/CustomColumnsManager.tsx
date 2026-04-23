import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Calculator, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  type CustomColumn,
  useCustomColumns, useCreateCustomColumn, useDeleteCustomColumn, useUpdateCustomColumn,
} from "@/hooks/useCustomColumns";
import {
  type ColumnKey, ALL_COLUMNS, COMPUTED_COLUMNS, getColumnLabel, type FiscalConfig,
} from "@/hooks/useFiscalConfig";
import { type Formula, type FormulaToken, slugifyKey, validateFormula, formulaToText } from "@/lib/formula";

interface Props {
  companyId: string;
  config: FiscalConfig | null | undefined;
}

export function CustomColumnsManager({ companyId, config }: Props) {
  const { data: columns = [], isLoading } = useCustomColumns(companyId);
  const createMut = useCreateCustomColumn(companyId);
  const updateMut = useUpdateCustomColumn(companyId);
  const deleteMut = useDeleteCustomColumn(companyId);
  const [editing, setEditing] = useState<CustomColumn | null>(null);
  const [creating, setCreating] = useState(false);

  const labelOf = useMemo(() => {
    return (key: string): string => {
      const cc = columns.find((c) => c.key === key);
      if (cc) return cc.label;
      return getColumnLabel(config ?? undefined, key as ColumnKey);
    };
  }, [columns, config]);

  const handleSave = async (
    data: { label: string; kind: "manual" | "formula"; formula: Formula; decimals: number; format: "currency" | "percent" },
    existing?: CustomColumn,
  ) => {
    const label = data.label.trim();
    if (!label) return toast.error("Informe um nome para a coluna");
    if (data.kind === "formula") {
      const err = validateFormula(data.formula);
      if (err) return toast.error(`Fórmula inválida: ${err}`);
    }
    try {
      if (existing) {
        await updateMut.mutateAsync({
          id: existing.id,
          patch: { label, kind: data.kind, formula: data.formula, decimals: data.decimals, format: data.format },
        });
        toast.success("Coluna atualizada");
      } else {
        // generate unique key from label
        let baseKey = slugifyKey(label);
        const existingKeys = new Set([...columns.map((c) => c.key), ...ALL_COLUMNS]);
        let k = baseKey, i = 2;
        while (existingKeys.has(k)) { k = `${baseKey}_${i++}`; }
        await createMut.mutateAsync({
          key: k, label, kind: data.kind, formula: data.formula, decimals: data.decimals, format: data.format,
          position: columns.length,
        });
        toast.success("Coluna criada");
      }
      setEditing(null);
      setCreating(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const move = (col: CustomColumn, dir: -1 | 1) => {
    const sorted = [...columns].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((c) => c.id === col.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    updateMut.mutate({ id: col.id, patch: { position: swap.position } });
    updateMut.mutate({ id: swap.id, patch: { position: col.position } });
  };

  const toggleVisible = (col: CustomColumn, v: boolean) => {
    updateMut.mutate({ id: col.id, patch: { visible: v } }, {
      onSuccess: () => toast.success(`${col.label} ${v ? "ativada" : "ocultada"}`),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Colunas Personalizadas</CardTitle>
          <CardDescription>
            Crie colunas próprias com valores manuais ou calculadas por fórmula a partir de outras colunas.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova coluna
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : columns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma coluna personalizada ainda. Clique em <strong>Nova coluna</strong>.
          </p>
        ) : (
          <div className="space-y-2">
            {[...columns].sort((a, b) => a.position - b.position).map((col, i, arr) => (
              <div key={col.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => move(col, -1)} aria-label="Mover acima">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === arr.length - 1} onClick={() => move(col, 1)} aria-label="Mover abaixo">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{col.label}</span>
                    <Badge variant={col.kind === "formula" ? "default" : "secondary"} className="text-xs">
                      {col.kind === "formula" ? <><Calculator className="mr-1 h-3 w-3" />Fórmula</> : "Manual"}
                    </Badge>
                  </div>
                  {col.kind === "formula" && (
                    <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                      = {formulaToText(col.formula, labelOf) || "(vazia)"}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={col.visible} onCheckedChange={(v) => toggleVisible(col, v)} aria-label="Visibilidade" />
                  <Button variant="ghost" size="icon" onClick={() => setEditing(col)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Excluir coluna "${col.label}"? Os valores também serão removidos.`)) {
                        deleteMut.mutate(col.id, {
                          onSuccess: () => toast.success("Coluna excluída"),
                          onError: (e: Error) => toast.error(e.message),
                        });
                      }
                    }}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ColumnEditor
          open={creating || !!editing}
          existing={editing}
          columns={columns}
          config={config}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(data) => handleSave(data, editing ?? undefined)}
          saving={createMut.isPending || updateMut.isPending}
        />
      </CardContent>
    </Card>
  );
}

// =====================================================================
// Editor (create / edit) with visual formula builder
// =====================================================================

function ColumnEditor({
  open, existing, columns, config, onClose, onSave, saving,
}: {
  open: boolean;
  existing: CustomColumn | null;
  columns: CustomColumn[];
  config: FiscalConfig | null | undefined;
  onClose: () => void;
  onSave: (data: { label: string; kind: "manual" | "formula"; formula: Formula; decimals: number; format: "currency" | "percent" }) => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [kind, setKind] = useState<"manual" | "formula">(existing?.kind ?? "manual");
  const [tokens, setTokens] = useState<FormulaToken[]>(existing?.formula?.tokens ?? []);
  const [decimals, setDecimals] = useState<number>(existing?.decimals ?? 2);
  const [format, setFormat] = useState<"currency" | "percent">(existing?.format ?? "currency");
  const [numInput, setNumInput] = useState("");
  const [pctInput, setPctInput] = useState("");

  // Reset state when dialog re-opens with new target
  useMemo(() => {
    if (open) {
      setLabel(existing?.label ?? "");
      setKind(existing?.kind ?? "manual");
      setTokens(existing?.formula?.tokens ?? []);
      setDecimals(existing?.decimals ?? 2);
      setFormat(existing?.format ?? "currency");
      setNumInput("");
      setPctInput("");
    }
  }, [open, existing]);

  const labelOf = (key: string): string => {
    const cc = columns.find((c) => c.key === key);
    if (cc) return cc.label;
    return getColumnLabel(config ?? undefined, key as ColumnKey);
  };

  const builtinKeys = ALL_COLUMNS.filter((k) => !COMPUTED_COLUMNS.includes(k));
  const otherCustom = columns.filter((c) => c.id !== existing?.id);

  const push = (tk: FormulaToken) => setTokens((prev) => [...prev, tk]);
  const popLast = () => setTokens((prev) => prev.slice(0, -1));
  const clear = () => setTokens([]);

  const error = kind === "formula" ? validateFormula({ tokens }) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Editar coluna" : "Nova coluna"}</DialogTitle>
          <DialogDescription>
            Defina o nome da coluna e como seus valores serão preenchidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="col-label">Nome da coluna</Label>
            <Input
              id="col-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Lucro líquido, ICMS líquido, x..."
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as "manual" | "formula")} className="grid grid-cols-2 gap-2">
              <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${kind === "manual" ? "border-primary bg-accent" : ""}`}>
                <RadioGroupItem value="manual" />
                <div>
                  <div className="text-sm font-medium">Manual</div>
                  <div className="text-xs text-muted-foreground">Você digita o valor por mês.</div>
                </div>
              </label>
              <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${kind === "formula" ? "border-primary bg-accent" : ""}`}>
                <RadioGroupItem value="formula" />
                <div>
                  <div className="text-sm font-medium">Fórmula</div>
                  <div className="text-xs text-muted-foreground">Calculada automaticamente.</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="col-decimals">Casas decimais</Label>
            <Input
              id="col-decimals"
              type="number"
              min={0}
              max={6}
              value={decimals}
              onChange={(e) => setDecimals(Math.max(0, Math.min(6, parseInt(e.target.value || "0"))))}
            />
          </div>

          {kind === "formula" && (
            <div className="space-y-3">
              <div>
                <Label>Fórmula</Label>
                <div className="mt-1.5 min-h-[3rem] rounded-md border bg-muted/30 p-3 font-mono text-sm break-words">
                  {tokens.length === 0 ? (
                    <span className="text-muted-foreground">Clique abaixo para inserir colunas, números e operadores.</span>
                  ) : (
                    <>= {formulaToText({ tokens }, labelOf)}</>
                  )}
                </div>
                {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Colunas padrão</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {builtinKeys.map((k) => (
                    <Button key={k} type="button" variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => push({ t: "col", key: k })}>
                      {getColumnLabel(config ?? undefined, k)}
                    </Button>
                  ))}
                </div>
              </div>

              {otherCustom.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Outras colunas personalizadas</Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {otherCustom.map((c) => (
                      <Button key={c.id} type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => push({ t: "col", key: c.key })}>
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Operadores</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(["+", "-", "*", "/"] as const).map((op) => (
                    <Button key={op} type="button" variant="secondary" size="sm" className="h-8 w-8 p-0 font-mono"
                      onClick={() => push({ t: "op", v: op })}>
                      {op}
                    </Button>
                  ))}
                  <Button type="button" variant="secondary" size="sm" className="h-8 w-8 p-0 font-mono" onClick={() => push({ t: "lp" })}>(</Button>
                  <Button type="button" variant="secondary" size="sm" className="h-8 w-8 p-0 font-mono" onClick={() => push({ t: "rp" })}>)</Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Inserir número</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Ex: 0.5"
                    value={numInput}
                    onChange={(e) => setNumInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const n = parseFloat(numInput.replace(",", "."));
                        if (!isNaN(n)) { push({ t: "num", v: n }); setNumInput(""); }
                      }
                    }}
                  />
                  <Button type="button" onClick={() => {
                    const n = parseFloat(numInput.replace(",", "."));
                    if (!isNaN(n)) { push({ t: "num", v: n }); setNumInput(""); }
                  }}>Inserir</Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={popLast} disabled={tokens.length === 0}>
                  <X className="mr-1 h-3 w-3" /> Apagar último
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={tokens.length === 0}>
                  Limpar tudo
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSave({ label, kind, formula: { tokens }, decimals })}
            disabled={saving || !label.trim() || (kind === "formula" && (!!error || tokens.length === 0))}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? "Salvar" : "Criar coluna"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}