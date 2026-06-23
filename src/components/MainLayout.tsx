import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { Separator } from "./ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home, Building2, X } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { useOpenTabs } from "@/hooks/useOpenTabs";
import { formatCNPJ } from "@/lib/format";
import { useKnowledgeTheme } from "@/hooks/useKnowledgeTheme";
import { cn } from "@/lib/utils";
import * as React from "react";

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const { openTabs, closeTab } = useOpenTabs();
  useKnowledgeTheme();

  const getBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean);
    const breadcrumbs = paths.map((path, index) => {
      const url = `/${paths.slice(0, index + 1).join("/")}`;
      const label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");

      let displayLabel = label;
      if (path === "app") displayLabel = "Início";
      if (path === "empresas") displayLabel = "Empresas";
      if (path === "dashboard") displayLabel = "Dashboard";
      if (path === "movimento") displayLabel = "Movimento";
      if (path === "planejamento") displayLabel = "Planejamento";
      if (path === "apresentacao") displayLabel = "Apresentação";
      if (path === "minha-conta") displayLabel = "Minha Conta";
      if (path === "admin") displayLabel = "Administração";
      if (path === "usuarios") displayLabel = "Usuários";
      if (path === "tarefas") displayLabel = "Tarefas";

      return { url, label: displayLabel, isCurrent: index === paths.length - 1 };
    });
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const handleTabClick = (company: typeof selectedCompany) => {
    if (!company) return;
    setSelectedCompany(company);
    navigate(`/movimento?company=${company.id}`);
  };

  const handleCloseTab = (e: React.MouseEvent, companyId: string) => {
    e.stopPropagation();
    closeTab(companyId);
    if (selectedCompany?.id === companyId) {
      const remaining = openTabs.filter((c) => c.id !== companyId);
      if (remaining.length > 0) {
        const next = remaining[remaining.length - 1];
        setSelectedCompany(next);
        navigate(`/movimento?company=${next.id}`);
      } else {
        setSelectedCompany(null);
      }
    }
  };

  // Sync tabs with up-to-date company data when companies list refreshes
  const resolvedTabs = openTabs.map(
    (tab) => companies.find((c) => c.id === tab.id) ?? tab
  );

  const hasTabs = resolvedTabs.length > 0;

  return (
    <SidebarProvider className="app-print-root">
      <AppSidebar />
      <SidebarInset className="app-print-inset">
        <header className="app-print-header flex h-16 shrink-0 items-center gap-3 border-b bg-card/80 backdrop-blur px-4 md:px-6 sticky top-0 z-20 overflow-hidden">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="h-5 shrink-0" />

          {hasTabs ? (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
              {resolvedTabs.map((company) => {
                const isActive = selectedCompany?.id === company.id;
                return (
                  <button
                    key={company.id}
                    onClick={() => handleTabClick(company)}
                    className={cn(
                      "group flex items-center gap-2 rounded-xl px-3 py-1.5 border text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                      isActive
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md shrink-0",
                      isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Building2 className="h-3 w-3" />
                    </div>
                    <span className="truncate max-w-[140px] md:max-w-[220px]">
                      {company.nome_fantasia || company.razao_social}
                    </span>
                    {isActive && (
                      <span className="text-xs text-muted-foreground hidden md:inline tabular-nums">
                        {formatCNPJ(company.cnpj)}
                      </span>
                    )}
                    <span
                      role="button"
                      onClick={(e) => handleCloseTab(e, company.id)}
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive shrink-0",
                        isActive && "opacity-60"
                      )}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link to="/app" className="flex items-center">
                      <Home className="h-4 w-4" />
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((bc) => (
                  <React.Fragment key={bc.url}>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      {bc.isCurrent ? (
                        <BreadcrumbPage>{bc.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild className="hidden md:block">
                          <Link to={bc.url}>{bc.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <ThemeToggle />
          </div>
        </header>
        <main className="app-print-main flex-1 p-4 md:p-8 overflow-auto max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
