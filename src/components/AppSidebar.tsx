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
  ChevronRight,
  Plus,
  Wrench,
  FileText,
  Sparkles,
  BookOpen,
  ArrowUpCircle,
  Loader2,
  Monitor,
  Zap,
  Scale,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useUserRole } from "@/hooks/useUserRole";
import { useAppUpdater } from "@/hooks/useAppUpdater";
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
import { ImperialLogo } from "@/components/ImperialLogo";
import { toast } from "sonner";
import { useEffect } from "react";
import { isTauri } from "@/lib/desktop";

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const { isSuperAdmin, isAdmin } = useUserRole();
  const { updateInfo, isUpdating, error: updateError, installUpdate } = useAppUpdater();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (updateError) toast.error(`Erro ao atualizar: ${updateError}`);
  }, [updateError]);

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
    },
    {
      title: "Apresentação",
      icon: Presentation,
      path: "/apresentacao",
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
    {
      title: "Assistente IA",
      icon: Sparkles,
      path: "/assistente",
    },
    {
      title: "Conhecimento",
      icon: BookOpen,
      path: "/conhecimento",
    },
    {
      title: "Automações",
      icon: Zap,
      path: "/automacoes",
    },
    {
      title: "Reforma Tributária",
      icon: Scale,
      path: "/reforma-tributaria",
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
              <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-[var(--shadow-soft)] ring-1 ring-border/60">
                <ImperialLogo className="size-full" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold text-base">Imperial App</span>
                <span className="text-xs text-muted-foreground font-medium">Imperial Contabilidade</span>
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
          {updateInfo.available && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={installUpdate}
                disabled={isUpdating}
                tooltip={isUpdating ? "Atualizando..." : `Atualizar para v${updateInfo.version}`}
                className="bg-primary/10 text-primary font-medium ring-1 ring-primary/30 hover:bg-primary/20 hover:text-primary"
              >
                {isUpdating ? <Loader2 className="animate-spin" /> : <ArrowUpCircle />}
                <span>{isUpdating ? "Atualizando..." : `Atualizar para v${updateInfo.version}`}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {!isTauri() && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.open("https://github.com/adonai404/relfiscal/releases", "_blank", "noopener,noreferrer")}
                tooltip="Baixar app desktop"
                className="text-muted-foreground hover:text-foreground"
              >
                <Monitor />
                <span>Baixar app desktop</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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
