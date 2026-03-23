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
} from "lucide-react";
import { cn, formatDateBR, notaToScale10 } from "@/lib/utils";
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
  evaluationId?: string;
  analyzedAt?: Date;
  transferred?: boolean;
  attendantMatch?: any;
}

interface MentoriaPipelineProps {
  files: PipelineFile[];
  getWorkflowStatus: (id: string) => WorkflowStatus;
  highlightedFileId: string | null;
  readingIds: Set<string>;
  approvingIds: Set<string>;
  processing: boolean;
  isAdmin: boolean;
  onOpenFile: (f: PipelineFile) => void;
  onOpenMentoria: (f: PipelineFile) => void;
  onStartMentoria: (f: PipelineFile) => void;
  onApproveOfficial: (f: PipelineFile) => void;
  onRemoveFile: (id: string) => void;
  onOpenDiagnostic: (f: PipelineFile) => void;
  onAnalyzeNext?: () => void;
}

const COLUMNS: { key: WorkflowStatus; label: string; icon: typeof Clock; emptyText: string }[] = [
  { key: "nao_iniciado", label: "Não iniciados", icon: Clock, emptyText: "Nenhum atendimento pendente" },
  { key: "em_analise", label: "Em análise", icon: PlayCircle, emptyText: "Nenhum atendimento em andamento" },
  { key: "finalizado", label: "Finalizados", icon: CheckCircle2, emptyText: "Nenhum atendimento finalizado" },
];

const columnStyles: Record<WorkflowStatus, { header: string; border: string; bg: string; badge: string; countBg: string }> = {
  nao_iniciado: {
    header: "text-muted-foreground",
    border: "border-border/60",
    bg: "bg-muted/20",
    badge: "bg-muted text-muted-foreground",
    countBg: "bg-muted/60 text-muted-foreground",
  },
  em_analise: {
    header: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/5",
    badge: "bg-primary/15 text-primary",
    countBg: "bg-primary/15 text-primary",
  },
  finalizado: {
    header: "text-accent",
    border: "border-accent/30",
    bg: "bg-accent/5",
    badge: "bg-accent/15 text-accent",
    countBg: "bg-accent/15 text-accent",
  },
};

const AttendanceCard = ({
  file,
  highlighted,
  readingIds,
  approvingIds,
  processing,
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
  readingIds: Set<string>;
  approvingIds: Set<string>;
  processing: boolean;
  isAdmin: boolean;
  onOpenFile: (f: PipelineFile) => void;
  onOpenMentoria: (f: PipelineFile) => void;
  onStartMentoria: (f: PipelineFile) => void;
  onApproveOfficial: (f: PipelineFile) => void;
  onRemoveFile: (id: string) => void;
  onOpenDiagnostic: (f: PipelineFile) => void;
}) => {
  const hasResult = file.status === "analisado" && file.result;
  const nota = hasResult ? file.result?.notaFinal : null;
  const nota10 = nota != null ? notaToScale10(nota) : null;
  const isReading = readingIds.has(file.id);
  const canStartMentoria = !processing && !isReading && file.status !== "erro";
  const primaryLabel = isReading ? "Lendo atendimento..." : processing ? "Processando..." : hasResult ? "Abrir mentoria" : "Iniciar mentoria";

  const handleCardClick = () => {
    if (hasResult) {
      onOpenMentoria(file);
    } else if (canStartMentoria) {
      onStartMentoria(file);
    }
  };

  const handleStartMentoria = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!canStartMentoria) return;
    if (hasResult) {
      onOpenMentoria(file);
      return;
    }
    onStartMentoria(file);
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

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-all group",
        canStartMentoria || hasResult ? "cursor-pointer" : "",
        highlighted
          ? "ring-2 ring-primary/30 border-primary/40 bg-primary/5 shadow-sm"
          : "bg-background border-border/60",
        "hover:shadow-sm",
        file.approvedAsOfficial && "border-l-[3px] border-l-accent"
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
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
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2.5">
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

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {file.approvedAsOfficial && (
          <Badge className="bg-accent/15 text-accent text-[9px] gap-0.5 px-1.5 py-0 h-auto">
            <ShieldCheck className="h-2.5 w-2.5" /> Oficial
          </Badge>
        )}
        {file.ineligible && (
          <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 h-auto">
            {file.ineligibleReason || "Fora de avaliação"}
          </Badge>
        )}
        {file.transferred && (
          <Badge className="bg-primary/15 text-primary text-[9px] px-1 py-0 h-auto">Transferido</Badge>
        )}
        {hasResult && !file.ineligible && nota10 != null && nota10 < 7 && (
          <Badge className="bg-warning/15 text-warning text-[9px] px-1.5 py-0 h-auto">Necessita mentoria</Badge>
        )}
        {file.result?.classificacao && !file.ineligible && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-auto font-semibold">
            {file.result.classificacao}
          </Badge>
        )}
      </div>

      <Button
        size="sm"
        className="w-full gap-1.5 mb-2.5 font-semibold"
        onClick={handleStartMentoria}
        disabled={!canStartMentoria}
      >
        {isReading || processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
        {primaryLabel}
      </Button>

      <div className="flex items-center gap-1 pt-2 border-t border-border/40 opacity-80 group-hover:opacity-100 transition-opacity">
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

        {hasResult && !file.ineligible && !file.approvedAsOfficial && file.evaluationId && (
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
  isAdmin,
  onOpenFile,
  onOpenMentoria,
  onStartMentoria,
  onApproveOfficial,
  onRemoveFile,
  onOpenDiagnostic,
  onAnalyzeNext,
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
    return groups;
  }, [files, getWorkflowStatus]);

  const hasNextToAnalyze = grouped.nao_iniciado.some((f) => f.status === "analisado" && f.result);

  return (
    <div className="space-y-3" id="mentoria-table">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = grouped[col.key];
          const style = columnStyles[col.key];
          const Icon = col.icon;

          return (
            <div key={col.key} className={cn("rounded-2xl border p-4 flex flex-col", style.border, style.bg)}>
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

              <div className="flex-1 overflow-y-auto min-h-0 max-h-[calc(100vh-480px)] pr-1 space-y-2.5 scrollbar-thin">
                {items.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground/60 italic">{col.emptyText}</p>
                  </div>
                )}
                {items.map((f) => (
                  <AttendanceCard
                    key={f.id}
                    file={f}
                    highlighted={highlightedFileId === f.id}
                    readingIds={readingIds}
                    approvingIds={approvingIds}
                    processing={processing}
                    isAdmin={isAdmin}
                    onOpenFile={onOpenFile}
                    onOpenMentoria={onOpenMentoria}
                    onStartMentoria={onStartMentoria}
                    onApproveOfficial={onApproveOfficial}
                    onRemoveFile={onRemoveFile}
                    onOpenDiagnostic={onOpenDiagnostic}
                  />
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
