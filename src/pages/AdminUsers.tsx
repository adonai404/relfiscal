import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Lock, Unlock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

type Row = {
  user_id: string;
  email: string | null;
  username: string | null;
  status: "ativo" | "bloqueado";
  created_at: string;
  isSuperAdmin: boolean;
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, email, username, status, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const superAdmins = new Set((roles ?? []).filter((r: any) => r.role === "super_admin").map((r: any) => r.user_id));
      return (profiles ?? []).map((p: any) => ({
        ...p,
        isSuperAdmin: superAdmins.has(p.user_id),
      })) as Row[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "ativo" | "bloqueado" }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "ativo" ? "Usuário ativado" : "Usuário bloqueado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ativos = rows.filter((r) => r.status === "ativo");
  const bloqueados = rows.filter((r) => r.status === "bloqueado");

  const renderTable = (data: Row[], emptyMsg: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuário</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Cadastro</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              {emptyMsg}
            </TableCell>
          </TableRow>
        ) : (
          data.map((r) => {
            const isSelf = r.user_id === user?.id;
            return (
              <TableRow key={r.user_id}>
                <TableCell className="font-medium">
                  {r.username ?? "-"}
                  {r.isSuperAdmin && <Badge className="ml-2">super admin</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.email ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  {r.status === "ativo" ? (
                    <Badge variant="secondary">ativo</Badge>
                  ) : (
                    <Badge variant="destructive">bloqueado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {isSelf || r.isSuperAdmin ? (
                    <span className="text-xs text-muted-foreground">{isSelf ? "(você)" : "—"}</span>
                  ) : r.status === "ativo" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setStatus.mutate({ userId: r.user_id, status: "bloqueado" })}
                    >
                      <Lock className="mr-1 h-4 w-4" /> Bloquear
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setStatus.mutate({ userId: r.user_id, status: "ativo" })}>
                      <Unlock className="mr-1 h-4 w-4" /> Ativar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/empresas")} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Gerenciar Usuários</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Usuários ativos ({ativos.length})</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(ativos, "Nenhum usuário ativo.")}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Usuários bloqueados
                  {bloqueados.length > 0 && <Badge variant="destructive">{bloqueados.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderTable(bloqueados, "Nenhum usuário bloqueado.")}</CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
