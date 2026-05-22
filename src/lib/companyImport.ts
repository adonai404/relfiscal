import { supabase } from "@/integrations/supabase/client";

export interface ImportCompanyInput {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  uf?: string;
  regime?: "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei";
}

export interface ImportCompanyResult {
  id: string;
  cnpj: string;
  created: boolean;
}

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export async function getOrCreateImportCompanies(rows: ImportCompanyInput[]) {
  const unique = new Map<string, ImportCompanyInput>();

  rows.forEach((row) => {
    const cnpj = onlyDigits(row.cnpj);
    if (cnpj && !unique.has(cnpj)) unique.set(cnpj, { ...row, cnpj });
  });

  const results = await Promise.all(
    Array.from(unique.values()).map(async (row) => {
      const { data, error } = await (supabase as any).rpc("get_or_create_import_company", {
        _cnpj: row.cnpj,
        _razao_social: row.razao_social || "A definir",
        _nome_fantasia: row.nome_fantasia || row.razao_social || `Empresa ${row.cnpj.slice(-4)}`,
        _uf: row.uf || "SP",
        _regime: row.regime || "simples_nacional",
      });

      if (error) throw error;
      const item = Array.isArray(data) ? data[0] : data;
      if (!item?.id) throw new Error(`Falha ao localizar ou criar a empresa ${row.cnpj}.`);
      return item as ImportCompanyResult;
    })
  );

  return {
    results,
    idByCnpj: new Map(results.map((company) => [onlyDigits(company.cnpj), company.id])),
    createdCount: results.filter((company) => company.created).length,
  };
}