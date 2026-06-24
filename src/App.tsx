 import Home from "./pages/Home.tsx";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { isTauri, openInAppBrowser } from "@/lib/desktop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { OpenTabsProvider } from "@/hooks/useOpenTabs";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/MainLayout";
import Index from "./pages/Index.tsx";
import Landing from "./pages/Landing.tsx";
import Auth from "./pages/Auth.tsx";
import Companies from "./pages/Companies.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Combo from "./pages/Combo.tsx";
import Movement from "./pages/Movement.tsx";
import Presentation from "./pages/Presentation.tsx";
import Settings from "./pages/Settings.tsx";
import PublicMovement from "./pages/PublicMovement.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminCustomers from "./pages/AdminCustomers.tsx";
import PortalHome from "./pages/PortalHome.tsx";
import PortalCompany from "./pages/PortalCompany.tsx";
import { PortalLayout } from "./components/PortalLayout";
 import TaxPlanning from "./pages/TaxPlanning.tsx";
 import TaxPlanningDetail from "./pages/TaxPlanningDetail.tsx";
import ProfileSettings from "./pages/ProfileSettings.tsx";
import Tools from "./pages/Tools.tsx";
import Documentation from "./pages/Documentation.tsx";
import Assistant from "./pages/Assistant.tsx";
import Knowledge from "./pages/Knowledge.tsx";
import Automacoes from "./pages/Automacoes.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

// No desktop (Tauri) os assets vêm do bundle local via tauri://, então usamos
// HashRouter (rotas no fragmento #/...) para deep-link/refresh funcionarem sem
// servidor. No web mantemos BrowserRouter (URLs limpas, SEO de /p/:slug etc.).
const Router = isTauri() ? HashRouter : BrowserRouter;

/**
 * No desktop, faz os links EXTERNOS (http/https) abrirem no NAVEGADOR INTERNO do
 * app — e SÓ ali. O Tauri abre `target="_blank"` no navegador do SO de forma
 * nativa, e `preventDefault()` NÃO segura isso (abriria nos dois). A solução é
 * "neutralizar" o link: guardar a URL num data-attr e remover `target`/`href`,
 * para o Tauri nunca disparar o open externo. O clique então abre só a janela
 * interna. No web este componente não faz nada.
 */
function DesktopExternalLinks() {
  useEffect(() => {
    if (!isTauri()) return;
    const EXTERNAL = /^https?:\/\//i;

    const neutralize = (a: HTMLAnchorElement) => {
      const href = a.getAttribute("href");
      if (!href || !EXTERNAL.test(href)) return; // ignora links internos (rotas)
      a.dataset.inappHref = href;
      a.removeAttribute("target");
      a.removeAttribute("href");
      a.style.cursor = "pointer";
    };
    const scan = (root: Element | Document) => {
      if (root instanceof HTMLAnchorElement) neutralize(root);
      root.querySelectorAll?.("a[href]").forEach((el) => neutralize(el as HTMLAnchorElement));
    };

    scan(document);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) scan(n as Element);
        });
        if (m.type === "attributes" && m.target instanceof HTMLAnchorElement) {
          neutralize(m.target);
        }
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "target"],
    });

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const url = a?.dataset?.inappHref;
      if (url) {
        e.preventDefault();
        void openInAppBrowser(url);
      }
    };
    document.addEventListener("click", onClick, true);

    return () => {
      obs.disconnect();
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router>
          <DesktopExternalLinks />
          <AuthProvider>
            <CompanyProvider>
              <OpenTabsProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/p/:slug" element={<PublicMovement />} />
                
                <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                  <Route path="/app" element={<Home />} />
                  <Route path="/empresas" element={<Companies />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/combo" element={<Combo />} />
                  <Route path="/movimento" element={<Movement />} />
                  <Route path="/apresentacao" element={<Presentation />} />
                  <Route path="/configuracoes" element={<Settings />} />
                  <Route path="/planejamento" element={<TaxPlanning />} />
                  <Route path="/planejamento/:id" element={<TaxPlanningDetail />} />
                  <Route path="/minha-conta" element={<ProfileSettings />} />
                  <Route path="/ferramentas" element={<Tools />} />
                  <Route path="/documentacao" element={<Documentation />} />
                  <Route path="/assistente" element={<Assistant />} />
                  <Route path="/conhecimento" element={<Knowledge />} />
                  <Route path="/automacoes" element={<Automacoes />} />
                  <Route path="/admin/usuarios" element={<ProtectedRoute requireSuperAdmin><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/clientes" element={<ProtectedRoute requireSuperAdmin><AdminCustomers /></ProtectedRoute>} />
                </Route>

                <Route path="/portal" element={<PortalLayout />}>
                  <Route index element={<PortalHome />} />
                  <Route path="empresa/:id" element={<PortalCompany />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
              </OpenTabsProvider>
            </CompanyProvider>
          </AuthProvider>
        </Router>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
