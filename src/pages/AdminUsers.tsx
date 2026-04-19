import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Check, X, Shield, ShieldOff, Users } from "lucide-react";
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
  approved: boolean;
  created_at: string;
  roles: string[];
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, username, approved, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const byUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role);
        byUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: byUser.get(p.user_id) ?? [] })) as Row[];
    },
  });

  const setApproved = useMutation({
    mutationFn: async ({ userId, approved }: { userId: string; approved: boolean }) => {
      const { error } = await supabase.from("profiles").update({ approved }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approved ? "Usuário aprovado" : "Acesso revogado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setAdmin = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.makeAdmin ? "Promovido a admin" : "Removido de admin");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pending = rows.filter((r) => !r.approved);
  const approved = rows.filter((r) => r.approved);

  const renderTable = (data: Row[], emptyMsg: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuário</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Cadastro</TableHead>
          <TableHead>Papéis</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{emptyMsg}</TableCell></TableRow>
        ) : data.map((r) => {
          const isAdminRow = r.roles.includes("admin");
          const isSelf = r.user_id === user?.id;
          return (
            <TableRow key={r.user_id}>
              <TableCell className="font-medium">{r.username ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground">{r.email ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(r.created_at).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell>
                {isAdminRow ? <Badge>admin</Badge> : <Badge variant="secondary">user</Badge>}
              </TableCell>
              <TableCell className="text-right space-x-2">
                {!r.approved ? (
                  <Button size="sm" onClick={() => setApproved.mutate({ userId: r.user_id, approved: true })}>
                    <Check className="mr-1 h-4 w-4" /> Aprovar
                  </Button>
                ) : (
                  <>
                    {!isSelf && (
                      <>
                        {isAdminRow ? (
                          <Button size="sm" variant="outline" onClick={() => setAdmin.mutate({ userId: r.user_id, makeAdmin: false })}>
                            <ShieldOff className="mr-1 h-4 w-4" /> Remover admin
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setAdmin.mutate({ userId: r.user_id, makeAdmin: true })}>
                            <Shield className="mr-1 h-4 w-4" /> Tornar admin
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => setApproved.mutate({ userId: r.user_id, approved: false })}>
                          <X className="mr-1 h-4 w-4" /> Revogar
                        </Button>
                      </>
                    )}
                    {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                  </>
                )}
              </TableCell>
            </TableRow>
          );
        })}
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
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Pendentes de aprovação
                  {pending.length > 0 && <Badge variant="destructive">{pending.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderTable(pending, "Nenhum usuário aguardando aprovação.")}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usuários aprovados ({approved.length})</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(approved, "Nenhum usuário aprovado ainda.")}</CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
