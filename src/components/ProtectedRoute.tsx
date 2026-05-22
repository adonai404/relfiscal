import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

export function ProtectedRoute({
  children,
  requireSuperAdmin = false,
}: {
  children: ReactNode;
  /** Restringe a rota apenas ao SUPER ADMIN */
  requireSuperAdmin?: boolean;
}) {
  const { user, loading, signOut } = useAuth();
  const { profile, isLoading: loadingProfile, isBlocked, isCustomer } = useProfile();
  const { isSuperAdmin } = useUserRole();

  if (loading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  // Clientes do portal não acessam a área administrativa
  if (isCustomer && !isSuperAdmin) {
    return <Navigate to="/portal" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/empresas" replace />;
  }

  // Super admin nunca é bloqueado
  if (isBlocked && !isSuperAdmin) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ background: "var(--gradient-subtle)" }}
      >
        <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acesso bloqueado</CardTitle>
            <CardDescription>
              Sua conta está bloqueada. Entre em contato com o administrador do sistema para regularizar seu acesso.
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
