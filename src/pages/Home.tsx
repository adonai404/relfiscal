 import { ArrowLeftRight, LayoutDashboard, Presentation, LogOut, ChevronRight, Activity, UserCog, Calculator, Settings as SettingsIcon, ShieldCheck, Link2, Users } from "lucide-react";
 import { useNavigate } from "react-router-dom";
 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { useCompany } from "@/hooks/useCompany";
 import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { ThemeToggle } from "@/components/ThemeToggle";
 
export default function Home() {
  const { user, signOut } = useAuth();
  const { data: profileData } = useQuery({
    queryKey: ["profile-details", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("status, customer_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role;
    },
  });

  const isSuperAdmin = userRole === "super_admin";
  const isCustomer = !!profileData?.customer_id;
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Usuário";
    
    if (hour >= 5 && hour < 12) return `Bom dia, ${userName}`;
    if (hour >= 12 && hour < 19) return `Boa tarde, ${userName}`;
    return `Boa noite, ${userName}`;
  };

  const menuItems = [
    {
      title: "Movimento",
      description: "Lançamentos fiscais e conciliação",
      icon: ArrowLeftRight,
      path: "/empresas",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Dashboard",
      description: "Visão geral e indicadores",
      icon: LayoutDashboard,
      path: "/dashboard",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    ...(!isCustomer ? [
      {
        title: "Apresentação",
        description: "Cenários de economia tributária",
        icon: Presentation,
        path: "/apresentacao",
        color: "text-purple-500",
        bg: "bg-purple-500/10",
      },
      {
        title: "Planejamento Tributário",
        description: "Simulações de regimes fiscais",
        icon: Calculator,
        path: "/planejamento",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        forceEnabled: true,
      },
      {
        title: "Conexão API",
        description: "Integração externa de dados",
        icon: Link2,
        path: "/conexao-api",
        color: "text-indigo-500",
        bg: "bg-indigo-500/10",
        forceEnabled: true,
      },
    ] : []),
    {
      title: "Minha Conta",
      description: "Perfil, senha e segurança",
      icon: UserCog,
      path: "/minha-conta",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      forceEnabled: true,
    },
    ...(isSuperAdmin ? [
      {
        title: "Clientes",
        description: "Gerenciar grupos de empresas por cliente",
        icon: Users,
        path: "/admin/clientes",
        color: "text-blue-600",
        bg: "bg-blue-600/10",
        forceEnabled: true,
      },
      {
        title: "Administração",
        description: "Gerenciar usuários e permissões",
        icon: ShieldCheck,
        path: "/admin/usuarios",
        color: "text-rose-500",
        bg: "bg-rose-500/10",
        forceEnabled: true,
      }
    ] : []),
  ];
 
   return (
     <div className="min-h-screen w-full flex flex-col" style={{ background: "var(--gradient-subtle)" }}>
       <header className="border-b bg-card/60 backdrop-blur">
         <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 max-w-7xl mx-auto">
           <div className="flex items-center gap-3">
             <div className="bg-primary/10 p-2 rounded-xl">
               <Activity className="h-6 w-6 text-primary" />
             </div>
             <div>
               <h1 className="text-lg font-bold tracking-tight">TaxFlow</h1>
               <p className="text-xs text-muted-foreground font-medium">Gestão Inteligente</p>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             <ThemeToggle />
             <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive">
               <LogOut className="h-4 w-4" />
             </Button>
           </div>
         </div>
       </header>
 
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:py-8 sm:px-6">
          <div className="mb-6 sm:mb-10 text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 sm:mb-2">{getGreeting()}</h2>
            <p className="text-muted-foreground text-base sm:text-lg">Selecione uma funcionalidade para começar.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
           {menuItems.map((item, idx) => {
             const Icon = item.icon;
               const isDisabled = false;
             return (
               <Button
                 key={item.path}
                 variant="ghost"
                 disabled={isDisabled}
                  className="h-auto p-0 hover:bg-transparent group animate-in fade-in slide-in-from-bottom-4 duration-500 disabled:opacity-40"
                 style={{ animationDelay: `${idx * 100}ms` }}
                 onClick={() => navigate(item.path)}
               >
                  <Card className="w-full h-full transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 border-border/50 hover:border-primary/50 group-hover:bg-accent/5">
                    <CardHeader className="p-4 sm:p-6">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${item.bg} flex items-center justify-center mb-2 transition-transform duration-300 group-hover:scale-110`}>
                        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${item.color}`} />
                      </div>
                      <CardTitle className="flex items-center justify-between group-hover:text-primary transition-colors text-left text-base sm:text-lg">
                        {item.title}
                        <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </CardTitle>
                      <CardDescription className="text-left line-clamp-2 text-xs sm:text-sm">
                        {item.description}
                      </CardDescription>
                   </CardHeader>
                 </Card>
               </Button>
             );
           })}
         </div>
       </main>
 
       <footer className="border-t py-6 bg-card/30 mt-auto">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-sm text-muted-foreground">
           © {new Date().getFullYear()} TaxFlow - Sistema de Gestão Fiscal. Todos os direitos reservados.
         </div>
       </footer>
     </div>
   );
 }