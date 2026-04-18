import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Shield, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Navigate } from "react-router-dom";

interface ProfileRow {
  user_id: string;
  email: string | null;
  username: string | null;
  approved: boolean;
  access_requested_at: string | null;
  created_at: string;
}

export default function UsersAdmin() {
  const navigate = useNavigate();
  const { isAdmin, roles } = useUserRole();
  const qc = useQueryClient();

  const rolesLoading = roles === undefined;

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin_profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, username, approved, access_requested_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  if (!rolesLoading && !isAdmin) return <Navigate to="/empresas" replace />;

  const setApproved = async (userId: string, approved: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ approved })
      .eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success(approved ? "Usuário autorizado" : "Acesso revogado");
    qc.invalidateQueries({ queryKey: ["admin_profiles"] });
  };

  const pending = profiles.filter((p) => !p.approved);
  const approved = profiles.filter((p) => p.approved);

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/empresas")} aria-label="Voltar">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Gerenciar Usuários</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-600" />
                      Aguardando aprovação
                    </CardTitle>
                    <CardDescription>
                      Usuários que se cadastraram e estão em modo demonstração.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{pending.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {pending.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum usuário pendente.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead>Solicitou acesso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map((p) => (
                        <TableRow key={p.user_id}>
                          <TableCell className="font-medium">{p.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(p.created_at)}
                          </TableCell>
                          <TableCell>
                            {p.access_requested_at ? (
                              <Badge variant="default" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(p.access_requested_at)}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => setApproved(p.user_id, true)}>
                              <Check className="mr-1 h-4 w-4" /> Autorizar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary" />
                      Usuários autorizados
                    </CardTitle>
                    <CardDescription>
                      Acesso completo ao sistema.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{approved.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {approved.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum usuário autorizado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approved.map((p) => (
                        <TableRow key={p.user_id}>
                          <TableCell className="font-medium">{p.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(p.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setApproved(p.user_id, false)}
                            >
                              <X className="mr-1 h-4 w-4" /> Revogar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
