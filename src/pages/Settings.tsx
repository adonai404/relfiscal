import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronLeft, Download, FileSpreadsheet, Loader2, Settings as SettingsIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import {
  type FiscalConfig,
  TOGGLEABLE_COLUMNS,
  type ColumnKey,
  useFiscalConfig,
  useUpdateFiscalConfig,
} from "@/hooks/useFiscalConfig";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatCNPJ } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { downloadTemplate, exportMovementToXlsx } from "@/lib/xlsx";
import { useXlsxImport } from "@/hooks/useXlsxImport";

const TOGGLE_LABELS: Record<ColumnKey, string> = {
  entrada: "Entrada", saida: "Saída", icms: "ICMS", impostos_federais: "Impostos Federais",
  simples_nacional: "Simples Nacional", honorarios: "Honorários", folha: "Folha",
  encargos_patronal: "Encargos Patronal", difal: "DIFAL", pis: "PIS",
  cofins: "COFINS", irpj: "IRPJ", csll: "CSLL",
};

const LABEL_FIELDS: { key: keyof FiscalConfig; default: string }[] = [
  { key: "label_competencia", default: "Competência" },
  { key: "label_entrada", default: "Entrada" },
  { key: "label_saida", default: "Saída" },
  { key: "label_icms", default: "ICMS" },
  { key: "label_impostos_federais", default: "Impostos Federais" },
  { key: "label_simples_nacional", default: "Simples Nacional" },
  { key: "label_honorarios", default: "Honorários" },
  { key: "label_folha", default: "Folha" },
  { key: "label_encargos_patronal", default: "Encargos Patronal" },
  { key: "label_difal", default: "DIFAL" },
  { key: "label_pis", default: "PIS" },
  { key: "label_cofins", default: "COFINS" },
  { key: "label_irpj", default: "IRPJ" },
  { key: "label_csll", default: "CSLL" },
];

export default function Settings() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const companyId = selectedCompany?.id;
  const { data: config, isLoading } = useFiscalConfig(companyId);
  const update = useUpdateFiscalConfig(companyId);
  const xlsx = useXlsxImport(companyId, config);

  // Lightweight fetch of rows just for export
  const { data: exportRows = [] } = useQuery({
    queryKey: ["fiscal_movement_export", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_movement").select("*").eq("company_id", companyId!)
        .order("competencia", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Local label state for onBlur saves
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [aliquota, setAliquota] = useState<string>("");

  useEffect(() => {
    if (!config) return;
    const init: Record<string, string> = {};
    LABEL_FIELDS.forEach((f) => {
      init[f.key as string] = (config[f.key] as string) ?? f.default;
    });
    setLabels(init);
    setAliquota(String(config.aliquota_simples_nacional ?? 6));
  }, [config]);

  if (!selectedCompany) return <Navigate to="/empresas" replace />;

  const toggleColumn = (col: ColumnKey, value: boolean) => {
    update.mutate(
      { [`show_${col}_column`]: value } as Partial<FiscalConfig>,
      {
        onSuccess: () => toast.success(`${TOGGLE_LABELS[col]} ${value ? "ativada" : "ocultada"}`),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const saveLabel = (key: string, fallback: string) => {
    const val = (labels[key] || "").trim() || fallback;
    if (config && (config[key as keyof FiscalConfig] as string) === val) return;
    update.mutate({ [key]: val } as Partial<FiscalConfig>, {
      onSuccess: () => toast.success("Rótulo atualizado"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const toggleAuto = (v: boolean) => {
    update.mutate({ auto_calculate_simples_nacional: v }, {
      onSuccess: () => toast.success(v ? "Cálculo automático ativado" : "Cálculo automático desativado"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const saveAliquota = () => {
    const n = parseFloat(aliquota.replace(",", "."));
    if (isNaN(n) || n < 0 || n > 100) return toast.error("Alíquota inválida");
    if (config?.aliquota_simples_nacional === n) return;
    update.mutate({ aliquota_simples_nacional: n }, {
      onSuccess: () => toast.success("Alíquota atualizada"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/movimento")} aria-label="Voltar">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold leading-tight">{selectedCompany.nome_fantasia}</div>
              <div className="text-xs text-muted-foreground">{formatCNPJ(selectedCompany.cnpj)} · {selectedCompany.uf}</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Configurações</h1>
        </div>

        {isLoading || !config ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            {/* Card 1 — Column visibility */}
            <Card>
              <CardHeader>
                <CardTitle>Visibilidade de Colunas</CardTitle>
                <CardDescription>Escolha quais colunas aparecem na tabela do Movimento Fiscal, na página pública e na impressão.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {TOGGLEABLE_COLUMNS.map((col) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const checked = (config as any)[`show_${col}_column`] as boolean;
                    return (
                      <div key={col} className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor={`sw-${col}`} className="cursor-pointer">{TOGGLE_LABELS[col]}</Label>
                        <Switch
                          id={`sw-${col}`}
                          checked={checked}
                          onCheckedChange={(v) => toggleColumn(col, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Card 2 — Rename headers */}
            <Card>
              <CardHeader>
                <CardTitle>Renomear Cabeçalhos</CardTitle>
                <CardDescription>Personalize os rótulos das colunas. Salvo automaticamente ao sair do campo.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {LABEL_FIELDS.map((f) => (
                    <div key={f.key as string} className="space-y-1.5">
                      <Label htmlFor={`lbl-${f.key as string}`} className="text-xs text-muted-foreground">
                        {f.default}
                      </Label>
                      <Input
                        id={`lbl-${f.key as string}`}
                        value={labels[f.key as string] ?? ""}
                        onChange={(e) => setLabels({ ...labels, [f.key as string]: e.target.value })}
                        onBlur={() => saveLabel(f.key as string, f.default)}
                        placeholder={f.default}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Card 3 — Simples Nacional */}
            <Card>
              <CardHeader>
                <CardTitle>Cálculo Simples Nacional</CardTitle>
                <CardDescription>
                  Quando o cálculo automático está ativo, a coluna Simples Nacional é preenchida com <strong>Saída × Alíquota</strong> em cada competência.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label htmlFor="auto-sw" className="cursor-pointer font-medium">Cálculo Automático</Label>
                    <p className="text-xs text-muted-foreground">
                      Sobrescreve o valor manual da coluna Simples Nacional.
                    </p>
                  </div>
                  <Switch
                    id="auto-sw"
                    checked={config.auto_calculate_simples_nacional}
                    onCheckedChange={toggleAuto}
                  />
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <Label htmlFor="aliquota">Alíquota (%)</Label>
                  <Input
                    id="aliquota"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={aliquota}
                    onChange={(e) => setAliquota(e.target.value)}
                    onBlur={saveAliquota}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
