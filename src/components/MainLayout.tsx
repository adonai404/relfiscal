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
import { Home } from "lucide-react";

export function MainLayout() {
  const location = useLocation();
  
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/60 backdrop-blur px-4 sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
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
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import * as React from "react";
