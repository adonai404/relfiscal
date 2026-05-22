import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, TrendingUp, Building2, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PortalLayout() {
  const { user, loading, signOut } = useAuth();
  const { isCustomer, isLoading } = useProfile();
  const { isSuperAdmin } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }
  if (!isCustomer && !isSuperAdmin) {
    navigate("/app", { replace: true });
    return null;
  }

  const showBack = location.pathname !== "/portal";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {showBack && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/portal")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Link to="/portal" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold leading-tight">Portal do Cliente</div>
                <div className="text-[11px] text-muted-foreground">{user.email}</div>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}