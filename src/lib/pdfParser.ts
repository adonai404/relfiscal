import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseFiscalText, type ExtractedData } from './fiscalTextParser';

// Usa o worker local empacotado pelo Vite. Evita falhas por CDN/CSP e URLs externas indisponíveis.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type { ExtractedData } from './fiscalTextParser';

export const normalizeCNPJ = (cnpj: string) => {
  return cnpj.replace(/\D/g, '');
};

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
