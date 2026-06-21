import { useState, useEffect } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  LifeBuoy,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/publicUrl";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImperialLogo } from "@/components/ImperialLogo";

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "Conexão segura" },
  { icon: Sparkles, label: "Assistente com IA" },
  { icon: LifeBuoy, label: "Suporte dedicado" },
];

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const { isCustomer, isLoading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "signup" ? "signup" : "signin",
  );

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
            <ImperialLogo className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  if (user) {
    if (profileLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }
    return <Navigate to={isCustomer ? "/portal" : "/app"} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Acesso liberado. Bem-vindo de volta!");
    navigate("/");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: publicUrl("/app") },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro concluído! Já pode entrar no Imperial App.");
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Digite seu email no campo acima para redefinir a senha.");
      return;
    }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: publicUrl("/auth"),
    });
    setResetting(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de redefinição para o seu email.");
  };

  const isSignin = activeTab === "signin";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* dotted grid */}
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent 80%)",
          }}
        />
        {/* glow orbs */}
        <div className="absolute -left-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-warning/15 blur-[120px]" />
      </div>

      <div className="absolute right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      {/* Centered auth column */}
      <div className="relative z-10 w-full max-w-[440px]">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-3 shadow-[var(--shadow-elegant)] ring-1 ring-border/60">
            <ImperialLogo className="h-full w-full" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Imperial App</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            O super app da Imperial Contabilidade
          </p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-[var(--shadow-elegant)] backdrop-blur-xl">
          {/* top accent */}
          <div className="h-1.5 w-full" style={{ backgroundImage: "var(--gradient-primary)" }} />

          <div className="p-6 sm:p-8">
            <div className="mb-6 space-y-1.5 text-center">
              <h2 className="text-2xl font-bold tracking-tight">
                {isSignin ? "Entre na sua conta" : "Crie seu acesso"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isSignin
                  ? "Gerencie sua contabilidade em um só lugar."
                  : "Comece agora a centralizar sua gestão fiscal."}
              </p>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "signin" | "signup")}
              className="w-full"
            >
              <TabsList className="mb-6 grid h-12 w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
                <TabsTrigger
                  value="signin"
                  className="rounded-lg transition-all data-[state=active]:shadow-sm"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-lg transition-all data-[state=active]:shadow-sm"
                >
                  Cadastrar
                </TabsTrigger>
              </TabsList>

              {/* Sign in */}
              <TabsContent value="signin" className="mt-0 animate-in fade-in-50 duration-300">
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email-in" className="text-sm font-medium">
                      Email
                    </Label>
                    <div className="group relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="email-in"
                        type="email"
                        autoComplete="email"
                        placeholder="voce@imperial.com.br"
                        className="h-11 rounded-xl border-muted-foreground/20 bg-background/60 pl-10 transition-all focus:bg-background"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pwd-in" className="text-sm font-medium">
                        Senha
                      </Label>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-primary"
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={resetting}
                      >
                        {resetting ? "Enviando..." : "Esqueceu a senha?"}
                      </Button>
                    </div>
                    <div className="group relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="pwd-in"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-11 rounded-xl border-muted-foreground/20 bg-background/60 pl-10 pr-10 transition-all focus:bg-background"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl text-base font-semibold transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Acessar Imperial App <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Sign up */}
              <TabsContent value="signup" className="mt-0 animate-in fade-in-50 duration-300">
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email-up" className="text-sm font-medium">
                      Seu melhor email
                    </Label>
                    <div className="group relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="email-up"
                        type="email"
                        autoComplete="email"
                        placeholder="voce@empresa.com.br"
                        className="h-11 rounded-xl border-muted-foreground/20 bg-background/60 pl-10 transition-all focus:bg-background"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pwd-up" className="text-sm font-medium">
                      Crie uma senha forte
                    </Label>
                    <div className="group relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="pwd-up"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        className="h-11 rounded-xl border-muted-foreground/20 bg-background/60 pl-10 pr-10 transition-all focus:bg-background"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl text-base font-semibold transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Criar minha conta <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex items-center justify-center gap-5">
          {TRUST_BADGES.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <b.icon className="h-3.5 w-3.5 text-primary" />
              {b.label}
            </div>
          ))}
        </div>

        {/* Terms */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com os{" "}
          <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">
            Termos de Uso
          </Button>{" "}
          e a{" "}
          <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">
            Política de Privacidade
          </Button>{" "}
          da Imperial Contabilidade.
        </p>
      </div>
    </div>
  );
}
