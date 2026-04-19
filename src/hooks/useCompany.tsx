import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Company {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  uf: string;
  slug: string;
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
  const [selectedCompany, setSelectedState] = useState<Company | null>(null);

  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ["companies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get IDs the user can access
      const { data: links, error: linkErr } = await supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", user!.id);
      if (linkErr) throw linkErr;
      const ids = links?.map((l) => l.company_id) ?? [];

      // Admins also see all companies
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      const isAdmin = roles?.some((r) => r.role === "admin");

      let query = supabase.from("companies").select("id, cnpj, razao_social, nome_fantasia, uf, slug").order("nome_fantasia");
      if (!isAdmin) {
        if (ids.length === 0) return [] as Company[];
        query = query.in("id", ids);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  // restore selection from localStorage when companies load
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
