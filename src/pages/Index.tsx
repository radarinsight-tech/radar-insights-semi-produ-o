import { useState, useMemo, useEffect, useCallback } from "react";
import UploadSection from "@/components/UploadSection";
import AnalysisResult, { type AnalysisData } from "@/components/AnalysisResult";
import HistoryTable from "@/components/HistoryTable";
import Filters from "@/components/Filters";
import StatsWidgets from "@/components/StatsWidgets";
import ScoreEvolutionChart from "@/components/ScoreEvolutionChart";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import { supabase } from "@/integrations/supabase/client";
import { Radar, LogOut, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { HistoryEntry } from "@/lib/mockData";

const Index = () => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filters, setFilters] = useState({ atendente: "todos", periodo: "", tipo: "todos" });
  const [protocolSearch, setProtocolSearch] = useState("");

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("evaluations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading history:", error);
      return;
    }

    setHistory(
      (data || []).map((row: any) => ({
        data: row.data,
        protocolo: row.protocolo,
        atendente: row.atendente,
        nota: Number(row.nota),
        classificacao: row.classificacao,
        bonus: row.bonus,
        tipo: row.tipo,
      }))
    );
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleAnalyze = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const text = await extractTextFromPdf(file);
      if (!text.trim()) {
        toast.error("Não foi possível extrair texto do PDF.");
        setIsAnalyzing(false);
        return;
      }

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

      const analysisResult: AnalysisData = {
        protocolo: data.protocolo || "Não identificado",
        atendente: data.atendente || "Não identificado",
        tipo: data.tipo || "Não identificado",
        atualizacaoCadastral: data.atualizacaoCadastral || "Não",
        notaFinal: typeof data.nota === "number" ? data.nota : 0,
        classificacao: data.classificacao || "Regular",
        bonus: data.bonus === true,
        pontosMelhoria: Array.isArray(data.pontosMelhoria) ? data.pontosMelhoria : [],
      };

      setAnalysis(analysisResult);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Save to database
      const { error: insertError } = await supabase.from("evaluations").insert({
        data: data.data || new Date().toLocaleDateString("pt-BR"),
        protocolo: analysisResult.protocolo,
        atendente: analysisResult.atendente,
        tipo: analysisResult.tipo,
        atualizacao_cadastral: analysisResult.atualizacaoCadastral,
        nota: analysisResult.notaFinal,
        classificacao: analysisResult.classificacao,
        bonus: analysisResult.bonus,
        pontos_melhoria: analysisResult.pontosMelhoria,
        user_id: user?.id,
      });

      if (insertError) {
        console.error("Error saving evaluation:", insertError);
        toast.warning("Análise concluída, mas houve erro ao salvar no histórico.");
      } else {
        toast.success("Análise concluída e salva!");
        await loadHistory();
      }
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Erro inesperado ao processar o PDF.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const atendentes = useMemo(() => [...new Set(history.map((e) => e.atendente))].sort(), [history]);
  const tipos = useMemo(() => [...new Set(history.map((e) => e.tipo))].sort(), [history]);

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
  }, [filters, history]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Radar className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Radar Insight</h1>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/users")}>
              <Users className="h-4 w-4" />
              Usuários
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UploadSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          <AnalysisResult data={analysis} />
        </div>

        <ScoreEvolutionChart entries={filtered} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-4">
            <Filters
              atendentes={atendentes}
              tipos={tipos}
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
