import { useState, useMemo } from "react";
import UploadSection from "@/components/UploadSection";
import AnalysisResult, { type AnalysisData } from "@/components/AnalysisResult";
import HistoryTable from "@/components/HistoryTable";
import Filters from "@/components/Filters";
import StatsWidgets from "@/components/StatsWidgets";
import { generateMockHistory, mockAtendentes, mockTipos } from "@/lib/mockData";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import { supabase } from "@/integrations/supabase/client";
import { Radar } from "lucide-react";
import { toast } from "sonner";

const history = generateMockHistory(20);

const Index = () => {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filters, setFilters] = useState({ atendente: "todos", periodo: "", tipo: "todos" });

  const handleAnalyze = async (file: File) => {
    setIsAnalyzing(true);
    try {
      // 1. Extract text from PDF
      const text = await extractTextFromPdf(file);
      if (!text.trim()) {
        toast.error("Não foi possível extrair texto do PDF.");
        setIsAnalyzing(false);
        return;
      }

      // 2. Call edge function
      const { data, error } = await supabase.functions.invoke("analyze-attendance", {
        body: { text },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Erro ao analisar atendimento. Tente novamente.");
        setIsAnalyzing(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setIsAnalyzing(false);
        return;
      }

      // 3. Map response to AnalysisData
      setAnalysis({
        protocolo: data.protocolo || "Não identificado",
        atendente: data.atendente || "Não identificado",
        tipo: data.tipo || "Não identificado",
        atualizacaoCadastral: data.atualizacaoCadastral || "Não",
        notaFinal: typeof data.nota === "number" ? data.nota : 0,
        classificacao: data.classificacao || "Regular",
        bonus: data.bonus === true,
      });
      toast.success("Análise concluída!");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Erro inesperado ao processar o PDF.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filtered = useMemo(() => {
    return history.filter((e) => {
      if (filters.atendente !== "todos" && e.atendente !== filters.atendente) return false;
      if (filters.tipo !== "todos" && e.tipo !== filters.tipo) return false;
      if (filters.periodo) {
        const [year, month] = filters.periodo.split("-");
        const parts = e.data.split("/");
        if (parts[1] !== month || parts[2] !== year) return false;
      }
      return true;
    });
  }, [filters]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Radar className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Radar Insight</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UploadSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          <AnalysisResult data={analysis} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-4">
            <Filters
              atendentes={mockAtendentes}
              tipos={mockTipos}
              filters={filters}
              onChange={setFilters}
            />
            <HistoryTable entries={filtered} />
          </div>
          <StatsWidgets entries={filtered} />
        </div>
      </main>
    </div>
  );
};

export default Index;
