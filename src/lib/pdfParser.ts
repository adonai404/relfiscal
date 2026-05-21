import * as pdfjs from 'pdfjs-dist';

// Configurar o worker do PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
    
    // 1. Empresa: Extrair o texto após 'Nome empresarial:', parando antes de 'Data de abertura' ou 'CNPJ'
    let companyName = 'Não encontrado';
    const companyMatch = fullText.match(/Nome empresarial:\s*(.*?)(?=\s*(Data de abertura|CNPJ|$))/i);
    if (companyMatch && companyMatch[1]) {
      companyName = companyMatch[1].trim();
    }

    // 2. CNPJ: Localizar o padrão 'CNPJ Matriz: XX.XXX.XXX/XXXX-XX'
    let cnpj = 'Não encontrado';
    const cnpjMatch = fullText.match(/CNPJ Matriz:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
    if (cnpjMatch && cnpjMatch[1]) {
      cnpj = cnpjMatch[1].trim();
    }

    // 3. Competência: Extrair o mês/ano do 'Período de Apuração'
    let period = 'Não encontrado';
    const periodMatch = fullText.match(/Período de Apuração:\s*(\d{2}\/\d{4})/i);
    if (periodMatch && periodMatch[1]) {
      period = periodMatch[1].trim();
    }

    // 4. Receita: Capturar o valor total da 'Receita Bruta do PA (RPA)'
    let revenue = '0,00';
    let status: 'success' | 'no_movement' = 'success';
    const revenueMatch = fullText.match(/Receita Bruta do PA \(RPA\):\s*R\$\s*([\d.,]+)/i);
    if (revenueMatch && revenueMatch[1]) {
      revenue = revenueMatch[1].trim();
      if (revenue === '0,00' || /^0+([.,]0+)?$/.test(revenue)) {
        status = 'no_movement';
      }
    } else {
      // Tentar sem o R$
      const revenueMatchAlt = fullText.match(/Receita Bruta do PA \(RPA\):\s*([\d.,]+)/i);
      if (revenueMatchAlt && revenueMatchAlt[1]) {
        revenue = revenueMatchAlt[1].trim();
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
