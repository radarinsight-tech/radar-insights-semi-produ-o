import { useState, useMemo, useEffect, useCallback } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import UploadSection, { type UploadState } from "@/components/UploadSection";
import AnalysisResult, { type AnalysisData } from "@/components/AnalysisResult";
import HistoryTable from "@/components/HistoryTable";
import Filters, { type FilterValues } from "@/components/Filters";
import StatsWidgets from "@/components/StatsWidgets";
import ScoreEvolutionChart from "@/components/ScoreEvolutionChart";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Users, Search, ArrowLeft } from "lucide-react";
import logoSymbol from "@/assets/logo-symbol.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { HistoryEntry } from "@/lib/mockData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Parse dd/MM/yyyy to a Date object */
const parseDateBR = (str: string): Date | null => {
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};


const Index = () => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("empty");
  const [analyzedFileName, setAnalyzedFileName] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filters, setFilters] = useState<FilterValues>({
    atendente: "todos",
    periodo: "",
    tipo: "todos",
  });
  const [protocolSearch, setProtocolSearch] = useState("");

  // Re-evaluation confirmation state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateProtocol, setDuplicateProtocol] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("evaluations")
      .select("*")
      .eq("resultado_validado", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading history:", error);
      return;
    }

    setHistory(
      (data || []).map((row: any) => ({
        id: row.id,
        data: row.data,
        data_avaliacao: row.data_avaliacao
          ? new Date(row.data_avaliacao).toLocaleString("pt-BR")
          : "",
        protocolo: row.protocolo,
        atendente: row.atendente,
        nota: Number(row.nota),
        classificacao: row.classificacao,
        bonus: row.bonus,
        tipo: row.tipo,
        atualizacao_cadastral: row.atualizacao_cadastral || "Não",
        pontos_melhoria: row.pontos_melhoria || [],
        pdf_url: row.pdf_url || undefined,
        full_report: row.full_report || null,
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

  const handleNewAnalysis = () => {
    setAnalysis(null);
    setUploadState("empty");
    setAnalyzedFileName("");
  };

  const runAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setAnalyzedFileName(file.name);
    try {
      const text = await extractTextFromPdf(file);
      if (!text.trim()) {
        toast.error("Não foi possível extrair texto do PDF.");
        setIsAnalyzing(false);
        setUploadState("empty");
        return;
      }

      // Check for duplicate protocol before running analysis
      const protocolMatch = text.match(/(?:protocolo|prot\.?)\s*[:\-]?\s*([A-Za-z0-9]+)/i);
      const extractedProtocol = protocolMatch?.[1];

      if (extractedProtocol) {
        const { data: existing } = await supabase
          .from("evaluations")
          .select("id")
          .eq("protocolo", extractedProtocol)
          .limit(1);

        if (existing && existing.length > 0) {
          setPendingFile(file);
          setDuplicateProtocol(extractedProtocol);
          setIsAnalyzing(false);
          return;
        }
      }

      await executeAnalysis(file, text);
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Erro inesperado ao processar o PDF.");
      setIsAnalyzing(false);
      setUploadState("empty");
    }
  };

  const executeAnalysis = async (file: File, text?: string) => {
    setIsAnalyzing(true);
    setAnalyzedFileName(file.name);
    try {
      if (!text) {
        text = await extractTextFromPdf(file);
        if (!text.trim()) {
          toast.error("Não foi possível extrair texto do PDF.");
          setIsAnalyzing(false);
          setUploadState("empty");
          return;
        }
      }

      // Upload PDF to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(fileName, file, { contentType: "application/pdf" });

      let pdfUrl: string | null = null;
      if (uploadError) {
        console.error("PDF upload error:", uploadError);
        toast.warning("Erro ao armazenar o PDF, mas a análise continuará.");
      } else {
        const { data: urlData } = supabase.storage.from("pdfs").getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase.functions.invoke("analyze-attendance", {
        body: { text },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Erro ao analisar atendimento. Tente novamente.");
        setIsAnalyzing(false);
        setUploadState("empty");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setIsAnalyzing(false);
        setUploadState("empty");
        return;
      }

      const fullReport = { ...data };

      // ═══ CLIENT-SIDE CONSISTENCY VALIDATION ═══
      const isAudited = data.statusAuditoria === "auditoria_realizada";
      
      // Block: audited but no score
      if (isAudited && (!data.pontosPossiveis || data.pontosPossiveis === 0)) {
        toast.error("Erro de consistência: auditoria realizada mas sem pontuação. Reprocessar atendimento.");
        setUploadState("empty");
        setIsAnalyzing(false);
        return;
      }

      // Block: positive classification with zero score
      if (data.notaFinal === 0 && ["Excelente", "Bom atendimento", "Regular"].includes(data.classificacao) && isAudited) {
        toast.error("Erro de consistência: classificação positiva com nota zero. Reprocessar atendimento.");
        setUploadState("empty");
        setIsAnalyzing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        toast.error("Usuário não autenticado. Faça login novamente.");
        setIsAnalyzing(false);
        setUploadState("empty");
        return;
      }

      // Map new audit fields to DB columns
      const atualizacaoCadastral = data.bonusOperacional?.atualizacaoCadastral || "NÃO";
      const notaFinal = typeof data.notaFinal === "number" ? data.notaFinal : 0;
      const bonusQualidade = typeof data.bonusQualidade === "number" ? data.bonusQualidade : 0;

      const { data: savedRow, error: insertError } = await supabase.from("evaluations").insert({
        data: data.data || new Date().toLocaleDateString("pt-BR"),
        protocolo: data.protocolo || "Não identificado",
        atendente: data.atendente || "Não identificado",
        tipo: data.tipo || "Não identificado",
        atualizacao_cadastral: atualizacaoCadastral,
        nota: notaFinal,
        classificacao: data.classificacao || "Fora de Avaliação",
        bonus: bonusQualidade >= 70,
        pontos_melhoria: Array.isArray(data.mentoria) ? data.mentoria : [],
        user_id: user.id,
        pdf_url: pdfUrl,
        full_report: fullReport as unknown as import("@/integrations/supabase/types").Json,
        prompt_version: data.promptVersion || "auditor_v3",
        resultado_validado: true,
        audit_log: (data.auditLog || null) as unknown as import("@/integrations/supabase/types").Json,
        parent_evaluation_id: null,
      } as any).select().single();

      if (insertError || !savedRow) {
        console.error("Error saving evaluation:", insertError);
        toast.error("Erro ao salvar avaliação no histórico: " + (insertError?.message || "Erro desconhecido"));
        setUploadState("empty");
      } else {
        const isNoInteraction = data.motivo === "sem_interacao_do_cliente";
        setAnalysis({
          protocolo: savedRow.protocolo,
          atendente: savedRow.atendente,
          tipo: savedRow.tipo,
          atualizacaoCadastral: savedRow.atualizacao_cadastral,
          notaFinal: Number(savedRow.nota),
          classificacao: savedRow.classificacao,
          bonus: savedRow.bonus,
          bonusQualidade: bonusQualidade,
          pontosMelhoria: savedRow.pontos_melhoria || [],
          impeditivo: data.impeditivo === true,
          motivoImpeditivo: data.motivoImpeditivo,
          pontosObtidos: data.pontosObtidos,
          pontosPossiveis: data.pontosPossiveis,
          noInteraction: isNoInteraction,
        });
        setUploadState(isNoInteraction ? "no-interaction" : "completed");
        toast.success(duplicateProtocol ? "Reavaliação concluída e salva!" : "Análise concluída e salva!");
        setDuplicateProtocol(null);
        setPendingFile(null);
        await loadHistory();
      }
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Erro inesperado ao processar o PDF.");
      setUploadState("empty");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmReeval = () => {
    if (pendingFile) {
      executeAnalysis(pendingFile);
    }
  };

  const handleCancelReeval = () => {
    setPendingFile(null);
    setDuplicateProtocol(null);
    setUploadState("empty");
    toast.info("Análise cancelada.");
  };

  const atendentes = useMemo(() => [...new Set(history.map((e) => e.atendente))].sort(), [history]);
  const tipos = useMemo(() => [...new Set(history.map((e) => e.tipo))].sort(), [history]);

  const filtered = useMemo(() => {
    return history.filter((e) => {
      if (protocolSearch && !e.protocolo.toLowerCase().includes(protocolSearch.toLowerCase())) return false;
      if (filters.atendente !== "todos" && e.atendente !== filters.atendente) return false;
      if (filters.tipo !== "todos" && e.tipo !== filters.tipo) return false;

      if (filters.periodoInicio && filters.periodoFim) {
        const entryDate = parseDateBR(e.data);
        const startDate = parseDateBR(filters.periodoInicio);
        const endDate = parseDateBR(filters.periodoFim);
        if (entryDate && startDate && endDate) {
          if (entryDate < startDate || entryDate > endDate) return false;
        }
      } else if (filters.periodoInicio && !filters.periodoFim) {
        const entryDate = parseDateBR(e.data);
        const startDate = parseDateBR(filters.periodoInicio);
        if (entryDate && startDate && entryDate < startDate) return false;
      } else if (filters.periodo) {
        const [year, month] = filters.periodo.split("-");
        const parts = e.data.split("/");
        if (parts.length >= 3 && (parts[1] !== month || parts[2] !== year)) return false;
      }

      return true;
    });
  }, [filters, history, protocolSearch]);

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <h1 className="text-xl font-bold text-foreground">
            Radar Insight — <span className="text-primary">Sucesso do Cliente</span>
          </h1>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
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
          <UploadSection
            onAnalyze={runAnalysis}
            isAnalyzing={isAnalyzing}
            analysisState={uploadState}
            analyzedFileName={analyzedFileName}
            onNewAnalysis={handleNewAnalysis}
          />
          <AnalysisResult data={analysis} />
        </div>

        <ScoreEvolutionChart entries={filtered} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <Filters
                atendentes={atendentes}
                tipos={tipos}
                filters={filters}
                onChange={setFilters}
              />
              <div className="relative w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar protocolo..."
                  value={protocolSearch}
                  onChange={(e) => setProtocolSearch(e.target.value)}
                  className="pl-8 bg-card"
                />
              </div>
            </div>
            <HistoryTable entries={filtered} onRefresh={loadHistory} />
          </div>
          <StatsWidgets entries={filtered} />
        </div>
      </main>

      <AlertDialog open={!!duplicateProtocol} onOpenChange={(open) => { if (!open) handleCancelReeval(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atendimento já avaliado</AlertDialogTitle>
            <AlertDialogDescription>
              Este atendimento (protocolo <strong>{duplicateProtocol}</strong>) já foi avaliado anteriormente. Deseja reavaliar?
              <br />
              <span className="text-xs text-muted-foreground mt-1 block">
                Uma nova avaliação será criada, preservando o histórico anterior.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReeval}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReeval}>Sim, reavaliar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
