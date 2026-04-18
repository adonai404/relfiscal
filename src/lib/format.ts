export const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(n ?? 0));

export const formatCNPJ = (cnpj: string) => {
  const d = (cnpj || "").replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

// Convert competencia stored as 'YYYY-MM' (or 'MM/YYYY') to displayable 'MM/YYYY'
export const displayCompetencia = (c: string) => {
  if (!c) return "";
  if (/^\d{4}-\d{2}$/.test(c)) {
    const [y, m] = c.split("-");
    return `${m}/${y}`;
  }
  return c;
};

// Parse a user-entered numeric string supporting BR (1.234,56) and US (1,234.56) formats.
// Accepts currency symbols, spaces, parentheses for negatives, and bare commas/dots.
export const parseBrNumber = (input: string | number | null | undefined): number => {
  if (input === null || input === undefined || input === "") return 0;
  if (typeof input === "number") return isNaN(input) ? 0 : input;
  let s = String(input).trim();
  if (!s) return 0;
  // Handle parentheses as negative: (123,45) => -123,45
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  // Strip currency and spaces
  s = s.replace(/[R$\s\u00A0]/gi, "");
  // Leading minus sign
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Whichever appears LAST is the decimal separator
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // BR: dots are thousands, comma is decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: commas are thousands, dot is decimal
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only comma -> decimal separator (BR)
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // else: only dot or none -> already valid
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negative ? -n : n;
};

// Normalize any input to 'YYYY-MM' for storage / sorting
export const normalizeCompetencia = (c: string) => {
  if (!c) return c;
  if (/^\d{4}-\d{2}$/.test(c)) return c;
  if (/^\d{2}\/\d{4}$/.test(c)) {
    const [m, y] = c.split("/");
    return `${y}-${m}`;
  }
  return c;
};
