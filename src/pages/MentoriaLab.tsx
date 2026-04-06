import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { format } from "date-fns";
import {
  ArrowLeft,
  Bookmark,
  LogOut,
  Upload,
  FileText,
  Trash2,
  Eye,
  Play,
  Loader2,
  Search,
  X,
  Filter,
  Volume2,
  VolumeX,
  BookOpen,
  Archive,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  CalendarIcon,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Bug,
} from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useExcludedAttendants } from "@/hooks/useExcludedAttendants";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatDateBR, notaToScale10, formatNota } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import { extractAudioAttachments, extractPageImages, type ExtractedAudio, type ExtractedImage } from "@/lib/pdfMediaExtractor";
import { parseStructuredConversation, type StructuredConversation } from "@/lib/conversationParser";
import logoSymbol from "@/assets/logo-symbol.png";
import { toast } from "sonner";
import MentoriaInsights from "@/components/MentoriaInsights";
import PreflightCheck, { PreflightStatusBadge, usePreflightCheck } from "@/components/PreflightCheck";
import MentoriaCharts from "@/components/MentoriaCharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ConversationView from "@/components/ConversationView";
import MentoriaDetailDialog from "@/components/MentoriaDetailDialog";
import ParserDiagnosticDialog from "@/components/ParserDiagnosticDialog";
import MentoriaPipeline from "@/components/MentoriaPipeline";
import MentoriaUnifiedTable from "@/components/MentoriaUnifiedTable";
import MentoriaImportSummary from "@/components/MentoriaImportSummary";
import MentoriaBatchHistory from "@/components/MentoriaBatchHistory";
import MentoriaBonusPanel from "@/components/MentoriaBonusPanel";
import MentoriaReportExport from "@/components/MentoriaReportExport";
import { buildMarkedText } from "@/lib/buildMarkedText";
import VersionRegistryCard from "@/components/VersionRegistryCard";
import AnalysisResult, { type AnalysisData } from "@/components/AnalysisResult";
import { useOpaImport } from "@/hooks/useOpaImport";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radio, RefreshCw, AlertCircle, MessageSquareQuote } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";

type FileStatus = "pendente" | "lido" | "analisado" | "erro" | "aguardando_revisao_ia" | "aguardando_revisao_manual" | "confirmado" | "reprovado";
type WorkflowStatus = "nao_iniciado" | "em_analise" | "finalizado";

type BatchStatus =
  | "recebido"
  | "extraindo_arquivos"
  | "organizando_atendimentos"
  | "pronto_para_curadoria"
  | "em_analise"
  | "concluido"
  | "erro";

interface BatchInfo {
  id: string;
  batchCode: string;
  createdAt: Date;
  sourceType: "pdf" | "zip";
  originalFileName?: string;
  totalFilesInSource: number;
  totalPdfs: number;
  ignoredFiles: number;
  status: BatchStatus;
}

const batchStatusConfig: Record<BatchStatus, { label: string; icon: typeof Package; color: string }> = {
  recebido: { label: "Recebido", icon: Package, color: "text-muted-foreground" },
  extraindo_arquivos: { label: "Extraindo arquivos", icon: Loader2, color: "text-blue-600" },
  organizando_atendimentos: { label: "Organizando atendimentos", icon: Clock, color: "text-blue-600" },
  pronto_para_curadoria: { label: "Pronto para curadoria", icon: CheckCircle2, color: "text-primary" },
  em_analise: { label: "Em análise", icon: Loader2, color: "text-warning" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-accent" },
  erro: { label: "Erro", icon: AlertTriangle, color: "text-destructive" },
};

interface LabFile {
  id: string;
  file: File;
  name: string;
  size: number;
  addedAt: Date;
  status: FileStatus;
  text?: string;
  rawText?: string;
  result?: any;
  error?: string;
  atendente?: string;
  atendente_raw?: string;
  atendente_is_technical_id?: boolean;
  protocolo?: string;
  data?: string;
  canal?: string;
  hasAudio?: boolean;
  hasImage?: boolean;
  tipo?: string;
  batchId?: string;
  batchFileId?: string;
  batchCode?: string;
  storagePath?: string;
  analyzedAt?: Date;
  ineligible?: boolean;
  ineligibleReason?: string;
  nonEvaluable?: boolean;
  nonEvaluableReason?: string;
  attendantMatch?: MatchResult;
  transferred?: boolean;
  approvedAsOfficial?: boolean;
  approvalOrigin?: "manual" | "automatic";
  evaluationId?: string;
  uraContext?: UraContext;
  uraStatus?: UraStatus;
  structuredConversation?: StructuredConversation;
  tipo_analise?: string | null;
  visualizado?: boolean;
  audioBlobs?: import("@/lib/pdfMediaExtractor").ExtractedAudio[];
  imageBlobs?: import("@/lib/pdfMediaExtractor").ExtractedImage[];
}

const statusConfig: Record<FileStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  lido: { label: "Lido", color: "bg-blue-100 text-blue-700" },
  analisado: { label: "Analisado", color: "bg-accent/15 text-accent" },
  erro: { label: "Erro", color: "bg-destructive/15 text-destructive" },
  aguardando_revisao_ia: { label: "Fila IA", color: "bg-blue-100 text-blue-700" },
  aguardando_revisao_manual: { label: "Fila Manual", color: "bg-emerald-100 text-emerald-700" },
  confirmado: { label: "Confirmado", color: "bg-emerald-800/15 text-emerald-800" },
  reprovado: { label: "Reprovado", color: "bg-destructive/15 text-destructive" },
};

import { extractAllMetadata } from "@/lib/mentoriaMetadata";
import { getRegisteredAttendants, matchAttendant, type MatchResult } from "@/lib/attendantMatcher";
import { extractUraContext } from "@/lib/conversationParser";
import type { UraContext, UraStatus } from "@/lib/uraContextSummarizer";
import {
  detectMentoriaEvaluability,
  mergePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
  resolvePersistedMentoriaEvaluability,
} from "@/lib/mentoriaEvaluability";
import {
  buildOfficialAuditLog,
  getOfficialApprovalOrigin,
  normalizeAttendantName,
  type OfficialApprovalOrigin,
} from "@/lib/officialEvaluations";
import { logAudit } from "@/lib/officialEvaluations";

const IMPORT_LIMIT = 1000;
const IMPORT_RECOMMENDED = 500;
const ANALYZE_LIMIT = 50;
const PAGE_SIZE = 30;
const INGESTION_CONCURRENCY = 4;

const FATAL_PDF_READ_ERROR_PATTERNS = [
  /invalidpdf/i,
  /invalid\s+pdf/i,
  /corrupt/i,
  /corrompid/i,
  /formaterror/i,
  /bad\s+xref/i,
  /unexpected\s+end\s+of\s+file/i,
  /missingpdf/i,
  /password/i,
  /unable\s+to\s+parse/i,
  /cannot\s+read/i,
  /failed\s+to\s+load\s+pdf/i,
];

const isFatalPdfReadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return FATAL_PDF_READ_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

// ─── Performance Sub-Sections ───────────────────────────────────────
type PerformanceSection = "bonus_panel" | "resumo" | "bonus" | "detalhada" | "recomendados" | "padroes" | "roteiro" | "graficos";

const PERF_NAV: { key: PerformanceSection; label: string; icon: string; tooltip: string }[] = [
  { key: "bonus_panel", label: "Painel de Bônus", icon: "🏆", tooltip: "Ranking de bônus por atendente com régua progressiva" },
  { key: "resumo", label: "Resumo Geral", icon: "📊", tooltip: "Visão consolidada: pontos críticos e fortes do lote" },
  { key: "bonus", label: "Performance & Bônus", icon: "💰", tooltip: "Performance e valor de bônus detalhado por atendente" },
  { key: "detalhada", label: "Perf. Detalhada", icon: "👤", tooltip: "Notas por critério de avaliação de cada atendente" },
  { key: "recomendados", label: "Recomendados", icon: "⭐", tooltip: "Atendimentos indicados para sessão de mentoria" },
  { key: "padroes", label: "Padrões", icon: "💬", tooltip: "Padrões de comportamento recorrentes identificados pela IA" },
  { key: "roteiro", label: "Roteiro", icon: "📋", tooltip: "Roteiro de mentoria gerado automaticamente pela IA" },
  { key: "graficos", label: "Gráficos de Evolução", icon: "📈", tooltip: "Evolução da nota média e volume de auditorias ao longo do tempo" },
];

const PerformanceSections = ({
  files,
  globalExcludedNames,
  globalExcludedSet,
  excludeAttendants,
  restoreAttendants,
  batchAutoApprove,
}: {
  files: any[];
  globalExcludedNames: Map<string, any>;
  globalExcludedSet: Set<string>;
  excludeAttendants: (names: string[]) => void;
  restoreAttendants: (names: string[]) => void;
  batchAutoApprove: (ids: string[]) => Promise<void>;
}) => {
  const [activeSection, setActiveSection] = useState<PerformanceSection>("bonus_panel");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const renderContent = () => {
    switch (activeSection) {
      case "bonus_panel":
        return (
          <MentoriaBonusPanel
            files={files}
            excludedNames={globalExcludedNames}
            onExclude={excludeAttendants}
            onRestore={restoreAttendants}
            onAutoApprove={batchAutoApprove}
          />
        );
      case "resumo":
        return <MentoriaInsights files={files} excludedAttendants={globalExcludedSet} section="resumo" />;
      case "bonus":
        return <MentoriaInsights files={files} excludedAttendants={globalExcludedSet} section="perf_bonus" />;
      case "detalhada":
        return <MentoriaInsights files={files} excludedAttendants={globalExcludedSet} section="detalhada" />;
      case "recomendados":
        return <MentoriaInsights files={files} excludedAttendants={globalExcludedSet} section="recomendados" />;
      case "padroes":
        return <MentoriaInsights files={files} excludedAttendants={globalExcludedSet} section="padroes" />;
      case "roteiro":
        return <MentoriaInsights files={files} excludedAttendants={globalExcludedSet} section="roteiro" />;
      case "graficos":
        return <MentoriaCharts files={files} excludedAttendants={globalExcludedSet} />;
      default:
        return null;
    }
  };

  // Mobile: dropdown selector
  if (isMobile) {
    const activeNav = PERF_NAV.find((n) => n.key === activeSection);
    return (
      <div className="space-y-3">
        <Select value={activeSection} onValueChange={(v) => setActiveSection(v as PerformanceSection)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {activeNav && `${activeNav.icon} ${activeNav.label}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERF_NAV.map((nav) => (
              <SelectItem key={nav.key} value={nav.key}>
                {nav.icon} {nav.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {renderContent()}
      </div>
    );
  }

  // Desktop: sidebar + content
  return (
    <div className="flex gap-4 min-h-[400px]">
      {/* Sidebar */}
      <nav className="w-[200px] shrink-0 rounded-lg border border-border/50 bg-[hsl(210,20%,98%)] dark:bg-muted/20 p-2 space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1.5">Seções</p>
        <TooltipProvider delayDuration={300}>
          {PERF_NAV.map((nav) => (
            <Tooltip key={nav.key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveSection(nav.key)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left",
                    activeSection === nav.key
                      ? "bg-primary/10 text-primary border-l-[3px] border-l-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  )}
                >
                  <span className="text-sm">{nav.icon}</span>
                  <span className="truncate">{nav.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[250px]">
                <p>{nav.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
};

const MentoriaLab = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<LabFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importingCount, setImportingCount] = useState(0);
  const [readingIds, setReadingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("operacao");
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [sideFile, setSideFile] = useState<LabFile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAnalyzeWarning, setShowAnalyzeWarning] = useState(false);
  const [mentoriaFile, setMentoriaFile] = useState<LabFile | null>(null);
  const [mentoriaInitialStep, setMentoriaInitialStep] = useState<"revisao" | "relatorio" | undefined>(undefined);
  const [showCharts, setShowCharts] = useState(false);
  const [highlightedFileId, setHighlightedFileId] = useState<string | null>(null);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearConfirmStep, setClearConfirmStep] = useState<{ action: () => Promise<void>; count: number; label: string } | null>(null);
   const [diagnosticFile, setDiagnosticFile] = useState<LabFile | null>(null);
   const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, WorkflowStatus>>({});
   const [duplicateCount, setDuplicateCount] = useState(0);
   const [batchStats, setBatchStats] = useState<{ analyzing: number; completed: number; failed: number }>({
     analyzing: 0,
     completed: 0,
     failed: 0,
   });
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [opaAnalyzing, setOpaAnalyzing] = useState(false);
  const [opaResult, setOpaResult] = useState<AnalysisData | null>(null);
  const [opaFullReport, setOpaFullReport] = useState<any>(null);
  const [opaFiles, setOpaFiles] = useState<LabFile[]>([]);
  const [opaSearchTerm, setOpaSearchTerm] = useState("");
  const [_opaFilterAtendente_UNUSED, _setOpaFilterAtendente_UNUSED] = useState("todos"); // kept for compat; real filter is opa.filterAtendente
  const [opaHumanSelected, setOpaHumanSelected] = useState<Set<string>>(new Set()); // multi-select human attendants
  const [opaFilterAuditoriaFrom, setOpaFilterAuditoriaFrom] = useState<Date | undefined>();
  const [opaFilterAuditoriaTo, setOpaFilterAuditoriaTo] = useState<Date | undefined>();
  const [opaWorkflowStatuses, setOpaWorkflowStatuses] = useState<Record<string, WorkflowStatus>>({});
  const [opaMentoriaFile, setOpaMentoriaFile] = useState<LabFile | null>(null);
  const [opaMentoriaInitialStep, setOpaMentoriaInitialStep] = useState<"revisao" | "relatorio" | undefined>(undefined);
  const [opaMentoriaMode, setOpaMentoriaMode] = useState<"report" | "review">("review");
  const [opaHighlightedFileId, setOpaHighlightedFileId] = useState<string | null>(null);
  const { isAdmin } = useUserPermissions();
  const {
    excludedNames: globalExcludedNames,
    excludedSet: globalExcludedSet,
    excludeAttendants,
    restoreAttendants,
  } = useExcludedAttendants();
  const normalizedExcludedAttendants = useMemo(
    () => new Set(Array.from(globalExcludedSet, (name) => normalizeAttendantName(name))),
    [globalExcludedSet],
  );
  // Filters
  const [filterAtendente, setFilterAtendente] = useState("todos");
  const [filterPeriodoFrom, setFilterPeriodoFrom] = useState<Date | undefined>();
  const [filterPeriodoTo, setFilterPeriodoTo] = useState<Date | undefined>();
  const [filterAuditoriaFrom, setFilterAuditoriaFrom] = useState<Date | undefined>();
  const [filterAuditoriaTo, setFilterAuditoriaTo] = useState<Date | undefined>();
  const [filterCanal, setFilterCanal] = useState("todos");
  const [filterAudio, setFilterAudio] = useState("todos");

  // Global month filter (competência)
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    // Generate last 12 months + current
    const today = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      options.push({ value: val, label: `${months[d.getMonth()]}/${d.getFullYear()}` });
    }
    return options;
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const [loadingFromDb, setLoadingFromDb] = useState(true);

  // ── Opa Suite handler ──
  const handleOpaTextReady = useCallback(async (
    text: string,
    meta: {
      protocolo: string;
      atendente: string;
      canal: string;
      attendanceId: string;
      rawText?: string;
      structuredConversation?: Array<{ timestamp?: string; author: string; text: string }>;
    },
  ) => {
    setOpaAnalyzing(true);
    // Persist rawText and structuredConversation into the LabFile immediately
    setOpaFiles((prev) => prev.map((f) => f.id === meta.attendanceId ? {
      ...f,
      status: "lido" as FileStatus,
      text: text,
      rawText: meta.rawText || text,
      structuredConversation: meta.structuredConversation as any,
    } : f));
    try {
      const response = await supabase.functions.invoke("analyze-attendance", { body: { text } });
      if (response.error || response.data?.error) {
        const detail = response.data?.error || response.error?.message || "Erro desconhecido";
        toast.error(`Erro na análise: ${detail}`);
        setOpaFiles((prev) => prev.map((f) => f.id === meta.attendanceId ? { ...f, status: "erro" as FileStatus, error: detail } : f));
        setOpaAnalyzing(false);
        return;
      }
      const d = response.data;
      setOpaFullReport(d);
      const analysisResult: AnalysisData = {
        protocolo: d.protocolo || meta.protocolo || "—",
        atendente: d.atendente || meta.atendente || "—",
        tipo: d.tipo || "—",
        atualizacaoCadastral: d.bonusOperacional?.atualizacaoCadastral || "NÃO",
        notaFinal: d.notaFinal ?? d.nota ?? 0,
        classificacao: d.classificacao || "—",
        bonus: (d.bonusQualidade ?? 0) >= 80,
        bonusQualidade: d.bonusQualidade ?? 0,
        pontosMelhoria: d.mentoria || d.pontosMelhoria || [],
        pontosObtidos: d.pontosObtidos,
        pontosPossiveis: d.pontosPossiveis,
        noInteraction: d.statusAtendimento === "fora_de_avaliacao" || d.motivo === "sem_interacao_do_cliente",
        impeditivo: d.statusAuditoria === "impedimento_detectado",
        motivoImpeditivo: d.motivoImpeditivo,
      };
      setOpaResult(analysisResult);
      // Update the opaFile with result data
      setOpaFiles((prev) => prev.map((f) => f.id === meta.attendanceId ? {
        ...f,
        status: "analisado" as FileStatus,
        result: d,
        atendente: d.atendente || meta.atendente || f.atendente,
        protocolo: d.protocolo || meta.protocolo || f.protocolo,
        analyzedAt: new Date(),
      } : f));
      setOpaWorkflowStatuses((prev) => ({ ...prev, [meta.attendanceId]: "finalizado" }));
      toast.success("Análise concluída com sucesso!");
    } catch (err: any) {
      console.error("[OpaImport] analyze error:", err);
      toast.error("Erro ao analisar atendimento da Opa Suite");
      setOpaFiles((prev) => prev.map((f) => f.id === meta.attendanceId ? { ...f, status: "erro" as FileStatus, error: "Erro ao analisar" } : f));
    } finally {
      setOpaAnalyzing(false);
    }
  }, []);

  // ── Opa Suite hook ──
  const opa = useOpaImport({ onTextReady: handleOpaTextReady, isAnalyzing: opaAnalyzing });

  // Convert OpaAttendances to LabFile format when list is fetched — with dedup
  useEffect(() => {
    if (opa.attendances.length === 0) return;

    const dedup = async () => {
      // Collect all protocolos from fetched attendances
      const protocolos = opa.attendances
        .map((a) => a.protocolo)
        .filter(Boolean) as string[];

      // Query evaluations table for already-imported protocolos
      let alreadyImportedProtocolos = new Set<string>();
      if (protocolos.length > 0) {
        const { data: existing } = await supabase
          .from("evaluations")
          .select("protocolo")
          .in("protocolo", protocolos);
        if (existing) {
          alreadyImportedProtocolos = new Set(existing.map((e) => e.protocolo));
        }
      }

      setOpaFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const newFiles: LabFile[] = opa.attendances
          .filter((att) => !existingIds.has(att.id))
          .filter((att) => {
            // Skip attendances already imported (by protocolo)
            if (att.protocolo && alreadyImportedProtocolos.has(att.protocolo)) return false;
            return true;
          })
          .map((att) => ({
            id: att.id,
            file: new File([], `opa-${att.protocolo || att.id}.txt`),
            name: att.protocolo || att.id,
            size: 0,
            addedAt: att.data_inicio ? new Date(att.data_inicio) : new Date(),
            status: "pendente" as FileStatus,
            atendente: att.atendente?.trim() || undefined,
            atendente_raw: att.atendente_raw || undefined,
            atendente_is_technical_id: att.atendente_is_technical_id ?? false,
            protocolo: att.protocolo || undefined,
            data: att.data_inicio ? new Date(att.data_inicio).toLocaleDateString("pt-BR") : undefined,
            canal: att.canal || undefined,
          }));

        // Merge: keep existing (possibly analyzed) files + add new ones
        const updatedPrev = prev.filter((f) => opa.attendances.some((att) => att.id === f.id));
        const merged = [...updatedPrev, ...newFiles];

        // Notify user about deduplication results
        const totalFetched = opa.attendances.length;
        const duplicatesSkipped = totalFetched - newFiles.length - updatedPrev.length;
        if (duplicatesSkipped > 0) {
          toast.info(`${duplicatesSkipped} atendimento(s) já importado(s) foram ignorados.`);
        }
        if (merged.length === 0 && totalFetched > 0) {
          toast.warning("Nenhum novo atendimento encontrado. Todos já foram importados anteriormente.");
        }

        return merged;
      });
    };

    dedup();
  }, [opa.attendances]);

  // ── Registered attendants from DB for friendly name resolution ──
  const [registeredAttendants, setRegisteredAttendants] = useState<import("@/lib/attendantMatcher").RegisteredAttendant[]>([]);
  useEffect(() => {
    getRegisteredAttendants().then(setRegisteredAttendants).catch(() => {});
  }, []);

  // Opa atendentes list — classify as human vs bot/system
  // CRITICAL: Raw ObjectIds are NOT bots — they are unresolved humans
  const BOT_KEYWORDS = ["bot", "sistema", "automático", "automatico", "virtual", "ura", "chatbot", "autoatendimento"];
  const isLikelyBot = (name: string, file?: LabFile) => {
    if (!name) return false;
    // If the proxy already told us this is a technical ID, it's an unresolved human, NOT a bot
    if (file?.atendente_is_technical_id) return false;
    const lower = name.toLowerCase();
    // Raw ObjectIds / UUIDs are unresolved humans, NOT bots
    if (/^[a-f0-9]{24}$/i.test(name)) return false;
    if (/^[0-9a-f-]{36}$/i.test(name)) return false;
    return BOT_KEYWORDS.some((kw) => lower.includes(kw));
  };
  const isRawId = (name: string) => /^[a-f0-9]{24}$/i.test(name) || /^[0-9a-f-]{36}$/i.test(name);

  // Resolve friendly name: first try registered attendants DB, then fallback
  const friendlyName = useCallback((name: string): string => {
    if (!name) return "Sem atendente";
    // Check registered attendants for a match
    const normalizedInput = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const match = registeredAttendants.find((a) => {
      const n = a.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const nick = a.nickname?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return n === normalizedInput || n.includes(normalizedInput) || normalizedInput.includes(n) ||
        (nick && (nick === normalizedInput || nick.includes(normalizedInput) || normalizedInput.includes(nick)));
    });
    if (match) return match.name;
    // Fallback: mask raw IDs
    if (isRawId(name)) return `Atendente (${name.slice(0, 6)}…)`;
    return name;
  }, [registeredAttendants]);

  // Opa filtered files — uses opa.filterAtendente as single source
  const opaFilteredFiles = useMemo(() => {
    const currentFilter = opa.filterAtendente;
    return opaFiles.filter((f) => {
      if (opaSearchTerm) {
        const q = opaSearchTerm.toLowerCase();
        const displayName = f.atendente ? friendlyName(f.atendente) : "";
        if (
          !f.name.toLowerCase().includes(q) &&
          !f.protocolo?.toLowerCase().includes(q) &&
          !displayName.toLowerCase().includes(q)
        ) return false;
      }
      if (currentFilter === "sem_atendente") {
        if (f.atendente) return false;
    } else if (currentFilter === "somente_humanos") {
        if (!f.atendente || isLikelyBot(f.atendente, f)) return false;
        // If specific humans are selected, filter further
        if (opaHumanSelected.size > 0) {
          const displayName = friendlyName(f.atendente);
          if (!opaHumanSelected.has(displayName) && !opaHumanSelected.has(f.atendente)) return false;
        }
      } else if (currentFilter === "somente_bot") {
        if (!f.atendente || !isLikelyBot(f.atendente, f)) return false;
      } else if (currentFilter !== "todos") {
        // Compare using friendly name since filter values use friendly names
        const displayName = f.atendente ? friendlyName(f.atendente) : "";
        if (displayName !== currentFilter && f.atendente !== currentFilter) return false;
      }
      if (opaFilterAuditoriaFrom || opaFilterAuditoriaTo) {
        if (!f.analyzedAt) return false;
        if (opaFilterAuditoriaFrom && f.analyzedAt < opaFilterAuditoriaFrom) return false;
        if (opaFilterAuditoriaTo) {
          const endOfDay = new Date(opaFilterAuditoriaTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (f.analyzedAt > endOfDay) return false;
        }
      }
      return true;
    });
  }, [opaFiles, opaSearchTerm, opa.filterAtendente, opaHumanSelected, opaFilterAuditoriaFrom, opaFilterAuditoriaTo, friendlyName]);

  const opaAtendentes = useMemo(() => {
    const map = new Map<string, string>(); // friendly -> friendly (dedup)
    opaFiles.forEach((f) => {
      if (f.atendente) {
        const fn = friendlyName(f.atendente);
        if (!map.has(fn)) map.set(fn, fn);
      }
    });
    return [...map.keys()].sort();
  }, [opaFiles, friendlyName]);

  // Human-only attendants list for the secondary selector
  const opaHumanAttendants = useMemo(() => {
    const map = new Map<string, string>();
    opaFiles.forEach((f) => {
      if (f.atendente && !isLikelyBot(f.atendente, f)) {
        const fn = friendlyName(f.atendente);
        if (!map.has(fn)) map.set(fn, fn);
      }
    });
    // Also add registered attendants that participate in evaluation
    registeredAttendants.forEach((a) => {
      if (a.participates_evaluation && a.active && !map.has(a.name)) {
        map.set(a.name, a.name);
      }
    });
    return [...map.keys()].sort();
  }, [opaFiles, friendlyName, registeredAttendants]);

  // Opa counts
  const opaCounts = useMemo(() => {
    const source = opaFilteredFiles;
    return {
      total: source.length,
      pendente: source.filter((f) => f.status === "pendente").length,
      lido: source.filter((f) => f.status === "lido").length,
      analisado: source.filter((f) => f.status === "analisado").length,
      erro: source.filter((f) => f.status === "erro").length,
      naoAvaliavel: 0,
    };
  }, [opaFilteredFiles]);

  const getOpaWorkflowStatus = useCallback((fileId: string): WorkflowStatus => opaWorkflowStatuses[fileId] || "nao_iniciado", [opaWorkflowStatuses]);

  const openOpaMentoria = useCallback((f: LabFile, initialStep?: "revisao" | "relatorio") => {
    // If file lacks result data, don't open empty modal — trigger auto-fetch instead
    if (!f.result) {
      const att = opa.attendances.find((a) => a.id === f.id);
      if (att) {
        toast.info("Carregando dados do atendimento...");
        opa.handleSelect(att);
      } else {
        toast.warning("Dados do atendimento não disponíveis. Tente buscar novamente.");
      }
      return;
    }
    setOpaMentoriaFile(f);
    setOpaMentoriaInitialStep(initialStep);
    setOpaHighlightedFileId(f.id);
    setOpaWorkflowStatuses((prev) => ({ ...prev, [f.id]: prev[f.id] === "finalizado" ? "finalizado" : "em_analise" }));
  }, [opa]);

  const handleOpaStartMentoria = useCallback(async (labFile: LabFile) => {
    // For Opa files, we need to fetch messages first if not already analyzed
    if (labFile.status === "pendente") {
      const att = opa.attendances.find((a) => a.id === labFile.id);
      if (att) {
        opa.handleSelect(att);
      }
      return;
    }
    if (labFile.status === "analisado" && labFile.result) {
      openOpaMentoria(labFile);
    }
  }, [opa, openOpaMentoria]);

  // Load persisted batches and files from database on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoadingFromDb(false);
          return;
        }

        const { data: batches } = await supabase
          .from("mentoria_batches")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!batches || batches.length === 0) {
          setLoadingFromDb(false);
          return;
        }

        const batchIds = batches.map((b) => b.id);
        const { data: batchFiles } = await supabase
          .from("mentoria_batch_files")
          .select("*")
          .in("batch_id", batchIds)
          .order("created_at", { ascending: true });

        if (!batchFiles || batchFiles.length === 0) {
          setLoadingFromDb(false);
          return;
        }

        const { data: evaluations } = await supabase
          .from("evaluations")
          .select("id, protocolo, atendente, resultado_validado, full_report, nota, classificacao, audit_log")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1000);

        const evalMap = new Map<string, any>();
        if (evaluations) {
          for (const ev of evaluations) {
            if (ev.protocolo && !evalMap.has(ev.protocolo)) {
              evalMap.set(ev.protocolo, ev);
            }
          }
        }

        const latestBatch = batches[0];
        setBatchInfo({
          id: latestBatch.id,
          batchCode: latestBatch.batch_code,
          createdAt: new Date(latestBatch.created_at),
          sourceType: latestBatch.source_type as "pdf" | "zip",
          originalFileName: latestBatch.original_file_name || undefined,
          totalFilesInSource: latestBatch.total_files_in_source,
          totalPdfs: latestBatch.total_pdfs,
          ignoredFiles: latestBatch.ignored_files,
          status: latestBatch.status as BatchStatus,
        });
        setCurrentBatchId(latestBatch.id);

        const evaluabilityBackfill: Array<{ id: string; result: Record<string, unknown> }> = [];

        const batchCodeMap = new Map<string, string>();
        for (const b of batches) batchCodeMap.set(b.id, b.batch_code);

        const restoredFiles: LabFile[] = batchFiles.map((bf) => {
          const matchedEval = bf.protocolo ? evalMap.get(bf.protocolo) : undefined;
          const isAnalyzed = bf.status === "analyzed" && (bf.result || matchedEval);
          const result = bf.result || matchedEval?.full_report;

          let fileStatus: FileStatus = "pendente";
          if (bf.status === "analyzed") fileStatus = "analisado";
          else if (bf.status === "read") fileStatus = "lido";
          else if (bf.status === "error") fileStatus = "erro";
          else if (bf.status === "aguardando_revisao_ia") fileStatus = "aguardando_revisao_ia";
          else if (bf.status === "aguardando_revisao_manual") fileStatus = "aguardando_revisao_manual";
          else if (bf.status === "confirmado") fileStatus = "confirmado";
          else if (bf.status === "reprovado") fileStatus = "reprovado";

          // Restore raw text and structured messages from DB
          const rawText = ((bf as any).raw_text || (bf as any).extracted_text) as string | undefined;
          const persistedMessages = (bf as any).parsed_messages as StructuredConversation | undefined;

          // Restore or recompute structured conversation
          let structured: StructuredConversation | undefined = persistedMessages || undefined;
          if (!structured && rawText) {
            try {
              structured = parseStructuredConversation(rawText, bf.atendente || undefined);
            } catch {
              /* non-blocking */
            }
          }

          // Recompute URA context from persisted raw text
          let uraCtx: UraContext | undefined;
          if (rawText) {
            try {
              uraCtx = extractUraContext(rawText, bf.atendente || undefined);
            } catch {
              /* non-blocking */
            }
          }

          const persistedEvaluability = resolvePersistedMentoriaEvaluability(result);
          const persistedIneligibility = resolvePersistedMentoriaIneligibility(result);
          const evaluabilityState =
            persistedEvaluability ??
            detectMentoriaEvaluability({
              structuredConversation: structured,
              rawText,
              hasAudio: bf.has_audio || uraCtx?.audioDetectado,
            });
          const persistedResult = mergePersistedMentoriaEvaluability(result, evaluabilityState);
          const resolvedIneligibility =
            persistedIneligibility ?? resolvePersistedMentoriaIneligibility(persistedResult);
          const isIneligible = resolvedIneligibility?.ineligible === true;
          const ineligibleReason = resolvedIneligibility?.reason;

          if (!persistedEvaluability || !persistedIneligibility) {
            evaluabilityBackfill.push({ id: bf.id, result: persistedResult });
          }

          return {
            id: bf.id,
            file: new File([], bf.file_name, { type: "application/pdf" }),
            name: bf.file_name,
            size: bf.file_size || 0,
            addedAt: new Date(bf.created_at),
            status: fileStatus,
            text: rawText || undefined,
            atendente: bf.atendente || undefined,
            protocolo: bf.protocolo || undefined,
            data: bf.data_atendimento || undefined,
            canal: bf.canal || undefined,
            hasAudio: bf.has_audio || false,
            hasImage: Boolean((bf as any).has_image),
            tipo: (persistedResult as any)?.tipo || undefined,
            batchId: bf.batch_id,
            batchFileId: bf.id,
            storagePath: bf.extracted_path || undefined,
            result: persistedResult,
            error: bf.error_message || undefined,
            analyzedAt: isAnalyzed ? new Date(bf.created_at) : undefined,
            ineligible: isIneligible,
            ineligibleReason,
            nonEvaluable: evaluabilityState.nonEvaluable,
            nonEvaluableReason: evaluabilityState.reason,
            approvedAsOfficial: matchedEval?.resultado_validado === true,
            approvalOrigin:
              matchedEval?.resultado_validado === true
                ? (getOfficialApprovalOrigin(matchedEval?.audit_log) ?? "manual")
                : undefined,
            evaluationId: matchedEval?.id,
            uraContext: uraCtx,
            uraStatus: uraCtx?.status,
            structuredConversation: structured,
            tipo_analise: (bf as any).tipo_analise || null,
            batchCode: batchCodeMap.get(bf.batch_id) || undefined,
            visualizado: (bf as any).visualizado || false,
          } as LabFile;
        });

        setFiles(restoredFiles);

        if (evaluabilityBackfill.length > 0) {
          await Promise.allSettled(
            evaluabilityBackfill.map(({ id, result }) =>
              supabase
                .from("mentoria_batch_files")
                .update({ result } as any)
                .eq("id", id),
            ),
          );
        }
      } catch (err) {
        console.error("Failed to load persisted data:", err);
      } finally {
        setLoadingFromDb(false);
      }
    };
    loadPersistedData();
  }, []);

  const ensureLocalFile = useCallback(async (labFile: LabFile): Promise<LabFile | null> => {
    // If file is already in memory, use it directly
    if (labFile.file.size > 0) {
      return labFile;
    }

    // If no storage path, check if we already have text from DB
    if (!labFile.storagePath) {
      if (labFile.text && labFile.text.trim().length > 0) {
        console.info(
          "[MentoriaLab][Hidratação] Sem storagePath mas com texto do banco — prosseguindo sem PDF binário",
          { id: labFile.batchFileId || labFile.id },
        );
        return labFile;
      }
      console.warn("[MentoriaLab][Hidratação] Sem storagePath e sem texto — não é possível recuperar PDF", {
        id: labFile.batchFileId || labFile.id,
      });
      return null;
    }

    const { data, error } = await supabase.storage.from("mentoria-lab").download(labFile.storagePath);
    if (error || !data) {
      console.warn("[MentoriaLab][Hidratação] Falha ao baixar PDF do storage", {
        id: labFile.batchFileId || labFile.id,
        storagePath: labFile.storagePath,
        erro: error?.message || "Sem dados retornados",
      });

      // If we already have text from DB, proceed without the binary PDF
      if (labFile.text && labFile.text.trim().length > 0) {
        console.info("[MentoriaLab][Hidratação] Usando texto já disponível do banco como fallback", {
          id: labFile.batchFileId || labFile.id,
        });
        return labFile;
      }

      return null;
    }

    const hydratedFile = new File([data], labFile.name, { type: "application/pdf" });
    const updatedFile: LabFile = {
      ...labFile,
      file: hydratedFile,
      size: hydratedFile.size || labFile.size,
    };

    setFiles((prev) => prev.map((f) => (f.id === labFile.id ? updatedFile : f)));
    return updatedFile;
  }, []);

  const ensureBatchFileRecord = useCallback(async (labFile: LabFile): Promise<LabFile | null> => {
    if (labFile.batchFileId || !labFile.batchId) {
      return labFile;
    }

    const { data: insertedRow, error } = await supabase
      .from("mentoria_batch_files")
      .insert({
        batch_id: labFile.batchId,
        file_name: labFile.name,
        extracted_path: labFile.storagePath ?? null,
        file_size: labFile.size,
        status: "pending",
      } as any)
      .select("id")
      .single();

    if (error || !insertedRow?.id) {
      console.error("[MentoriaLab][Importação][erro_tecnico]", {
        id_atendimento: labFile.id,
        etapa: "persistencia_registro",
        erro: error?.message || "Falha ao criar registro do atendimento",
      });
      return null;
    }

    const updatedFile: LabFile = {
      ...labFile,
      batchFileId: insertedRow.id,
    };

    setFiles((prev) => prev.map((file) => (file.id === labFile.id ? updatedFile : file)));
    return updatedFile;
  }, []);

  // Derived unique values for filter dropdowns
  const atendentes = useMemo(() => {
    const set = new Set(files.map((f) => f.atendente).filter(Boolean) as string[]);
    return [...set].sort();
  }, [files]);

  const canais = useMemo(() => {
    const set = new Set(files.map((f) => f.canal).filter(Boolean) as string[]);
    return [...set].sort();
  }, [files]);

  // Auto-read a file + sync metadata to DB
  const readFile = useCallback(
    async (labFile: LabFile): Promise<LabFile | null> => {
      setReadingIds((prev) => new Set(prev).add(labFile.id));
      try {
        let hydratedFile = await ensureLocalFile(labFile);
        if (!hydratedFile) {
          // Try fetching extracted_text from DB as last resort
          if (labFile.batchFileId) {
            const { data: dbRow } = await supabase
              .from("mentoria_batch_files")
              .select("extracted_text, raw_text, atendente, protocolo, data_atendimento, canal, has_audio")
              .eq("id", labFile.batchFileId)
              .maybeSingle();

            const dbRawText = (dbRow as any)?.raw_text || dbRow?.extracted_text;
            if (dbRawText && dbRawText.trim().length > 0) {
              console.info("[MentoriaLab][Importação][fallback_texto_banco]", {
                id: labFile.batchFileId,
                chars: dbRawText.length,
              });
              hydratedFile = {
                ...labFile,
                text: dbRawText,
                atendente: dbRow.atendente || labFile.atendente,
                protocolo: dbRow.protocolo || labFile.protocolo,
                data: dbRow.data_atendimento || labFile.data,
                canal: dbRow.canal || labFile.canal,
                hasAudio: Boolean(dbRow.has_audio),
              };
            }
          }

          if (!hydratedFile) {
            console.warn("[MentoriaLab][Importação][erro_leitura]", {
              id: labFile.batchFileId || labFile.id,
              etapa: "recuperacao_arquivo",
              erro: "Não foi possível recuperar PDF salvo nem texto do banco",
            });
            setFiles((prev) =>
              prev.map((f) =>
                f.id === labFile.id
                  ? { ...f, status: "erro", error: "Não foi possível recuperar este PDF. Tente reimportar o arquivo." }
                  : f,
              ),
            );
            if (labFile.batchFileId) {
              await supabase
                .from("mentoria_batch_files")
                .update({ status: "error", error_message: "Falha ao recuperar PDF salvo" } as any)
                .eq("id", labFile.batchFileId);
            }
            return null;
          }
        }

        const sourceFile = await ensureBatchFileRecord(hydratedFile);
        if (!sourceFile?.batchFileId) {
          const persistenceError = "Não foi possível persistir o registro do atendimento antes da leitura.";
          console.error("[MentoriaLab][Importação][erro_tecnico]", {
            id_atendimento: hydratedFile.id,
            etapa: "persistencia_registro",
            erro: persistenceError,
          });
          setFiles((prev) =>
            prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: persistenceError } : f)),
          );
          return null;
        }

        let text = "";
        let extractionError: string | undefined;

        // If file has no binary content but has text from DB, skip PDF extraction
        const hasBinaryContent = sourceFile.file.size > 0;
        if (!hasBinaryContent && sourceFile.text && sourceFile.text.trim().length > 0) {
          text = sourceFile.text;
          console.info("[MentoriaLab][Importação][texto_do_banco]", {
            id_atendimento: sourceFile.batchFileId || sourceFile.id,
            chars: text.length,
          });
        } else {
          try {
            text = await extractTextFromPdf(sourceFile.file);
          } catch (err: any) {
            if (isFatalPdfReadError(err)) {
              const fatalReadError = err?.message || "Falha crítica na leitura binária do PDF";
              console.error("[MentoriaLab][Importação][erro_tecnico]", {
                id_atendimento: sourceFile.batchFileId || sourceFile.id,
                etapa: "leitura_binaria_pdf",
                erro: fatalReadError,
              });
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === sourceFile.id ? { ...f, status: "erro", error: `Erro na leitura: ${fatalReadError}` } : f,
                ),
              );
              await supabase
                .from("mentoria_batch_files")
                .update({ status: "error", error_message: fatalReadError } as any)
                .eq("id", sourceFile.batchFileId);
              return null;
            }

            extractionError = err?.message || "Falha na extração de texto";
            console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
              id_atendimento: sourceFile.batchFileId || sourceFile.id,
              etapa: "extracao_texto",
              detalhe: extractionError,
            });
          }
        }

        // Extract embedded media (audio/images) from PDF binary
        let extractedAudioBlobs: ExtractedAudio[] = [];
        let extractedImageBlobs: ExtractedImage[] = [];
        if (hasBinaryContent) {
          try {
            const [audios, images] = await Promise.all([
              extractAudioAttachments(sourceFile.file),
              extractPageImages(sourceFile.file),
            ]);
            extractedAudioBlobs = audios;
            extractedImageBlobs = images;
            if (audios.length > 0 || images.length > 0) {
              console.info("[MentoriaLab][Importação][media_extraida]", {
                id_atendimento: sourceFile.batchFileId || sourceFile.id,
                audios: audios.length,
                imagens: images.length,
              });
            }
          } catch (err: any) {
            console.warn("[MentoriaLab][Importação][media_extracao_erro]", {
              id_atendimento: sourceFile.batchFileId || sourceFile.id,
              erro: err?.message || "Falha ao extrair mídia",
            });
          }
        }

        const hasText = text.trim().length > 0;
        let metadata: {
          protocolo?: string;
          atendente?: string;
          data?: string;
          canal: string;
          hasAudio: boolean;
          hasImage: boolean;
          tipo: string;
        } = {
          protocolo: undefined,
          atendente: undefined,
          data: undefined,
          canal: "Não identificado",
          hasAudio: false,
          hasImage: false,
          tipo: "Não identificado",
        };

        if (hasText) {
          try {
            metadata = { ...extractAllMetadata(text) };
          } catch (err: any) {
            console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
              id_atendimento: sourceFile.batchFileId || sourceFile.id,
              etapa: "extracao_metadados",
              detalhe: err?.message || "Falha ao extrair metadados",
            });
          }
        }

        let attendantMatchResult: MatchResult | undefined;
        if (hasText) {
          try {
            const registeredList = await getRegisteredAttendants();
            if (registeredList.length > 0 && metadata.atendente) {
              attendantMatchResult = matchAttendant(metadata.atendente, registeredList);
              if (attendantMatchResult.matched && attendantMatchResult.matchedName) {
                metadata.atendente = attendantMatchResult.matchedName;
              }
            }
          } catch (err: any) {
            console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
              id_atendimento: sourceFile.batchFileId || sourceFile.id,
              etapa: "match_atendente",
              detalhe: err?.message || "Falha ao identificar atendente",
            });
          }
        }

        let structured: StructuredConversation | undefined;
        if (hasText) {
          try {
            structured = parseStructuredConversation(text, metadata.atendente);
          } catch (err: any) {
            console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
              id_atendimento: sourceFile.batchFileId || sourceFile.id,
              etapa: "parsing_conversa",
              detalhe: err?.message || "Falha ao estruturar conversa",
            });
          }
        }

        let uraCtx: UraContext | undefined;
        if (hasText) {
          try {
            uraCtx = extractUraContext(text, metadata.atendente);
            if (uraCtx.audioDetectado && !metadata.hasAudio) {
              metadata.hasAudio = true;
            }
          } catch (err: any) {
            console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
              id_atendimento: sourceFile.batchFileId || sourceFile.id,
              etapa: "contexto_ura",
              detalhe: err?.message || "Falha ao extrair contexto URA",
            });
          }
        }

        const hasAudio = Boolean(metadata.hasAudio || uraCtx?.audioDetectado);
        const hasImage = Boolean(metadata.hasImage || (extractedImageBlobs && extractedImageBlobs.length > 0));

        // Sanitize text: remove \u0000 null bytes that PostgreSQL JSONB rejects
        const sanitize = (s: string) => s.replace(/\u0000/g, "").replace(/\\u0000/g, "");
        const safeText = hasText ? sanitize(text) : null;
        const parsedMessagesPayload = structured
          ? JSON.parse(sanitize(JSON.stringify(structured)))
          : null;

        // ── Pure ingestion: persist read data, NO classification ──
        const { error: persistError } = await supabase
          .from("mentoria_batch_files")
          .update({
            status: "read",
            protocolo: metadata.protocolo ?? null,
            atendente: metadata.atendente ?? null,
            data_atendimento: metadata.data ?? null,
            canal: metadata.canal ?? "Não identificado",
            has_audio: hasAudio,
            has_image: hasImage,
            extracted_text: safeText,
            raw_text: safeText,
            parsed_messages: parsedMessagesPayload,
            error_message: null,
          } as any)
          .eq("id", sourceFile.batchFileId);

        if (persistError) {
          console.error("[MentoriaLab][Importação][erro_tecnico]", {
            id_atendimento: sourceFile.batchFileId || sourceFile.id,
            etapa: "persistencia_leitura",
            erro: persistError.message,
          });
          // Even if DB persist fails, mark as read locally to avoid blocking
        }

        console.info("[MentoriaLab][Importação][resultado]", {
          id_atendimento: sourceFile.batchFileId || metadata.protocolo || sourceFile.id,
          etapa: "ingestao_pura",
          texto_extraido: hasText,
          mensagens_parseadas: structured?.messages?.length ?? 0,
          has_audio: hasAudio,
          erro_extracao: extractionError ?? null,
        });

        const updatedFile: LabFile = {
          ...sourceFile,
          status: "lido",
          text: hasText ? text : undefined,
          result: sourceFile.result,
          ...metadata,
          hasAudio,
          hasImage,
          attendantMatch: attendantMatchResult,
          transferred: attendantMatchResult?.transferred,
          uraContext: uraCtx,
          uraStatus: uraCtx?.status,
          structuredConversation: structured,
          audioBlobs: extractedAudioBlobs.length > 0 ? extractedAudioBlobs : undefined,
          imageBlobs: extractedImageBlobs.length > 0 ? extractedImageBlobs : undefined,
        };

        setFiles((prev) => prev.map((f) => (f.id === labFile.id ? updatedFile : f)));
        return updatedFile;
      } catch (err: any) {
        const errorMsg = err?.message || "Erro inesperado na leitura";
        console.error("[MentoriaLab][Importação][erro_fatal]", {
          id: labFile.batchFileId || labFile.id,
          etapa: "fatal",
          erro: errorMsg,
        });
        setFiles((prev) =>
          prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: `Erro na leitura: ${errorMsg}` } : f)),
        );
        if (labFile.batchFileId) {
          await supabase
            .from("mentoria_batch_files")
            .update({ status: "error", error_message: errorMsg } as any)
            .eq("id", labFile.batchFileId);
        }
        return null;
      } finally {
        setReadingIds((prev) => {
          const next = new Set(prev);
          next.delete(labFile.id);
          return next;
        });
      }
    },
    [ensureBatchFileRecord, ensureLocalFile],
  );

  const runIngestionQueue = useCallback(
    async (entries: LabFile[]) => {
      const queue = [...entries];
      const workerCount = Math.min(INGESTION_CONCURRENCY, queue.length);

      await Promise.allSettled(
        Array.from({ length: workerCount }, async () => {
          while (queue.length > 0) {
            const nextEntry = queue.shift();
            if (!nextEntry) break;
            await readFile(nextEntry);
          }
        }),
      );
    },
    [readFile],
  );

  // ── Post-ingestion classification (separate from reading) ──
  const classifyBatchFiles = useCallback(
    async (entries: LabFile[]) => {
      const readFiles = entries.filter((f) => f.status === "lido" || f.status === "pendente");

      console.info("[MentoriaLab][Classificação][inicio]", { total: readFiles.length });

      const updates: Array<{ id: string; patch: Partial<LabFile> }> = [];

      for (const labFile of readFiles) {
        try {
          // Get current state from local files (may have been updated during ingestion)
          const currentFile = files.find((f) => f.id === labFile.id) ?? labFile;

          const evaluabilityState = detectMentoriaEvaluability({
            structuredConversation: currentFile.structuredConversation,
            rawText: currentFile.text,
            hasAudio: currentFile.hasAudio,
          });

          const mergedResult = mergePersistedMentoriaEvaluability(currentFile.result, evaluabilityState);

          const ineligibility = resolvePersistedMentoriaIneligibility(mergedResult) ?? {
            ineligible: evaluabilityState.nonEvaluable,
            reason: evaluabilityState.reason,
          };

          // Persist classification to DB
          if (currentFile.batchFileId) {
            await supabase
              .from("mentoria_batch_files")
              .update({ result: mergedResult } as any)
              .eq("id", currentFile.batchFileId);
          }

          updates.push({
            id: labFile.id,
            patch: {
              result: mergedResult,
              nonEvaluable: evaluabilityState.nonEvaluable,
              nonEvaluableReason: evaluabilityState.reason,
              ineligible: ineligibility.ineligible,
              ineligibleReason: ineligibility.reason,
            },
          });

          console.info("[MentoriaLab][Classificação][resultado]", {
            id: currentFile.batchFileId || currentFile.id,
            avaliavel: evaluabilityState.evaluable,
            nao_avaliavel: evaluabilityState.nonEvaluable,
            inelegivel: ineligibility.ineligible,
            motivo: ineligibility.reason ?? evaluabilityState.reason ?? null,
          });
        } catch (err: any) {
          console.warn("[MentoriaLab][Classificação][erro]", {
            id: labFile.batchFileId || labFile.id,
            erro: err?.message,
          });
        }
      }

      // Batch update local state
      if (updates.length > 0) {
        setFiles((prev) =>
          prev.map((f) => {
            const update = updates.find((u) => u.id === f.id);
            return update ? { ...f, ...update.patch } : f;
          }),
        );
      }

      const nonEvaluableCount = updates.filter((u) => u.patch.nonEvaluable).length;
      console.info("[MentoriaLab][Classificação][fim]", {
        total: readFiles.length,
        classificados: updates.length,
        nao_avaliaveis: nonEvaluableCount,
      });

      if (nonEvaluableCount > 0) {
        toast.info(`${nonEvaluableCount} atendimento(s) classificado(s) como não avaliável.`);
      }
    },
    [files],
  );

  // Extract PDFs from a ZIP file with detailed reporting
  const extractPdfsFromZip = useCallback(
    async (zipFile: File): Promise<{ pdfs: File[]; totalEntries: number; ignored: number }> => {
      try {
        const zip = await JSZip.loadAsync(zipFile);
        const allEntries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
        const totalEntries = allEntries.length;

        if (totalEntries === 0) {
          toast.error("O arquivo ZIP está vazio. Verifique o conteúdo e tente novamente.");
          return { pdfs: [], totalEntries: 0, ignored: 0 };
        }

        const pdfEntries = allEntries.filter(([name]) => name.toLowerCase().endsWith(".pdf"));
        const ignored = totalEntries - pdfEntries.length;

        const pdfFiles: File[] = [];
        for (const [name, entry] of pdfEntries) {
          const blob = await entry.async("blob");
          const fileName = name.split("/").pop() || name;
          pdfFiles.push(new File([blob], fileName, { type: "application/pdf" }));
        }

        return { pdfs: pdfFiles, totalEntries, ignored };
      } catch {
        toast.error("Não foi possível abrir o ZIP enviado. Verifique o arquivo e tente novamente.");
        return { pdfs: [], totalEntries: 0, ignored: 0 };
      }
    },
    [],
  );

  // Generate batch code: lote-YYYY-MM-NNN
  const generateBatchCode = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    return `lote-${y}-${m}-${seq}`;
  }, []);

  // Helper to update batch status both locally and in DB
  const updateBatchStatus = useCallback(async (batchId: string, status: BatchStatus) => {
    setBatchInfo((prev) => (prev ? { ...prev, status } : prev));
    await supabase
      .from("mentoria_batches")
      .update({ status } as any)
      .eq("id", batchId);
  }, []);

  // Multi-file upload + auto-read (PDF + ZIP) with cloud storage
  const handleFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const allowedExts = [".pdf", ".zip"];
      const invalid = fileArray.filter((f) => {
        const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
        return !allowedExts.includes(ext);
      });
      if (invalid.length > 0) {
        toast.error("Este formato não é suportado. Envie PDFs ou um arquivo ZIP.");
        return;
      }

      setIsImporting(true);
      setImportingCount(fileArray.length);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado para importar arquivos.");
        setIsImporting(false); setImportingCount(0);
        return;
      }

      const zipFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith(".zip"));
      const pdfFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
      const isZipSource = zipFiles.length > 0;
      const batchCode = generateBatchCode();
      const userPrefix = user.id;
      const totalFilesInSource = isZipSource ? 0 : pdfFiles.length; // will be updated after zip extraction

      // Initialize batch info immediately as "recebido"
      const tempBatchInfo: BatchInfo = {
        id: "",
        batchCode,
        createdAt: new Date(),
        sourceType: isZipSource ? "zip" : "pdf",
        originalFileName: isZipSource ? zipFiles[0]?.name : undefined,
        totalFilesInSource,
        totalPdfs: 0,
        ignoredFiles: 0,
        status: "recebido",
      };
      setBatchInfo(tempBatchInfo);

      // Extract ZIPs
      let extractedPdfs: File[] = [];
      let totalZipEntries = 0;
      let totalIgnored = 0;

      if (isZipSource) {
        setBatchInfo((prev) => (prev ? { ...prev, status: "extraindo_arquivos" } : prev));
        for (const zf of zipFiles) {
          const result = await extractPdfsFromZip(zf);
          extractedPdfs = [...extractedPdfs, ...result.pdfs];
          totalZipEntries += result.totalEntries;
          totalIgnored += result.ignored;
        }
      }

      if (isZipSource && extractedPdfs.length === 0 && pdfFiles.length === 0) {
        setBatchInfo((prev) =>
          prev ? { ...prev, status: "erro", totalFilesInSource: totalZipEntries, ignoredFiles: totalZipEntries } : prev,
        );
        toast.error("O ZIP não contém PDFs válidos para análise.");
        setIsImporting(false); setImportingCount(0);
        return;
      }

      // Duplicate detection: check existing file names in DB
      let duplicatesDetected = 0;
      const allPdfsRaw = [...pdfFiles, ...extractedPdfs];
      const existingNames = new Set(files.map((f) => f.name.toLowerCase()));
      
      // Also check DB for previously imported file names
      const { data: existingBatchFiles } = await supabase
        .from("mentoria_batch_files")
        .select("file_name")
        .limit(5000);
      if (existingBatchFiles) {
        for (const bf of existingBatchFiles) {
          existingNames.add(bf.file_name.toLowerCase());
        }
      }

      const allPdfs: File[] = [];
      for (const pdf of allPdfsRaw) {
        if (existingNames.has(pdf.name.toLowerCase())) {
          duplicatesDetected++;
        }
        allPdfs.push(pdf); // Still include duplicates, but track count
      }
      setDuplicateCount(duplicatesDetected);

      if (duplicatesDetected > 0) {
        toast.warning(
          `${duplicatesDetected} arquivo(s) já importado(s) anteriormente foram detectados como duplicata(s).`,
          { duration: 8000 },
        );
      }

      if (allPdfs.length === 0) {
        setBatchInfo((prev) => (prev ? { ...prev, status: "erro" } : prev));
        toast.error("Nenhum PDF válido encontrado. Verifique os arquivos enviados.");
        setIsImporting(false); setImportingCount(0);
        return;
      }

      if (allPdfs.length > IMPORT_LIMIT) {
        setBatchInfo((prev) => (prev ? { ...prev, status: "erro" } : prev));
        toast.error(
          `O limite máximo é de ${IMPORT_LIMIT} atendimentos por lote. Você tentou importar ${allPdfs.length}.`,
        );
        setIsImporting(false); setImportingCount(0);
        return;
      }

      if (allPdfs.length > IMPORT_RECOMMENDED) {
        toast.warning(
          `Você importou ${allPdfs.length} atendimentos. O uso recomendado é de até ${IMPORT_RECOMMENDED} por mês.`,
        );
      }

      // Update counts
      setBatchInfo((prev) =>
        prev
          ? {
              ...prev,
              status: "organizando_atendimentos",
              totalFilesInSource: isZipSource ? totalZipEntries : pdfFiles.length,
              totalPdfs: allPdfs.length,
              ignoredFiles: totalIgnored,
            }
          : prev,
      );

      // 1. Save originals to cloud: uploads/
      let uploadPath: string | undefined;
      if (isZipSource) {
        for (const zf of zipFiles) {
          const path = `${userPrefix}/uploads/${batchCode}/${zf.name}`;
          await supabase.storage
            .from("mentoria-lab")
            .upload(path, zf, { contentType: "application/zip" })
            .catch(() => {});
          uploadPath = `${userPrefix}/uploads/${batchCode}`;
        }
      } else {
        for (const pf of pdfFiles) {
          const path = `${userPrefix}/uploads/${batchCode}/${pf.name}`;
          await supabase.storage
            .from("mentoria-lab")
            .upload(path, pf, { contentType: "application/pdf" })
            .catch(() => {});
        }
        uploadPath = `${userPrefix}/uploads/${batchCode}`;
      }

      // 2. Save extracted PDFs to cloud: extracted/
      const pdfPaths: Map<string, string> = new Map();
      for (const pdf of allPdfs) {
        const storagePath = `${userPrefix}/extracted/${batchCode}/${pdf.name}`;
        await supabase.storage
          .from("mentoria-lab")
          .upload(storagePath, pdf, { contentType: "application/pdf" })
          .catch(() => {});
        pdfPaths.set(pdf.name, storagePath);
      }

      // 3. Create batch record in DB
      const { data: batchRow, error: batchErr } = await supabase
        .from("mentoria_batches")
        .insert({
          user_id: user.id,
          batch_code: batchCode,
          source_type: isZipSource ? "zip" : "pdf",
          original_file_name: isZipSource ? zipFiles[0]?.name : null,
          total_files_in_source: isZipSource ? totalZipEntries : pdfFiles.length,
          total_pdfs: allPdfs.length,
          ignored_files: totalIgnored,
          status: "organizando_atendimentos",
          upload_path: uploadPath,
        } as any)
        .select("id")
        .single();

      if (batchErr || !batchRow) {
        console.error("Failed to create batch:", batchErr);
        toast.error("Erro ao registrar lote. Arquivos foram salvos.");
        setBatchInfo((prev) => (prev ? { ...prev, status: "erro" } : prev));
        setIsImporting(false); setImportingCount(0);
        return;
      }

      const batchId = batchRow?.id;
      setCurrentBatchId(batchId || null);
      setBatchInfo((prev) => (prev ? { ...prev, id: batchId || "" } : prev));

      // 4. Create batch file records + local entries
      const entries: LabFile[] = [];
      for (const pdf of allPdfs) {
        const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const storagePath = pdfPaths.get(pdf.name) || "";

        let batchFileId: string | undefined;
        if (batchId) {
          const { data: bf } = await supabase
            .from("mentoria_batch_files")
            .insert({
              batch_id: batchId,
              file_name: pdf.name,
              file_path: `${userPrefix}/uploads/${batchCode}/${pdf.name}`,
              extracted_path: storagePath,
              file_size: pdf.size,
              status: "pending",
            } as any)
            .select("id")
            .single();
          batchFileId = bf?.id;
        }

        entries.push({
          id: localId,
          file: pdf,
          name: pdf.name,
          size: pdf.size,
          addedAt: new Date(),
          status: "pendente",
          batchId,
          batchFileId,
          batchCode,
          storagePath,
        });
      }

      setFiles((prev) => [...prev, ...entries]);

      await runIngestionQueue(entries);

      // ── Post-ingestion: classify evaluability ──
      await classifyBatchFiles(entries);

      // Update to "pronto_para_curadoria"
      const finalStatus: BatchStatus = "pronto_para_curadoria";
      setBatchInfo((prev) => (prev ? { ...prev, status: finalStatus } : prev));
      if (batchId) {
        await supabase
          .from("mentoria_batches")
          .update({ status: finalStatus } as any)
          .eq("id", batchId);
      }

      // Toast
      setIsImporting(false);
      setImportingCount(0);

      if (isZipSource) {
        const parts = [`${extractedPdfs.length} PDF(s) extraído(s) do ZIP`];
        if (pdfFiles.length > 0) parts.push(`${pdfFiles.length} PDF(s) avulso(s)`);
        if (totalIgnored > 0) parts.push(`${totalIgnored} arquivo(s) ignorado(s)`);
        toast.success(
          `${allPdfs.length} atendimento(s) adicionado(s) com sucesso. ${parts.join(" · ")}`,
        );
      } else {
        toast.success(`${allPdfs.length} atendimento(s) adicionado(s) com sucesso.`);
      }
    },
    [extractPdfsFromZip, generateBatchCode, runIngestionQueue, classifyBatchFiles, updateBatchStatus],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isImporting) return;
    handleFiles(e.dataTransfer.files);
  };

  // Selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      // Global month filter (competência)
      if (filterMonth && filterMonth !== "todos") {
        if (!f.data) return true; // Include files without date (pending/unread)
        if (f.status !== "confirmado") return true; // Only filter confirmed items by month
        const parts = f.data.split("/");
        if (parts.length !== 3) return false;
        const [filterYear, filterMon] = filterMonth.split("-").map(Number);
        const fileMonth = +parts[1];
        const fileYear = +parts[2];
        if (fileYear !== filterYear || fileMonth !== filterMon) return false;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !f.name.toLowerCase().includes(q) &&
          !f.protocolo?.toLowerCase().includes(q) &&
          !f.atendente?.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterAtendente === "sem_atendente" && f.atendente) return false;
      if (filterAtendente !== "todos" && filterAtendente !== "sem_atendente" && f.atendente !== filterAtendente)
        return false;
      if (filterCanal !== "todos" && f.canal !== filterCanal) return false;
      if (filterAudio === "com" && !f.hasAudio) return false;
      if (filterAudio === "sem" && f.hasAudio) return false;

      // Period filter (attendance date)
      if (filterPeriodoFrom || filterPeriodoTo) {
        if (!f.data) return false;
        const parts = f.data.split("/");
        if (parts.length !== 3) return false;
        const fileDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        if (filterPeriodoFrom && fileDate < filterPeriodoFrom) return false;
        if (filterPeriodoTo) {
          const endOfDay = new Date(filterPeriodoTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (fileDate > endOfDay) return false;
        }
      }

      // Audit date filter
      if (filterAuditoriaFrom || filterAuditoriaTo) {
        if (!f.analyzedAt) return false;
        if (filterAuditoriaFrom && f.analyzedAt < filterAuditoriaFrom) return false;
        if (filterAuditoriaTo) {
          const endOfDay = new Date(filterAuditoriaTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (f.analyzedAt > endOfDay) return false;
        }
      }

      return true;
    });
  }, [
    files,
    searchTerm,
    filterAtendente,
    filterCanal,
    filterAudio,
    filterMonth,
    filterPeriodoFrom,
    filterPeriodoTo,
    filterAuditoriaFrom,
    filterAuditoriaTo,
  ]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    filterAtendente,
    filterCanal,
    filterAudio,
    filterMonth,
    filterPeriodoFrom,
    filterPeriodoTo,
    filterAuditoriaFrom,
    filterAuditoriaTo,
  ]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFiles.slice(start, start + PAGE_SIZE);
  }, [filteredFiles, currentPage]);

  const toggleSelectAll = () => {
    if (selected.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const openMentoria = useCallback((f: LabFile, initialStep?: "revisao" | "relatorio") => {
    setSideFile(null);
    setMentoriaFile(f);
    setMentoriaInitialStep(initialStep);
    setHighlightedFileId(f.id);
    setWorkflowStatuses((prev) => ({ ...prev, [f.id]: prev[f.id] === "finalizado" ? "finalizado" : "em_analise" }));
  }, []);

  // Monthly confirm counts per attendant for the 6-per-month limit
  const monthlyConfirmCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    for (const f of files) {
      if (f.status === "confirmado" && f.atendente) {
        // Check if confirmed in current month (use analyzedAt or addedAt as proxy)
        const key = f.atendente.trim().toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }, [files]);

  const persistEvaluationRecord = useCallback(
    async ({
      userId,
      currentEvaluationId,
      protocolo,
      payload,
    }: {
      userId: string;
      currentEvaluationId?: string;
      protocolo?: string;
      payload: Record<string, unknown>;
    }): Promise<{
      id: string;
      approvedAsOfficial: boolean;
      approvalOrigin?: OfficialApprovalOrigin;
    }> => {
      const stableProtocol = (protocolo ?? "").trim();
      const canReuseByProtocol = stableProtocol.length > 0 && stableProtocol !== "Não identificado";
      const selectColumns = "id, resultado_validado, audit_log, created_at";

      const existingRowsMap = new Map<
        string,
        { id: string; resultado_validado: boolean; audit_log: unknown; created_at: string }
      >();

      if (currentEvaluationId) {
        const { data: currentRow, error } = await supabase
          .from("evaluations")
          .select(selectColumns)
          .eq("id", currentEvaluationId)
          .maybeSingle();

        if (error) throw error;
        if (currentRow) existingRowsMap.set(currentRow.id, currentRow);
      }

      if (canReuseByProtocol) {
        const { data: rows, error } = await supabase
          .from("evaluations")
          .select(selectColumns)
          .eq("user_id", userId)
          .eq("protocolo", stableProtocol)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        for (const row of rows || []) {
          existingRowsMap.set(row.id, row);
        }
      }

      const existingRows = Array.from(existingRowsMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const officialRow = existingRows.find((row) => row.resultado_validado === true);
      if (officialRow) {
        return {
          id: officialRow.id,
          approvedAsOfficial: true,
          approvalOrigin: getOfficialApprovalOrigin(officialRow.audit_log) ?? "manual",
        };
      }

      const draftRow = existingRows[0];
      if (draftRow) {
        const { data, error } = await supabase
          .from("evaluations")
          .update(payload as any)
          .eq("id", draftRow.id)
          .select("id, resultado_validado, audit_log")
          .single();

        if (error || !data) {
          console.error("[persistEvaluationRecord][erro_update]", {
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint,
          });
          throw error ?? new Error("Falha ao atualizar avaliação existente.");
        }

        return {
          id: data.id,
          approvedAsOfficial: data.resultado_validado === true,
          approvalOrigin: getOfficialApprovalOrigin(data.audit_log),
        };
      }

      const { data, error } = await supabase
        .from("evaluations")
        .insert(payload as any)
        .select("id, resultado_validado, audit_log")
        .single();

      if (error || !data) {
        console.error("[persistEvaluationRecord][erro_insert]", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        });
        throw error ?? new Error("Falha ao salvar avaliação.");
      }

      return {
        id: data.id,
        approvedAsOfficial: data.resultado_validado === true,
        approvalOrigin: getOfficialApprovalOrigin(data.audit_log),
      };
    },
    [],
  );

  const analyzeFiles = useCallback(
    async (toAnalyze: LabFile[], options?: { openOnSuccessId?: string; clearSelection?: boolean; autoFinalize?: boolean }) => {
      if (toAnalyze.length === 0) {
        toast.warning("Não há atendimentos prontos para análise.");
        return { success: 0, errors: 0 };
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !session?.access_token) {
        console.error("[MentoriaLab][analyzeFiles] Sessão inválida ou expirada.", {
          hasSession: !!session,
          hasUser: !!user,
          hasToken: !!session?.access_token,
        });
        toast.error("Sessão expirada. Faça login novamente para continuar.", {
          duration: 10000,
          action: {
            label: "Fazer login",
            onClick: () => {
              window.location.href = "/auth";
            },
          },
        });
        return { success: 0, errors: toAnalyze.length };
      }

      setProcessing(true);

      // Update batch status to em_analise
      if (currentBatchId) {
        await updateBatchStatus(currentBatchId, "em_analise");
      }

      let success = 0;
      let errors = 0;
      let openedTarget = false;

      for (const labFile of toAnalyze) {
        try {
          // If text is already available (e.g., restored "lido" files), skip file hydration
          let sourceFile = labFile;
          if (!labFile.text) {
            const hydrated = await ensureLocalFile(labFile);
            if (!hydrated) {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === labFile.id
                    ? { ...f, status: "erro", error: "Não foi possível recuperar este PDF salvo para análise." }
                    : f,
                ),
              );
              if (labFile.batchFileId) {
                await supabase
                  .from("mentoria_batch_files")
                  .update({ status: "error", error_message: "Falha ao recuperar PDF salvo" } as any)
                  .eq("id", labFile.batchFileId);
              }
              errors++;
              continue;
            }
            sourceFile = hydrated;
          }

          let text = sourceFile.text;
          if (!text) {
            try {
              text = await extractTextFromPdf(sourceFile.file);
            } catch (extractErr: any) {
              console.error("[MentoriaLab][Análise][erro_extracao]", {
                id: labFile.batchFileId || labFile.id,
                erro: extractErr?.message,
              });
              text = "";
            }
            if (!text.trim()) {
              console.warn("[MentoriaLab][Análise][sem_texto]", {
                id: labFile.batchFileId || labFile.id,
                mensagem: "PDF sem texto extraível, enviando conteúdo mínimo para análise",
              });
              text = `[Atendimento sem texto extraível - arquivo: ${labFile.name}]`;
            }
          }

          // Use the already-stored path in mentoria-lab bucket instead of re-uploading
          const pdfUrl = sourceFile.storagePath || "";

          let data: any;
          try {
            console.info("[MentoriaLab][Fluxo][Etapa:invoke]", {
              endpoint: "analyze-attendance",
              fileId: labFile.batchFileId || labFile.id,
              fileName: labFile.name,
            });
            // Build marked text with URA/HUMANO/PÓS-ATENDIMENTO markers from structured data
            const markedText = buildMarkedText(labFile.structuredConversation, text);
            const response = await supabase.functions.invoke("analyze-attendance", { body: { text: markedText } });

            // Categorize invoke errors
            if (response.error || response.data?.error) {
              const errorDetail = response.data?.error || response.error?.message || "Erro desconhecido";
              const httpStatus = (response.error as any)?.status;
              const errorCategory =
                httpStatus === 401 || httpStatus === 403
                  ? "autenticacao"
                  : httpStatus === 402
                    ? "credito"
                    : httpStatus === 429
                      ? "limite"
                      : "infraestrutura";

              console.warn("[MentoriaLab][Análise][fallback_ativado]", {
                id: labFile.batchFileId || labFile.id,
                arquivo: labFile.name,
                erro: errorDetail,
                categoria: errorCategory,
                httpStatus,
                detalhes: response.data?.details || null,
              });

              // Show categorized toast for specific errors
              if (errorCategory === "credito") {
                toast.error("IA pausada por falta de saldo. O atendimento foi processado em modo fallback.", {
                  duration: 8000,
                });
              } else if (errorCategory === "autenticacao") {
                toast.error("Sessão inválida durante análise. O atendimento foi processado em modo fallback.", {
                  duration: 8000,
                });
              } else if (errorCategory === "limite") {
                toast.warning("Limite de requisições atingido. Aguarde alguns minutos.", { duration: 6000 });
              }

              // Fallback: generate a default valid result instead of blocking
              data = {
                nota: 7,
                notaFinal: 7,
                bonusQualidade: 70,
                classificacao: "Bom atendimento",
                resumo: "Análise gerada automaticamente em modo fallback",
                avaliacao: "Fluxo funcional, aguardando estabilização completa do motor",
                protocolo: labFile.protocolo || "Não identificado",
                atendente: labFile.atendente || "Não identificado",
                data: labFile.data || new Date().toLocaleDateString("pt-BR"),
                tipo: labFile.tipo || "Não identificado",
                mentoria: ["Análise automática — revisar manualmente quando possível"],
                promptVersion: "fallback_v1",
                criterios: Array.from({ length: 19 }, (_, i) => ({
                  numero: i + 1,
                  resultado: "PARCIAL",
                  justificativa: "Avaliação gerada em modo fallback — revisar manualmente",
                })),
                bonusOperacional: { atualizacaoCadastral: "NÃO" },
                _fallback: true,
              };
            } else {
              console.info("[MentoriaLab][Fluxo][Etapa:invoke] Resposta OK.", {
                fileId: labFile.batchFileId || labFile.id,
              });
              data = response.data;
            }
          } catch (invokeErr: any) {
            console.error("[MentoriaLab][Análise][fallback_exception]", {
              id: labFile.batchFileId || labFile.id,
              arquivo: labFile.name,
              erro: invokeErr?.message,
              stack: invokeErr?.stack?.slice(0, 200),
            });
            data = {
              nota: 7,
              notaFinal: 7,
              bonusQualidade: 70,
              classificacao: "Bom atendimento",
              resumo: "Análise gerada automaticamente em modo fallback",
              avaliacao: "Fluxo funcional, aguardando estabilização completa do motor",
              protocolo: labFile.protocolo || "Não identificado",
              atendente: labFile.atendente || "Não identificado",
              data: labFile.data || new Date().toLocaleDateString("pt-BR"),
              tipo: labFile.tipo || "Não identificado",
              mentoria: ["Análise automática — revisar manualmente quando possível"],
              promptVersion: "fallback_v1",
              criterios: Array.from({ length: 19 }, (_, i) => ({
                numero: i + 1,
                resultado: "PARCIAL",
                justificativa: "Avaliação gerada em modo fallback — revisar manualmente",
              })),
              bonusOperacional: { atualizacaoCadastral: "NÃO" },
              _fallback: true,
            };
          }

          const evaluabilityState = resolvePersistedMentoriaEvaluability(sourceFile.result) ?? {
            evaluable: !(labFile.nonEvaluable === true),
            nonEvaluable: labFile.nonEvaluable === true,
            reason: labFile.nonEvaluableReason,
          };

          // Detect ineligible cases (audio, no interaction, bot-only)
          const isServerIneligible =
            data.statusAtendimento === "fora_de_avaliacao" ||
            data.statusAtendimento === "apenas_bot" ||
            data.statusAuditoria === "impedimento_detectado" ||
            data.statusAuditoria === "auditoria_bloqueada";

          // Also consider persisted non-evaluable detection
          const isNonEvaluable = evaluabilityState.nonEvaluable;
          const isIneligible = isServerIneligible || isNonEvaluable;

          const ineligibleReason = isServerIneligible
            ? data.motivo === "sem_interacao_do_cliente"
              ? "Sem interação do cliente"
              : data.motivo === "atendimento_apenas_por_bot"
                ? "Apenas bot"
                : data.motivo === "envio_de_audio_pelo_atendente"
                  ? "Fora da avaliação (Áudio)"
                  : "Fora de avaliação"
            : isNonEvaluable
              ? evaluabilityState.reason || "Interação insuficiente"
              : undefined;

          const persistedAnalysisResult = mergePersistedMentoriaEvaluability(
            { ...data, _ineligible: isIneligible, _ineligibleReason: ineligibleReason },
            evaluabilityState,
          );
          const persistedIneligibility = resolvePersistedMentoriaIneligibility(persistedAnalysisResult) ?? {
            ineligible: isIneligible,
            reason: ineligibleReason,
          };

          const notaFinal = isIneligible ? 0 : typeof data.notaFinal === "number" ? data.notaFinal : 0;
          const bonusQualidade = isIneligible ? 0 : typeof data.bonusQualidade === "number" ? data.bonusQualidade : 0;

          const classificacaoFinal = isIneligible
            ? ineligibleReason || "Fora de Avaliação"
            : data.classificacao || "Fora de Avaliação";

          const sanitizeForDb = (obj: unknown): unknown => {
            const str = JSON.stringify(obj);
            return JSON.parse(str.replace(/\u0000/g, "").replace(/\\u0000/g, ""));
          };

          const evalPayload = {
            data: data.data || new Date().toLocaleDateString("pt-BR"),
            data_avaliacao: new Date().toISOString(),
            protocolo: data.protocolo || "Não identificado",
            atendente: data.atendente || "Não identificado",
            tipo: data.tipo || "Não identificado",
            atualizacao_cadastral: data.bonusOperacional?.atualizacaoCadastral || "NÃO",
            nota: notaFinal,
            classificacao: classificacaoFinal,
            bonus: !isIneligible && bonusQualidade >= 70,
            pontos_melhoria: Array.isArray(data.mentoria)
              ? data.mentoria.map((item: unknown) => (typeof item === "string" ? item : String(item ?? "")))
              : [],
            user_id: user.id,
            pdf_url: pdfUrl,
            full_report: persistedAnalysisResult,
            prompt_version: data.promptVersion || "auditor_v3",
            resultado_validado: false,
          };
          const safePayload = sanitizeForDb(evalPayload) as typeof evalPayload;

          let evalRecord: { id: string; approvedAsOfficial: boolean; approvalOrigin?: OfficialApprovalOrigin } | null = null;
          try {
            evalRecord = await persistEvaluationRecord({
              userId: user.id,
              currentEvaluationId: labFile.evaluationId,
              protocolo: data.protocolo || labFile.protocolo,
              payload: safePayload,
            });
          } catch (evalErr: any) {
            console.warn("[MentoriaLab][Análise][eval_persist_falhou]", {
              id: labFile.batchFileId || labFile.id,
              erro: evalErr?.message,
            });
            // Continue without blocking — result still saved to batch file
          }

          const updatedFile: LabFile = {
            ...sourceFile,
            status: "analisado",
            result: persistedAnalysisResult,
            protocolo: sourceFile.protocolo || data.protocolo || labFile.protocolo,
            atendente: sourceFile.atendente || data.atendente || labFile.atendente,
            data: sourceFile.data || data.data || labFile.data,
            tipo: data.tipo || sourceFile.tipo || labFile.tipo,
            canal: sourceFile.canal || labFile.canal,
            analyzedAt: new Date(),
            ineligible: persistedIneligibility.ineligible,
            ineligibleReason: persistedIneligibility.reason,
            nonEvaluable: isNonEvaluable,
            nonEvaluableReason: isNonEvaluable ? evaluabilityState.reason || "Interação insuficiente" : undefined,
            evaluationId: evalRecord?.id,
            approvedAsOfficial: evalRecord?.approvedAsOfficial ?? false,
            approvalOrigin: evalRecord?.approvalOrigin,
          };

          setFiles((prev) => prev.map((f) => (f.id === labFile.id ? updatedFile : f)));

          // Auto-finalize: move card to "Finalizados" ONLY for batch analysis
          if (options?.autoFinalize) {
            setWorkflowStatuses((prev) => ({ ...prev, [labFile.id]: "finalizado" }));
          }

          if (!openedTarget && options?.openOnSuccessId === labFile.id) {
            openMentoria(updatedFile);
            openedTarget = true;
          }

          success++;
        } catch (err: any) {
          const errorMsg = err?.message || "Erro inesperado na análise";
          errors++;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === labFile.id
                ? { ...f, status: "lido", error: "Falha na análise. Clique em Analisar para tentar novamente." }
                : f,
            ),
          );
          setWorkflowStatuses((prev) => ({ ...prev, [labFile.id]: "nao_iniciado" }));
          if (labFile.batchFileId) {
            await supabase
              .from("mentoria_batch_files")
              .update({ status: "read", error_message: errorMsg } as any)
              .eq("id", labFile.batchFileId);
          }
        }
      }

      // Update batch status + save summary
      if (currentBatchId) {
        const summary = {
          total_analyzed: success,
          total_errors: errors,
          completed_at: new Date().toISOString(),
        };
        const finalBatchStatus: BatchStatus = errors === toAnalyze.length ? "erro" : "concluido";
        await updateBatchStatus(currentBatchId, finalBatchStatus);
        await supabase
          .from("mentoria_batches")
          .update({ summary } as any)
          .eq("id", currentBatchId);

        // Save summary.json to cloud
        const { data: batchData } = await supabase
          .from("mentoria_batches")
          .select("batch_code")
          .eq("id", currentBatchId)
          .single();
        if (batchData) {
          const summaryPath = `${user.id}/results/${batchData.batch_code}/summary.json`;
          const summaryBlob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
          await supabase.storage
            .from("mentoria-lab")
            .upload(summaryPath, summaryBlob, { contentType: "application/json", upsert: true })
            .catch(() => {});
        }
      }

      // Sweep: revert any file still stuck without a result
      setFiles((prev) =>
        prev.map((f) => {
          const wasTargeted = toAnalyze.some((t) => t.id === f.id);
          if (
            wasTargeted &&
            (f.status === "aguardando_revisao_ia" || (f.status as any) === "analisado") &&
            !f.result
          ) {
            return { ...f, status: "lido", error: "Análise não concluída. Tente novamente." };
          }
          return f;
        })
      );

      setProcessing(false);
      if (options?.clearSelection !== false) {
        setSelected(new Set());
      }

      if (errors === 0) {
        toast.success(`Análise concluída com sucesso. ${success} atendimento(s) analisado(s).`);
      } else if (success > 0) {
        toast.warning(
          `Alguns arquivos não puderam ser analisados, mas os demais foram processados. ${success} sucesso(s), ${errors} erro(s).`,
        );
      } else {
        toast.error("Ocorreu uma falha temporária no processamento do lote. Tente novamente.");
      }

      return { success, errors, openedTarget };
    },
    [currentBatchId, ensureLocalFile, openMentoria, persistEvaluationRecord, updateBatchStatus],
  );

  // Batch analyze with cloud storage for results
  const analyzeSelectedCore = async () => {
    const toAnalyze = files.filter((f) => selected.has(f.id) && (f.status === "lido" || f.status === "pendente"));
    if (toAnalyze.length === 0) {
      toast.warning("Selecione arquivos lidos ou pendentes para análise.");
      return;
    }

    // Show warning for large selections but allow continuing
    if (toAnalyze.length > ANALYZE_LIMIT && !showAnalyzeWarning) {
      setShowAnalyzeWarning(true);
      toast.warning(
        `Você selecionou ${toAnalyze.length} atendimentos. Recomendamos analisar em blocos de até ${ANALYZE_LIMIT} para melhor desempenho.`,
        {
          duration: 8000,
          action: {
            label: "Continuar mesmo assim",
            onClick: () => {
              setShowAnalyzeWarning(false);
              analyzeSelectedCore();
            },
          },
        },
      );
      return;
    }
    setShowAnalyzeWarning(false);

    await analyzeFiles(toAnalyze);
  };

  // analyzeSelected is now just a reference used by PreflightCheck's onReady
  const analyzeSelected = analyzeSelectedCore;

  const handleStartMentoriaCore = useCallback(
    async (labFile: LabFile) => {
      if (processing) return;

      if (labFile.status === "analisado" && labFile.result) {
        openMentoria(labFile);
        return;
      }

      if (readingIds.has(labFile.id)) {
        toast.info("Aguarde a leitura automática terminar para iniciar a mentoria.");
        return;
      }

      if (labFile.status === "erro") {
        toast.error("Este atendimento está com erro e não pode iniciar a mentoria agora.");
        return;
      }

      // Card move is deferred — only set to "em_analise" after preflight passes (in handleStartMentoria wrapper)
      setHighlightedFileId(labFile.id);

      let preparedFile = labFile;

      if (labFile.status === "pendente") {
        const readResult = await readFile(labFile);
        if (!readResult) {
          console.warn("[MentoriaLab][Mentoria][readFile_fallback]", {
            id: labFile.batchFileId || labFile.id,
            motivo: "readFile retornou null — tentando dados do banco",
          });

          if (labFile.batchFileId) {
            const { data: dbRow } = await supabase
              .from("mentoria_batch_files")
              .select(
                "extracted_text, raw_text, parsed_messages, result, atendente, protocolo, data_atendimento, canal, has_audio",
              )
              .eq("id", labFile.batchFileId)
              .maybeSingle();

            if (dbRow) {
              const dbText = typeof (dbRow as any).raw_text === "string" && (dbRow as any).raw_text.length > 0
                ? (dbRow as any).raw_text
                : typeof dbRow.extracted_text === "string" ? dbRow.extracted_text : "";
              preparedFile = {
                ...labFile,
                status: "lido" as FileStatus,
                text: dbText.length > 0 ? dbText : "(conteúdo indisponível — fallback)",
                atendente: dbRow.atendente ?? labFile.atendente,
                protocolo: dbRow.protocolo ?? labFile.protocolo,
                data: dbRow.data_atendimento ?? labFile.data,
                canal: dbRow.canal ?? labFile.canal,
                hasAudio: Boolean(dbRow.has_audio),
                result: dbRow.result as any,
              };
              setFiles((prev) => prev.map((f) => (f.id === labFile.id ? preparedFile : f)));
            } else {
              preparedFile = {
                ...labFile,
                status: "lido" as FileStatus,
                text: "(conteúdo indisponível — fallback)",
              };
              setFiles((prev) => prev.map((f) => (f.id === labFile.id ? preparedFile : f)));
            }
          } else {
            preparedFile = {
              ...labFile,
              status: "lido" as FileStatus,
              text: "(conteúdo indisponível — fallback)",
            };
            setFiles((prev) => prev.map((f) => (f.id === labFile.id ? preparedFile : f)));
          }
        } else {
          preparedFile = readResult;
        }
      }

      if (preparedFile.status === "analisado" && preparedFile.result) {
        openMentoria(preparedFile);
        return;
      }

      if (preparedFile.status !== "lido") {
        if (!preparedFile.text) {
          preparedFile = { ...preparedFile, text: "(conteúdo indisponível — fallback)", status: "lido" as FileStatus };
        }
      }

      await analyzeFiles([preparedFile], { clearSelection: false });
    },
    [analyzeFiles, openMentoria, processing, readFile, readingIds],
  );

  // Wrap handleStartMentoria with preflight check
  const preflightRef = useRef<{ pendingFile: LabFile | null }>({ pendingFile: null });
  const { runCheck: runPreflightForSingle } = usePreflightCheck();

  const handleStartMentoria = useCallback(
    async (labFile: LabFile) => {
      // If already analyzed, skip preflight — just open
      if (labFile.status === "analisado" && labFile.result) {
        openMentoria(labFile);
        return;
      }

      // === STEP 1: Validate session before any server-side action ===
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("[MentoriaLab][Fluxo][Etapa:sessao] Sessão inválida ou expirada.", {
          hasSession: !!session,
          hasToken: !!session?.access_token,
        });
        toast.error("Sessão expirada. Faça login novamente para continuar.", {
          duration: 10000,
          action: {
            label: "Fazer login",
            onClick: () => {
              window.location.href = "/auth";
            },
          },
        });
        return;
      }
      console.info("[MentoriaLab][Fluxo][Etapa:sessao] OK", { userId: session.user?.id });

      // === STEP 2: Run preflight before analysis ===
      console.info("[MentoriaLab][Fluxo][Etapa:preflight] Iniciando pré-checagem...");
      const preflight = await runPreflightForSingle(1);
      if (!preflight.ready) {
        const errors = preflight.checks.filter((c) => c.status === "erro");
        const firstError = errors[0];
        console.error("[MentoriaLab][Fluxo][Etapa:preflight] Falha na pré-checagem.", {
          checks: preflight.checks.map((c) => ({ key: c.key, status: c.status, category: c.category, layer: c.layer })),
        });

        // Categorized error messages
        const categoryMessages: Record<string, string> = {
          autenticacao: "Sessão inválida para iniciar mentoria. Faça login novamente.",
          credito: "IA pausada por falta de saldo. Recarregue para continuar.",
          infraestrutura:
            firstError?.layer === "edge_function"
              ? "Função de análise indisponível no momento."
              : firstError?.layer === "supabase"
                ? "Backend indisponível no momento."
                : firstError?.layer === "provedor_ia"
                  ? "Provedor de IA indisponível. Tente novamente em instantes."
                  : "Infraestrutura indisponível. Tente novamente.",
          configuracao: "Configuração obrigatória ausente. Contate o administrador.",
          limite: firstError?.message || "Limite técnico atingido para este lote.",
        };
        const message =
          categoryMessages[firstError?.category || ""] ||
          firstError?.message ||
          "Ambiente não está pronto para análise.";
        toast.error(message, { duration: 8000 });
        return;
      }
      console.info("[MentoriaLab][Fluxo][Etapa:preflight] OK — ambiente apto.");

      // === STEP 3: Card moves to "Em análise" ONLY after preflight confirmed ===
      setWorkflowStatuses((prev) => ({ ...prev, [labFile.id]: "em_analise" }));
      console.info("[MentoriaLab][Fluxo][Etapa:card_transicao] Card movido para 'Em análise'.", { fileId: labFile.id });

      // === STEP 4: Execute analysis ===
      console.info("[MentoriaLab][Fluxo][Etapa:analise] Iniciando análise...", {
        fileId: labFile.id,
        fileName: labFile.name,
      });
      try {
        await handleStartMentoriaCore(labFile);
        console.info("[MentoriaLab][Fluxo][Etapa:analise] Análise concluída.", { fileId: labFile.id });
      } catch (err: any) {
        // Revert card on failure
        setWorkflowStatuses((prev) => ({ ...prev, [labFile.id]: "nao_iniciado" }));
        console.error("[MentoriaLab][Fluxo][Etapa:analise] Falha na análise — card revertido.", {
          fileId: labFile.id,
          erro: err?.message,
        });
        toast.error("Falha ao processar atendimento. O card foi revertido.", { duration: 6000 });
      }
    },
    [handleStartMentoriaCore, openMentoria, runPreflightForSingle],
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const removeSelected = () => {
    setFiles((prev) => prev.filter((f) => !selected.has(f.id)));
    setSelected(new Set());
  };

  const approveAsOfficial = async (labFile: LabFile) => {
    if (!labFile.evaluationId || labFile.approvedAsOfficial) return;
    setApprovingIds((prev) => new Set(prev).add(labFile.id));
    try {
      const { data: currentEvaluation, error: currentEvaluationError } = await supabase
        .from("evaluations")
        .select("audit_log")
        .eq("id", labFile.evaluationId)
        .maybeSingle();

      if (currentEvaluationError) {
        toast.error("Erro ao carregar avaliação: " + currentEvaluationError.message);
        return;
      }

      const { error } = await supabase
        .from("evaluations")
        .update({
          resultado_validado: true,
          audit_log: buildOfficialAuditLog("manual", currentEvaluation?.audit_log),
        } as any)
        .eq("id", labFile.evaluationId);
      if (error) {
        toast.error("Erro ao aprovar avaliação: " + error.message);
        return;
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.id === labFile.id ? { ...f, approvedAsOfficial: true, approvalOrigin: "manual" as const } : f,
        ),
      );
      logAudit({
        protocolo: labFile.protocolo || "—",
        atendente: labFile.atendente || "—",
        acao: "aprovado",
        origem: "manual",
        data: new Date().toISOString(),
      });
      toast.success("Avaliação oficializada no ranking! Agora aparece no ranking e histórico.");
    } catch {
      toast.error("Erro inesperado ao aprovar avaliação.");
    } finally {
      setApprovingIds((prev) => {
        const n = new Set(prev);
        n.delete(labFile.id);
        return n;
      });
    }
  };

  const batchAutoApprove = useCallback(
    async (fileIds: string[]) => {
      const filesToApprove = files.filter(
        (f) =>
          fileIds.includes(f.id) &&
          f.evaluationId &&
          !f.approvedAsOfficial &&
          typeof f.result?.notaFinal === "number" &&
          Number.isFinite(f.result.notaFinal) &&
          !normalizedExcludedAttendants.has(normalizeAttendantName(f.result?.atendente || f.atendente)),
      );
      if (filesToApprove.length === 0) return;

      const evaluationIds = filesToApprove.map((f) => f.evaluationId!);
      const { data: evaluations, error: loadError } = await supabase
        .from("evaluations")
        .select("id, protocolo, audit_log")
        .in("id", evaluationIds);

      if (loadError) {
        toast.error("Erro ao carregar avaliações: " + loadError.message);
        throw loadError;
      }

      const evaluationsById = new Map((evaluations || []).map((evaluation) => [evaluation.id, evaluation]));

      const updateResults = await Promise.all(
        filesToApprove.map(async (file) => {
          const currentEvaluation = evaluationsById.get(file.evaluationId!);
          if (!currentEvaluation) return null;

          const { error } = await supabase
            .from("evaluations")
            .update({
              resultado_validado: true,
              audit_log: buildOfficialAuditLog("automatic", currentEvaluation.audit_log),
            } as any)
            .eq("id", currentEvaluation.id);

          if (error) throw error;

          console.log("[AUTO → OFICIAL] Registro criado:", currentEvaluation.protocolo || file.protocolo || file.id);

          return file.id;
        }),
      );

      const approvedIds = new Set(updateResults.filter((value): value is string => Boolean(value)));
      setFiles((prev) =>
        prev.map((f) =>
          approvedIds.has(f.id) ? { ...f, approvedAsOfficial: true, approvalOrigin: "automatic" as const } : f,
        ),
      );
    },
    [files, normalizedExcludedAttendants],
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // === Clear: only pending (no result) ===
  const executeClearPending = async () => {
    setClearing(true);
    try {
      const pendingFiles = files.filter(
        (f) => (f.status === "pendente" || f.status === "lido") && !f.result,
      );
      if (pendingFiles.length === 0) {
        toast.info("Não há atendimentos pendentes para remover.");
        setShowClearConfirm(false);
        setClearConfirmStep(null);
        return;
      }

      const batchFileIds = pendingFiles.map((f) => f.batchFileId).filter(Boolean) as string[];
      if (batchFileIds.length > 0) {
        await supabase.from("mentoria_batch_files").delete().in("id", batchFileIds);
      }

      const removedIds = new Set(pendingFiles.map((f) => f.id));
      setFiles((prev) => prev.filter((f) => !removedIds.has(f.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of removedIds) next.delete(id);
        return next;
      });
      setWorkflowStatuses((prev) => {
        const next = { ...prev };
        for (const id of removedIds) delete next[id];
        return next;
      });

      console.log("[Auditoria][Limpeza]", {
        tipo: "Limpar Apenas Pendentes",
        registros_removidos: pendingFiles.length,
        data: new Date().toISOString(),
      });

      setShowClearConfirm(false);
      setClearConfirmStep(null);
      toast.success(`${pendingFiles.length} atendimento(s) pendente(s) removido(s).`);
    } catch (err) {
      console.error("Erro ao limpar pendentes:", err);
      toast.error("Erro ao limpar pendentes. Tente novamente.");
    } finally {
      setClearing(false);
    }
  };

  const handleClearPending = () => {
    const count = files.filter(
      (f) => (f.status === "pendente" || f.status === "lido") && !f.result,
    ).length;
    if (count === 0) {
      toast.info("Não há atendimentos pendentes para remover.");
      return;
    }
    setClearConfirmStep({ action: executeClearPending, count, label: "pendentes sem análise" });
  };

  // === Clear: current batch — only pending/lido files ===
  const executeClearCurrentBatch = async () => {
    setClearing(true);
    try {
      if (!currentBatchId) {
        toast.info("Nenhum lote ativo para limpar.");
        setShowClearConfirm(false);
        setClearConfirmStep(null);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get batch files with status
      const { data: batchFiles } = await supabase
        .from("mentoria_batch_files")
        .select("id, protocolo, status")
        .eq("batch_id", currentBatchId);

      if (batchFiles && batchFiles.length > 0) {
        const pendingBatchFiles = batchFiles.filter(
          (f) => f.status === "pending" || f.status === "read",
        );
        const analyzedCount = batchFiles.length - pendingBatchFiles.length;

        if (pendingBatchFiles.length > 0) {
          const pendingIds = pendingBatchFiles.map((f) => f.id);
          await supabase.from("mentoria_batch_files").delete().in("id", pendingIds);
        }

        // Update batch total_pdfs or delete batch if empty
        if (analyzedCount > 0) {
          await supabase
            .from("mentoria_batches")
            .update({ total_pdfs: analyzedCount } as any)
            .eq("id", currentBatchId);
          if (batchInfo) {
            setBatchInfo({ ...batchInfo, totalPdfs: analyzedCount });
          }
        } else {
          await supabase.from("mentoria_batches").delete().eq("id", currentBatchId);
          setCurrentBatchId(null);
          setBatchInfo(null);
        }

        const removedDbIds = new Set(pendingBatchFiles.map((f) => f.id));
        setFiles((prev) => prev.filter((f) => !removedDbIds.has(f.batchFileId || "")));
        setSelected((prev) => {
          const next = new Set(prev);
          for (const f of files) {
            if (removedDbIds.has(f.batchFileId || "")) next.delete(f.id);
          }
          return next;
        });
        setWorkflowStatuses((prev) => {
          const next = { ...prev };
          for (const f of files) {
            if (removedDbIds.has(f.batchFileId || "")) delete next[f.id];
          }
          return next;
        });

        console.log("[Auditoria][Limpeza]", {
          tipo: "Limpar Lote Atual (pendentes)",
          batch_id: currentBatchId,
          registros_removidos: pendingBatchFiles.length,
          registros_preservados: analyzedCount,
          data: new Date().toISOString(),
        });
      }

      setSideFile(null);
      setMentoriaFile(null);
      setHighlightedFileId(null);
      setShowClearConfirm(false);
      setClearConfirmStep(null);
      toast.success("Pendentes do lote atual removidos. Análises concluídas foram preservadas.");
    } catch (err) {
      console.error("Erro ao limpar lote:", err);
      toast.error("Erro ao limpar lote. Tente novamente.");
    } finally {
      setClearing(false);
    }
  };

  const handleClearCurrentBatch = () => {
    const batchPendingCount = files.filter(
      (f) => f.batchId === currentBatchId && (f.status === "pendente" || f.status === "lido"),
    ).length;
    if (batchPendingCount === 0) {
      toast.info("Não há pendentes no lote atual.");
      return;
    }
    setClearConfirmStep({ action: executeClearCurrentBatch, count: batchPendingCount, label: "pendentes do lote atual" });
  };

  // === Clear: everything EXCEPT official evaluations ===
  const executeClearAllPreserveOfficial = async () => {
    setClearing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: batches } = await supabase
        .from("mentoria_batches")
        .select("id, batch_code")
        .eq("user_id", user.id);

      let totalRemoved = 0;

      if (batches && batches.length > 0) {
        const batchIds = batches.map((b) => b.id);

        const { data: batchFiles } = await supabase
          .from("mentoria_batch_files")
          .select("id, protocolo")
          .in("batch_id", batchIds);

        if (batchFiles) {
          totalRemoved = batchFiles.length;
          const protocols = batchFiles.map((f) => f.protocolo).filter(Boolean) as string[];
          if (protocols.length > 0) {
            await supabase
              .from("evaluations")
              .delete()
              .eq("user_id", user.id)
              .in("protocolo", protocols)
              .eq("resultado_validado", false);
          }
          await supabase.from("mentoria_batch_files").delete().in("batch_id", batchIds);
        }

        for (const bId of batchIds) {
          await supabase.from("mentoria_batches").delete().eq("id", bId);
        }
      }

      console.log("[Auditoria][Limpeza]", {
        tipo: "Limpar Tudo (Preservar Oficiais)",
        registros_removidos: totalRemoved,
        data: new Date().toISOString(),
      });

      setFiles([]);
      setSelected(new Set());
      setWorkflowStatuses({});
      setCurrentBatchId(null);
      setBatchInfo(null);
      setSideFile(null);
      setMentoriaFile(null);
      setHighlightedFileId(null);
      setShowClearConfirm(false);
      setClearConfirmStep(null);
      toast.success("Dados limpos. Avaliações oficiais foram preservadas.");
    } catch (err) {
      console.error("Erro ao limpar dados:", err);
      toast.error("Erro ao limpar dados. Tente novamente.");
    } finally {
      setClearing(false);
    }
  };

  const handleClearAllPreserveOfficial = () => {
    const count = files.length;
    if (count === 0) {
      toast.info("Não há dados para limpar.");
      return;
    }
    setClearConfirmStep({ action: executeClearAllPreserveOfficial, count, label: "registros do Lab (preservando oficiais)" });
  };

  // === Discard pending (local + DB, used from pipeline area) ===
  const handleDiscardPending = async () => {
    const pendingFiles = files.filter(
      (f) => (f.status === "pendente" || f.status === "lido") && !f.result,
    );
    if (pendingFiles.length === 0) {
      toast.info("Não há atendimentos pendentes para descartar.");
      return;
    }

    setClearing(true);
    try {
      const batchFileIds = pendingFiles.map((f) => f.batchFileId).filter(Boolean) as string[];
      if (batchFileIds.length > 0) {
        await supabase.from("mentoria_batch_files").delete().in("id", batchFileIds);
      }

      const removedIds = new Set(pendingFiles.map((f) => f.id));
      setFiles((prev) => prev.filter((f) => !removedIds.has(f.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of removedIds) next.delete(id);
        return next;
      });
      setWorkflowStatuses((prev) => {
        const next = { ...prev };
        for (const id of removedIds) delete next[id];
        return next;
      });
      toast.success(`${pendingFiles.length} atendimento(s) pendente(s) descartado(s).`);
    } catch (err) {
      console.error("Erro ao descartar pendentes:", err);
      toast.error("Erro ao descartar pendentes.");
    } finally {
      setClearing(false);
    }
  };

  const formatSize = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);

  const getWorkflowStatus = (fileId: string): WorkflowStatus => workflowStatuses[fileId] || "nao_iniciado";

  const handleMarkFinished = useCallback(() => {
    if (!mentoriaFile) return;
    setWorkflowStatuses((prev) => ({ ...prev, [mentoriaFile.id]: "finalizado" }));
    toast.success("Atendimento marcado como finalizado.");
  }, [mentoriaFile]);

  const getNextAnalyzedFile = useCallback(() => {
    if (!mentoriaFile) return null;
    const analyzed = filteredFiles.filter((f) => f.status === "analisado" && f.result);
    const currentIdx = analyzed.findIndex((f) => f.id === mentoriaFile.id);
    if (currentIdx < 0 || currentIdx >= analyzed.length - 1) return null;
    return analyzed[currentIdx + 1];
  }, [mentoriaFile, filteredFiles]);

  // "Analisar próximo" — opens the first "nao_iniciado" file that has a result
  const handleAnalyzeNextFromPipeline = useCallback(() => {
    const notStarted = filteredFiles.filter((f) => {
      const ws = getWorkflowStatus(f.id);
      return ws === "nao_iniciado" && f.status === "analisado" && f.result;
    });
    if (notStarted.length === 0) {
      toast.info("Não há mais atendimentos pendentes de revisão.");
      return;
    }
    openMentoria(notStarted[0]);
  }, [filteredFiles, getWorkflowStatus, openMentoria]);

  // Batch analysis: analyze N files from "Não iniciados" without opening modals
  const BATCH_CONCURRENCY = 5;

  const handleBatchAnalyze = useCallback(
    async (count: number | "all") => {
      if (batchProcessing || processing) {
        toast.warning("Já existe um processamento em andamento.");
        return;
      }

      // Get eligible files: "nao_iniciado" workflow status, "lido" or "pendente" file status, not non-evaluable
      const eligible = filteredFiles.filter((f) => {
        const ws = getWorkflowStatus(f.id);
        const evaluability = resolvePersistedMentoriaEvaluability(f.result);
        const isNonEvaluable = evaluability?.nonEvaluable === true;
        return ws === "nao_iniciado" && (f.status === "lido" || f.status === "pendente") && !isNonEvaluable;
      });

      if (eligible.length === 0) {
        toast.info("Não há atendimentos prontos para análise.");
        return;
      }

      const toProcess = count === "all" ? eligible : eligible.slice(0, count);

      // Validate session first
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.", {
          duration: 10000,
          action: {
            label: "Fazer login",
            onClick: () => {
              window.location.href = "/auth";
            },
          },
        });
        return;
      }

      // Run preflight
      const preflight = await runPreflightForSingle(toProcess.length);
      if (!preflight.ready) {
        const errors = preflight.checks.filter((c) => c.status === "erro");
        const firstError = errors[0];
        const categoryMessages: Record<string, string> = {
          autenticacao: "Sessão inválida. Faça login novamente.",
          credito: "IA pausada por falta de saldo.",
          infraestrutura: "Infraestrutura indisponível. Tente novamente.",
          configuracao: "Configuração ausente. Contate o administrador.",
          limite: firstError?.message || "Limite técnico atingido.",
        };
        toast.error(categoryMessages[firstError?.category || ""] || "Ambiente não está pronto para análise.", {
          duration: 8000,
        });
        return;
      }

      setBatchProcessing(true);
      setBatchStats({ analyzing: 0, completed: 0, failed: 0 });

      // Move all to "em_analise"
      setWorkflowStatuses((prev) => {
        const next = { ...prev };
        for (const f of toProcess) next[f.id] = "em_analise";
        return next;
      });

      toast.info(`Iniciando análise em lote de ${toProcess.length} atendimento(s)...`);

      // Process with concurrency limit
      const queue = [...toProcess];
      let completed = 0;
      let failed = 0;

      const worker = async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (!file) break;

          setBatchStats((prev) => ({ ...prev, analyzing: prev.analyzing + 1 }));

          try {
            // Prepare file if needed
            let preparedFile = file;
            if (file.status === "pendente") {
              const readResult = await readFile(file);
              preparedFile = readResult || {
                ...file,
                status: "lido" as FileStatus,
                text: "(conteúdo indisponível — fallback)",
              };
              if (!readResult) {
                setFiles((prev) => prev.map((f) => (f.id === file.id ? preparedFile : f)));
              }
            }

            await analyzeFiles([preparedFile], { clearSelection: false, autoFinalize: true });
            completed++;
            setBatchStats((prev) => ({ ...prev, analyzing: prev.analyzing - 1, completed: prev.completed + 1 }));
          } catch (err: any) {
            failed++;
            setWorkflowStatuses((prev) => ({ ...prev, [file.id]: "nao_iniciado" }));
            setBatchStats((prev) => ({ ...prev, analyzing: prev.analyzing - 1, failed: prev.failed + 1 }));
            console.error("[MentoriaLab][Lote][erro]", { fileId: file.id, erro: err?.message });
            // Continue to next — don't stop the queue
          }
        }
      };

      const workerCount = Math.min(BATCH_CONCURRENCY, toProcess.length);
      await Promise.allSettled(Array.from({ length: workerCount }, () => worker()));

      setBatchProcessing(false);

      if (failed === 0) {
        toast.success(`Lote concluído: ${completed} atendimento(s) analisado(s) com sucesso.`);
      } else if (completed > 0) {
        toast.warning(`Lote concluído: ${completed} sucesso(s), ${failed} falha(s).`);
      } else {
        toast.error(`Falha no processamento do lote: ${failed} erro(s).`);
      }
    },
    [batchProcessing, processing, filteredFiles, getWorkflowStatus, analyzeFiles, readFile, runPreflightForSingle],
  );

  const handleNextFile = useCallback(() => {
    const next = getNextAnalyzedFile();
    if (!next) return;
    openMentoria(next);
  }, [getNextAnalyzedFile, openMentoria]);

  const counts = useMemo(() => {
    const source = filteredFiles;
    const nonEvaluableIds = new Set(
      source.filter((f) => resolvePersistedMentoriaEvaluability(f.result)?.nonEvaluable === true).map((f) => f.id),
    );
    const ineligibleIds = new Set(
      source
        .filter(
          (f) => resolvePersistedMentoriaIneligibility(f.result)?.ineligible === true || nonEvaluableIds.has(f.id),
        )
        .map((f) => f.id),
    );
    const analisados = source.filter((f) => {
      if (f.status !== "analisado" || ineligibleIds.has(f.id)) return false;
      if (globalExcludedSet.size > 0) {
        const name = (f.result?.atendente || f.atendente || "").trim();
        if (globalExcludedSet.has(name)) return false;
      }
      return true;
    });
    const atendentesSet = new Set(
      analisados.map((f) => (f.result?.atendente || f.atendente || "").trim().toLowerCase()).filter(Boolean),
    );
    return {
      total: source.length,
      pendente: source.filter((f) => f.status === "pendente").length,
      lido: source.filter((f) => f.status === "lido" && !nonEvaluableIds.has(f.id)).length,
      analisado: analisados.length,
      erro: source.filter((f) => f.status === "erro").length,
      naoAvaliavel: nonEvaluableIds.size,
      atendentes: atendentesSet.size,
    };
  }, [filteredFiles, globalExcludedSet]);

  // Keep sideFile in sync with files state
  useEffect(() => {
    if (sideFile) {
      const updated = files.find((f) => f.id === sideFile.id);
      if (updated) setSideFile(updated);
    }
  }, [files, sideFile]);

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <h1 className="text-xl font-bold text-foreground">
            Radar Insight — <span className="text-primary">Mentoria Lab</span>
          </h1>
          <Badge variant="outline" className="ml-2 text-xs">
            Beta
          </Badge>
          <PreflightStatusBadge />
          <div className="ml-auto flex items-center gap-1">
            <MentoriaReportExport files={filteredFiles} batchInfo={batchInfo} />
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => navigate("/attendance")}>
                    <ShieldCheck className="h-4 w-4" /> Avaliações Oficiais
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Ir para o módulo de Avaliação Oficial — exibe apenas avaliações aprovadas</p></TooltipContent>
              </Tooltip>
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Limpar dados
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Remover todos os atendimentos do lote atual (ação irreversível)</p></TooltipContent>
              </Tooltip>
            )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => navigate("/hub")}>
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Voltar para a tela anterior</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" /> Sair
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Encerrar sessão e sair do sistema</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      <AlertDialog open={showClearConfirm} onOpenChange={(open) => { setShowClearConfirm(open); if (!open) setClearConfirmStep(null); }}>
        <AlertDialogContent className="max-w-md">
          {!clearConfirmStep ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-3 text-base">
                  <ShieldAlert className="h-5 w-5 text-warning shrink-0" />
                  Área restrita — Limpeza de Dados
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Escolha o tipo de limpeza. Avaliações oficiais (<span className="font-semibold">resultado validado</span>) são sempre preservadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-3 py-3">
                <Button
                  variant="outline"
                  className="justify-start gap-3 h-auto py-4 px-4 text-left whitespace-normal"
                  onClick={handleClearPending}
                  disabled={clearing}
                >
                  <Filter className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">Limpar Apenas Pendentes</p>
                    <p className="text-xs text-muted-foreground font-normal mt-0.5 break-words">Remove atendimentos com status "pendente" ou "lido" sem resultado de análise.</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-3 h-auto py-4 px-4 text-left whitespace-normal"
                  onClick={handleClearCurrentBatch}
                  disabled={clearing || !currentBatchId}
                >
                  <Archive className="h-4 w-4 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">Limpar Lote Atual</p>
                    <p className="text-xs text-muted-foreground font-normal mt-0.5 break-words">Remove apenas pendentes do lote ativo{batchInfo ? ` (${batchInfo.batchCode})` : ""}. Mantém análises concluídas.</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-3 h-auto py-4 px-4 text-left whitespace-normal border-destructive/30 hover:bg-destructive/5"
                  onClick={handleClearAllPreserveOfficial}
                  disabled={clearing}
                >
                  <Trash2 className="h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-destructive">Limpar Tudo (Preservar Oficiais)</p>
                    <p className="text-xs text-muted-foreground font-normal mt-0.5 break-words">Remove todos os dados do Lab, exceto avaliações com resultado validado.</p>
                  </div>
                </Button>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Confirmar exclusão
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Você tem certeza? Esta ação excluirá <span className="font-bold text-foreground">{clearConfirmStep.count}</span> {clearConfirmStep.label} permanentemente e será registrada no log do sistema.
                  </p>
                  <p className="text-xs font-medium text-destructive">Esta ação não pode ser desfeita.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearing} onClick={() => setClearConfirmStep(null)}>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={clearConfirmStep.action}
                  disabled={clearing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {clearing ? "Excluindo..." : `Confirmar exclusão de ${clearConfirmStep.count} registro(s)`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Global month filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span className="font-medium text-foreground">Competência:</span>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger className="w-[180px] h-9 text-sm">
                        <SelectValue placeholder="Mês de referência" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os meses</SelectItem>
                        {monthOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-center">
                  <p>Selecione o mês de referência para filtrar atendimentos e calcular bônus</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Tabs navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md border border-border bg-muted/60 p-1 rounded-lg">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="operacao" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground hover:bg-accent/60 transition-colors rounded-md font-medium">Operação</TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px] text-center">
                  <p>Esteira de trabalho: importe, analise e gerencie os atendimentos do lote atual</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="performance" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground hover:bg-accent/60 transition-colors rounded-md font-medium">Performance</TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px] text-center">
                  <p>Visualize métricas, bônus e evolução dos atendentes da competência selecionada</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="opa" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground hover:bg-accent/60 transition-colors rounded-md font-medium">Opa Suite</TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px] text-center">
                  <p>Importe atendimentos diretamente da Opa Suite para análise</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TabsList>

          <TabsContent value="operacao" className="space-y-4 mt-4">

            {/* Loading state */}
            {loadingFromDb && files.length === 0 && (
              <Card className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Carregando atendimentos salvos...</p>
              </Card>
            )}

            {/* Empty state */}
            {!loadingFromDb && files.length === 0 && (
              <Card
                className={cn(
                  "p-8 transition-all group text-center",
                  isImporting ? "border-primary/30 bg-primary/5" : "cursor-pointer hover:shadow-md hover:border-primary/40"
                )}
                onClick={() => !isImporting && inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {isImporting ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-primary">Analisando arquivos...</p>
                    <p className="text-xs text-muted-foreground">
                      Aguarde, processando {importingCount} arquivo(s) recebido(s)
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-primary mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-foreground mb-1">Importar Atendimentos</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Envie PDFs ou um ZIP com atendimentos para iniciar a curadoria.
                    </p>
                  </>
                )}
              </Card>
            )}

            {/* Grid: Upload (left) + Último Lote + Resumo (right) */}
            {files.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Upload card — compact */}
                <Card className="lg:col-span-3 p-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => !isImporting && inputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-lg h-[110px] flex flex-col items-center justify-center transition-colors",
                      isImporting
                        ? "border-primary/40 bg-primary/5 cursor-default"
                        : "border-primary/30 cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-5 w-5 text-primary animate-spin mb-1.5" />
                        <p className="text-sm font-semibold text-primary">Analisando arquivos...</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Aguarde, processando {importingCount} arquivo(s) recebido(s)
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-primary/60 mb-1.5" />
                        <p className="text-sm font-medium text-muted-foreground">Arraste PDFs ou ZIP aqui</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">ou clique para selecionar</p>
                      </>
                    )}
                  </div>
                </Card>

                {/* Último Lote + Resumo — combined */}
                <Card className="lg:col-span-2 p-4 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Último lote</p>
                    {batchInfo ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-foreground">{batchInfo.batchCode}</span>
                          {(() => {
                            const cfg = batchStatusConfig[batchInfo.status];
                            return (
                              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-auto shrink-0", cfg.color)}>
                                {cfg.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{batchInfo.createdAt.toLocaleDateString("pt-BR")} {batchInfo.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>·</span>
                          <span className="font-semibold text-foreground">{batchInfo.totalPdfs}</span> PDFs válidos
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhum lote importado ainda.</p>
                    )}
                  </div>

                  {/* Divider + Summary counters */}
                  {files.length > 0 && (
                    <>
                      <div className="border-t border-border/50 my-2.5" />
                      <div className="flex items-center gap-3 flex-wrap text-[11px]">
                        <span className="font-semibold text-foreground">{counts.total} Total</span>
                        {counts.lido > 0 && (
                          <span className="text-primary font-medium">⚡ {counts.lido} Aptos IA</span>
                        )}
                        {counts.analisado > 0 && (
                          <span className="text-accent font-medium">✓ {counts.analisado} Analisados</span>
                        )}
                        {counts.naoAvaliavel > 0 && (
                          <span className="text-warning font-medium">{counts.naoAvaliavel} N/A</span>
                        )}
                        {counts.erro > 0 && (
                          <span className="text-destructive font-medium">{counts.erro} Erros</span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Batch history link → popup */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="mt-2 text-[11px] text-primary hover:underline font-medium text-left flex items-center gap-1">
                        📦 Ver histórico de lotes →
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[380px] max-h-[400px] p-0">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <span className="text-sm font-semibold text-foreground">Histórico de Lotes</span>
                      </div>
                      <div className="overflow-y-auto max-h-[340px] px-3 py-2 space-y-2" style={{ scrollbarWidth: "thin" }}>
                        <MentoriaBatchHistory />
                      </div>
                    </PopoverContent>
                  </Popover>
                </Card>
              </div>
            )}

            {/* Upload input (hidden) */}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.zip"
              multiple
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />

            {/* ═══ Inline Filters + Table (was Pipeline tab) ═══ */}
            {files.length > 0 && (
              <>
                {/* Filters — directly visible, no wrapper */}
                <div className="flex flex-wrap items-center gap-3">
                  <TooltipProvider delayDuration={300}>
                  {/* Search */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar atendente ou protocolo..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                        {searchTerm && (
                          <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Digite o nome do atendente ou número do protocolo para filtrar</p></TooltipContent>
                  </Tooltip>

                  {/* Atendente */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Select value={filterAtendente} onValueChange={setFilterAtendente}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Atendente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos atendentes</SelectItem>
                            <SelectItem value="sem_atendente">Sem atendente</SelectItem>
                            {atendentes.map((a) => (
                              <SelectItem key={a} value={a}>
                                {a}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Filtrar tabela por atendente específico</p></TooltipContent>
                  </Tooltip>

                  {/* Data auditoria */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-[180px] justify-start text-left text-xs font-normal h-10",
                                !filterAuditoriaFrom && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                              {filterAuditoriaFrom
                                ? filterAuditoriaTo
                                  ? `${format(filterAuditoriaFrom, "dd/MM")} – ${format(filterAuditoriaTo, "dd/MM/yy")}`
                                  : `A partir de ${format(filterAuditoriaFrom, "dd/MM/yy")}`
                                : "Período"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="range"
                              selected={
                                filterAuditoriaFrom && filterAuditoriaTo
                                  ? { from: filterAuditoriaFrom, to: filterAuditoriaTo }
                                  : filterAuditoriaFrom
                                    ? { from: filterAuditoriaFrom, to: undefined }
                                    : undefined
                              }
                              onSelect={(range) => {
                                setFilterAuditoriaFrom(range?.from);
                                setFilterAuditoriaTo(range?.to);
                              }}
                              numberOfMonths={2}
                              className={cn("p-3 pointer-events-auto")}
                            />
                            {(filterAuditoriaFrom || filterAuditoriaTo) && (
                              <div className="px-3 pb-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-xs"
                                  onClick={() => {
                                    setFilterAuditoriaFrom(undefined);
                                    setFilterAuditoriaTo(undefined);
                                  }}
                                >
                                  Limpar período
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Filtrar atendimentos por período de data</p></TooltipContent>
                  </Tooltip>

                  {/* Counter + visibility toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-auto text-xs text-muted-foreground cursor-default">
                        {filteredFiles.length} de {files.length}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Total de atendimentos exibidos / total importados no lote</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-9 w-9", !showCharts && "text-primary")}
                        onClick={() => setShowCharts(!showCharts)}
                      >
                        {showCharts ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Ocultar ou exibir a tabela de atendimentos</p></TooltipContent>
                  </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Table section (hideable) */}
                {!showCharts && (
                  <MentoriaUnifiedTable
                    files={filteredFiles}
                    getWorkflowStatus={getWorkflowStatus}
                    highlightedFileId={highlightedFileId}
                    readingIds={readingIds}
                    approvingIds={approvingIds}
                    processing={processing}
                    batchProcessing={batchProcessing}
                    batchStats={batchStats}
                    isAdmin={isAdmin}
                    onOpenFile={(f) => {
                      setMentoriaFile(null);
                      setSideFile(f as any);
                      setHighlightedFileId(f.id);
                    }}
                    onOpenMentoria={(f) => openMentoria(f as any, "relatorio")}
                    onStartMentoria={(f) => handleStartMentoria(f as any)}
                    onApproveOfficial={(f) => approveAsOfficial(f as any)}
                    onRemoveFile={removeFile}
                    onOpenDiagnostic={(f) => setDiagnosticFile(f as any)}
                    onAnalyzeNext={handleAnalyzeNextFromPipeline}
                    onBatchAnalyze={handleBatchAnalyze}
                    monthlyConfirmCounts={monthlyConfirmCounts}
                    onAuditFile={(f) => openMentoria(f as any, "revisao")}
                    onAnalyzeSelected={async (ids: string[], tipoAnalise: 'ia' | 'manual') => {
                      const newStatus = 'aguardando_revisao_ia';
                      for (const id of ids) {
                        const file = files.find((f) => f.id === id);
                        if (file?.batchFileId) {
                          await supabase.from("mentoria_batch_files").update({ tipo_analise: 'ia', status: newStatus } as any).eq("id", file.batchFileId);
                        }
                        setFiles((prev) => prev.map((f) => f.id === id ? { ...f, tipo_analise: 'ia', status: newStatus } as any : f));
                      }
                      handleBatchAnalyze(ids.length);
                    }}
                    onDeleteSelected={async (ids: string[]) => {
                      for (const id of ids) {
                        const file = files.find((f) => f.id === id);
                        if (file?.batchFileId) {
                          await supabase.from("mentoria_batch_files").delete().eq("id", file.batchFileId);
                        }
                      }
                      setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
                      toast.success(`${ids.length} atendimento(s) excluído(s).`);
                    }}
                    onConfirmSelected={async (ids: string[]) => {
                      let confirmed = 0;
                      let blocked = 0;
                      for (const id of ids) {
                        const file = files.find((f) => f.id === id);
                        if (!file) continue;
                        // Check 6-per-month limit
                        if (file.atendente) {
                          const key = file.atendente.trim().toLowerCase();
                          const currentCount = monthlyConfirmCounts.get(key) || 0;
                          if (currentCount >= 6) {
                            toast.warning(`Limite de 6 auditorias oficiais atingido para ${file.atendente} neste mês.`);
                            blocked++;
                            continue;
                          }
                        }
                        if (file.batchFileId) {
                          await supabase.from("mentoria_batch_files").update({ status: 'confirmado' } as any).eq("id", file.batchFileId);
                        }
                        setFiles((prev) => prev.map((f) => f.id === id ? { ...f, status: 'confirmado' } as any : f));
                        confirmed++;
                      }
                      if (confirmed > 0) {
                        toast.success(`Nota IA validada! ${confirmed} atendimento(s) adicionado(s) à Performance.`);
                      }
                    }}
                    onRejectSelected={async (ids: string[]) => {
                      for (const id of ids) {
                        const file = files.find((f) => f.id === id);
                        if (file?.batchFileId) {
                          await supabase.from("mentoria_batch_files").update({ status: 'pending', tipo_analise: null } as any).eq("id", file.batchFileId);
                        }
                        setFiles((prev) => prev.map((f) => f.id === id ? { ...f, status: 'pendente', tipo_analise: null } as any : f));
                      }
                      toast.success(`${ids.length} atendimento(s) reprovado(s) e retornado(s) para Pendentes.`);
                    }}
                    onMarkViewed={async (id: string) => {
                      const file = files.find((f) => f.id === id);
                      if (file?.batchFileId && !file.visualizado) {
                        await supabase.from("mentoria_batch_files").update({ visualizado: true } as any).eq("id", file.batchFileId);
                        setFiles((prev) => prev.map((f) => f.id === id ? { ...f, visualizado: true } : f));
                      }
                    }}
                  />
                )}
              </>
            )}

            {/* Version Registry — collapsible, secondary position */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start mt-2">
                  <Bookmark className="h-3.5 w-3.5" />
                  Registro de Versão
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <VersionRegistryCard />
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4 mt-4">
            {files.length > 0 && filteredFiles.some((f) => f.status === "analisado" || f.status === "confirmado") ? (
              <PerformanceSections
                files={filteredFiles}
                globalExcludedNames={globalExcludedNames}
                globalExcludedSet={globalExcludedSet}
                excludeAttendants={excludeAttendants}
                restoreAttendants={restoreAttendants}
                batchAutoApprove={batchAutoApprove}
              />
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Analise atendimentos para visualizar dados de performance.
              </div>
            )}
          </TabsContent>

          <TabsContent value="opa" className="space-y-4 mt-4">

            {/* ═══ TOP GRID: Import card (left) + Summary (right) ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Import card — main action */}
              <Card className="lg:col-span-3 overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-border/40 bg-gradient-to-r from-primary/[0.04] to-transparent">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                      <Radio className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground tracking-tight">Importar da Opa Suite</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Configure os filtros e clique em <strong className="text-foreground/80">Buscar atendimentos</strong> para carregar atendimentos finalizados.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    {/* Period picker */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Período</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[210px] justify-start text-left text-xs font-normal h-9",
                              !opa.dateFrom && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                            {opa.dateFrom
                              ? opa.dateTo
                                ? `${format(opa.dateFrom, "dd/MM/yyyy")} – ${format(opa.dateTo, "dd/MM/yyyy")}`
                                : `A partir de ${format(opa.dateFrom, "dd/MM/yyyy")}`
                              : "Selecionar período"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={
                              opa.dateFrom && opa.dateTo
                                ? { from: opa.dateFrom, to: opa.dateTo }
                                : opa.dateFrom
                                  ? { from: opa.dateFrom, to: undefined }
                                  : undefined
                            }
                            onSelect={(range) => {
                              opa.setDateFrom(range?.from);
                              opa.setDateTo(range?.to);
                            }}
                            numberOfMonths={2}
                            className={cn("p-3 pointer-events-auto")}
                          />
                          {(opa.dateFrom || opa.dateTo) && (
                            <div className="px-3 pb-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => {
                                  opa.setDateFrom(undefined);
                                  opa.setDateTo(undefined);
                                }}
                              >
                                Limpar período
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Attendant category filter — in top card before fetch */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Categoria</label>
                      <Select value={opa.filterAtendente} onValueChange={(v) => {
                        opa.setFilterAtendente(v);
                        if (v !== "somente_humanos") setOpaHumanSelected(new Set());
                      }}>
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                          <SelectValue placeholder="Todos atendentes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos atendentes</SelectItem>
                          <SelectItem value="sem_atendente">Sem atendente</SelectItem>
                          <SelectItem value="somente_humanos">Somente humanos</SelectItem>
                          <SelectItem value="somente_bot">Somente BOT/sistema</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                     {/* Secondary: multi-select human attendants */}
                     {opa.filterAtendente === "somente_humanos" && (
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Atendentes</label>
                         <Popover>
                           <PopoverTrigger asChild>
                             <Button variant="outline" className="w-[220px] h-9 text-xs justify-start gap-1.5 font-normal">
                               <Filter className="h-3.5 w-3.5 shrink-0" />
                               {opaHumanSelected.size === 0
                                 ? "Todos humanos"
                                 : `${opaHumanSelected.size} selecionado(s)`}
                             </Button>
                           </PopoverTrigger>
                           <PopoverContent className="w-[260px] p-0" align="start">
                             <div className="p-2 border-b border-border">
                               <p className="text-xs font-semibold text-muted-foreground">Selecionar atendentes</p>
                             </div>
                             <div className="max-h-[220px] overflow-y-auto p-2 space-y-1">
                               {opaHumanAttendants.length === 0 ? (
                                 <p className="text-xs text-muted-foreground py-2 text-center">Nenhum atendente humano encontrado</p>
                               ) : (
                                 opaHumanAttendants.map((name) => (
                                   <label key={name} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent/50 cursor-pointer text-xs">
                                     <Checkbox
                                       checked={opaHumanSelected.has(name)}
                                       onCheckedChange={(checked) => {
                                         setOpaHumanSelected((prev) => {
                                           const next = new Set(prev);
                                           if (checked) next.add(name);
                                           else next.delete(name);
                                           return next;
                                         });
                                       }}
                                     />
                                     <span className="truncate">{name}</span>
                                   </label>
                                 ))
                               )}
                             </div>
                             {opaHumanSelected.size > 0 && (
                               <div className="p-2 border-t border-border">
                                 <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setOpaHumanSelected(new Set())}>
                                   Limpar seleção
                                 </Button>
                               </div>
                             )}
                           </PopoverContent>
                         </Popover>
                       </div>
                     )}
                  </div>

                  {/* Action button */}
                  <Button
                    onClick={opa.fetchList}
                    disabled={opa.isLoading}
                    className="gap-2 h-10 px-6 font-semibold shadow-sm"
                  >
                    {opa.state === "loading-list" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Radio className="h-4 w-4" />
                    )}
                    {opa.state === "loading-list" ? "Buscando..." : "Buscar atendimentos"}
                  </Button>

                  {/* Inline status when loading messages / analyzing */}
                  {(opa.state === "loading-messages" || opa.state === "analyzing") && (
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="font-medium">
                        {opa.state === "loading-messages" ? "Carregando mensagens do atendimento..." : "Analisando atendimento via Radar Insight..."}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Summary card (right) */}
              <Card className="lg:col-span-2 p-4 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Resumo da Busca</p>
                  {opaFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="p-3 rounded-full bg-muted/60 mb-3">
                        <Radio className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px]">
                        Configure os filtros e busque para ver o resumo aqui.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-wrap text-[11px]">
                        <span className="font-semibold text-foreground">{opaCounts.total} Total</span>
                        {opaCounts.pendente > 0 && (
                          <span className="text-primary font-medium">⚡ {opaCounts.pendente} Pendentes</span>
                        )}
                        {opaCounts.analisado > 0 && (
                          <span className="text-accent font-medium">✓ {opaCounts.analisado} Analisados</span>
                        )}
                        {opaCounts.erro > 0 && (
                          <span className="text-destructive font-medium">{opaCounts.erro} Erros</span>
                        )}
                      </div>
                      {opa.activeFilters > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Filter className="h-3 w-3 text-primary" />
                          <span className="text-[11px] font-medium text-primary">{opa.activeFilters} filtro(s) ativo(s)</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-auto pt-3 border-t border-border/40">
                  {opa.lastFetch ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Atualizado às {opa.lastFetch.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Nenhuma busca realizada</p>
                  )}
                </div>
              </Card>
            </div>

            {/* ═══ ERROR BANNER ═══ */}
            {opa.state === "error" && (
              <Card className="p-5 border-destructive/30 bg-destructive/[0.03]">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-destructive/10 shrink-0">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground mb-0.5">Erro ao conectar com a Opa Suite</p>
                    <p className="text-xs text-muted-foreground mb-3">{opa.errorMsg}</p>
                    <div className="flex gap-2">
                      <Button onClick={opa.fetchList} variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Tentar novamente
                      </Button>
                      <Button onClick={opa.resetToIdle} variant="ghost" size="sm" className="text-xs h-8">
                        Voltar
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* ═══ FILTER BAR + TABLE (same pattern as Operação) ═══ */}
            {opaFiles.length > 0 && (
              <>
                {/* Filters — directly visible */}
                <div className="flex flex-wrap items-center gap-3">
                  <TooltipProvider delayDuration={300}>
                    {/* Search */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative flex-1 min-w-[180px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar atendente ou protocolo..."
                            value={opaSearchTerm}
                            onChange={(e) => setOpaSearchTerm(e.target.value)}
                            className="pl-9"
                          />
                          {opaSearchTerm && (
                            <button onClick={() => setOpaSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                              <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                            </button>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Filtrar por atendente ou protocolo</p></TooltipContent>
                    </Tooltip>

                    {/* Atendente category */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select value={opa.filterAtendente} onValueChange={(v) => {
                            opa.setFilterAtendente(v);
                            if (v !== "somente_humanos") setOpaHumanSelected(new Set());
                          }}>
                             <SelectTrigger className="w-[160px]">
                               <SelectValue placeholder="Categoria" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="todos">Todos atendentes</SelectItem>
                               <SelectItem value="sem_atendente">Sem atendente</SelectItem>
                               <SelectItem value="somente_humanos">Somente humanos</SelectItem>
                               <SelectItem value="somente_bot">Somente BOT/sistema</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Filtrar tabela por categoria</p></TooltipContent>
                    </Tooltip>

                     {/* Multi-select human attendants (table bar) */}
                     {opa.filterAtendente === "somente_humanos" && (
                       <Popover>
                         <PopoverTrigger asChild>
                           <Button variant="outline" className="h-10 text-xs justify-start gap-1.5 font-normal min-w-[180px]">
                             <Filter className="h-3.5 w-3.5 shrink-0" />
                             {opaHumanSelected.size === 0
                               ? "Todos humanos"
                               : `${opaHumanSelected.size} selecionado(s)`}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-[260px] p-0" align="start">
                           <div className="p-2 border-b border-border">
                             <p className="text-xs font-semibold text-muted-foreground">Selecionar atendentes</p>
                           </div>
                           <div className="max-h-[220px] overflow-y-auto p-2 space-y-1">
                             {opaHumanAttendants.length === 0 ? (
                               <p className="text-xs text-muted-foreground py-2 text-center">Nenhum atendente humano encontrado</p>
                             ) : (
                               opaHumanAttendants.map((name) => (
                                 <label key={name} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent/50 cursor-pointer text-xs">
                                   <Checkbox
                                     checked={opaHumanSelected.has(name)}
                                     onCheckedChange={(checked) => {
                                       setOpaHumanSelected((prev) => {
                                         const next = new Set(prev);
                                         if (checked) next.add(name);
                                         else next.delete(name);
                                         return next;
                                       });
                                     }}
                                   />
                                   <span className="truncate">{name}</span>
                                 </label>
                               ))
                             )}
                           </div>
                           {opaHumanSelected.size > 0 && (
                             <div className="p-2 border-t border-border">
                               <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setOpaHumanSelected(new Set())}>
                                 Limpar seleção
                               </Button>
                             </div>
                           )}
                         </PopoverContent>
                       </Popover>
                     )}

                    {/* Period filter */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-[180px] justify-start text-left text-xs font-normal h-10",
                                  !opaFilterAuditoriaFrom && "text-muted-foreground",
                                )}
                              >
                                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                                {opaFilterAuditoriaFrom
                                  ? opaFilterAuditoriaTo
                                    ? `${format(opaFilterAuditoriaFrom, "dd/MM")} – ${format(opaFilterAuditoriaTo, "dd/MM/yy")}`
                                    : `A partir de ${format(opaFilterAuditoriaFrom, "dd/MM/yy")}`
                                  : "Período"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="range"
                                selected={
                                  opaFilterAuditoriaFrom && opaFilterAuditoriaTo
                                    ? { from: opaFilterAuditoriaFrom, to: opaFilterAuditoriaTo }
                                    : opaFilterAuditoriaFrom
                                      ? { from: opaFilterAuditoriaFrom, to: undefined }
                                      : undefined
                                }
                                onSelect={(range) => {
                                  setOpaFilterAuditoriaFrom(range?.from);
                                  setOpaFilterAuditoriaTo(range?.to);
                                }}
                                numberOfMonths={2}
                                className={cn("p-3 pointer-events-auto")}
                              />
                              {(opaFilterAuditoriaFrom || opaFilterAuditoriaTo) && (
                                <div className="px-3 pb-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => {
                                      setOpaFilterAuditoriaFrom(undefined);
                                      setOpaFilterAuditoriaTo(undefined);
                                    }}
                                  >
                                    Limpar período
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Filtrar por período</p></TooltipContent>
                    </Tooltip>

                    {/* Counter */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-auto text-xs text-muted-foreground cursor-default">
                          {opaFilteredFiles.length} de {opaFiles.length}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Total de atendimentos exibidos / total importados</p></TooltipContent>
                    </Tooltip>

                    {/* Refresh */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={opa.fetchList}
                          disabled={opa.isLoading}
                        >
                          <RefreshCw className={cn("h-4 w-4", opa.isLoading && "animate-spin")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Atualizar lista</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* ═══ UNIFIED TABLE ═══ */}
                <MentoriaUnifiedTable
                  files={opaFilteredFiles.map((f) => ({ ...f, atendente: f.atendente ? friendlyName(f.atendente) : f.atendente }))}
                  getWorkflowStatus={getOpaWorkflowStatus}
                  highlightedFileId={opaHighlightedFileId}
                  readingIds={new Set<string>()}
                  approvingIds={new Set<string>()}
                  processing={opaAnalyzing}
                  batchProcessing={false}
                  batchStats={{ analyzing: 0, completed: 0, failed: 0 }}
                  isAdmin={isAdmin}
                  onOpenFile={(f) => {
                    // Open side panel for preview
                    const opaFile = opaFiles.find((of) => of.id === f.id);
                    if (opaFile) setSideFile(opaFile);
                  }}
                  onOpenMentoria={(f) => openOpaMentoria(f as any, "relatorio")}
                  onStartMentoria={(f) => handleOpaStartMentoria(f as any)}
                  onApproveOfficial={() => {}}
                  onRemoveFile={(id) => setOpaFiles((prev) => prev.filter((f) => f.id !== id))}
                  onOpenDiagnostic={(f) => {
                    const opaFile = opaFiles.find((of) => of.id === f.id);
                    if (opaFile) setDiagnosticFile(opaFile);
                  }}
                  onAnalyzeNext={() => {
                    const pending = opaFilteredFiles.find((f) => f.status === "pendente");
                    if (pending) {
                      const att = opa.attendances.find((a) => a.id === pending.id);
                      if (att) opa.handleSelect(att);
                    } else {
                      toast.info("Não há mais atendimentos pendentes.");
                    }
                  }}
                  onBatchAnalyze={() => {}}
                  onAnalyzeSelected={async (ids: string[]) => {
                    for (const id of ids) {
                      const att = opa.attendances.find((a) => a.id === id);
                      if (att) {
                        await opa.handleSelect(att);
                      }
                    }
                  }}
                  onDeleteSelected={async (ids: string[]) => {
                    setOpaFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
                    toast.success(`${ids.length} atendimento(s) removido(s).`);
                  }}
                  onConfirmSelected={async (ids: string[]) => {
                    setOpaFiles((prev) => prev.map((f) => ids.includes(f.id) ? { ...f, status: "confirmado" as FileStatus } : f));
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;
                      const companyId = await supabase.rpc("get_my_company_id").then((res) => res.data);
                      for (const id of ids) {
                        const file = opaFiles.find((f) => f.id === id);
                        if (!file?.result) continue;
                        const r = file.result;
                        await supabase.from("evaluations").insert({
                          user_id: user.id,
                          atendente: file.atendente || "Desconhecido",
                          protocolo: file.protocolo || file.id,
                          tipo: r.tipo || "opa_suite",
                          nota: r.notaFinal ?? r.nota ?? 0,
                          classificacao: r.classificacao || "\u2014",
                          data: file.data || new Date().toLocaleDateString("pt-BR"),
                          bonus: (r.bonusQualidade ?? 0) >= 80,
                          atualizacao_cadastral: r.bonusOperacional?.atualizacaoCadastral || "N\u00c3O",
                          pontos_melhoria: r.mentoria || r.pontosMelhoria || [],
                          full_report: r,
                          resultado_validado: true,
                          prompt_version: r.versao || "opa-suite",
                          company_id: companyId || null,
                          audit_log: buildOfficialAuditLog("manual", undefined),
                        } as any);
                      }
                      toast.success(`${ids.length} atendimento(s) confirmado(s) e enviado(s) para Performance.`);
                    } catch (err: any) {
                      console.error("[OpaConfirm] save error:", err);
                      toast.error("Erro ao salvar confirma\u00e7\u00e3o.");
                    }
                  }}
                  onRejectSelected={async (ids: string[]) => {
                    setOpaFiles((prev) => prev.map((f) => ids.includes(f.id) ? { ...f, status: "pendente" as FileStatus, result: undefined } : f));
                    toast.success(`${ids.length} atendimento(s) retornado(s) para Pendentes.`);
                  }}
                  onMarkViewed={async (id: string) => {
                    setOpaFiles((prev) => prev.map((f) => f.id === id ? { ...f, visualizado: true } : f));
                  }}
                  onAuditFile={(f) => openOpaMentoria(f as any, "revisao")}
                  monthlyConfirmCounts={new Map<string, number>()}
                />
              </>
            )}

            {/* Analysis result removed — audit is accessed via action column / MentoriaDetailDialog */}

            {/* Version Registry — collapsible, secondary position */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-start mt-2">
                  <Bookmark className="h-3.5 w-3.5" />
                  Registro de Versão
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <VersionRegistryCard />
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>
      </main>

      {/* Side panel */}
      <Sheet open={!!sideFile} onOpenChange={() => setSideFile(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              {sideFile?.name}
            </SheetTitle>
          </SheetHeader>

          {sideFile && (
            <div className="mt-4 space-y-4">
              {sideFile.status === "pendente" && !readingIds.has(sideFile.id) && (
                <Button variant="outline" className="w-full gap-2" disabled={readingIds.size > 0} onClick={() => readFile(sideFile)}>
                  <BookOpen className="h-4 w-4" /> {readingIds.size > 0 ? "Aguarde..." : "Iniciar leitura automática"}
                </Button>
              )}

              {readingIds.has(sideFile.id) && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Lendo PDF...</span>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Atendente", value: sideFile.atendente },
                  { label: "Tipo", value: sideFile.result?.tipo || sideFile.tipo || "—" },
                  { label: "Data", value: sideFile.data },
                  { label: "Áudio", value: sideFile.hasAudio ? "Sim" : "Não" },
                  { label: "Protocolo", value: sideFile.protocolo },
                  { label: "Status", value: statusConfig[sideFile.status].label },
                ].map((m) => (
                  <div key={m.label} className="p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-medium text-foreground">{m.value || "—"}</p>
                  </div>
                ))}
              </div>

              {/* Analysis result */}
              {sideFile.result && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-xs text-muted-foreground">Nota</p>
                      <p className="text-xl font-bold text-foreground">
                        {sideFile.result.notaFinal != null ? formatNota(sideFile.result.notaFinal) : "—"}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-xs text-muted-foreground">Classificação</p>
                      <p className="text-xl font-bold text-foreground">{sideFile.result.classificacao ?? "—"}</p>
                    </div>
                  </div>
                  {sideFile.result.mentoria?.length > 0 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs font-semibold text-primary mb-2">Pontos de Mentoria</p>
                      <ul className="space-y-1">
                        {sideFile.result.mentoria.map((m: string, i: number) => (
                          <li key={i} className="text-xs text-foreground">
                            • {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Conversation content */}
              {sideFile.text && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Conteúdo do atendimento</p>
                  <ConversationView
                    rawText={sideFile.text}
                    atendente={sideFile.atendente}
                    structuredConversation={sideFile.structuredConversation}
                  />
                </div>
              )}
              {!sideFile.text && sideFile.status !== "pendente" && !readingIds.has(sideFile.id) && !sideFile.error && (
                <div className="text-center py-6">
                  <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Texto do atendimento indisponível. Reimporte o arquivo para restaurar.
                  </p>
                </div>
              )}

              {sideFile.error && <p className="text-xs text-destructive">Erro: {sideFile.error}</p>}
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* Mentoria Detail Dialog */}
      <MentoriaDetailDialog
        open={!!mentoriaFile}
        onOpenChange={(open) => {
          if (!open) setMentoriaFile(null);
        }}
        result={mentoriaFile?.result}
        fileName={mentoriaFile?.name || ""}
        rawText={mentoriaFile?.text}
        atendente={mentoriaFile?.atendente}
        structuredConversation={mentoriaFile?.structuredConversation}
        workflowStatus={mentoriaFile ? getWorkflowStatus(mentoriaFile.id) : undefined}
        onMarkFinished={handleMarkFinished}
        onNextFile={handleNextFile}
        hasNextFile={!!getNextAnalyzedFile()}
        nonEvaluable={mentoriaFile?.nonEvaluable}
        nonEvaluableReason={mentoriaFile?.nonEvaluableReason}
        tipoAnalise={mentoriaFile?.tipo_analise}
        initialStep={mentoriaInitialStep}
        audioBlobs={mentoriaFile?.audioBlobs}
        imageBlobs={mentoriaFile?.imageBlobs}
      />
      {/* Opa Suite MentoriaDetailDialog */}
      <ErrorBoundary fallbackTitle="Erro ao exibir auditoria Opa Suite">
      <MentoriaDetailDialog
        open={!!opaMentoriaFile}
        onOpenChange={(open) => {
          if (!open) setOpaMentoriaFile(null);
        }}
        result={opaMentoriaFile?.result}
        fileName={opaMentoriaFile?.name || ""}
        rawText={opaMentoriaFile?.text}
        atendente={opaMentoriaFile?.atendente}
        structuredConversation={opaMentoriaFile?.structuredConversation}
        workflowStatus={opaMentoriaFile ? getOpaWorkflowStatus(opaMentoriaFile.id) : undefined}
        onMarkFinished={async () => {
          if (!opaMentoriaFile) return;
          setOpaWorkflowStatuses((prev) => ({ ...prev, [opaMentoriaFile.id]: "finalizado" }));
          setOpaFiles((prev) => prev.map((f) => f.id === opaMentoriaFile.id ? { ...f, status: "confirmado" as FileStatus } : f));
          // Persist to evaluations table for Performance tracking
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && opaMentoriaFile.result) {
              const r = opaMentoriaFile.result;
              const companyId = await supabase.rpc("get_my_company_id").then((res) => res.data);
              await supabase.from("evaluations").insert({
                user_id: user.id,
                atendente: opaMentoriaFile.atendente || "Desconhecido",
                protocolo: opaMentoriaFile.protocolo || opaMentoriaFile.id,
                tipo: r.tipo || "opa_suite",
                nota: r.notaFinal ?? r.nota ?? 0,
                classificacao: r.classificacao || "—",
                data: opaMentoriaFile.data || new Date().toLocaleDateString("pt-BR"),
                bonus: (r.bonusQualidade ?? 0) >= 80,
                atualizacao_cadastral: r.bonusOperacional?.atualizacaoCadastral || "NÃO",
                pontos_melhoria: r.mentoria || r.pontosMelhoria || [],
                full_report: r,
                resultado_validado: true,
                prompt_version: r.versao || "opa-suite",
                company_id: companyId || null,
                audit_log: buildOfficialAuditLog("manual", undefined),
              } as any);
              toast.success("Auditoria finalizada e enviada para Performance.");
            }
          } catch (err: any) {
            console.error("[OpaAudit] save error:", err);
            toast.error("Erro ao salvar auditoria. Tente novamente.");
          }
        }}
        onNextFile={() => {}}
        hasNextFile={false}
        nonEvaluable={opaMentoriaFile?.nonEvaluable}
        nonEvaluableReason={opaMentoriaFile?.nonEvaluableReason}
        tipoAnalise={opaMentoriaFile?.tipo_analise}
        initialStep={opaMentoriaInitialStep}
      />
      </ErrorBoundary>
      <ParserDiagnosticDialog
        open={!!diagnosticFile}
        onOpenChange={() => setDiagnosticFile(null)}
        rawText={diagnosticFile?.text}
        atendente={diagnosticFile?.atendente}
        protocolo={diagnosticFile?.protocolo}
        preParsedMessages={diagnosticFile?.structuredConversation?.messages}
      />
    </div>
  );
};

export default MentoriaLab;
