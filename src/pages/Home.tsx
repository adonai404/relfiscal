 import { useNavigate } from "react-router-dom";
 import { Building2, ArrowLeftRight, LayoutDashboard, Presentation, Settings, LogOut, ChevronRight, Activity } from "lucide-react";
 import { useAuth } from "@/hooks/useAuth";
 import { useCompany } from "@/hooks/useCompany";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { ThemeToggle } from "@/components/ThemeToggle";
 import { formatCNPJ } from "@/lib/format";
 
 export default function Home() {
   const { signOut } = useAuth();
   const { selectedCompany } = useCompany();
   const navigate = useNavigate();
 
    const menuItems = [
      {
        title: "Movimento",
        description: "Lançamentos fiscais e conciliação",
        icon: ArrowLeftRight,
        path: "/movimento",
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
 
       <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-6">
         <div className="mb-10 text-center sm:text-left">
           <h2 className="text-3xl font-bold tracking-tight mb-2">Bem-vindo ao TaxFlow</h2>
           <p className="text-muted-foreground text-lg">Selecione uma funcionalidade para começar a gerenciar sua empresa.</p>
         </div>
 
         {selectedCompany && (
           <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
             <Card className="border-primary/20 bg-primary/[0.02] overflow-hidden">
               <CardContent className="p-6">
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                   <div className="flex items-center gap-4">
                     <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                       <Building2 className="h-6 w-6 text-primary" />
                     </div>
                     <div className="text-center sm:text-left">
                       <h3 className="font-bold text-xl">{selectedCompany.nome_fantasia}</h3>
                       <p className="text-sm text-muted-foreground">
                         {formatCNPJ(selectedCompany.cnpj)} · {selectedCompany.uf}
                       </p>
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </div>
         )}
 
         {!selectedCompany && (
           <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
             <Card className="border-amber-500/20 bg-amber-500/[0.02]">
               <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-4">
                   <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                     <Building2 className="h-6 w-6 text-amber-500" />
                   </div>
                   <p className="text-sm font-medium">Você precisa selecionar uma empresa para acessar as funcionalidades.</p>
                 </div>
                 <Button variant="default" onClick={() => navigate("/empresas")}>
                   Selecionar Empresa
                 </Button>
               </CardContent>
             </Card>
           </div>
         )}
 
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {menuItems.map((item, idx) => {
             const Icon = item.icon;
             const isDisabled = !selectedCompany;
             return (
               <Button
                 key={item.path}
                 variant="ghost"
                 disabled={isDisabled}
                 className="h-auto p-0 hover:bg-transparent group animate-in fade-in slide-in-from-bottom-4 duration-500 disabled:opacity-50"
                 style={{ animationDelay: `${idx * 100}ms` }}
                 onClick={() => navigate(item.path)}
               >
                 <Card className="w-full h-full transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 border-border/50 hover:border-primary/50 group-hover:bg-accent/5">
                   <CardHeader>
                     <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center mb-2 transition-transform duration-300 group-hover:scale-110`}>
                       <Icon className={`h-6 w-6 ${item.color}`} />
                     </div>
                     <CardTitle className="flex items-center justify-between group-hover:text-primary transition-colors text-left">
                       {item.title}
                       <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                     </CardTitle>
                     <CardDescription className="text-left line-clamp-2">
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