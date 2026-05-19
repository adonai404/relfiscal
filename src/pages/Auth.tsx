 import { useState, useEffect } from "react";
 import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
 import { Loader2, TrendingUp, Mail, Lock, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Auth() {
   const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
   const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
   const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "signup" ? "signup" : "signin");
 
   useEffect(() => {
     const tab = searchParams.get("tab");
     if (tab === "signup" || tab === "signin") {
       setActiveTab(tab);
     }
   }, [searchParams]);
 
   if (authLoading) {
     return (
       <div className="flex min-h-screen items-center justify-center bg-background">
         <div className="flex flex-col items-center gap-4">
           <div className="relative">
             <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
             <TrendingUp className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary" />
           </div>
           <p className="text-sm font-medium text-muted-foreground animate-pulse">Carregando...</p>
         </div>
       </div>
     );
   }
 
   if (user) return <Navigate to="/app" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
     toast.success("Bem-vindo!");
     navigate("/app");
   };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
       options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já pode entrar.");
  };

   return (
     <div className="flex min-h-screen w-full flex-col lg:flex-row overflow-hidden bg-background">
       <div className="absolute right-4 top-4 z-50"><ThemeToggle /></div>
       
       {/* Left side: Content & Branding */}
       <div className="relative hidden w-full lg:flex lg:w-1/2 flex-col justify-between p-12 overflow-hidden">
         <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
           <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary blur-[100px]" />
           <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-primary-glow blur-[100px]" />
         </div>
 
         <div className="relative z-10 flex items-center gap-3">
           <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
             <TrendingUp className="h-6 w-6" />
           </div>
           <span className="text-xl font-bold tracking-tight">Movimento Fiscal</span>
         </div>
 
         <div className="relative z-10 space-y-8">
           <div className="space-y-4">
             <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
               Gestão inteligente de <br />
               <span className="text-primary italic">movimentação fiscal</span>
             </h1>
             <p className="text-lg text-muted-foreground max-w-lg">
               Acompanhe seus impostos, faturamento e indicadores mensais de forma consolidada e eficiente.
             </p>
           </div>
 
           <div className="grid grid-cols-1 gap-6 pt-4">
             {[
               { icon: CheckCircle2, title: "Consolidação Automática", desc: "Seus dados fiscais organizados em um só lugar." },
               { icon: ShieldCheck, title: "Segurança de Dados", desc: "Acesso controlado e proteção total das suas informações." },
             ].map((feature, i) => (
               <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                   <feature.icon className="h-5 w-5" />
                 </div>
                 <div>
                   <h3 className="font-semibold">{feature.title}</h3>
                   <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                 </div>
               </div>
             ))}
           </div>
         </div>
 
         <div className="relative z-10 pt-8 border-t border-border/50">
           <p className="text-sm text-muted-foreground italic">
             "A ferramenta que precisávamos para ter clareza sobre o peso dos impostos na operação."
           </p>
         </div>
       </div>
 
       {/* Right side: Auth Form */}
       <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 lg:bg-muted/30">
         <div className="w-full max-w-[400px] space-y-8">
           {/* Mobile Logo */}
           <div className="flex flex-col items-center lg:hidden mb-8">
             <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
               <TrendingUp className="h-7 w-7" />
             </div>
             <h1 className="text-2xl font-bold">Movimento Fiscal</h1>
           </div>
 
           <div className="space-y-2 text-center lg:text-left">
             <h2 className="text-3xl font-bold tracking-tight">
               {activeTab === "signin" ? "Boas-vindas" : "Crie sua conta"}
             </h2>
             <p className="text-muted-foreground">
               {activeTab === "signin" 
                 ? "Acesse sua conta para gerenciar suas empresas." 
                 : "Comece a organizar sua gestão fiscal hoje mesmo."}
             </p>
           </div>
 
           <Card className="border-none bg-transparent lg:bg-card lg:border lg:shadow-xl lg:shadow-black/5 overflow-hidden">
             <CardContent className="p-0 sm:p-2">
               <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                 <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 p-1 lg:bg-muted/80">
                   <TabsTrigger value="signin" className="rounded-md transition-all data-[state=active]:shadow-sm">Entrar</TabsTrigger>
                   <TabsTrigger value="signup" className="rounded-md transition-all data-[state=active]:shadow-sm">Cadastrar</TabsTrigger>
                 </TabsList>
 
                 <div className="p-4 lg:p-6 space-y-6">
                   <TabsContent value="signin" className="mt-0 space-y-6 animate-in fade-in-50 duration-500">
                     <form onSubmit={handleSignIn} className="space-y-5">
                       <div className="space-y-2">
                         <Label htmlFor="email-in" className="text-sm font-medium">Email corporativo</Label>
                         <div className="relative group">
                           <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                           <Input 
                             id="email-in" 
                             type="email" 
                             placeholder="nome@empresa.com.br"
                             className="pl-10 h-11 border-muted-foreground/20 bg-background/50 focus:bg-background transition-all"
                             required 
                             value={email} 
                             onChange={(e) => setEmail(e.target.value)} 
                           />
                         </div>
                       </div>
                       <div className="space-y-2">
                         <div className="flex items-center justify-between">
                           <Label htmlFor="pwd-in" className="text-sm font-medium">Senha</Label>
                           <Button variant="link" size="sm" className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-primary" type="button">
                             Esqueceu a senha?
                           </Button>
                         </div>
                         <div className="relative group">
                           <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                           <Input 
                             id="pwd-in" 
                             type="password" 
                             placeholder="••••••••"
                             className="pl-10 h-11 border-muted-foreground/20 bg-background/50 focus:bg-background transition-all"
                             required 
                             value={password} 
                             onChange={(e) => setPassword(e.target.value)} 
                           />
                         </div>
                       </div>
                       <Button type="submit" className="w-full h-11 text-base font-semibold transition-all hover:translate-y-[-1px] active:translate-y-[1px]" disabled={submitting}>
                         {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Entrar na conta <ArrowRight className="ml-2 h-4 w-4" /></>}
                       </Button>
                     </form>
                   </TabsContent>
 
                   <TabsContent value="signup" className="mt-0 space-y-6 animate-in fade-in-50 duration-500">
                     <form onSubmit={handleSignUp} className="space-y-5">
                       <div className="space-y-2">
                         <Label htmlFor="email-up" className="text-sm font-medium">Melhor email</Label>
                         <div className="relative group">
                           <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                           <Input 
                             id="email-up" 
                             type="email" 
                             placeholder="exemplo@email.com"
                             className="pl-10 h-11 border-muted-foreground/20 bg-background/50 focus:bg-background transition-all"
                             required 
                             value={email} 
                             onChange={(e) => setEmail(e.target.value)} 
                           />
                         </div>
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="pwd-up" className="text-sm font-medium">Crie uma senha forte</Label>
                         <div className="relative group">
                           <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                           <Input 
                             id="pwd-up" 
                             type="password" 
                             placeholder="Mínimo 6 caracteres"
                             minLength={6} 
                             className="pl-10 h-11 border-muted-foreground/20 bg-background/50 focus:bg-background transition-all"
                             required 
                             value={password} 
                             onChange={(e) => setPassword(e.target.value)} 
                           />
                         </div>
                       </div>
                       <Button type="submit" className="w-full h-11 text-base font-semibold transition-all hover:translate-y-[-1px] active:translate-y-[1px]" disabled={submitting}>
                         {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Criar minha conta <ArrowRight className="ml-2 h-4 w-4" /></>}
                       </Button>
                     </form>
                   </TabsContent>
                 </div>
               </Tabs>
             </CardContent>
           </Card>
 
           <div className="text-center">
             <p className="text-sm text-muted-foreground">
               Ao continuar, você concorda com nossos <br />
               <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">Termos de Uso</Button> e <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">Privacidade</Button>.
             </p>
           </div>
         </div>
       </div>
     </div>
   );
}
