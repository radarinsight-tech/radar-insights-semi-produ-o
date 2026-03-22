import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import ModuleGuard from "@/components/ModuleGuard";
import AdminGuard from "@/components/AdminGuard";
import Hub from "./pages/Hub.tsx";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";

import Users from "./pages/Users.tsx";
import CreditAnalysis from "./pages/CreditAnalysis.tsx";
import CreditDashboard from "./pages/CreditDashboard.tsx";
import DocumentAnalysis from "./pages/DocumentAnalysis.tsx";
import SpcConsulta from "./pages/SpcConsulta.tsx";
import MentoriaLab from "./pages/MentoriaLab.tsx";
import MentoriaPreventiva from "./pages/MentoriaPreventiva.tsx";
import Atendentes from "./pages/Atendentes.tsx";
import RankingBonus from "./pages/RankingBonus.tsx";
import PerformanceDashboard from "./pages/PerformanceDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppModeBanner from "./components/AppModeBanner.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppModeBanner />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Hub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <ModuleGuard module="auditoria">
                  <Index />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit"
            element={
              <ProtectedRoute>
                <ModuleGuard module="credito">
                  <CreditAnalysis />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit-dashboard"
            element={
              <ProtectedRoute>
                <ModuleGuard module="credito">
                  <CreditDashboard />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit-docs"
            element={
              <ProtectedRoute>
                <ModuleGuard module="credito">
                  <DocumentAnalysis />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit-spc"
            element={
              <ProtectedRoute>
                <ModuleGuard module="credito">
                  <SpcConsulta />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentoria-lab"
            element={
              <ProtectedRoute>
                <ModuleGuard module="auditoria">
                  <MentoriaLab />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentoria-preventiva"
            element={
              <ProtectedRoute>
                <ModuleGuard module="auditoria">
                  <MentoriaPreventiva />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/atendentes"
            element={
              <ProtectedRoute>
                <ModuleGuard module="auditoria">
                  <Atendentes />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ranking"
            element={
              <ProtectedRoute>
                <ModuleGuard module="auditoria">
                  <RankingBonus />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute>
                <ModuleGuard module="auditoria">
                  <PerformanceDashboard />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <AdminGuard>
                  <Users />
                </AdminGuard>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
