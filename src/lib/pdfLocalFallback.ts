import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ExtractedData } from "./pdfExtract";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const moneyRe = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const toNumber = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

async function pdfToText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const Y_TOL = 3;
    const lineMap = new Map<number, Array<{ s: string; x: number; w: number }>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of content.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / Y_TOL) * Y_TOL;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ s: item.str, x: item.transform[4], w: item.width || 0 });
    }
    const lines = Array.from(lineMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, its]) => {
        its.sort((a, b) => a.x - b.x);
        let line = "";
        for (let k = 0; k < its.length; k++) {
          if (k > 0 && its[k].x - (its[k - 1].x + its[k - 1].w) > 5) line += "   ";
          line += its[k].s;
        }
        return line;
      });
    out += lines.join("\n") + "\n";
  }
  return out.replace(/ /g, " ");
}

function parseExtractedText(text: string): ExtractedData | null {
  // ── CNPJ ─────────────────────────────────────────────────────────────────────
  const cnpjMatch =
    text.match(/CNPJ\s+Matriz\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i) ??
    text.match(/CNPJ\s+Estabelecimento\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i) ??
    text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  const cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, "") : null;

  // ── Razão Social ──────────────────────────────────────────────────────────────
  const razaoMatch = text.match(/Nome\s+[Ee]mpresarial\s*:\s*([^\n\r]+?)(?:\s{2,}|[\n\r]|$)/);
  const razao_social = razaoMatch ? razaoMatch[1].trim() : null;

  // ── Competência ───────────────────────────────────────────────────────────────
  // Formato 1: "Período de Apuração: 01/05/2026 a 30/05/2026" → mês/ano da data inicial
  // Formato 2: "Período de Apuração (PA): 05/2026"
  let competencia: string | null = null;
  const periodRange = text.match(/Per[ií]odo\s+de\s+Apura[cç][aã]o\s*:\s*\d{2}\/(\d{2})\/(\d{4})/i);
  const periodPa    = text.match(/Per[ií]odo\s+de\s+Apura[cç][aã]o\s*\(PA\)\s*:\s*(\d{2})\/(\d{4})/i);
  if (periodRange) competencia = `${periodRange[2]}-${periodRange[1]}`;
  else if (periodPa) competencia = `${periodPa[2]}-${periodPa[1]}`;

  // ── RPA – Receita Bruta do PA - Competência ───────────────────────────────────
  // Tabela: [label]  Mercado Interno  Mercado Externo  Total
  // O rótulo pode usar hífen normal, en-dash ou em-dash antes de "Competência"
  const rpaIdx = text.search(/Receita\s+Bruta\s+do\s+PA\s*\(RPA\)\s*[-–—]\s*Compet[eê]ncia/i);
  let rpa: ExtractedData["rpa"] = null;
  if (rpaIdx >= 0) {
    const win  = text.slice(rpaIdx, rpaIdx + 600);
    const nums = Array.from(win.matchAll(moneyRe)).map((m) => toNumber(m[0]));
    if (nums.length >= 3) {
      rpa = { mercado_interno: nums[0], mercado_externo: nums[1], total: nums[2] };
    } else if (nums.length === 1) {
      // Alguns layouts trazem apenas o total na mesma linha
      rpa = { mercado_interno: nums[0], mercado_externo: 0, total: nums[0] };
    }
  }

  // ── RBT12 ─────────────────────────────────────────────────────────────────────
  const rbtIdx = text.search(/Receita\s+bruta\s+acumulada\s+nos\s+doze\s+meses\s+anteriores\s+ao\s+PA\s*\(RBT12\)/i);
  let rbt12: ExtractedData["rbt12"] = null;
  if (rbtIdx >= 0) {
    const win  = text.slice(rbtIdx, rbtIdx + 600);
    const nums = Array.from(win.matchAll(moneyRe)).map((m) => toNumber(m[0]));
    if (nums.length >= 3) {
      rbt12 = { mercado_interno: nums[0], mercado_externo: nums[1], total: nums[2] };
    }
  }

  // ── Valor do DAS / débito exigível ────────────────────────────────────────────
  let valor_pago_das = 0;

  // Formato 1 — PGDAS-D padrão (Receita Federal): seção "Arrecadação do DAS"
  const arrIdx = text.search(/Arrecada[cç][aã]o\s+do\s+DAS/i);
  if (arrIdx >= 0) {
    const win  = text.slice(arrIdx, arrIdx + 400);
    const nums = Array.from(win.matchAll(moneyRe)).map((m) => toNumber(m[0]));
    if (nums.length > 0) valor_pago_das = nums[nums.length - 1];
  }

  // Formato 2 — SITTAX / comprovante de declaração: "Total do Débito Exigível"
  // Tabela com 9 colunas: IRPJ | CSLL | COFINS | PIS/Pasep | INSS/CPP | ICMS | IPI | ISS | Total
  // Último valor da linha = total do débito exigível
  if (valor_pago_das === 0) {
    const debIdx = text.search(/Total\s+do\s+D[eé]bito\s+Exig[ií]vel/i);
    if (debIdx >= 0) {
      const win  = text.slice(debIdx, debIdx + 800);
      const nums = Array.from(win.matchAll(moneyRe)).map((m) => toNumber(m[0]));
      if (nums.length > 0) {
        // O layout pode trazer apenas a linha de valores (9 colunas) ou incluir
        // valores do header anterior. Em qualquer caso o total é o último.
        valor_pago_das = nums[nums.length - 1];
      }
    }
  }

  if (!cnpj || !competencia) return null;
  return {
    cnpj,
    razao_social,
    competencia,
    valor_pago_das,
    rpa: rpa ?? { mercado_interno: 0, mercado_externo: 0, total: 0 },
    rbt12,
  };
}

export async function extractLocally(file: File): Promise<ExtractedData | null> {
  try {
    const text = await pdfToText(file);
    return parseExtractedText(text);
  } catch (e) {
    console.warn("Local PDF extraction failed:", file.name, e);
    return null;
  }
}
