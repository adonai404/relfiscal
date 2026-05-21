import * as pdfjs from 'pdfjs-dist';

// Configurar o worker do PDF.js usando a URL local do node_modules via Vite ou fallback
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + ' ';
    }

    // Regras de extração baseadas nas especificações
    
    // 1. Empresa: Extrair o texto após 'Nome empresarial:', parando antes de 'Data de abertura' ou 'CNPJ' ou 'Data da consulta'
    let companyName = 'Não encontrado';
    const companyMatch = fullText.match(/Nome empresarial:\s*(.*?)(?=\s*(Data de abertura|CNPJ|Data da consulta|$))/i);
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
    
    // Tenta encontrar o bloco de receita bruta
    const rpaMatch = fullText.match(/Receita Bruta do PA \(RPA\) - Competência\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)/i);
    
    if (rpaMatch) {
      const totalValue = rpaMatch[3].trim();
      const internalValue = rpaMatch[1].trim();
      const externalValue = rpaMatch[2].trim();
      
      const isZero = (val: string) => val === '0,00' || /^0+([.,]0+)?$/.test(val);
      
      if (isZero(internalValue) && isZero(externalValue) && isZero(totalValue)) {
        revenue = 'Declarado sem movimento';
        status = 'no_movement';
      } else {
        revenue = totalValue;
        status = 'success';
      }
    } else {
      // Fallback para caso o formato seja levemente diferente
      const fallbackMatch = fullText.match(/Receita Bruta do PA \(RPA\):\s*R?\$\s*([\d.,]+)/i);
      if (fallbackMatch && fallbackMatch[1]) {
        revenue = fallbackMatch[1].trim();
        if (revenue === '0,00') {
          revenue = 'Declarado sem movimento';
          status = 'no_movement';
        }
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
