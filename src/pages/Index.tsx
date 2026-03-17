import { useState, useMemo, useEffect, useCallback } from "react";
import { formatDateTimeBR } from "@/lib/utils";
import ErrorBoundary from "@/components/ErrorBoundary";
import UploadSection, { type UploadState } from "@/components/UploadSection";
import AnalysisResult, { type AnalysisData } from "@/components/AnalysisResult";
import HistoryTable from "@/components/HistoryTable";
import Filters, { type FilterValues } from "@/components/Filters";
import StatsWidgets, { type StatusFilter } from "@/components/StatsWidgets";
import { matchesStatusFilter, getStatusLabel } from "@/lib/auditStatus";
import ScoreEvolutionChart from "@/components/ScoreEvolutionChart";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Users, Search, ArrowLeft, AlertTriangle, RefreshCw, X, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    atendente: "todos",
    periodo: "",
    tipo: "todos",
  });
  const [protocolSearch, setProtocolSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [showCharts, setShowCharts] = useState(false);

  // Re-evaluation confirmation state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateProtocol, setDuplicateProtocol] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
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
          data: row.data || "",
          data_avaliacao: row.data_avaliacao
            ? formatDateTimeBR(row.data_avaliacao)
            : "",
          protocolo: row.protocolo || "—",
          atendente: row.atendente || "—",
          nota: Number(row.nota) || 0,
          classificacao: row.classificacao || "—",
          bonus: row.bonus ?? false,
          tipo: row.tipo || "—",
          atualizacao_cadastral: row.atualizacao_cadastral || "Não",
          pontos_melhoria: Array.isArray(row.pontos_melhoria) ? row.pontos_melhoria : [],
          pdf_url: row.pdf_url || undefined,
          full_report: row.full_report || null,
        }))
      );
    } catch (err) {
      console.error("Error loading history (uncaught):", err);
    }
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
    setAnalysisError(null);
    setUploadState("empty");
    setAnalyzedFileName("");
  };

  const runAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalyzedFileName(file.name);
    console.log("[Radar] Etapa 1: PDF carregado —", file.name, `(${(file.size / 1024).toFixed(1)} KB)`);
    try {
      console.log("[Radar] Etapa 2: Extraindo texto do PDF...");
      const text = await extractTextFromPdf(file);
      if (!text.trim()) {
        console.error("[Radar] Erro na Etapa 2: Texto extraído está vazio");
        toast.error("Não foi possível extrair texto do PDF.");
        setIsAnalyzing(false);
        setUploadState("empty");
        return;
      }
      console.log("[Radar] Etapa 2: Texto extraído com sucesso —", text.length, "caracteres");

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
      console.error("[Radar] Erro crítico no pipeline:", err);
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setAnalysisError(`Falha ao processar PDF: ${msg}`);
      toast.error("Erro inesperado ao processar o PDF.");
      setIsAnalyzing(false);
      setUploadState("completed");
    }
  };

  const executeAnalysis = async (file: File, text?: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalyzedFileName(file.name);
    try {
      if (!text) {
        console.log("[Radar] Etapa 2 (retry): Extraindo texto do PDF...");
        text = await extractTextFromPdf(file);
        if (!text.trim()) {
          console.error("[Radar] Erro na Etapa 2: Texto extraído está vazio");
          toast.error("Não foi possível extrair texto do PDF.");
          setIsAnalyzing(false);
          setUploadState("empty");
          return;
        }
      }

      // Upload PDF to storage
      console.log("[Radar] Etapa 3: Upload do PDF para storage...");
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(fileName, file, { contentType: "application/pdf" });

      let pdfUrl: string | null = null;
      if (uploadError) {
        console.error("[Radar] Erro na Etapa 3 (não crítico):", uploadError);
        toast.warning("Erro ao armazenar o PDF, mas a análise continuará.");
      } else {
        const { data: urlData } = supabase.storage.from("pdfs").getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
        console.log("[Radar] Etapa 3: PDF armazenado com sucesso");
      }

      console.log("[Radar] Etapa 4: Enviando para análise IA...");
      const { data, error } = await supabase.functions.invoke("analyze-attendance", {
        body: { text },
      });

      if (error) {
        console.error("[Radar] Erro na Etapa 4 (edge function):", error);
        setAnalysisError("Erro ao analisar atendimento. A função de análise retornou erro.");
        toast.error("Erro ao analisar atendimento. Tente novamente.");
        setIsAnalyzing(false);
        setUploadState("completed");
        return;
      }

      if (data?.error) {
        console.error("[Radar] Erro na Etapa 4 (resposta IA):", data.error);
        setAnalysisError(data.error);
        toast.error(data.error);
        setIsAnalyzing(false);
        setUploadState("completed");
        return;
      }

      console.log("[Radar] Etapa 4: Análise IA concluída —", data?.statusAuditoria, data?.classificacao);

      const fullReport = { ...data };

      // ═══ CLIENT-SIDE CONSISTENCY VALIDATION ═══
      const isAudited = data.statusAuditoria === "auditoria_realizada";
      
      // Block: audited but no score
      if (isAudited && (!data.pontosPossiveis || data.pontosPossiveis === 0)) {
        console.error("[Radar] Erro na Etapa 5 (consistência): auditoria sem pontuação");
        setAnalysisError("Erro de consistência: auditoria realizada mas sem pontuação.");
        toast.error("Erro de consistência: auditoria realizada mas sem pontuação. Reprocessar atendimento.");
        setUploadState("completed");
        setIsAnalyzing(false);
        return;
      }

      // Block: positive classification with zero score
      if (data.notaFinal === 0 && ["Excelente", "Bom atendimento", "Regular"].includes(data.classificacao) && isAudited) {
        console.error("[Radar] Erro na Etapa 5 (consistência): classificação positiva com nota 0");
        setAnalysisError("Erro de consistência: classificação positiva com nota zero.");
        toast.error("Erro de consistência: classificação positiva com nota zero. Reprocessar atendimento.");
        setUploadState("completed");
        setIsAnalyzing(false);
        return;
      }

      console.log("[Radar] Etapa 5: Validação de consistência OK");

      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        console.error("[Radar] Erro na Etapa 6: Usuário não autenticado");
        setAnalysisError("Usuário não autenticado. Faça login novamente.");
        toast.error("Usuário não autenticado. Faça login novamente.");
        setIsAnalyzing(false);
        setUploadState("completed");
        return;
      }

      // Map new audit fields to DB columns
      console.log("[Radar] Etapa 6: Salvando avaliação no banco...");
      const atualizacaoCadastral = data.bonusOperacional?.atualizacaoCadastral || "NÃO";
      const notaFinal = typeof data.notaFinal === "number" ? data.notaFinal : 0;
      const bonusQualidade = typeof data.bonusQualidade === "number" ? data.bonusQualidade : 0;

      const { data: savedRow, error: insertError } = await supabase.from("evaluations").insert({
        data: data.data || new Date().toLocaleDateString("pt-BR"),
        data_avaliacao: new Date().toISOString(),
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
        console.error("[Radar] Erro na Etapa 6 (insert):", insertError);
        setAnalysisError("Erro ao salvar avaliação: " + (insertError?.message || "Erro desconhecido"));
        toast.error("Erro ao salvar avaliação no histórico: " + (insertError?.message || "Erro desconhecido"));
        setUploadState("completed");
      } else {
        console.log("[Radar] Etapa 6: Avaliação salva com sucesso — ID:", savedRow.id);
        console.log("[Radar] Etapa 7: Renderizando resultado...");
        const isNoInteraction = data.motivo === "sem_interacao_do_cliente";
        setAnalysis({
          protocolo: savedRow.protocolo || "—",
          atendente: savedRow.atendente || "—",
          tipo: savedRow.tipo || "—",
          atualizacaoCadastral: savedRow.atualizacao_cadastral || "NÃO",
          notaFinal: Number(savedRow.nota) || 0,
          classificacao: savedRow.classificacao || "Fora de Avaliação",
          bonus: savedRow.bonus ?? false,
          bonusQualidade: bonusQualidade,
          pontosMelhoria: Array.isArray(savedRow.pontos_melhoria) ? savedRow.pontos_melhoria : [],
          impeditivo: data.impeditivo === true,
          motivoImpeditivo: data.motivoImpeditivo || undefined,
          pontosObtidos: data.pontosObtidos ?? undefined,
          pontosPossiveis: data.pontosPossiveis ?? undefined,
          noInteraction: isNoInteraction,
        });
        setUploadState(isNoInteraction ? "no-interaction" : "completed");
        toast.success(duplicateProtocol ? "Reavaliação concluída e salva!" : "Análise concluída e salva!");
        setDuplicateProtocol(null);
        setPendingFile(null);
        console.log("[Radar] Etapa 7: Resultado renderizado com sucesso");
        await loadHistory();
      }
    } catch (err) {
      console.error("[Radar] Erro crítico no pipeline:", err);
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setAnalysisError(`Falha inesperada: ${msg}`);
      toast.error("Erro inesperado ao processar o PDF.");
      setUploadState("completed");
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

  const baseFiltered = useMemo(() => {
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

  const filtered = useMemo(() => {
    if (!statusFilter) return baseFiltered;
    return baseFiltered.filter((e) =>
      matchesStatusFilter(
        e.full_report as Record<string, unknown> | null | undefined,
        statusFilter
      )
    );
  }, [baseFiltered, statusFilter]);

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
          <ErrorBoundary fallbackTitle="Erro no upload">
            <UploadSection
              onAnalyze={runAnalysis}
              isAnalyzing={isAnalyzing}
              analysisState={uploadState}
              analyzedFileName={analyzedFileName}
              onNewAnalysis={handleNewAnalysis}
            />
          </ErrorBoundary>
          <ErrorBoundary fallbackTitle="Erro no resultado da análise">
            {analysisError ? (
              <Card className="p-6 border-destructive/30 bg-destructive/5">
                <h2 className="text-lg font-bold text-primary mb-4">Resultado da Auditoria</h2>
                <div className="flex flex-col items-center text-center gap-3 py-4">
                  <div className="p-3 rounded-full bg-destructive/10">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Erro ao processar atendimento</p>
                  <p className="text-xs text-muted-foreground max-w-sm">{analysisError}</p>
                  <Button variant="outline" size="sm" onClick={handleNewAnalysis}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Nova análise
                  </Button>
                </div>
              </Card>
            ) : (
              <AnalysisResult data={analysis} />
            )}
          </ErrorBoundary>
        </div>


        {/* Charts toggle card */}
        {filtered.length >= 2 && !showCharts && (
          <Card
            className="p-4 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
            onClick={() => setShowCharts(true)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">Ver Gráficos</h3>
                <p className="text-xs text-muted-foreground">Evolução de notas e ranking de atendentes</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{filtered.length} registros</Badge>
            </div>
          </Card>
        )}

        {showCharts && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Gráficos de Evolução
              </h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCharts(false)}>
                <X className="h-3.5 w-3.5" /> Fechar
              </Button>
            </div>
            <ErrorBoundary fallbackTitle="Erro nos gráficos">
              <ScoreEvolutionChart entries={filtered} />
            </ErrorBoundary>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <ErrorBoundary fallbackTitle="Erro nos filtros">
                <Filters
                  atendentes={atendentes}
                  tipos={tipos}
                  filters={filters}
                  onChange={setFilters}
                />
              </ErrorBoundary>
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
            {statusFilter && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-sm font-medium text-foreground">
                  Filtrando: {getStatusLabel(statusFilter)}
                </span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setStatusFilter(null)}>
                  <X className="h-3 w-3 mr-1" /> Limpar filtro
                </Button>
              </div>
            )}
            <ErrorBoundary fallbackTitle="Erro na tabela de histórico">
              <HistoryTable entries={filtered} onRefresh={loadHistory} />
            </ErrorBoundary>
          </div>
          <ErrorBoundary fallbackTitle="Erro nos indicadores">
            <StatsWidgets entries={baseFiltered} activeStatusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
          </ErrorBoundary>
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
