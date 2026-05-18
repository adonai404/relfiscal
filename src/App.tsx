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
import Index from "./pages/Index.tsx";
import Landing from "./pages/Landing.tsx";
import Auth from "./pages/Auth.tsx";
import Companies from "./pages/Companies.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Combo from "./pages/Combo.tsx";
import Movement from "./pages/Movement.tsx";
import Presentation from "./pages/Presentation.tsx";
import PublicMovement from "./pages/PublicMovement.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
 import TaxPlanning from "./pages/TaxPlanning.tsx";
 import TaxPlanningDetail from "./pages/TaxPlanningDetail.tsx";
import ProfileSettings from "./pages/ProfileSettings.tsx";
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
                 <Route path="/app" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/empresas" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/combo" element={<ProtectedRoute><Combo /></ProtectedRoute>} />
                <Route path="/movimento" element={<ProtectedRoute><Movement /></ProtectedRoute>} />
                <Route path="/apresentacao" element={<ProtectedRoute><Presentation /></ProtectedRoute>} />
                 <Route path="/planejamento" element={<ProtectedRoute><TaxPlanning /></ProtectedRoute>} />
                 <Route path="/planejamento/:id" element={<ProtectedRoute><TaxPlanningDetail /></ProtectedRoute>} />
                <Route path="/minha-conta" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
                <Route path="/admin/usuarios" element={<ProtectedRoute requireSuperAdmin><AdminUsers /></ProtectedRoute>} />
                <Route path="/p/:slug" element={<PublicMovement />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
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
