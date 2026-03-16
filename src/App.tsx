import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import Hub from "./pages/Hub.tsx";
import AttendanceDemo from "./pages/AttendanceDemo.tsx";
import Auth from "./pages/Auth.tsx";
import Users from "./pages/Users.tsx";
import CreditAnalysis from "./pages/CreditAnalysis.tsx";
import CreditDashboard from "./pages/CreditDashboard.tsx";
import DocumentAnalysis from "./pages/DocumentAnalysis.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
              <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
                <div style={{ maxWidth: 600, margin: "0 auto" }}>
                  <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Radar Insight — Attendance</h1>
                  <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1.5rem" }}>Teste de isolamento da rota</p>
                  <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "1px solid #f59e0b", color: "#fbbf24", fontSize: "0.75rem", fontWeight: 600, marginBottom: "1.5rem" }}>Modo Demo</span>
                  <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "2rem", textAlign: "center", marginBottom: "1.5rem" }}>
                    <p style={{ fontSize: "1.125rem", fontWeight: 600 }}>✅ Rota funcionando</p>
                    <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.5rem" }}>Este conteúdo é estático. Se você está vendo isso, a rota /attendance está OK.</p>
                  </div>
                  <button style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", background: "#3b82f6", color: "white", fontWeight: 600, border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Nova análise</button>
                </div>
              </div>
            }
          />
          <Route
            path="/credit"
            element={
              <ProtectedRoute>
                <CreditAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit-dashboard"
            element={
              <ProtectedRoute>
                <CreditDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit-docs"
            element={
              <ProtectedRoute>
                <DocumentAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
