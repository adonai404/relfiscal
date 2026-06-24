import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface ReportCompanyRow {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  regime: string;
  entrada: number;
  saida: number;
  simples_nacional: number;
  icms: number;
  impostos_federais: number;
  honorarios: number;
  folha: number;
  encargos_patronal: number;
}

export interface ReportOptions {
  periodo: string;    // "YYYY-MM"
  geradoEm: Date;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const REGIME: Record<string, string> = {
  simples_nacional: "Simples Nac.",
  lucro_presumido: "Lucro Pres.",
  lucro_real: "Lucro Real",
  mei: "MEI",
};

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function fmtPeriodo(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  return `${MESES[parseInt(m, 10) - 1] ?? m}/${y}`;
}

function fmtBrl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(n: number): string {
  return `${n.toFixed(2).replace(".", ",")}%`;
}

function fmtCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").padStart(14, "0");
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}

// Cores (rgb)
const C_HEADER  = [30, 41, 59]   as [number,number,number]; // slate-800
const C_TOTAL   = [15, 23, 42]   as [number,number,number]; // slate-950
const C_ACCENT  = [15, 118, 110] as [number,number,number]; // teal-700
const C_STRIPE  = [248, 250, 252] as [number,number,number]; // slate-50
const C_TEXT    = [30, 41, 59]   as [number,number,number];
const C_MUTED   = [100, 116, 139] as [number,number,number]; // slate-500

// ─── Geração do PDF ───────────────────────────────────────────────────────────

export function generateConsolidatedPdf(
  rows: ReportCompanyRow[],
  options: ReportOptions,
): Uint8Array {
  const { periodo, geradoEm } = options;
  const periodoLabel = fmtPeriodo(periodo);
  const geradoLabel  = geradoEm.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();   // 297
  const H   = doc.internal.pageSize.getHeight();  // 210

  // ─── Totais ─────────────────────────────────────────────────────────────────
  const zero = { entrada:0, saida:0, simples_nacional:0, icms:0,
                 impostos_federais:0, honorarios:0, folha:0, encargos_patronal:0 };
  const totals = rows.reduce((acc, r) => ({
    entrada:           acc.entrada           + (r.entrada           ?? 0),
    saida:             acc.saida             + (r.saida             ?? 0),
    simples_nacional:  acc.simples_nacional  + (r.simples_nacional  ?? 0),
    icms:              acc.icms              + (r.icms              ?? 0),
    impostos_federais: acc.impostos_federais + (r.impostos_federais ?? 0),
    honorarios:        acc.honorarios        + (r.honorarios        ?? 0),
    folha:             acc.folha             + (r.folha             ?? 0),
    encargos_patronal: acc.encargos_patronal + (r.encargos_patronal ?? 0),
  }), zero);

  const totalImpostos = totals.simples_nacional + totals.icms + totals.impostos_federais;
  const aliqMedia     = totals.saida > 0 ? (totalImpostos / totals.saida) * 100 : 0;

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — Capa + Resumo Executivo
  // ══════════════════════════════════════════════════════════════════════════

  // Barra de topo
  doc.setFillColor(...C_HEADER);
  doc.rect(0, 0, W, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("RELATÓRIO FISCAL CONSOLIDADO", 14, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Competência: ${periodoLabel}`, 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(200, 210, 220);
  doc.text(
    `Gerado em ${geradoLabel}  ·  ${rows.length} empresa(s)`,
    W - 14, 22, { align: "right" },
  );

  // Título resumo
  doc.setTextColor(...C_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RESUMO EXECUTIVO", 14, 42);

  // Linha decorativa
  doc.setDrawColor(...C_ACCENT);
  doc.setLineWidth(0.6);
  doc.line(14, 44, 100, 44);

  // Tabela do resumo
  const summaryRows: string[][] = [
    ["Total de Entradas",                   fmtBrl(totals.entrada)],
    ["Total de Saídas (Faturamento)",        fmtBrl(totals.saida)],
    ["Total de Impostos  (SN + ICMS + Fed.)", fmtBrl(totalImpostos)],
    ["Alíquota Efetiva Média",              fmtPct(aliqMedia)],
    ["Total Honorários",                    fmtBrl(totals.honorarios)],
    ["Total Folha de Pagamento",            fmtBrl(totals.folha)],
    ["Total Encargos Patronais",            fmtBrl(totals.encargos_patronal)],
  ];

  autoTable(doc, {
    startY: 47,
    head: [],
    body: summaryRows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 86, textColor: C_TEXT },
      1: { cellWidth: 52, halign: "right", textColor: C_ACCENT, fontStyle: "bold" },
    },
    tableWidth: 138,
    margin: { left: 14 },
  });

  // Box de rodapé da capa
  const lastY = (doc as any).lastAutoTable?.finalY ?? 115;
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  doc.text(
    "Este relatório foi gerado automaticamente pelo Imperial App.",
    14, Math.max(lastY + 12, 125),
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 2+ — Tabela Consolidada
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();

  doc.setFillColor(...C_HEADER);
  doc.rect(0, 0, W, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`TABELA CONSOLIDADA  ·  ${periodoLabel.toUpperCase()}`, 14, 13);

  const head = [[
    "Empresa", "CNPJ", "Regime",
    "Entrada", "Saída",
    "Simples Nac.", "ICMS", "Imp. Fed.",
    "Honorários", "Folha", "Encargos",
    "Alíquota",
  ]];

  const body: string[][] = rows.map((r) => {
    const impostos = (r.simples_nacional ?? 0) + (r.icms ?? 0) + (r.impostos_federais ?? 0);
    const aliq     = r.saida > 0 ? (impostos / r.saida) * 100 : 0;
    return [
      r.nome_fantasia || r.razao_social,
      fmtCnpj(r.cnpj),
      REGIME[r.regime] ?? r.regime,
      fmtBrl(r.entrada           ?? 0),
      fmtBrl(r.saida             ?? 0),
      fmtBrl(r.simples_nacional  ?? 0),
      fmtBrl(r.icms              ?? 0),
      fmtBrl(r.impostos_federais ?? 0),
      fmtBrl(r.honorarios        ?? 0),
      fmtBrl(r.folha             ?? 0),
      fmtBrl(r.encargos_patronal ?? 0),
      fmtPct(aliq),
    ];
  });

  // Linha de totais
  body.push([
    "TOTAL", "", "",
    fmtBrl(totals.entrada),
    fmtBrl(totals.saida),
    fmtBrl(totals.simples_nacional),
    fmtBrl(totals.icms),
    fmtBrl(totals.impostos_federais),
    fmtBrl(totals.honorarios),
    fmtBrl(totals.folha),
    fmtBrl(totals.encargos_patronal),
    fmtPct(aliqMedia),
  ]);

  const totalRowIdx = body.length - 1;

  autoTable(doc, {
    startY: 24,
    head,
    body,
    theme: "striped",
    headStyles: {
      fillColor: C_HEADER,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      textColor: C_TEXT,
    },
    alternateRowStyles: { fillColor: C_STRIPE },
    columnStyles: {
      0:  { cellWidth: 46, overflow: "ellipsize" },
      1:  { cellWidth: 30 },
      2:  { cellWidth: 22, overflow: "ellipsize" },
      3:  { halign: "right", cellWidth: 22 },
      4:  { halign: "right", cellWidth: 22 },
      5:  { halign: "right", cellWidth: 22 },
      6:  { halign: "right", cellWidth: 18 },
      7:  { halign: "right", cellWidth: 18 },
      8:  { halign: "right", cellWidth: 22 },
      9:  { halign: "right", cellWidth: 22 },
      10: { halign: "right", cellWidth: 20 },
      11: { halign: "right", cellWidth: 16 },
    },
    willDrawCell(data) {
      // Estiliza linha de total
      if (data.row.index === totalRowIdx) {
        data.cell.styles.fillColor  = C_TOTAL;
        data.cell.styles.textColor  = [255, 255, 255];
        data.cell.styles.fontStyle  = "bold";
        data.cell.styles.fontSize   = 8;
      }
    },
    didDrawPage(data) {
      // Rodapé em cada página
      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(...C_MUTED);
      doc.text(
        `Relatório Fiscal Consolidado  ·  ${periodoLabel}  ·  Gerado por Imperial App  ·  Página ${data.pageNumber} de ${totalPages}`,
        W / 2, H - 5, { align: "center" },
      );
    },
    margin: { top: 24, left: 10, right: 10, bottom: 12 },
  });

  // Atualiza rodapé da página 1 com total de páginas correto
  const totalPages = doc.getNumberOfPages();
  doc.setPage(1);
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text(
    `Relatório Fiscal Consolidado  ·  ${periodoLabel}  ·  Gerado por Imperial App  ·  Página 1 de ${totalPages}`,
    W / 2, H - 5, { align: "center" },
  );

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
