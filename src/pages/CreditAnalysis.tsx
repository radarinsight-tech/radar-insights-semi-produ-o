import { useState } from "react";
import { LogOut, ArrowLeft, LayoutDashboard, FileCheck, ShieldAlert } from "lucide-react";
import logoSymbol from "@/assets/logo-symbol.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import CreditHistoryTable from "@/components/credit/CreditHistoryTable";
import CreditDailySummary from "@/components/credit/CreditDailySummary";
import LegacyBanner from "@/components/LegacyBanner";

const CreditAnalysis = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background" data-module="credit">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm px-6 py-2.5 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/")}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Hub
            </Button>
            <img src={logoSymbol} alt="Radar Insight" className="h-5 w-5 rounded-md object-contain" />
            <span className="text-sm font-bold text-primary tracking-tight">Análise de Crédito (Em teste)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/credit-dashboard")}>
              <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
              Dashboard
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/credit-docs")}>
              <FileCheck className="h-3.5 w-3.5 mr-1" />
              Documentos
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <LegacyBanner message="⚠️ Esta versão está em teste e temporariamente desativada" description="Nenhuma operação de consulta ou escrita é permitida nesta versão. Use o módulo Crédito (Legado) para operações ativas." />

        <div className="text-center p-8 border border-dashed border-border rounded-xl bg-muted/30">
          <p className="text-sm text-muted-foreground font-medium">
            Novas consultas estão desabilitadas nesta versão em teste.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Use o módulo Crédito (Legado) para consultas e operações.
          </p>
        </div>

        <section>
          <h2 className="text-sm font-semibold mb-3">Histórico de Análises (somente leitura)</h2>
          <CreditHistoryTable refreshTrigger={0} />
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Resumo Diário</h2>
          <CreditDailySummary refreshTrigger={0} />
        </section>
      </main>
    </div>
  );
};

export default CreditAnalysis;
