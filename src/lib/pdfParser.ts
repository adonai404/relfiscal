import * as pdfjs from 'pdfjs-dist';

// Configurar o worker do PDF.js usando a URL legada do unpkg para evitar problemas de ESM/mjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

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

    // Regras de extração baseadas nas especificações
    
    // 1. Empresa: Extrair o texto após 'Nome empresarial:'
    let companyName = 'Não encontrado';
    const companyMatch = fullText.match(/Nome empresarial:\s*(.+?)(?=\s{2,}|\n|Data de abertura|CNPJ|$)/i);
    if (companyMatch && companyMatch[1]) {
      companyName = companyMatch[1].trim();
    }

    // 2. CNPJ: Localizar o padrão 'CNPJ Matriz: XX.XXX.XXX/XXXX-XX'
    let cnpj = 'Não encontrado';
    const cnpjMatch = fullText.match(/CNPJ Matriz:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
    if (cnpjMatch && cnpjMatch[1]) {
      cnpj = cnpjMatch[1].trim();
    }

    // 3. Competência: Extrair a data inicial do campo 'Período de Apuração' e transformar para MM/AAAA
    let period = 'Não encontrado';
    const periodMatch = fullText.match(/Período de Apuração:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (periodMatch && periodMatch[2] && periodMatch[3]) {
      period = `${periodMatch[2]}/${periodMatch[3]}`;
    }

    // 4. Receita: Buscar o valor correspondente em "Receita Bruta do PA (RPA) - Competência"
    let revenue = '0,00';
    let status: 'success' | 'no_movement' = 'success';

    const isZero = (v: string) => /^0+([.,]0+)?$/.test(v.replace(/\./g, '').replace(',', '.').replace(/\s/g, '')) || v === '0,00';

    // Procura os 3 valores numéricos (Mercado Interno | Mercado Externo | Total) após "Receita Bruta do PA (RPA)"
    const rpaRegex = /Receita Bruta do PA \(RPA\)[^\d\n]*?([\d.]+,\d{2})[^\d\n]*?([\d.]+,\d{2})[^\d\n]*?([\d.]+,\d{2})/i;
    const rpaMatch = fullText.match(rpaRegex);

    if (rpaMatch) {
      const [, interno, externo, total] = rpaMatch;
      if (isZero(interno) && isZero(externo) && isZero(total)) {
        revenue = 'Declarado sem movimento';
        status = 'no_movement';
      } else {
        revenue = total;
        status = 'success';
      }
    } else {
      // Fallback: captura qualquer valor monetário após a label
      const fallback = fullText.match(/Receita Bruta do PA \(RPA\)[^\d]*?([\d.]+,\d{2})/i);
      if (fallback && fallback[1]) {
        revenue = isZero(fallback[1]) ? 'Declarado sem movimento' : fallback[1];
        status = isZero(fallback[1]) ? 'no_movement' : 'success';
      } else {
        revenue = 'Declarado sem movimento';
        status = 'no_movement';
      }
    }

    return {
      fileName: file.name,
      companyName,
      cnpj,
      period,
      revenue,
      status
    };
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
