import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ } from "@/lib/format";
import { useState, useMemo } from "react";

interface Company {
  id: string;
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  uf: string;
}

export default function PortalHome() {
  const [q, setQ] = useState("");

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["portal_companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, cnpj, nome_fantasia, razao_social, uf")
        .order("nome_fantasia");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return companies;
    return companies.filter(
      (c) =>
        c.nome_fantasia?.toLowerCase().includes(t) ||
        c.razao_social?.toLowerCase().includes(t) ||
        c.cnpj?.includes(t.replace(/\D/g, "")),
    );
  }, [companies, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suas empresas</h1>
        <p className="text-sm text-muted-foreground">
          {companies.length} empresa{companies.length === 1 ? "" : "s"} disponível
          {companies.length === 1 ? "" : "is"} para consulta
        </p>
      </div>

      {companies.length > 5 && (
        <Input
          placeholder="Buscar por nome ou CNPJ..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Nenhuma empresa vinculada ao seu acesso ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/portal/empresa/${c.id}`} className="group">
              <Card className="transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.nome_fantasia}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatCNPJ(c.cnpj)} · {c.uf}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}