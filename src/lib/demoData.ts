import type { Company } from "@/hooks/useCompany";

export const DEMO_COMPANIES: Company[] = [
  {
    id: "demo-1",
    cnpj: "12345678000190",
    razao_social: "Comércio Demonstração LTDA",
    nome_fantasia: "Demo Comércio",
    uf: "SP",
    slug: "demo-comercio",
  },
  {
    id: "demo-2",
    cnpj: "98765432000111",
    razao_social: "Serviços Exemplo S/A",
    nome_fantasia: "Demo Serviços",
    uf: "RJ",
    slug: "demo-servicos",
  },
  {
    id: "demo-3",
    cnpj: "11222333000144",
    razao_social: "Indústria Modelo EIRELI",
    nome_fantasia: "Demo Indústria",
    uf: "MG",
    slug: "demo-industria",
  },
];

export type DemoMovementRow = {
  id: string;
  company_id: string;
  competencia: string;
  entrada: number;
  saida: number;
  icms: number;
  impostos_federais: number;
  simples_nacional: number;
  honorarios: number;
  folha: number;
  encargos_patronal: number;
  difal: number;
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
};

const months = [
  "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
];

function genRows(companyId: string, base: number): DemoMovementRow[] {
  return months.map((m, i) => {
    const factor = 0.85 + (i % 5) * 0.07;
    const entrada = Math.round(base * factor);
    const saida = Math.round(base * factor * 1.35);
    return {
      id: `${companyId}-${m}`,
      company_id: companyId,
      competencia: m,
      entrada,
      saida,
      icms: Math.round(saida * 0.18),
      impostos_federais: Math.round(saida * 0.0925),
      simples_nacional: Math.round(saida * 0.06),
      honorarios: 1500 + (i * 50),
      folha: Math.round(base * 0.22),
      encargos_patronal: Math.round(base * 0.07),
      difal: Math.round(saida * 0.012),
      pis: Math.round(saida * 0.0165),
      cofins: Math.round(saida * 0.076),
      irpj: Math.round(saida * 0.015),
      csll: Math.round(saida * 0.009),
    };
  });
}

export const DEMO_MOVEMENTS: Record<string, DemoMovementRow[]> = {
  "demo-1": genRows("demo-1", 85000),
  "demo-2": genRows("demo-2", 42000),
  "demo-3": genRows("demo-3", 158000),
};

export const isDemoCompany = (id: string | undefined | null) =>
  !!id && id.startsWith("demo-");
