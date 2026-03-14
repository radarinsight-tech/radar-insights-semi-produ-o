import { useState } from "react";
import { Radar, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CreditUploadSection from "@/components/credit/CreditUploadSection";
import CreditAnalysisResult, { type CreditAnalysisData } from "@/components/credit/CreditAnalysisResult";

const CreditAnalysis = () => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<CreditAnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleAnalyze = async (text: string) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-credit", {
        body: { text },
      });

      if (error) {
        toast.error("Erro ao analisar consulta de crédito.");
        console.error("Edge function error:", error);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setAnalysis(data as CreditAnalysisData);
      toast.success("Análise de crédito concluída!");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Erro inesperado ao processar análise.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Radar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Radar Insight — <span className="text-primary">Análise de Crédito</span>
              </h1>
              <p className="text-xs text-muted-foreground">Análise de CPF via consulta SPC/Serasa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CreditUploadSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          <CreditAnalysisResult data={analysis} />
        </div>
      </main>
    </div>
  );
};

export default CreditAnalysis;
