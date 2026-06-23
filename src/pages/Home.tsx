 import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, LayoutDashboard, Presentation, LogOut, ChevronRight, Activity, UserCog, Calculator } from "lucide-react";
 import { useAuth } from "@/hooks/useAuth";
 import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { ThemeToggle } from "@/components/ThemeToggle";
 
 export default function Home() {
  const { user, signOut } = useAuth();
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
      },
      {
        title: "Minha Conta",
        description: "Perfil, senha e segurança",
        icon: UserCog,
        path: "/minha-conta",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
      },
    ];
 
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Painel Inicial</p>
            <h1 className="text-4xl font-bold tracking-tight mb-2">{getGreeting()}</h1>
            <p className="text-muted-foreground">Acesso rápido às áreas do sistema.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                className="group text-left animate-in fade-in slide-in-from-bottom-3 duration-500"
                style={{ animationDelay: `${idx * 70}ms` }}
                onClick={() => navigate(item.path)}
              >
                <div className="relative h-full rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5">
                  <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-105`}>
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-semibold text-base">{item.title}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
