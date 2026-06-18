import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useLocation, Link } from "react-router-dom";
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
import { Home, Building2 } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { formatCNPJ } from "@/lib/format";
import { useKnowledgeTheme } from "@/hooks/useKnowledgeTheme";

export function MainLayout() {
  const location = useLocation();
  const { selectedCompany } = useCompany();
  useKnowledgeTheme();
  
  const getBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean);
    const breadcrumbs = paths.map((path, index) => {
      const url = `/${paths.slice(0, index + 1).join("/")}`;
      const label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");
      
      // Special labels
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

      return { url, label: displayLabel, isCurrent: index === paths.length - 1 };
    });
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <SidebarProvider className="app-print-root">
      <AppSidebar />
      <SidebarInset className="app-print-inset">
        <header className="app-print-header flex h-16 shrink-0 items-center gap-3 border-b bg-card/80 backdrop-blur px-4 md:px-6 sticky top-0 z-20">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          {selectedCompany ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-1.5 border border-border/60">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-semibold truncate max-w-[200px] md:max-w-[320px]">
                  {selectedCompany.nome_fantasia || selectedCompany.razao_social}
                </span>
                <span className="text-xs text-muted-foreground hidden md:inline tabular-nums">
                  {formatCNPJ(selectedCompany.cnpj)}
                </span>
              </div>
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
              {breadcrumbs.map((bc, i) => (
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
          <div className="ml-auto flex items-center gap-2">
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

import * as React from "react";
