import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
 import { Building2, ChevronLeft, Download, FileSpreadsheet, Loader2, Settings as SettingsIcon, Upload, Database, Key } from "lucide-react";
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
  TAX_ELIGIBLE_COLUMNS,
  getTaxColumns,
} from "@/hooks/useFiscalConfig";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatCNPJ } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { downloadTemplate, exportMovementToXlsx } from "@/lib/xlsx";
import { useXlsxImport } from "@/hooks/useXlsxImport";
import { CustomColumnsManager } from "@/components/CustomColumnsManager";
import { useCustomColumns, useCustomColumnValues } from "@/hooks/useCustomColumns";

const TOGGLE_LABELS: Record<ColumnKey, string> = {
  entrada: "Entrada", saida: "Saída", icms: "ICMS", impostos_federais: "Impostos Federais",
  simples_nacional: "Simples Nacional", aliquota_simples_calc: "Alíquota Simples (calc.)",
  honorarios: "Honorários", folha: "Folha",
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
  const { data: customCols = [] } = useCustomColumns(companyId);
  const { data: customValues = [] } = useCustomColumnValues(companyId);
  const xlsx = useXlsxImport(companyId, config, customCols);

  const valuesByMov = (() => {
    const out: Record<string, Record<string, number>> = {};
    customValues.forEach((v) => { (out[v.movement_id] ||= {})[v.column_id] = Number(v.value || 0); });
    return out;
  })();

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

  const currentTaxCols = getTaxColumns(config ?? undefined);
  const toggleTaxColumn = (col: ColumnKey, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...currentTaxCols, col]))
      : currentTaxCols.filter((c) => c !== col);
    update.mutate(
      { tax_columns: next } as Partial<FiscalConfig>,
      {
        onSuccess: () =>
          toast.success(
            `${TOGGLE_LABELS[col]} ${checked ? "passou a contar" : "deixou de contar"} como imposto`,
          ),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/app")} aria-label="Voltar">
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

      <main className="max-w-4xl mx-auto w-full px-4 py-8 sm:px-6 space-y-8">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Conexão API</h1>
        </div>

        {isLoading || !config ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  Credenciais de Acesso
                </CardTitle>
                <CardDescription>
                  Utilize estas credenciais para integrar seus sistemas externos e enviar dados de entrada e saída.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>ID da Empresa (company_id)</Label>
                  <div className="flex gap-2">
                    <Input value={selectedCompany.id} readOnly className="font-mono bg-muted" />
                    <Button variant="outline" onClick={() => {
                      navigator.clipboard.writeText(selectedCompany.id);
                      toast.success("ID copiado!");
                    }}>Copiar</Button>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Endpoint de Integração</h4>
                  <code className="text-xs break-all block p-2 bg-card border rounded mb-2">
                    POST https://{window.location.host}/api/v1/movement
                  </code>
                  <p className="text-xs text-muted-foreground">
                    O endpoint aceita requisições JSON contendo os valores de entrada, saída e competência.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações de Recebimento</CardTitle>
                <CardDescription>
                  Configure como o sistema deve processar os dados recebidos via API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Processamento Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Calcular impostos e métricas imediatamente após o recebimento.
                    </p>
                  </div>
                  <Switch 
                    checked={config.auto_calculate_simples_nacional} 
                    onCheckedChange={toggleAuto} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rótulo para Entrada via API</Label>
                    <Input 
                      value={labels.label_entrada || "Entrada"} 
                      onChange={(e) => setLabels({ ...labels, label_entrada: e.target.value })}
                      onBlur={() => saveLabel("label_entrada", "Entrada")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rótulo para Saída via API</Label>
                    <Input 
                      value={labels.label_saida || "Saída"} 
                      onChange={(e) => setLabels({ ...labels, label_saida: e.target.value })}
                      onBlur={() => saveLabel("label_saida", "Saída")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex gap-3">
              <SettingsIcon className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-amber-700">Modo de Somente API</p>
                <p className="text-amber-600">Esta tela foi simplificada para focar na integração de dados. As configurações de interface foram movidas para a administração global.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
