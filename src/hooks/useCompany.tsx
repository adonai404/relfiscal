import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

export interface Company {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  uf: string;
  slug: string;
  status?: "ativa" | "inativa" | "arquivada";
  folder_id?: string | null;
  regime?: string;
  created_by?: string | null;
}

interface CompanyCtx {
  selectedCompany: Company | null;
  setSelectedCompany: (c: Company | null) => void;
  companies: Company[];
  loadingCompanies: boolean;
  refetch: () => void;
}

const Ctx = createContext<CompanyCtx>({
  selectedCompany: null,
  setSelectedCompany: () => {},
  companies: [],
  loadingCompanies: false,
  refetch: () => {},
});

const STORAGE_KEY = "fiscal.selectedCompanyId";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const [selectedCompany, setSelectedState] = useState<Company | null>(null);

  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ["companies", user?.id, isSuperAdmin],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select("id, cnpj, razao_social, nome_fantasia, uf, slug, regime, created_by, status, folder_id")
        .order("nome_fantasia");

      // Super admin vê todas; usuários comuns só veem as próprias
      if (!isSuperAdmin) {
        query = query.eq("created_by", user!.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  useEffect(() => {
    if (!companies.length) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const found = companies.find((c) => c.id === stored);
      if (found) {
        setSelectedState(found);
        return;
      }
    }
  }, [companies]);

  const setSelectedCompany = (c: Company | null) => {
    setSelectedState(c);
    if (c) localStorage.setItem(STORAGE_KEY, c.id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <Ctx.Provider value={{ selectedCompany, setSelectedCompany, companies, loadingCompanies: isLoading, refetch }}>
      {children}
    </Ctx.Provider>
  );
}

export const useCompany = () => useContext(Ctx);
