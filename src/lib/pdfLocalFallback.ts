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
  return out.replace(/\u00a0/g, " ");
}

function parseExtractedText(text: string): ExtractedData | null {
  // CNPJ (Matriz ou Estabelecimento — sempre 14 dígitos formatado)
  const cnpjMatch =
    text.match(/CNPJ\s+Matriz\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i) ??
    text.match(/CNPJ\s+Estabelecimento\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i) ??
    text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  const cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, "") : null;

  // Nome empresarial
  const razaoMatch = text.match(/Nome\s+[Ee]mpresarial\s*:\s*([^\n\r]+?)(?:\s{2,}|[\n\r]|$)/);
  const razao_social = razaoMatch ? razaoMatch[1].trim() : null;

  // Competência: "Período de Apuração: 01/06/2025 a 30/06/2025" OU "Período de Apuração (PA): 04/2025"
  let competencia: string | null = null;
  const periodRange = text.match(/Per[ií]odo\s+de\s+Apura[cç][aã]o\s*:\s*\d{2}\/(\d{2})\/(\d{4})/i);
  const periodPa = text.match(/Per[ií]odo\s+de\s+Apura[cç][aã]o\s*\(PA\)\s*:\s*(\d{2})\/(\d{4})/i);
  if (periodRange) competencia = `${periodRange[2]}-${periodRange[1]}`;
  else if (periodPa) competencia = `${periodPa[2]}-${periodPa[1]}`;

  // RPA – Competência: três valores (interno, externo, total) na sequência após o rótulo
  const rpaIdx = text.search(/Receita\s+Bruta\s+do\s+PA\s*\(RPA\)\s*-\s*Compet[eê]ncia/i);
  let rpa: ExtractedData["rpa"] = null;
  if (rpaIdx >= 0) {
    const window = text.slice(rpaIdx, rpaIdx + 600);
    const nums = Array.from(window.matchAll(moneyRe)).map((m) => toNumber(m[0]));
    if (nums.length >= 3) {
      rpa = { mercado_interno: nums[0], mercado_externo: nums[1], total: nums[2] };
    }
  }

  // RBT12
  const rbtIdx = text.search(/Receita\s+bruta\s+acumulada\s+nos\s+doze\s+meses\s+anteriores\s+ao\s+PA\s*\(RBT12\)/i);
  let rbt12: ExtractedData["rbt12"] = null;
  if (rbtIdx >= 0) {
    const window = text.slice(rbtIdx, rbtIdx + 600);
    const nums = Array.from(window.matchAll(moneyRe)).map((m) => toNumber(m[0]));
    if (nums.length >= 3) {
      rbt12 = { mercado_interno: nums[0], mercado_externo: nums[1], total: nums[2] };
    }
  }

  // Valor pago do DAS (declaração retificadora pode não ter)
  let valor_pago_das = 0;
  const arrIdx = text.search(/Arrecada[cç][aã]o\s+do\s+DAS/i);
  if (arrIdx >= 0) {
    const window = text.slice(arrIdx, arrIdx + 400);
    const nums = Array.from(window.matchAll(moneyRe)).map((m) => toNumber(m[0]));
    if (nums.length > 0) valor_pago_das = nums[nums.length - 1];
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
    console.warn("Local PDF fallback failed:", file.name, e);
    return null;
  }
}