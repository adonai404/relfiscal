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
