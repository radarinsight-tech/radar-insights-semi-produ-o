import { useState, useMemo } from "react";
import UploadSection from "@/components/UploadSection";
import AnalysisResult, { type AnalysisData } from "@/components/AnalysisResult";
import HistoryTable from "@/components/HistoryTable";
import Filters from "@/components/Filters";
import StatsWidgets from "@/components/StatsWidgets";
import { generateMockHistory, mockAtendentes, mockTipos } from "@/lib/mockData";
import { Radar } from "lucide-react";

const history = generateMockHistory(20);

const Index = () => {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filters, setFilters] = useState({ atendente: "todos", periodo: "", tipo: "todos" });

  const handleAnalyze = (_file: File) => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const nota = +(7 + Math.random() * 3).toFixed(1);
      const classificacao = nota >= 9 ? "Excelente" : nota >= 8 ? "Ótimo" : nota >= 7 ? "Bom" : "Regular";
      setAnalysis({
        protocolo: `ATD-${Math.floor(1000 + Math.random() * 9000)}`,
        atendente: mockAtendentes[Math.floor(Math.random() * mockAtendentes.length)],
        tipo: mockTipos[Math.floor(Math.random() * mockTipos.length)],
        atualizacaoCadastral: Math.random() > 0.5 ? "Sim" : "Não",
        notaFinal: nota,
        classificacao,
        bonus: nota >= 9,
      });
      setIsAnalyzing(false);
    }, 1500);
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
        {/* Upload + Result */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UploadSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          <AnalysisResult data={analysis} />
        </div>

        {/* History + Stats */}
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
