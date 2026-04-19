import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { user, loading, signOut } = useAuth();
  const { profile, isLoading: loadingProfile } = useProfile();
  const { isAdmin, roles } = useUserRole();

  if (loading || loadingProfile) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  if (requireAdmin && !isAdmin) return <Navigate to="/empresas" replace />;

  // Admin sempre passa, mesmo se profile.approved estiver false
  const approved = isAdmin || profile?.approved;

  if (!approved) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--gradient-subtle)" }}>
        <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Aguardando aprovação</CardTitle>
            <CardDescription>
              Sua conta foi criada com sucesso. Um administrador precisa aprovar seu acesso antes que você possa usar o sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Conectado como <strong>{user.email}</strong>
            </p>
            <Button variant="outline" onClick={signOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
