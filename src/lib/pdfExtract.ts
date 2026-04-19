// Cliente para a API pública de extração de extratos do Simples Nacional.
// Doc: https://bxzefwentojlteyjerpc.supabase.co/functions/v1/api-docs

const API_BASE = "https://bxzefwentojlteyjerpc.supabase.co/functions/v1";
const EXTRACT_URL = `${API_BASE}/simples-nacional-extract`;

export const PDF_API_LIMITS = {
  maxBytes: 20 * 1024 * 1024, // 20 MB por arquivo
};

export interface ExtractedRpa {
  mercado_interno: number | null;
  mercado_externo: number | null;
  total: number | null;
}

export interface ExtractedData {
  cnpj: string | null;
  razao_social: string | null;
  competencia: string | null; // YYYY-MM
  valor_pago_das: number | null;
  rpa: ExtractedRpa | null;
  rbt12: ExtractedRpa | null;
}

export interface ExtractSuccess {
  file_name: string;
  status: "success";
  data: ExtractedData;
}

export interface ExtractError {
  file_name: string;
  status: "error";
  error_code: "INVALID_PDF_FORMAT" | "CORRUPTED_FILE" | "MISSING_REQUIRED_FIELDS" | "UNSUPPORTED_VERSION" | string;
  error_message: string;
}

export interface ExtractResponse {
  success: boolean;
  processed: number;
  failed: number;
  results: ExtractSuccess[];
  errors: ExtractError[];
}

export const ERROR_CODE_LABELS: Record<string, string> = {
  INVALID_PDF_FORMAT: "PDF não é um extrato do Simples Nacional reconhecível.",
  CORRUPTED_FILE: "Arquivo corrompido, ilegível ou maior que 20MB.",
  MISSING_REQUIRED_FIELDS: "CNPJ ou competência ausentes na extração.",
  UNSUPPORTED_VERSION: "Layout do extrato ainda não suportado pela API.",
};

export function describeError(code: string): string {
  return ERROR_CODE_LABELS[code] ?? "Falha desconhecida ao processar o PDF.";
}

export async function extractPdfsSync(files: File[]): Promise<ExtractResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um PDF.");
  const tooBig = files.find((f) => f.size > PDF_API_LIMITS.maxBytes);
  if (tooBig) throw new Error(`O arquivo "${tooBig.name}" excede 20MB.`);

  const form = new FormData();
  files.forEach((f) => form.append("files[]", f, f.name));

  const res = await fetch(EXTRACT_URL, { method: "POST", body: form });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.message || j?.error || JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(`Falha na API de extração (${res.status}). ${detail}`);
  }
  return (await res.json()) as ExtractResponse;
}
