import { useMemo, type MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Eye,
  ShieldCheck,
  Bug,
  Trash2,
  Loader2,
  Clock,
  PlayCircle,
  CheckCircle2,
  User,
  Calendar,
  SkipForward,
  AlertTriangle,
  BookOpen,
  Zap,
} from "lucide-react";
import { cn, formatDateBR, notaToScale10 } from "@/lib/utils";
import {
  resolvePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
} from "@/lib/mentoriaEvaluability";
import type { WorkflowStatus } from "@/components/MentoriaDetailDialog";

interface PipelineFile {
  id: string;
  name: string;
  atendente?: string;
  protocolo?: string;
  data?: string;
  canal?: string;
  hasAudio?: boolean;
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
}

interface BatchStats {
  analyzing: number;
  completed: number;
  failed: number;
}

interface MentoriaPipelineProps {
  files: PipelineFile[];
  getWorkflowStatus: (id: string) => WorkflowStatus;
  highlightedFileId: string | null;
  readingIds: Set<string>;
  approvingIds: Set<string>;
  processing: boolean;
  batchProcessing: boolean;
  batchStats: BatchStats;
  isAdmin: boolean;
  onOpenFile: (f: PipelineFile) => void;
  onOpenMentoria: (f: PipelineFile) => void;
  onStartMentoria: (f: PipelineFile) => void;
  onApproveOfficial: (f: PipelineFile) => void;
  onRemoveFile: (id: string) => void;
  onOpenDiagnostic: (f: PipelineFile) => void;
  onAnalyzeNext?: () => void;
  onBatchAnalyze?: (count: number | "all") => void;
}

const COLUMNS: { key: WorkflowStatus; label: string; icon: typeof Clock; emptyText: string }[] = [
  { key: "nao_iniciado", label: "Não iniciados", icon: Clock, emptyText: "Nenhum atendimento pendente" },
  { key: "em_analise", label: "Em análise", icon: PlayCircle, emptyText: "Nenhum atendimento em andamento" },
  { key: "finalizado", label: "Finalizados", icon: CheckCircle2, emptyText: "Nenhum atendimento finalizado" },
];

const columnStyles: Record<WorkflowStatus, { header: string; border: string; bg: string; badge: string; countBg: string }> = {
  nao_iniciado: {
    header: "text-muted-foreground",
    border: "border-border/40",
    bg: "bg-muted/60",
    badge: "bg-muted text-muted-foreground",
    countBg: "bg-muted/60 text-muted-foreground",
  },
  em_analise: {
    header: "text-primary",
    border: "border-border/40",
    bg: "bg-muted/60",
    badge: "bg-primary/15 text-primary",
    countBg: "bg-primary/15 text-primary",
  },
  finalizado: {
    header: "text-accent",
    border: "border-border/40",
    bg: "bg-muted/60",
    badge: "bg-accent/15 text-accent",
    countBg: "bg-accent/15 text-accent",
  },
};

const AttendanceCard = ({
  file,
  highlighted,
  workflowStatus,
  readingIds,
  approvingIds,
  processing,
  batchProcessing,
  isAdmin,
  onOpenFile,
  onOpenMentoria,
  onStartMentoria,
  onApproveOfficial,
  onRemoveFile,
  onOpenDiagnostic,
}: {
  file: PipelineFile;
  highlighted: boolean;
  workflowStatus: WorkflowStatus;
  readingIds: Set<string>;
  approvingIds: Set<string>;
  processing: boolean;
  batchProcessing: boolean;
  isAdmin: boolean;
  onOpenFile: (f: PipelineFile) => void;
  onOpenMentoria: (f: PipelineFile) => void;
  onStartMentoria: (f: PipelineFile) => void;
  onApproveOfficial: (f: PipelineFile) => void;
  onRemoveFile: (id: string) => void;
  onOpenDiagnostic: (f: PipelineFile) => void;
}) => {
  const persistedEvaluability = resolvePersistedMentoriaEvaluability(file.result);
  const persistedIneligibility = resolvePersistedMentoriaIneligibility(file.result);
  const isNonEvaluable = persistedEvaluability?.nonEvaluable === true;
  const isIneligible = persistedIneligibility?.ineligible === true;
  const ineligibleReason = persistedIneligibility?.reason;
  const hasResult = file.status === "analisado" && file.result;
  const nota = hasResult ? file.result?.notaFinal : null;
  const nota10 = nota != null ? notaToScale10(nota) : null;
  const isReading = readingIds.has(file.id);
  const isProcessingThis = (processing || batchProcessing) && workflowStatus === "em_analise" && !hasResult;
  const canStartAnalysis = !processing && !batchProcessing && !isReading && file.status !== "erro" && !isNonEvaluable && !hasResult;

  const handleStartAnalysis = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!canStartAnalysis) return;
    onStartMentoria(file);
  };

  const handleOpenMentoria = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpenMentoria(file);
  };

  const handlePreviewClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpenFile(file);
  };

  const handleApproveClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onApproveOfficial(file);
  };

  const handleDiagnosticClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpenDiagnostic(file);
  };

  const handleRemoveClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRemoveFile(file.id);
  };

  const handleCardClick = () => {
    if (hasResult) {
      onOpenMentoria(file);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-all group",
        hasResult ? "cursor-pointer" : "",
        highlighted
          ? "ring-2 ring-primary/30 border-primary/40 bg-primary/5 shadow-md"
          : "bg-white border-border/60 shadow-md",
        "hover:shadow-sm",
        file.approvedAsOfficial && "border-l-[3px] border-l-accent"
      )}
      onClick={handleCardClick}
    >
      <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mt-0.5">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <p className="text-sm font-semibold text-foreground truncate">
              {file.atendente || <span className="italic text-muted-foreground">Não identificado</span>}
            </p>
          </div>
          {file.protocolo && (
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate ml-[18px]">
              {file.protocolo}
            </p>
          )}
        </div>

        {nota10 != null && (
          <div
            className={cn(
              "shrink-0 text-center px-2 py-1 rounded-lg border",
              nota10 >= 9
                ? "bg-accent/10 border-accent/20 text-accent"
                : nota10 >= 7
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : nota10 >= 5
                    ? "bg-warning/10 border-warning/20 text-warning"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
            )}
          >
            <p className="text-lg font-black leading-none">{nota10.toFixed(1).replace(".", ",")}</p>
            <p className="text-[8px] font-medium mt-0.5">nota</p>
          </div>
        )}

        {isProcessingThis && (
          <Badge className="bg-primary/15 text-primary text-[9px] gap-0.5 px-1.5 py-0 h-auto animate-pulse">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processando
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {file.data && (
          <span className="flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {formatDateBR(file.data)}
          </span>
        )}
        {file.canal && <span className="truncate">{file.canal}</span>}
        {file.hasAudio && (
          <Badge className="bg-accent/15 text-accent text-[9px] px-1 py-0 h-auto">Áudio</Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {isNonEvaluable && (
          <Badge className="bg-warning/15 text-warning text-[9px] gap-0.5 px-1.5 py-0 h-auto border border-warning/30">
            <AlertTriangle className="h-2.5 w-2.5" /> Não avaliável
          </Badge>
        )}
        {file.approvedAsOfficial && (
          <Badge className="bg-accent/15 text-accent text-[9px] gap-0.5 px-1.5 py-0 h-auto">
            <ShieldCheck className="h-2.5 w-2.5" /> {file.approvalOrigin === "automatic" ? "Oficial (Auto)" : "Oficial (Manual)"}
          </Badge>
        )}
        {isIneligible && (
          <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 h-auto">
            {ineligibleReason || "Fora de avaliação"}
          </Badge>
        )}
        {file.transferred && (
          <Badge className="bg-primary/15 text-primary text-[9px] px-1 py-0 h-auto">Transferido</Badge>
        )}
        {hasResult && !isIneligible && !isNonEvaluable && nota10 != null && nota10 < 7 && (
          <Badge className="bg-warning/15 text-warning text-[9px] px-1.5 py-0 h-auto">Necessita mentoria</Badge>
        )}
        {file.result?.classificacao && !isIneligible && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-auto font-semibold">
            {file.result.classificacao}
          </Badge>
        )}
        {file.status === "erro" && (
          <Badge className="bg-destructive/15 text-destructive text-[9px] gap-0.5 px-1.5 py-0 h-auto">
            <AlertTriangle className="h-2.5 w-2.5" /> Erro
          </Badge>
        )}
        {hasResult && (
          <Badge className="bg-accent/15 text-accent text-[9px] gap-0.5 px-1.5 py-0 h-auto">
            <CheckCircle2 className="h-2.5 w-2.5" /> Analisado
          </Badge>
        )}
      </div>

      {/* Action buttons — separated: Iniciar análise vs Abrir mentoria */}
      <div className="flex items-center gap-1.5">
        {!isNonEvaluable && !hasResult && (
          <Button
            size="sm"
            className="w-full gap-2 font-semibold justify-center"
            onClick={handleStartAnalysis}
            disabled={!canStartAnalysis}
          >
            {isReading || isProcessingThis ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            {isReading ? "Lendo..." : isProcessingThis ? "Processando..." : "Iniciar análise"}
          </Button>
        )}
        {hasResult && (
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 font-semibold justify-center border-accent/30 text-accent hover:bg-accent/10"
            onClick={handleOpenMentoria}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Abrir mentoria
          </Button>
        )}
      </div>

      </div>{/* end p-4 space-y-3 */}

      <div className="flex items-center gap-1 px-4 py-2 border-t border-border/40 opacity-80 group-hover:opacity-100 transition-opacity bg-muted/30">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                 onClick={handlePreviewClick}
              >
                <Eye className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Visualizar preview</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {hasResult && !isIneligible && !file.approvedAsOfficial && file.evaluationId && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 text-accent border-accent/30 hover:bg-accent/10"
                   onClick={handleApproveClick}
                  disabled={approvingIds.has(file.id)}
                >
                  {approvingIds.has(file.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Aprovar como Oficial</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="ml-auto flex items-center gap-1">
          {isAdmin && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                     onClick={handleDiagnosticClick}
                  >
                    <Bug className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Diagnóstico</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive/70 hover:text-destructive"
                   onClick={handleRemoveClick}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Remover</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

const MentoriaPipeline = ({
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
  onAnalyzeNext,
  onBatchAnalyze,
}: MentoriaPipelineProps) => {
  const grouped = useMemo(() => {
    const groups: Record<WorkflowStatus, PipelineFile[]> = {
      nao_iniciado: [],
      em_analise: [],
      finalizado: [],
    };
    for (const f of files) {
      const ws = getWorkflowStatus(f.id);
      groups[ws].push(f);
    }
    // Sort "nao_iniciado" by newest first (most recently added on top)
    groups.nao_iniciado.sort((a, b) => {
      const dateA = a.addedAt instanceof Date ? a.addedAt.getTime() : 0;
      const dateB = b.addedAt instanceof Date ? b.addedAt.getTime() : 0;
      return dateB - dateA;
    });
    return groups;
  }, [files, getWorkflowStatus]);

  const hasNextToAnalyze = grouped.nao_iniciado.some((f) => f.status === "analisado" && f.result);

  // Count eligible files for batch buttons
  const eligibleForBatch = useMemo(() => {
    return grouped.nao_iniciado.filter(f => {
      const evaluability = resolvePersistedMentoriaEvaluability(f.result);
      return !evaluability?.nonEvaluable && (f.status === "lido" || f.status === "pendente");
    }).length;
  }, [grouped.nao_iniciado]);

  const isBusy = processing || batchProcessing;

  return (
    <div className="space-y-3" id="mentoria-table">
      {/* Batch action bar */}
      {eligibleForBatch > 0 && onBatchAnalyze && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {eligibleForBatch} atendimento(s) prontos para análise
              </span>
            </div>
          </div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">Ações de Análise Automática (IA)</p>
          <div className="flex items-center gap-2 flex-wrap">
            {eligibleForBatch >= 1 && (
              <Button size="sm" variant="outline" className="gap-1.5 font-semibold" onClick={() => onBatchAnalyze(10)} disabled={isBusy}>
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                Analisar próximos 10
              </Button>
            )}
            {eligibleForBatch > 10 && (
              <Button size="sm" variant="outline" className="gap-1.5 font-semibold" onClick={() => onBatchAnalyze(25)} disabled={isBusy}>
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                Analisar próximos 25
              </Button>
            )}
            <Button size="sm" className="gap-1.5 font-semibold" onClick={() => onBatchAnalyze("all")} disabled={isBusy}>
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Analisar todos ({eligibleForBatch})
            </Button>
          </div>
        </div>
      )}

      {/* Batch progress counters */}
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

      {hasNextToAnalyze && onAnalyzeNext && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <SkipForward className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {grouped.nao_iniciado.filter((f) => f.status === "analisado" && f.result).length} atendimento(s) aguardando revisão
            </span>
          </div>
          <Button size="sm" className="gap-1.5 font-semibold" onClick={onAnalyzeNext}>
            <SkipForward className="h-3.5 w-3.5" />
            Analisar próximo
          </Button>
        </div>
      )}

      {/* Non-evaluable counter */}
      {(() => {
        const nonEvaluableCount = files.filter((file) => {
          const persistedEvaluability = resolvePersistedMentoriaEvaluability(file.result);
          return persistedEvaluability?.nonEvaluable === true;
        }).length;
        return nonEvaluableCount > 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-warning/25 bg-warning/5 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-sm text-foreground">
              <strong className="font-semibold">{nonEvaluableCount}</strong>
              <span className="text-muted-foreground ml-1">
                {nonEvaluableCount === 1 ? "atendimento não avaliável" : "atendimentos não avaliáveis"}
                {" "}— não entram em médias ou indicadores
              </span>
            </span>
          </div>
        ) : null;
      })()}

      <div className="flex flex-col lg:flex-row gap-4">
        {COLUMNS.map((col) => {
          const items = grouped[col.key];
          const style = columnStyles[col.key];
          const Icon = col.icon;

          return (
            <div key={col.key} className={cn("flex-1 min-w-[280px] rounded-2xl border p-4 flex flex-col", style.border, style.bg)}>
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", style.header)} />
                  <h3 className={cn("text-xs font-extrabold uppercase tracking-[0.1em]", style.header)}>
                    {col.label}
                  </h3>
                </div>
                <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", style.countBg)}>
                  {items.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 max-h-[calc(100vh-480px)] pr-1 scrollbar-thin">
                {items.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground/60 italic">{col.emptyText}</p>
                  </div>
                )}
                {items.map((f, idx) => (
                  <div key={f.id} className={idx > 0 ? "mt-3" : ""}>
                    {idx > 0 && col.key === "nao_iniciado" && (
                      <div className="border-b border-border/50 mb-3" />
                    )}
                  <AttendanceCard
                    key={f.id}
                    file={f}
                    highlighted={highlightedFileId === f.id}
                    workflowStatus={col.key}
                    readingIds={readingIds}
                    approvingIds={approvingIds}
                    processing={processing}
                    batchProcessing={batchProcessing}
                    isAdmin={isAdmin}
                    onOpenFile={onOpenFile}
                    onOpenMentoria={onOpenMentoria}
                    onStartMentoria={onStartMentoria}
                    onApproveOfficial={onApproveOfficial}
                    onRemoveFile={onRemoveFile}
                    onOpenDiagnostic={onOpenDiagnostic}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MentoriaPipeline;
