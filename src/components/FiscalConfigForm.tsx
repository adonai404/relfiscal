import { useState } from "react";
import { FiscalConfig, ColumnKey, TOGGLEABLE_COLUMNS, useUpdateFiscalConfig, getColumnLabel, TAX_ELIGIBLE_COLUMNS } from "@/hooks/useFiscalConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface FiscalConfigFormProps {
  config: FiscalConfig;
  onSuccess?: () => void;
}

export function FiscalConfigForm({ config, onSuccess }: FiscalConfigFormProps) {
  const [formData, setFormData] = useState<Partial<FiscalConfig>>(config);
  const updateConfig = useUpdateFiscalConfig(config.company_id);

  const handleToggle = (field: string, value: boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLabelChange = (col: ColumnKey, value: string) => {
    setFormData((prev) => ({ ...prev, [`label_${col}`]: value }));
  };

  const handleTaxColumnToggle = (col: ColumnKey) => {
    const current = formData.tax_columns || [];
    const next = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    setFormData((prev) => ({ ...prev, tax_columns: next }));
  };

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync(formData);
      toast.success("Configurações salvas com sucesso!");
      onSuccess?.();
    } catch (error) {
      toast.error("Erro ao salvar configurações");
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="visibility" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="visibility">Colunas</TabsTrigger>
          <TabsTrigger value="labels">Rótulos</TabsTrigger>
          <TabsTrigger value="simples">Simples</TabsTrigger>
        </TabsList>

        <TabsContent value="visibility" className="space-y-4 py-4">
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              <div className="grid gap-4">
                {TOGGLEABLE_COLUMNS.map((col) => (
                  <div key={col} className="flex items-center justify-between space-x-2">
                    <Label htmlFor={`show_${col}`} className="flex flex-col space-y-1">
                      <span>{getColumnLabel(undefined, col)}</span>
                      <span className="font-normal text-xs text-muted-foreground">
                        Exibir esta coluna na tabela de movimento
                      </span>
                    </Label>
                    <Switch
                      id={`show_${col}`}
                      checked={(formData as any)[`show_${col}_column`] ?? true}
                      onCheckedChange={(v) => handleToggle(`show_${col}_column`, v)}
                    />
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t">
                <Label className="text-sm font-semibold mb-2 block">Cálculo de Impostos</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Selecione quais colunas devem ser somadas para compor o total de "Impostos" nos KPIs e gráficos.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TAX_ELIGIBLE_COLUMNS.map((col) => (
                    <label key={col} className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent/50 cursor-pointer">
                      <Checkbox 
                        checked={(formData.tax_columns || []).includes(col)}
                        onCheckedChange={() => handleTaxColumnToggle(col)}
                      />
                      <span className="text-xs">{getColumnLabel(undefined, col)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="labels" className="space-y-4 py-4">
          <ScrollArea className="h-[300px] pr-4">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label size="sm">Competência</Label>
                <Input 
                  value={formData.label_competencia || ""} 
                  onChange={(e) => handleLabelChange("competencia" as any, e.target.value)}
                  placeholder="Competência"
                />
              </div>
              <div className="space-y-1.5">
                <Label size="sm">Entrada</Label>
                <Input 
                  value={formData.label_entrada || ""} 
                  onChange={(e) => handleLabelChange("entrada" as any, e.target.value)}
                  placeholder="Entrada"
                />
              </div>
              <div className="space-y-1.5">
                <Label size="sm">Saída</Label>
                <Input 
                  value={formData.label_saida || ""} 
                  onChange={(e) => handleLabelChange("saida" as any, e.target.value)}
                  placeholder="Saída"
                />
              </div>
              {TOGGLEABLE_COLUMNS.map((col) => (
                <div key={col} className="space-y-1.5">
                  <Label size="sm">{getColumnLabel(undefined, col)}</Label>
                  <Input 
                    value={(formData as any)[`label_${col}`] || ""} 
                    onChange={(e) => handleLabelChange(col, e.target.value)}
                    placeholder={getColumnLabel(undefined, col)}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="simples" className="space-y-6 py-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="auto_calc" className="flex flex-col space-y-1">
              <span>Cálculo Automático</span>
              <span className="font-normal text-xs text-muted-foreground">
                Calcular automaticamente o Simples Nacional baseado na Saída
              </span>
            </Label>
            <Switch
              id="auto_calc"
              checked={formData.auto_calculate_simples_nacional || false}
              onCheckedChange={(v) => handleToggle("auto_calculate_simples_nacional", v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aliquota">Alíquota do Simples Nacional (%)</Label>
            <Input
              id="aliquota"
              type="number"
              step="0.01"
              value={formData.aliquota_simples_nacional || 0}
              onChange={(e) => handleToggle("aliquota_simples_nacional", parseFloat(e.target.value) || 0)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Esta alíquota será usada para calcular o valor do Simples Nacional se o cálculo automático estiver ativo.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={() => setFormData(config)} disabled={updateConfig.isPending}>
          Descartar
        </Button>
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
