 import Home from "./pages/Home.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
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
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CompanyProvider>
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
                  <Route path="/admin/usuarios" element={<ProtectedRoute requireSuperAdmin><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/clientes" element={<ProtectedRoute requireSuperAdmin><AdminCustomers /></ProtectedRoute>} />
                </Route>

                <Route path="/portal" element={<PortalLayout />}>
                  <Route index element={<PortalHome />} />
                  <Route path="empresa/:id" element={<PortalCompany />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </CompanyProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
