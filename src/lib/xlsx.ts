import * as XLSX from "xlsx";
import { ALL_COLUMNS, type ColumnKey, type FiscalConfig, getColumnLabel, isColumnVisible } from "@/hooks/useFiscalConfig";
import { displayCompetencia, normalizeCompetencia } from "./format";

export interface ParsedRow {
  competencia: string;
  values: Partial<Record<ColumnKey, number>>;
}

const competenciaHeaderLabel = (cfg?: FiscalConfig | null) => cfg?.label_competencia ?? "Competência";

// Build list of columns that should appear (visible) in the export/template
const visibleColumns = (cfg?: FiscalConfig | null): ColumnKey[] =>
  ALL_COLUMNS.filter((c) => isColumnVisible(cfg ?? undefined, c));

// Normalize header strings for matching: trim, lowercase, strip diacritics
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Parse numeric value supporting BR (1.234,56) and US (1,234.56) formats
const parseNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (!s) return 0;
  // Remove currency symbols and spaces
  s = s.replace(/[R$\s]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Assume BR: dot thousand sep, comma decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export function downloadTemplate(cfg: FiscalConfig | null | undefined, fileName = "template-movimento.xlsx") {
  const cols = visibleColumns(cfg);
  const headers = [competenciaHeaderLabel(cfg), ...cols.map((c) => getColumnLabel(cfg ?? undefined, c))];
  // 3 example empty rows with current and previous months
  const today = new Date();
  const examples: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    examples.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
  }
  const aoa: (string | number)[][] = [headers, ...examples.map((c) => [c, ...cols.map(() => 0)])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimento");
  XLSX.writeFile(wb, fileName);
}

export function exportMovementToXlsx(
  rows: Array<{ competencia: string } & Partial<Record<ColumnKey, number>>>,
  cfg: FiscalConfig | null | undefined,
  fileName = "movimento-fiscal.xlsx"
) {
  const cols = visibleColumns(cfg);
  const headers = [competenciaHeaderLabel(cfg), ...cols.map((c) => getColumnLabel(cfg ?? undefined, c))];
  const dataRows = rows.map((r) => [
    displayCompetencia(r.competencia),
    ...cols.map((c) => Number(r[c] ?? 0)),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimento");
  XLSX.writeFile(wb, fileName);
}

// Parse uploaded xlsx using current configuration to map labels back to keys
export async function parseXlsxFile(file: File, cfg: FiscalConfig | null | undefined): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  if (matrix.length < 2) return [];

  const headerRow = (matrix[0] || []).map((h) => norm(String(h ?? "")));

  // Map header index -> ColumnKey (or 'competencia')
  const competenciaLabel = norm(competenciaHeaderLabel(cfg));
  const headerToKey: Record<number, ColumnKey | "competencia"> = {};
  headerRow.forEach((h, i) => {
    if (!h) return;
    if (h === competenciaLabel || h === "competencia" || h === "competência" || h === "mes" || h === "mês") {
      headerToKey[i] = "competencia";
      return;
    }
    for (const c of ALL_COLUMNS) {
      const label = norm(getColumnLabel(cfg ?? undefined, c));
      const fallback = norm(c.replace(/_/g, " "));
      if (h === label || h === fallback) {
        headerToKey[i] = c;
        return;
      }
    }
  });

  const rows: ParsedRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    let competencia = "";
    const values: Partial<Record<ColumnKey, number>> = {};
    let hasAny = false;
    for (let i = 0; i < row.length; i++) {
      const key = headerToKey[i];
      if (!key) continue;
      const cell = row[i];
      if (key === "competencia") {
        competencia = normalizeCompetencia(String(cell ?? "").trim());
        if (competencia) hasAny = true;
      } else {
        values[key] = parseNum(cell);
      }
    }
    if (hasAny && /^\d{4}-\d{2}$/.test(competencia)) {
      rows.push({ competencia, values });
    }
  }
  return rows;
}
