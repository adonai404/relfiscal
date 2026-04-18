import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, TrendingUp } from "lucide-react";
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (user) return <Navigate to="/empresas" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    navigate("/empresas");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/empresas` },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já pode entrar.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Movimento Fiscal</CardTitle>
          <CardDescription>Painel de impostos mensais por empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email-in">Email</Label>
                  <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd-in">Senha</Label>
                  <Input id="pwd-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd-up">Senha (mín. 6 caracteres)</Label>
                  <Input id="pwd-up" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
