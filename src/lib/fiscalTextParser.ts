export interface ExtractedData {
  fileName: string;
  companyName: string;
  cnpj: string;
  period: string;
  revenue: string;
  status: 'success' | 'error' | 'no_movement';
  errorMessage?: string;
}

const moneyPattern = /\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g;

const parseMoney = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0;

const normalizeText = (text: string) => text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

const findLineValue = (lines: string[], label: RegExp) => {
  const line = lines.find((item) => label.test(item));
  if (!line) return null;
  const [, value = ''] = line.split(/:\s*/);
  return value.trim() || null;
};

export function parseFiscalText(fullText: string, fileName: string): ExtractedData {
  const text = fullText.replace(/\u00a0/g, ' ');
  const lines = text.split(/\r?\n/).map(normalizeText).filter(Boolean);

  const companyName = findLineValue(lines, /^Nome empresarial\s*:/i) ?? 'Não encontrado';
  const cnpjMatch = text.match(/CNPJ\s+Matriz\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
  const periodMatch = text.match(/Período\s+de\s+Apuração\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const rpaIndex = lines.findIndex((line) => /Receita\s+Bruta\s+do\s+PA\s*\(RPA\)\s*-\s*Competência/i.test(line));

  let revenue = 'Declarado sem movimento';
  let status: 'success' | 'no_movement' = 'no_movement';

  if (rpaIndex >= 0) {
    const revenueWindow = lines.slice(rpaIndex, rpaIndex + 6).join(' ');
    const values = Array.from(revenueWindow.matchAll(moneyPattern), (match) => match[0]);
    const rpaValues = values.slice(0, 3);
    const total = rpaValues[2] ?? rpaValues[0];

    if (total && rpaValues.some((value) => parseMoney(value) > 0)) {
      revenue = total;
      status = 'success';
    }
  }

  return {
    fileName,
    companyName,
    cnpj: cnpjMatch?.[1]?.trim() ?? 'Não encontrado',
    period: periodMatch ? `${periodMatch[2]}/${periodMatch[3]}` : 'Não encontrado',
    revenue,
    status
  };
}