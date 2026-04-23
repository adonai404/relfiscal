import * as XLSX from "xlsx";
import { ALL_COLUMNS, type ColumnKey, type FiscalConfig, getColumnLabel, isColumnVisible, isComputedColumn } from "@/hooks/useFiscalConfig";
import { displayCompetencia, normalizeCompetencia, parseBrNumber } from "./format";
import type { CustomColumn } from "@/hooks/useCustomColumns";
import { buildRowResolver } from "@/hooks/useCustomColumns";

export interface ParsedRow {
  competencia: string;
  values: Partial<Record<ColumnKey, number>>;
  customByKey?: Record<string, number>;
}

const competenciaHeaderLabel = (cfg?: FiscalConfig | null) => cfg?.label_competencia ?? "Competência";

// Build list of columns that should appear (visible) in the export/template.
// Computed/virtual columns (e.g. aliquota_simples_calc) are excluded — they're derived, not stored.
const visibleColumns = (cfg?: FiscalConfig | null): ColumnKey[] =>
  ALL_COLUMNS.filter((c) => !isComputedColumn(c) && isColumnVisible(cfg ?? undefined, c));

// Normalize header strings for matching: trim, lowercase, strip diacritics
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Parse numeric value supporting BR (1.234,56) and US (1,234.56) formats
const parseNum = (v: unknown): number => parseBrNumber(v as string | number | null | undefined);

export function downloadTemplate(
  cfg: FiscalConfig | null | undefined,
  fileName = "template-movimento.xlsx",
  customCols: CustomColumn[] = []
) {
  const cols = visibleColumns(cfg);
  const manualCustom = customCols
    .filter((c) => c.visible && c.kind === "manual")
    .sort((a, b) => a.position - b.position);
  const headers = [
    competenciaHeaderLabel(cfg),
    ...cols.map((c) => getColumnLabel(cfg ?? undefined, c)),
    ...manualCustom.map((c) => c.label),
  ];
  // 3 example empty rows with current and previous months
  const today = new Date();
  const examples: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    examples.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
  }
  const aoa: (string | number)[][] = [
    headers,
    ...examples.map((c) => [c, ...cols.map(() => 0), ...manualCustom.map(() => 0)]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimento");
  XLSX.writeFile(wb, fileName);
}

export function exportMovementToXlsx(
  rows: Array<{ competencia: string } & Partial<Record<ColumnKey, number>>>,
  cfg: FiscalConfig | null | undefined,
  fileName = "movimento-fiscal.xlsx",
  customCols: CustomColumn[] = [],
  // movement_id -> column_id -> value
  valuesByMov: Record<string, Record<string, number>> = {}
) {
  const cols = visibleColumns(cfg);
  const visibleCustom = customCols
    .filter((c) => c.visible)
    .sort((a, b) => a.position - b.position);
  const headers = [
    competenciaHeaderLabel(cfg),
    ...cols.map((c) => getColumnLabel(cfg ?? undefined, c)),
    ...visibleCustom.map((c) => c.label),
  ];
  const dataRows = rows.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowAny = r as any;
    const movId: string = rowAny.id ?? "";
    const resolver = buildRowResolver(rowAny, customCols, valuesByMov[movId] ?? {});
    return [
      displayCompetencia(r.competencia),
      ...cols.map((c) => Number(r[c] ?? 0)),
      ...visibleCustom.map((cc) => Number(resolver(cc.key))),
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimento");
  XLSX.writeFile(wb, fileName);
}

// Parse uploaded xlsx using current configuration to map labels back to keys
export async function parseXlsxFile(
  file: File,
  cfg: FiscalConfig | null | undefined,
  customCols: CustomColumn[] = []
): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  if (matrix.length < 2) return [];

  const headerRow = (matrix[0] || []).map((h) => norm(String(h ?? "")));

  // Map header index -> ColumnKey | 'competencia' | { custom: <customColumnKey> }
  const competenciaLabel = norm(competenciaHeaderLabel(cfg));
  const manualCustom = customCols.filter((c) => c.kind === "manual");
  const headerToKey: Record<number, ColumnKey | "competencia" | { custom: string }> = {};
  headerRow.forEach((h, i) => {
    if (!h) return;
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
    // try matching a custom manual column by label or key
    for (const cc of manualCustom) {
      if (h === norm(cc.label) || h === norm(cc.key)) {
        headerToKey[i] = { custom: cc.key };
        return;
      }
    }
  });

  const rows: ParsedRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    let competencia = "";
    const values: Partial<Record<ColumnKey, number>> = {};
    const customByKey: Record<string, number> = {};
    let hasAny = false;
    for (let i = 0; i < row.length; i++) {
      const key = headerToKey[i];
      if (!key) continue;
      const cell = row[i];
      if (key === "competencia") {
        competencia = normalizeCompetencia(String(cell ?? "").trim());
        if (competencia) hasAny = true;
      } else if (typeof key === "object" && "custom" in key) {
        customByKey[key.custom] = parseNum(cell);
      } else {
        values[key as ColumnKey] = parseNum(cell);
      }
    }
    if (hasAny && /^\d{4}-\d{2}$/.test(competencia)) {
      rows.push({ competencia, values, customByKey });
    }
  }
  return rows;
}
