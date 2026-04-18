import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Loader2,
  LineChart,
  Lock,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const Landing = () => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (user) return <Navigate to="/empresas" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shadow-[var(--shadow-soft)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">RelFiscal</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#recursos" className="transition hover:text-foreground">Recursos</a>
            <a href="#preview" className="transition hover:text-foreground">Preview</a>
            <a href="#beneficios" className="transition hover:text-foreground">Benefícios</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">
                Começar grátis <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* glow background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px"
          style={{ background: "linear-gradient(90deg, transparent, hsl(var(--border)), transparent)" }}
        />

        <div className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-5 gap-1.5 px-3 py-1 text-xs">
              <Sparkles className="h-3 w-3 text-primary" /> Feito para escritórios de contabilidade
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              O movimento fiscal de todos os seus clientes,{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                em um só lugar
              </span>
              .
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Centralize empresas, importe XLSX, acompanhe impostos e compartilhe relatórios
              com seus clientes — sem planilha solta, sem retrabalho.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-7 text-base shadow-[var(--shadow-elegant)]">
                <Link to="/auth">
                  Começar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
                <a href="#preview">Ver o produto</a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Multiempresa ilimitado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Link público para clientes
              </span>
            </div>
          </div>

          {/* Dashboard Preview Mock */}
          <div id="preview" className="mx-auto mt-16 max-w-6xl">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4">
          {[
            { k: "+10x", v: "mais rápido que planilhas" },
            { k: "100%", v: "dados criptografados" },
            { k: "1 clique", v: "para importar XLSX" },
            { k: "∞", v: "empresas por conta" },
          ].map((s) => (
            <div key={s.v} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-primary">{s.k}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="recursos" className="mx-auto max-w-7xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-3">Recursos</Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Tudo que seu escritório precisa para o fiscal
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pensado por contadores, para contadores. Da importação ao envio do relatório.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Building2 className="h-5 w-5" />}
            title="Multiempresa"
            text="Cadastre quantas empresas quiser, com regime tributário e UF. Troque de cliente em 1 clique."
          />
          <FeatureCard
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="Importe XLSX"
            text="Cole sua planilha e o sistema entende as competências. Adeus digitação manual."
          />
          <FeatureCard
            icon={<LineChart className="h-5 w-5" />}
            title="Dashboard inteligente"
            text="KPIs consolidados, evolução mensal e composição de impostos com filtro de período."
          />
          <FeatureCard
            icon={<Layers className="h-5 w-5" />}
            title="Combo comparativo"
            text="Compare 2+ empresas lado a lado: faturamento, carga tributária, margem e mais."
          />
          <FeatureCard
            icon={<Share2 className="h-5 w-5" />}
            title="Link público"
            text="Compartilhe o movimento fiscal com seu cliente por uma URL — sem login."
          />
          <FeatureCard
            icon={<Lock className="h-5 w-5" />}
            title="Acesso por permissão"
            text="Controle quem vê o quê. Admins gerenciam, equipe acessa só o necessário."
          />
        </div>
      </section>

      {/* BENEFITS */}
      <section id="beneficios" className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge variant="outline" className="mb-3">Por que migrar</Badge>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Menos planilha, mais decisão.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Pare de versionar XLSX no e-mail. Centralize, padronize e mostre valor real
              ao seu cliente com relatórios que ele entende.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { i: <Zap className="h-4 w-4" />, t: "Cálculo automático do Simples Nacional", d: "Defina a alíquota, o sistema calcula a cada competência." },
                { i: <TrendingUp className="h-4 w-4" />, t: "Visão consolidada de todas as empresas", d: "Ranking de carga tributária, faturamento e alertas." },
                { i: <Users className="h-4 w-4" />, t: "Equipe organizada por cliente", d: "Cada colaborador acessa só as empresas que precisa." },
              ].map((b) => (
                <li key={b.t} className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {b.i}
                  </div>
                  <div>
                    <div className="font-medium">{b.t}</div>
                    <div className="text-sm text-muted-foreground">{b.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 -z-10 rounded-3xl opacity-60 blur-3xl"
              style={{ background: "var(--gradient-primary)" }}
            />
            <MetricsMock />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24">
        <div
          className="relative overflow-hidden rounded-3xl border border-border/60 px-6 py-16 text-center sm:px-12"
          style={{ background: "var(--gradient-subtle)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-40"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 0%, hsl(var(--primary) / 0.25), transparent 70%)",
            }}
          />
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3 text-primary" /> Comece em 2 minutos
          </Badge>
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Pronto para deixar o fiscal dos seus clientes no piloto automático?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Crie sua conta gratuita, cadastre a primeira empresa e veja o dashboard funcionando hoje.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-8 text-base shadow-[var(--shadow-elegant)]">
              <Link to="/auth">
                Criar conta grátis <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>RelFiscal — Movimento fiscal multiempresa</span>
          </div>
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} RelFiscal. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition group-hover:opacity-30"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/* ---------- Mocks (puro CSS, sem libs) ---------- */

function DashboardMock() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-elegant)]"
      style={{ boxShadow: "0 30px 80px -30px hsl(var(--primary) / 0.35)" }}
    >
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-destructive/70" />
        <span className="h-3 w-3 rounded-full bg-warning/70" />
        <span className="h-3 w-3 rounded-full bg-success/70" />
        <div className="ml-3 hidden text-xs text-muted-foreground sm:block">relfiscal.app/dashboard</div>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-3">
        {/* KPIs */}
        {[
          { l: "Faturamento total", v: "R$ 4,82M", t: "+12,4%", up: true },
          { l: "Carga tributária", v: "11,7%", t: "−1,2pp", up: false },
          { l: "Empresas ativas", v: "37", t: "+3", up: true },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border/60 bg-background p-4">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{k.v}</div>
            <div
              className={`mt-1 inline-flex items-center gap-1 text-xs ${
                k.up ? "text-primary" : "text-success"
              }`}
            >
              <TrendingUp className="h-3 w-3" /> {k.t}
            </div>
          </div>
        ))}

        {/* Chart */}
        <div className="md:col-span-2 rounded-xl border border-border/60 bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Evolução fiscal</div>
              <div className="text-xs text-muted-foreground">Últimos 12 meses</div>
            </div>
            <Badge variant="secondary" className="text-[10px]">competência</Badge>
          </div>
          <MiniChart />
        </div>

        {/* Tax composition */}
        <div className="rounded-xl border border-border/60 bg-background p-4">
          <div className="mb-3 text-sm font-medium">Composição de impostos</div>
          <div className="space-y-2.5">
            {[
              { n: "ICMS", v: 42 },
              { n: "Simples Nacional", v: 28 },
              { n: "Federais", v: 18 },
              { n: "DIFAL", v: 8 },
              { n: "Outros", v: 4 },
            ].map((t) => (
              <div key={t.n}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">{t.n}</span>
                  <span className="font-medium">{t.v}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${t.v}%`, background: "var(--gradient-primary)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniChart() {
  // SVG line chart — pure CSS/SVG, no library
  const points = [22, 28, 25, 34, 30, 38, 42, 39, 47, 52, 48, 58];
  const max = Math.max(...points);
  const w = 560;
  const h = 160;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * (h - 20) - 10}`)
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full">
      <defs>
        <linearGradient id="lp-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="0"
          x2={w}
          y1={(h / 4) * i + 10}
          y2={(h / 4) * i + 10}
          stroke="hsl(var(--border))"
          strokeDasharray="3 4"
        />
      ))}
      <path d={area} fill="url(#lp-area)" />
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={h - (p / max) * (h - 20) - 10}
          r={i === points.length - 1 ? 4 : 2.5}
          fill="hsl(var(--primary))"
        />
      ))}
    </svg>
  );
}

function MetricsMock() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-elegant)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Combo de empresas</div>
          <div className="text-sm font-semibold">Comparativo Q1</div>
        </div>
        <Badge variant="secondary" className="text-[10px]">3 empresas</Badge>
      </div>
      <div className="space-y-3">
        {[
          { n: "Tech Solutions ME", c: "hsl(var(--primary))", v: 92 },
          { n: "Logística Brasil LTDA", c: "hsl(var(--primary-glow))", v: 74 },
          { n: "Comércio Verde EIRELI", c: "hsl(var(--success))", v: 58 },
        ].map((c) => (
          <div key={c.n}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: c.c }} />
                <span className="font-medium">{c.n}</span>
              </div>
              <span className="text-muted-foreground">{c.v} pts</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${c.v}%`, background: c.c }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/60 pt-4">
        {[
          { l: "Receita", v: "R$ 1,4M" },
          { l: "Margem", v: "22%" },
          { l: "Eficiência", v: "A+" },
        ].map((m) => (
          <div key={m.l} className="rounded-md bg-muted/50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.l}</div>
            <div className="text-sm font-semibold">{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Landing;
