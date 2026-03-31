import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye, ShieldCheck, Bug, Trash2, Loader2, PlayCircle, CheckCircle2,
  AlertTriangle, BookOpen, Zap, Clock, MoreHorizontal, Search,
  XCircle, Check,
} from "lucide-react";
import { cn, formatDateBR, notaToScale10 } from "@/lib/utils";
import {
  resolvePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
} from "@/lib/mentoriaEvaluability";
import type { WorkflowStatus } from "@/components/MentoriaDetailDialog";

type StatusFilter =
  | "todos"
  | "pendentes"
  | "em_analise"
  | "finalizados"
  | "nao_avaliaveis"
  | "aptos_ia"
  | "audio"
  | "imagem"
  | "aguardando_confirmacao"
  | "confirmados";

interface UnifiedFile {
  id: string;
  name: string;
  atendente?: string;
  protocolo?: string;
  data?: string;
  canal?: string;
  hasAudio?: boolean;
  hasImage?: boolean;
  status: string;
  result?: any;
  error?: string;
  ineligible?: boolean;
  ineligibleReason?: string;
  nonEvaluable?: boolean;
  nonEvaluableReason?: string;
  approvedAsOfficial?: boolean;
  approvalOrigin?: "manual" | "automatic";
  evaluationId?: string;
  analyzedAt?: Date;
  addedAt?: Date;
  transferred?: boolean;
  attendantMatch?: any;
  tipo_analise?: string | null;
  batchFileId?: string;
  batchCode?: string;
  visualizado?: boolean;
}

interface BatchStats {
  analyzing: number;
  completed: number;
  failed: number;
}

interface MentoriaUnifiedTableProps {
  files: UnifiedFile[];
  getWorkflowStatus: (id: string) => WorkflowStatus;
  highlightedFileId: string | null;
  readingIds: Set<string>;
  approvingIds: Set<string>;
  processing: boolean;
  batchProcessing: boolean;
  batchStats: BatchStats;
  isAdmin: boolean;
  onOpenFile: (f: UnifiedFile) => void;
  onOpenMentoria: (f: UnifiedFile) => void;
  onStartMentoria: (f: UnifiedFile) => void;
  onApproveOfficial: (f: UnifiedFile) => void;
  onRemoveFile: (id: string) => void;
  onOpenDiagnostic: (f: UnifiedFile) => void;
  onAnalyzeNext?: () => void;
  onBatchAnalyze?: (count: number | "all") => void;
  onAnalyzeSelected?: (ids: string[], tipoAnalise: 'ia' | 'manual') => void;
  onDeleteSelected?: (ids: string[]) => void;
  onConfirmSelected?: (ids: string[]) => void;
  onRejectSelected?: (ids: string[]) => void;
  onMarkViewed?: (id: string) => void;
  onAuditFile?: (f: UnifiedFile) => void;
  monthlyConfirmCounts?: Map<string, number>;
}

const STATUS_FILTERS: { key: StatusFilter; label: string; color?: string; tooltip: string }[] = [
  { key: "todos", label: "Todos", tooltip: "Exibe todos os atendimentos importados no lote atual" },
  { key: "pendentes", label: "Pendentes", tooltip: "Atendimentos aguardando análise da IA" },
  { key: "aptos_ia", label: "⚡ Aptos IA", color: "indigo", tooltip: "PDFs válidos prontos para análise automática. Clique em Analisar para processar" },
  { key: "em_analise", label: "Em análise", tooltip: "Atendimentos sendo processados pela IA no momento" },
  { key: "aguardando_confirmacao", label: "⏳ Aguardando confirmação", color: "blue", tooltip: "Analisados pela IA aguardando confirmação ou auditoria do gestor" },
  { key: "confirmados", label: "✅ Confirmados", color: "teal", tooltip: "Atendimentos confirmados pelo gestor — disponíveis na aba Performance" },
  { key: "nao_avaliaveis", label: "Não avaliáveis", tooltip: "PDFs sem conteúdo válido para auditoria (áudio, sem interação, duplicados)" },
  { key: "audio", label: "🎙️ Áudio", color: "amber", tooltip: "Atendimentos com áudio embutido. O áudio é transcrito automaticamente antes da análise." },
  { key: "imagem", label: "📷 Imagem", color: "purple", tooltip: "Atendimentos com imagem anexada" },
];

const getDaysPending = (addedAt?: Date): number => {
  if (!addedAt) return 0;
  const now = new Date();
  return Math.floor((now.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24));
};

// Status dot colors
const statusDot = (status: string, isProcessing: boolean) => {
  if (isProcessing) return "bg-primary animate-pulse";
  switch (status) {
    case "confirmado": return "bg-emerald-700";
    case "aguardando_revisao_ia": return "bg-blue-500";
    case "aguardando_revisao_manual": return "bg-emerald-500";
    case "reprovado": return "bg-destructive";
    case "finalizados": return "bg-accent";
    case "em_analise": return "bg-blue-500";
    case "nao_avaliaveis": return "bg-warning";
    default: return "bg-muted-foreground/40";
  }
};

// Status badge renderer
const renderStatusBadge = (status: string) => {
  switch (status) {
    case "aguardando_revisao_ia":
      return <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-400 text-[8px] px-1.5 py-0 h-auto border-0">🔵 Fila IA</Badge>;
    case "aguardando_revisao_manual":
      return <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[8px] px-1.5 py-0 h-auto border-0">🟢 Fila Manual</Badge>;
    case "confirmado":
      return <Badge className="bg-emerald-800/15 text-emerald-800 dark:text-emerald-300 text-[8px] px-1.5 py-0 h-auto border-0">✅ Confirmado</Badge>;
    case "reprovado":
      return <Badge className="bg-destructive/15 text-destructive text-[8px] px-1.5 py-0 h-auto border-0">❌ Reprovado</Badge>;
    default:
      return null;
  }
};

const MentoriaUnifiedTable = ({
  files,
  getWorkflowStatus,
  highlightedFileId,
  readingIds,
  approvingIds,
  processing,
  batchProcessing,
  batchStats,
  isAdmin,
  onOpenFile,
  onOpenMentoria,
  onStartMentoria,
  onApproveOfficial,
  onRemoveFile,
  onOpenDiagnostic,
  onBatchAnalyze,
  onAnalyzeSelected,
  onDeleteSelected,
  onConfirmSelected,
  onRejectSelected,
  onMarkViewed,
  onAuditFile,
  monthlyConfirmCounts,
}: MentoriaUnifiedTableProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);

  const isBusy = processing || batchProcessing;

  const categorized = useMemo(() => {
    return files.map((f) => {
      const ws = getWorkflowStatus(f.id);
      const ev = resolvePersistedMentoriaEvaluability(f.result);
      const isNonEval = ev?.nonEvaluable === true;
      const hasResult = (f.status === "analisado" || f.status === "aguardando_revisao_ia" || f.status === "aguardando_revisao_manual" || f.status === "confirmado") && f.result;
      const isAutoEligible = !isNonEval && (f.status === "lido" || f.status === "pendente") && !hasResult;

      // Detect audio-only attendance
      const isAudio = Boolean(f.hasAudio) && (() => {
        const reason = String(f.nonEvaluableReason || f.ineligibleReason || f.result?.motivo_nao_avaliavel || f.result?.motivo_inelegivel || f.result?._nonEvaluableReason || f.result?._ineligibleReason || "").toLowerCase();
        if (reason.includes("áudio") || reason.includes("audio") || reason.includes("gravacao") || reason.includes("gravação")) return true;
        if (hasResult && f.result?.notaFinal === 0) return true;
        const statusResult = String(f.result?.status_auditoria || f.result?.statusAuditoria || "").toLowerCase();
        if (statusResult.includes("não realizada") || statusResult.includes("nao_auditavel")) return true;
        return false;
      })();

      let category: StatusFilter;
      if (f.status === "aguardando_revisao_ia" || f.status === "aguardando_revisao_manual") category = "aguardando_confirmacao";
      else if (f.status === "confirmado") category = "confirmados";
      else if (isNonEval) category = "nao_avaliaveis";
      else if (ws === "finalizado" || (f.status === "analisado" && f.result)) category = "aguardando_confirmacao";
      else if (ws === "em_analise") category = "em_analise";
      else category = "pendentes";

      return { ...f, category, isNonEval, hasResult, isAutoEligible, isAudio, workflowStatus: ws };
    });
  }, [files, getWorkflowStatus]);

  const [showAll, setShowAll] = useState(false);
  const INITIAL_VISIBLE = 10;

  const visibleItems = useMemo(() => {
    return categorized;
  }, [categorized]);

  const filtered = useMemo(() => {
    if (statusFilter === "todos") return visibleItems;
    if (statusFilter === "aptos_ia") return visibleItems.filter((f) => f.isAutoEligible);
    if (statusFilter === "audio") return visibleItems.filter((f) => f.isAudio);
    if (statusFilter === "aguardando_confirmacao") return visibleItems.filter((f) => f.category === "aguardando_confirmacao");
    if (statusFilter === "confirmados") return visibleItems.filter((f) => f.status === "confirmado");
    return visibleItems.filter((f) => f.category === statusFilter);
  }, [visibleItems, statusFilter]);

  const displayedItems = useMemo(() => {
    if (showAll) return filtered;
    return filtered.slice(0, INITIAL_VISIBLE);
  }, [filtered, showAll]);

  const filterCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      todos: visibleItems.length,
      pendentes: 0,
      em_analise: 0,
      finalizados: 0,
      nao_avaliaveis: 0,
      aptos_ia: 0,
      audio: 0,
      aguardando_confirmacao: 0,
      confirmados: 0,
    };
    for (const f of visibleItems) {
      if (f.category === "pendentes") counts.pendentes++;
      else if (f.category === "em_analise") counts.em_analise++;
      else if (f.category === "nao_avaliaveis") counts.nao_avaliaveis++;
      else if (f.category === "aguardando_confirmacao") counts.aguardando_confirmacao++;
      else if (f.category === "confirmados") counts.confirmados++;
      if (f.isAutoEligible) counts.aptos_ia++;
      if (f.isAudio) counts.audio++;
    }
    return counts;
  }, [visibleItems, categorized]);

  const eligibleIds = useMemo(() => {
    return new Set(filtered.filter((f) => f.isAutoEligible).map((f) => f.id));
  }, [filtered]);

  const allVisibleIds = useMemo(() => new Set(displayedItems.map((f) => f.id)), [displayedItems]);
  const allVisibleSelected = allVisibleIds.size > 0 && [...allVisibleIds].every((id) => selectedIds.has(id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const handleToggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;
  const isReviewTab = statusFilter === "aguardando_confirmacao";

  return (
    <div className="space-y-3" id="mentoria-table">
      {/* Batch progress */}
      {batchProcessing && (
        <div className="flex items-center gap-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5">
          <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
          <span className="text-sm font-medium text-foreground">Processamento em lote</span>
          <div className="flex items-center gap-3 ml-auto text-xs font-semibold">
            <span className="text-primary">
              <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
              {batchStats.analyzing} em análise
            </span>
            <span className="text-accent">
              <CheckCircle2 className="h-3 w-3 inline mr-1" />
              {batchStats.completed} concluído(s)
            </span>
            {batchStats.failed > 0 && (
              <span className="text-destructive">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                {batchStats.failed} falha(s)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Status filter chips */}
      <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 border border-border/40 flex-wrap">
        {STATUS_FILTERS.map((sf) => {
          const count = filterCounts[sf.key];
          return (
            <Tooltip key={sf.key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setStatusFilter(sf.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    statusFilter === sf.key
                      ? sf.color === "indigo"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : sf.color === "amber"
                          ? "bg-amber-500 text-white shadow-sm"
                          : sf.color === "blue"
                            ? "bg-blue-600 text-white shadow-sm"
                            : sf.color === "emerald"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : sf.color === "teal"
                                ? "bg-teal-700 text-white shadow-sm"
                                : "bg-primary text-primary-foreground shadow-sm"
                      : sf.color === "indigo"
                        ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40"
                        : sf.color === "amber"
                          ? "text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                          : sf.color === "blue"
                            ? "text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40"
                            : sf.color === "emerald"
                              ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                              : sf.color === "teal"
                                ? "text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-950/40"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  )}
                >
                  {sf.label}
                  <span className="ml-1.5 opacity-70">({count})</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px] text-center">
                <p>{sf.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      </TooltipProvider>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhum atendimento nesta categoria.
        </div>
      ) : (
        <TooltipProvider delayDuration={300}>
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="max-h-[380px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1.5 cursor-pointer" onClick={() => handleSelectAll(!allVisibleSelected)}>
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={(checked) => handleSelectAll(!!checked)}
                          aria-label={allVisibleSelected ? "Desmarcar todos" : "Selecionar todos"}
                          className={cn(allVisibleIds.size === 0 && "opacity-30 pointer-events-none")}
                        />
                        <span className="text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                          {allVisibleSelected ? "Desmarcar todos" : "Selecionar todos"}
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>{allVisibleSelected ? "Desmarcar todos os atendimentos visíveis" : "Selecionar todos os atendimentos visíveis"}</p></TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="w-[30%] text-xs font-bold uppercase tracking-wide">
                  <Tooltip><TooltipTrigger asChild><span className="cursor-default">Atendente</span></TooltipTrigger><TooltipContent side="bottom"><p>Nome do atendente e protocolo do atendimento</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="w-[12%] text-xs font-bold uppercase tracking-wide">
                  <Tooltip><TooltipTrigger asChild><span className="cursor-default">Data</span></TooltipTrigger><TooltipContent side="bottom"><p>Data de realização do atendimento</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="w-[15%] text-xs font-bold uppercase tracking-wide">
                  <Tooltip><TooltipTrigger asChild><span className="cursor-default">Status</span></TooltipTrigger><TooltipContent side="bottom"><p>Situação atual da análise</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="w-[10%] text-xs font-bold uppercase tracking-wide text-center">
                  <Tooltip><TooltipTrigger asChild><span className="cursor-default">Nota</span></TooltipTrigger><TooltipContent side="bottom"><p>Nota final atribuída pela IA após análise</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="w-[20%] text-xs font-bold uppercase tracking-wide text-right">
                  <Tooltip><TooltipTrigger asChild><span className="cursor-default">Ação</span></TooltipTrigger><TooltipContent side="bottom"><p>Ações disponíveis para este atendimento</p></TooltipContent></Tooltip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedItems.map((f) => {
                const daysPending = !f.hasResult ? getDaysPending(f.addedAt) : 0;
                const isOverdue = daysPending >= 7;
                const nota = f.hasResult ? f.result?.notaFinal : null;
                const nota10 = nota != null ? notaToScale10(nota) : null;
                const isReading = readingIds.has(f.id);
                const isProcessingThis = (processing || batchProcessing) && f.workflowStatus === "em_analise" && !f.hasResult;
                const isInReviewQueue = f.status === "aguardando_revisao_ia" || f.status === "aguardando_revisao_manual";

                // Status label
                const getStatusLabel = () => {
                  if (f.isNonEval) return "N/A";
                  if (isProcessingThis) return "Processando";
                  switch (f.status) {
                    case "aguardando_revisao_ia":
                    case "aguardando_revisao_manual":
                    case "analisado":
                      return f.hasResult ? "Aguardando confirmação" : "Analisado";
                    case "confirmado": return "Confirmado";
                    case "reprovado": return "Reprovado";
                    default:
                      if (f.hasResult) return "Aguardando confirmação";
                      if (f.category === "em_analise") return "Em análise";
                      return "Pendente";
                  }
                };

                return (
                  <TableRow
                    key={f.id}
                    className={cn(
                      "group transition-colors",
                      highlightedFileId === f.id && "bg-primary/5",
                      f.approvedAsOfficial && "border-l-[3px] border-l-accent",
                    )}
                  >
                    {/* Checkbox + read indicator */}
                    <TableCell className="py-3 text-center w-10">
                      <div className="flex items-center justify-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              (f.visualizado || f.hasResult || f.status === "analisado" || f.status === "confirmado" || f.status === "aguardando_revisao_ia" || f.status === "aguardando_revisao_manual")
                                ? "bg-emerald-500"
                                : "bg-red-500"
                            )} />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{(f.visualizado || f.hasResult || f.status === "analisado" || f.status === "confirmado" || f.status === "aguardando_revisao_ia" || f.status === "aguardando_revisao_manual")
                              ? "Visualizado — PDF já foi revisado"
                              : "Não visualizado — PDF ainda não foi aberto"}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Checkbox
                          checked={selectedIds.has(f.id)}
                          onCheckedChange={(checked) => handleToggle(f.id, !!checked)}
                          aria-label={`Selecionar ${f.atendente || f.name}`}
                        />
                      </div>
                    </TableCell>

                    {/* Atendente + protocolo + lote badge */}
                    <TableCell className="py-3 w-[30%]">
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {f.atendente || (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="italic text-muted-foreground cursor-help">Não identificado</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[280px]">
                                <p>O nome do atendente não foi encontrado neste PDF. Verifique se o arquivo está correto.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </p>
                        {f.protocolo && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{f.protocolo}</p>
                        )}
                        {f.batchCode && (
                          <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 h-auto border-0 mt-0.5">
                            lote-{f.batchCode.split("-").pop()}
                          </Badge>
                        )}
                        {/* Monthly audit counter */}
                        {f.atendente && monthlyConfirmCounts && (() => {
                          const count = monthlyConfirmCounts.get(f.atendente.trim().toLowerCase()) || 0;
                          if (count >= 6) return (
                            <Badge className="bg-destructive/15 text-destructive text-[9px] px-1.5 py-0 h-auto border-0 mt-0.5">6/6 limite atingido</Badge>
                          );
                          if (count > 0) return (
                            <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-400 text-[9px] px-1.5 py-0 h-auto border-0 mt-0.5">{count}/6 este mês</Badge>
                          );
                          return null;
                        })()}
                      </div>
                    </TableCell>

                    {/* Data */}
                    <TableCell className="py-3 w-[12%]">
                      <p className="text-xs text-foreground">{f.data ? formatDateBR(f.data) : "—"}</p>
                    </TableCell>

                    {/* Status dot + label + badges */}
                    <TableCell className="py-3 w-[15%]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusDot(f.status, isProcessingThis))} />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {getStatusLabel()}
                        </span>
                        {isOverdue && !isInReviewQueue && (
                          <Badge className="bg-destructive/15 text-destructive text-[8px] px-1 py-0 h-auto gap-0.5">
                            <Clock className="h-2 w-2" />{daysPending}d
                          </Badge>
                        )}
                        {f.approvedAsOfficial && (
                          <ShieldCheck className="h-3 w-3 text-accent" />
                        )}
                        {renderStatusBadge(f.status)}
                        {f.tipo_analise === 'ia' && f.status !== "aguardando_revisao_ia" && (
                          <Badge className="bg-purple-600/15 text-purple-700 dark:text-purple-400 text-[8px] px-1.5 py-0 h-auto border-0">⚡ IA</Badge>
                        )}
                        {f.tipo_analise === 'manual' && f.status !== "aguardando_revisao_manual" && (
                          <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[8px] px-1.5 py-0 h-auto border-0">🔍 Manual</Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Nota + (Não Oficial) badge */}
                    <TableCell className="py-3 w-[10%] text-center">
                      {nota10 != null ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={cn(
                            "text-sm font-bold",
                            nota10 >= 9 ? "text-accent" : nota10 >= 7 ? "text-primary" : nota10 >= 5 ? "text-warning" : "text-destructive"
                          )}>
                            {nota10.toFixed(1).replace(".", ",")}
                          </span>
                          {f.status !== "confirmado" && f.hasResult && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[7px] px-1 py-0 h-auto border-0">Não Oficial</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Ação — Confirm/Audit for analyzed items, menu for all */}
                    <TableCell className="py-3 w-[20%] text-right">
                      <div className="flex items-center justify-end gap-1 flex-nowrap">
                        {/* Confirm + Audit buttons for items with results that are not yet confirmed */}
                        {f.hasResult && f.status !== "confirmado" && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  className="h-7 px-2.5 gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    if (onConfirmSelected) onConfirmSelected([f.id]);
                                  }}
                                >
                                  <Check className="h-3 w-3" /> Confirmar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p>Confirmar nota como oficial e enviar para Performance</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 gap-1 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    onMarkViewed?.(f.id);
                                    if (onAuditFile) onAuditFile(f);
                                  }}
                                >
                                  <Search className="h-3 w-3" /> Auditar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p>Revisar os 19 critérios antes de confirmar</p></TooltipContent>
                            </Tooltip>
                          </>
                        )}

                        {/* View result button for confirmed items */}
                        {f.hasResult && f.status === "confirmado" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 gap-1 text-xs font-semibold border-accent/30 text-accent hover:bg-accent/10"
                            onClick={() => { onMarkViewed?.(f.id); onOpenMentoria(f); }}
                          >
                            <BookOpen className="h-3 w-3" />
                            Ver
                          </Button>
                        )}

                        {/* Overflow menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuItem onClick={() => { onMarkViewed?.(f.id); onOpenFile(f); }}>
                                  <Eye className="h-3.5 w-3.5 mr-2" /> Preview
                                </DropdownMenuItem>
                              </TooltipTrigger>
                              <TooltipContent side="left"><p>Pré-visualizar o PDF do atendimento</p></TooltipContent>
                            </Tooltip>
                            {f.hasResult && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem onClick={() => { onMarkViewed?.(f.id); onOpenMentoria(f); }}>
                                    <BookOpen className="h-3.5 w-3.5 mr-2" /> Ver
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left"><p>Visualizar o resultado completo da análise</p></TooltipContent>
                              </Tooltip>
                            )}
                            {f.hasResult && !f.approvedAsOfficial && f.evaluationId && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem
                                    onClick={() => onApproveOfficial(f)}
                                    disabled={approvingIds.has(f.id)}
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Aprovar Oficial
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left"><p>Aprovar esta análise como avaliação oficial — aparecerá no módulo Avaliação Oficial</p></TooltipContent>
                              </Tooltip>
                            )}
                            {isAdmin && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem onClick={() => onOpenDiagnostic(f)}>
                                    <Bug className="h-3.5 w-3.5 mr-2" /> Diagnóstico
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left"><p>Ver diagnóstico técnico do parser — útil para identificar problemas na leitura do PDF</p></TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => onRemoveFile(f.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                                </DropdownMenuItem>
                              </TooltipTrigger>
                              <TooltipContent side="left"><p>Remover este atendimento do lote atual (não exclui da base)</p></TooltipContent>
                            </Tooltip>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>

          {/* Expand / collapse footer */}
          {filtered.length > INITIAL_VISIBLE && (
            <div className="border-t border-border/40 text-center py-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-primary"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "▲ Recolher" : `▼ Ver todos os ${filtered.length} atendimentos`}
              </Button>
            </div>
          )}
        </div>
        </TooltipProvider>
      )}

      {/* Floating action bar */}
      {selectedCount > 0 && (
        <TooltipProvider delayDuration={300}>
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-border/30 bg-[#1a1a2e] px-5 py-3 shadow-xl">
          <span className="text-sm font-medium text-white">
            {selectedCount} selecionado(s)
          </span>

          {/* Review tabs: Confirm + Reject buttons */}
          {isReviewTab && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      if (onConfirmSelected) onConfirmSelected([...selectedIds]);
                      setSelectedIds(new Set());
                    }}
                    disabled={isBusy}
                  >
                    <Check className="h-3.5 w-3.5" />
                    ✅ Confirmar selecionados ({selectedCount})
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Confirmar análises selecionadas e enviar para Performance</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 font-medium bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
                    onClick={() => {
                      setRejectTargetIds([...selectedIds]);
                      setShowRejectConfirm(true);
                    }}
                    disabled={isBusy}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    ❌ Reprovar selecionados ({selectedCount})
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Reprovar análises selecionadas — voltarão para Pendentes</p></TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Non-review tabs: Analyze + Delete buttons */}
          {!isReviewTab && (
            <>
              {/* Button 1: Analisar com IA */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => {
                      const ids = [...selectedIds].filter((id) =>
                        categorized.some((f) => f.id === id && f.isAutoEligible)
                      );
                      if (onAnalyzeSelected) {
                        onAnalyzeSelected(ids, 'ia');
                      } else if (onBatchAnalyze) {
                        onBatchAnalyze(ids.length);
                      }
                      setSelectedIds(new Set());
                    }}
                    disabled={isBusy}
                  >
                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    ⚡ Analisar com IA ({selectedCount})
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Análise automática via IA — mais rápida, sem intervenção manual</p></TooltipContent>
              </Tooltip>


              {/* Button 3: Excluir */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 font-medium bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isBusy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    🗑 Excluir ({selectedCount})
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Excluir os atendimentos selecionados permanentemente</p></TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Cancel button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="bg-destructive/20 border-destructive/40 text-white hover:bg-destructive/30 font-medium"
                onClick={() => setShowCancelConfirm(true)}
              >
                ✕ Cancelar
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Cancela a seleção atual de atendimentos</p></TooltipContent>
          </Tooltip>

          {/* Cancel selection dialog */}
          <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar seleção</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja cancelar a seleção?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Não, manter</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setSelectedIds(new Set());
                    setShowCancelConfirm(false);
                  }}
                >
                  Sim, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete confirmation dialog */}
          <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir atendimentos</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir {selectedCount} atendimento(s)? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (onDeleteSelected) {
                      onDeleteSelected([...selectedIds]);
                    }
                    setSelectedIds(new Set());
                    setShowDeleteConfirm(false);
                  }}
                >
                  Sim, excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reject confirmation dialog */}
          <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reprovar atendimento(s)</AlertDialogTitle>
                <AlertDialogDescription>
                  Reprovar {rejectTargetIds.length} atendimento(s)? Eles voltarão para Pendentes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (onRejectSelected) onRejectSelected(rejectTargetIds);
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      rejectTargetIds.forEach((id) => next.delete(id));
                      return next;
                    });
                    setRejectTargetIds([]);
                    setShowRejectConfirm(false);
                  }}
                >
                  Sim, reprovar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        </TooltipProvider>
      )}
    </div>
  );
};

export default MentoriaUnifiedTable;
