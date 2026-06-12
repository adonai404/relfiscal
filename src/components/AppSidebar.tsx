import { 
  Building2, 
  LayoutDashboard, 
  ArrowLeftRight, 
  Presentation, 
  Calculator, 
  Users, 
  UserCog, 
  LogOut,
  Home,
  Activity,
  ChevronRight,
  Plus,
  Wrench,
  FileText,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const { isSuperAdmin, isAdmin } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Usuário";
  const userInitial = userName.charAt(0).toUpperCase();

  const menuItems = [
    {
      title: "Início",
      icon: Home,
      path: "/app",
    },
    {
      title: "Empresas",
      icon: Building2,
      path: "/empresas",
    },
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      adminOnly: true,
    },
    {
      title: "Planejamento",
      icon: Calculator,
      path: "/planejamento",
      requiresCompany: true,
    },
    {
      title: "Apresentação",
      icon: Presentation,
      path: "/apresentacao",
      requiresCompany: true,
    },
    {
      title: "Documentação",
      icon: FileText,
      path: "/documentacao",
    },
    {
      title: "Ferramentas",
      icon: Wrench,
      path: "/ferramentas",
    },
  ];

  const adminItems = [
    {
      title: "Portal do Cliente",
      icon: Building2,
      path: "/admin/clientes",
      superAdminOnly: true,
    },
    {
      title: "Usuários",
      icon: Users,
      path: "/admin/usuarios",
      superAdminOnly: true,
    },
  ];

  const accountItems = [
    {
      title: "Minha Conta",
      icon: UserCog,
      path: "/minha-conta",
    },
  ];

  const filteredItems = menuItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const filteredAdminItems = adminItems.filter(item => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => navigate("/app")} className="hover:bg-transparent">
              <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-soft)]">
                <Activity className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold text-base">Fiscal.aqui</span>
                <span className="text-xs text-muted-foreground font-medium">Gestão Fiscal Inteligente</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>

        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarMenu>
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== "/app" && location.pathname.startsWith(item.path));
              const isDisabled = item.requiresCompany && !selectedCompany;

              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={isActive}
                    tooltip={item.title}
                    disabled={isDisabled}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {filteredAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarMenu>
              {filteredAdminItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.path)}
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {accountItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton 
                onClick={() => navigate(item.path)}
                isActive={location.pathname === item.path}
                tooltip={item.title}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{userInitial}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs">{user?.email}</span>
                  </div>
                  <ChevronRight className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side="right" align="end" sideOffset={4}>
                <DropdownMenuItem onClick={() => navigate("/minha-conta")}>
                  <UserCog className="mr-2 h-4 w-4" />
                  Minha Conta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
