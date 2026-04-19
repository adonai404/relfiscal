import * as XLSX from "xlsx";
import { ALL_COLUMNS, type ColumnKey, type FiscalConfig, getColumnLabel, isComputedColumn } from "@/hooks/useFiscalConfig";
import { normalizeCompetencia, parseBrNumber } from "./format";

export type TaxRegime = "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei";

export interface ParsedCompanyRow {
  cnpj: string; // 14 digits, no mask
  razao_social: string;
  nome_fantasia: string;
  uf: string;
  regime: TaxRegime;
}

export interface ParsedBatchMovementRow {
  cnpj: string; // 14 digits
  competencia: string; // YYYY-MM
  values: Partial<Record<ColumnKey, number>>;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const onlyDigits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

const REGIME_MAP: Record<string, TaxRegime> = {
  "simples nacional": "simples_nacional",
  "simples": "simples_nacional",
  "sn": "simples_nacional",
  "lucro presumido": "lucro_presumido",
  "presumido": "lucro_presumido",
  "lp": "lucro_presumido",
  "lucro real": "lucro_real",
  "real": "lucro_real",
  "lr": "lucro_real",
  "mei": "mei",
};
const parseRegime = (v: unknown): TaxRegime => {
  const k = norm(String(v ?? ""));
  return REGIME_MAP[k] ?? "simples_nacional";
};

// ---------- COMPANIES ----------

export function downloadCompaniesTemplate(fileName = "template-empresas.xlsx") {
  const headers = ["CNPJ", "Razão Social", "Nome Fantasia", "UF", "Regime"];
  const examples: (string | number)[][] = [
    ["00.000.000/0001-91", "Empresa Exemplo LTDA", "Exemplo", "SP", "Simples Nacional"],
    ["11.222.333/0001-44", "Outra Empresa LTDA", "Outra", "MG", "Lucro Presumido"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws["!cols"] = [{ wch: 22 }, { wch: 32 }, { wch: 22 }, { wch: 6 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Empresas");
  XLSX.writeFile(wb, fileName);
}

export async function parseCompaniesFile(file: File): Promise<ParsedCompanyRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  if (matrix.length < 2) return [];

  const header = (matrix[0] || []).map((h) => norm(String(h ?? "")));
  const idx = {
    cnpj: header.findIndex((h) => h === "cnpj"),
    razao: header.findIndex((h) => ["razao social", "razao", "razão social"].includes(h)),
    fantasia: header.findIndex((h) => ["nome fantasia", "fantasia", "nome"].includes(h)),
    uf: header.findIndex((h) => h === "uf" || h === "estado"),
    regime: header.findIndex((h) => ["regime", "regime tributario", "regime tributário"].includes(h)),
  };
  if (idx.cnpj < 0) throw new Error("Coluna 'CNPJ' não encontrada na planilha de empresas.");

  const rows: ParsedCompanyRow[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const cnpj = onlyDigits(row[idx.cnpj]);
    if (cnpj.length !== 14) continue;
    if (seen.has(cnpj)) continue;
    seen.add(cnpj);
    const razao = String(row[idx.razao] ?? "").trim() || "A definir";
    const fantasia = String(row[idx.fantasia] ?? "").trim() || razao;
    const uf = String(row[idx.uf] ?? "").trim().toUpperCase().slice(0, 2) || "SP";
    const regime = idx.regime >= 0 ? parseRegime(row[idx.regime]) : "simples_nacional";
    rows.push({ cnpj, razao_social: razao, nome_fantasia: fantasia, uf, regime });
  }
  return rows;
}

// ---------- BATCH MOVEMENT (multi-company by CNPJ) ----------

const visibleCols = (cfg?: FiscalConfig | null): ColumnKey[] =>
  ALL_COLUMNS.filter((c) => !isComputedColumn(c));

export function downloadBatchMovementTemplate(
  cfg: FiscalConfig | null | undefined,
  fileName = "template-movimento-em-lote.xlsx"
) {
  const cols = visibleCols(cfg);
  const headers = ["CNPJ", cfg?.label_competencia ?? "Competência", ...cols.map((c) => getColumnLabel(cfg ?? undefined, c))];
  const today = new Date();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const y = today.getFullYear();
  const examples: (string | number)[][] = [
    ["00.000.000/0001-91", `${m}/${y}`, ...cols.map(() => 0)],
    ["11.222.333/0001-44", `${m}/${y}`, ...cols.map(() => 0)],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimento");
  XLSX.writeFile(wb, fileName);
}

export async function parseBatchMovementFile(
  file: File,
  cfg: FiscalConfig | null | undefined
): Promise<ParsedBatchMovementRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  if (matrix.length < 2) return [];

  const header = (matrix[0] || []).map((h) => norm(String(h ?? "")));
  const cnpjIdx = header.findIndex((h) => h === "cnpj");
  if (cnpjIdx < 0) throw new Error("Coluna 'CNPJ' não encontrada na planilha de movimento em lote.");

  const competenciaLabel = norm(cfg?.label_competencia ?? "Competência");
  const headerToKey: Record<number, ColumnKey | "competencia"> = {};
  header.forEach((h, i) => {
    if (!h || i === cnpjIdx) return;
    if (h === competenciaLabel || h === "competencia" || h === "competência" || h === "mes" || h === "mês") {
      headerToKey[i] = "competencia";
      return;
    }
    for (const c of ALL_COLUMNS) {
      if (isComputedColumn(c)) continue;
      const label = norm(getColumnLabel(cfg ?? undefined, c));
      const fallback = norm(c.replace(/_/g, " "));
      if (h === label || h === fallback) {
        headerToKey[i] = c;
        return;
      }
    }
  });

  const rows: ParsedBatchMovementRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const cnpj = onlyDigits(row[cnpjIdx]);
    if (cnpj.length !== 14) continue;

    let competencia = "";
    const values: Partial<Record<ColumnKey, number>> = {};
    for (let i = 0; i < row.length; i++) {
      const key = headerToKey[i];
      if (!key) continue;
      const cell = row[i];
      if (key === "competencia") {
        competencia = normalizeCompetencia(String(cell ?? "").trim());
      } else {
        values[key] = parseBrNumber(cell as string | number | null | undefined);
      }
    }
    if (/^\d{4}-\d{2}$/.test(competencia)) {
      rows.push({ cnpj, competencia, values });
    }
  }
  return rows;
}
