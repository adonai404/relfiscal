import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Usa o worker local empacotado pelo Vite. Evita falhas por CDN/CSP e URLs externas indisponíveis.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedData {
  fileName: string;
  companyName: string;
  cnpj: string;
  period: string;
  revenue: string;
  status: 'success' | 'error' | 'no_movement';
  errorMessage?: string;
}

export const normalizeCNPJ = (cnpj: string) => {
  return cnpj.replace(/\D/g, '');
};

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

export async function extractDataFromPDF(file: File): Promise<ExtractedData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Agrupar itens por coordenada Y para reconstruir as linhas preservando o layout
      const Y_TOL = 3;
      const lineMap = new Map<number, Array<{ str: string; x: number; w: number }>>();
      for (const item of textContent.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / Y_TOL) * Y_TOL;
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push({ str: item.str, x: item.transform[4], w: item.width || 0 });
      }
      const sortedLines = Array.from(lineMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) => {
          items.sort((a, b) => a.x - b.x);
          let line = '';
          for (let k = 0; k < items.length; k++) {
            if (k > 0 && items[k].x - (items[k - 1].x + items[k - 1].w) > 5) {
              line += '   ';
            }
            line += items[k].str;
          }
          return line;
        });
      fullText += sortedLines.join('\n') + '\n';
    }

    return parseFiscalText(fullText, file.name);
  } catch (error) {
    console.error(`Erro ao processar ${file.name}:`, error);
    return {
      fileName: file.name,
      companyName: 'Erro',
      cnpj: 'Erro',
      period: 'Erro',
      revenue: '0,00',
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

export async function processInBatches(
  files: File[], 
  batchSize: number, 
  onProgress: (processed: number) => void
): Promise<ExtractedData[]> {
  const results: ExtractedData[] = [];
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(file => extractDataFromPDF(file)));
    results.push(...batchResults);
    onProgress(Math.min(i + batchSize, files.length));
  }
  
  return results;
}
