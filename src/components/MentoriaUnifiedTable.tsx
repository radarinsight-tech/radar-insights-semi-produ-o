import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  ShieldCheck,
  Bug,
  Trash2,
  Loader2,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Zap,
  Clock,
  UserCheck,
} from "lucide-react";
import { cn, formatDateBR, notaToScale10 } from "@/lib/utils";
import {
  resolvePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
} from "@/lib/mentoriaEvaluability";
import type { WorkflowStatus } from "@/components/MentoriaDetailDialog";

type StatusFilter = "todos" | "pendentes" | "em_analise" | "finalizados" | "nao_avaliaveis";

interface UnifiedFile {
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
}

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendentes", label: "Pendentes" },
  { key: "em_analise", label: "Em análise" },
  { key: "finalizados", label: "Finalizados" },
  { key: "nao_avaliaveis", label: "Não avaliáveis" },
];

const getDaysPending = (addedAt?: Date): number => {
  if (!addedAt) return 0;
  const now = new Date();
  const diff = now.getTime() - addedAt.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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
}: MentoriaUnifiedTableProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const isBusy = processing || batchProcessing;

  const categorized = useMemo(() => {
    return files.map((f) => {
      const ws = getWorkflowStatus(f.id);
      const ev = resolvePersistedMentoriaEvaluability(f.result);
      const isNonEval = ev?.nonEvaluable === true;
      const hasResult = f.status === "analisado" && f.result;
      const isAutoEligible = !isNonEval && (f.status === "lido" || f.status === "pendente") && !hasResult;

      let category: StatusFilter;
      if (isNonEval) category = "nao_avaliaveis";
      else if (ws === "finalizado" || hasResult) category = "finalizados";
      else if (ws === "em_analise") category = "em_analise";
      else category = "pendentes";

      return { ...f, category, isNonEval, hasResult, isAutoEligible, workflowStatus: ws };
    });
  }, [files, getWorkflowStatus]);

  const filtered = useMemo(() => {
    if (statusFilter === "todos") return categorized;
    return categorized.filter((f) => f.category === statusFilter);
  }, [categorized, statusFilter]);

  const filterCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      todos: categorized.length,
      pendentes: 0,
      em_analise: 0,
      finalizados: 0,
      nao_avaliaveis: 0,
    };
    for (const f of categorized) {
      counts[f.category]++;
    }
    return counts;
  }, [categorized]);

  const eligibleForBatch = useMemo(() => {
    return categorized.filter((f) => f.isAutoEligible).length;
  }, [categorized]);

  return (
    <div className="space-y-3" id="mentoria-table">
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

      {/* Batch action bar */}
      {eligibleForBatch > 0 && onBatchAnalyze && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {eligibleForBatch} atendimento(s) prontos para análise automática
            </span>
          </div>
          <div className="flex items-center gap-2">
            {eligibleForBatch >= 1 && (
              <Button size="sm" variant="outline" className="gap-1.5 font-semibold" onClick={() => onBatchAnalyze(10)} disabled={isBusy}>
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                Próximos 10
              </Button>
            )}
            <Button size="sm" className="gap-1.5 font-semibold" onClick={() => onBatchAnalyze("all")} disabled={isBusy}>
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Analisar todos ({eligibleForBatch})
            </Button>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 border border-border/40">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf.key}
            onClick={() => setStatusFilter(sf.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              statusFilter === sf.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
            )}
          >
            {sf.label}
            <span className="ml-1.5 opacity-70">({filterCounts[sf.key]})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhum atendimento nesta categoria.
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-bold uppercase tracking-wide">Atendente</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wide">Data</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wide">Tipo</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wide text-center">Aptos IA</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wide">Nota</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wide text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => {
                const daysPending = !f.hasResult ? getDaysPending(f.addedAt) : 0;
                const isOverdue = daysPending >= 7;
                const nota = f.hasResult ? f.result?.notaFinal : null;
                const nota10 = nota != null ? notaToScale10(nota) : null;
                const isReading = readingIds.has(f.id);
                const isProcessingThis = (processing || batchProcessing) && f.workflowStatus === "em_analise" && !f.hasResult;
                const canStartAnalysis = !processing && !batchProcessing && !isReading && f.status !== "erro" && !f.isNonEval && !f.hasResult;
                const ineligibility = resolvePersistedMentoriaIneligibility(f.result);

                return (
                  <TableRow
                    key={f.id}
                    className={cn(
                      "group transition-colors",
                      highlightedFileId === f.id && "bg-primary/5",
                      f.approvedAsOfficial && "border-l-[3px] border-l-accent",
                    )}
                  >
                    {/* Atendente */}
                    <TableCell className="py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate max-w-[180px]">
                          {f.atendente || <span className="italic text-muted-foreground">Não identificado</span>}
                        </p>
                        {f.protocolo && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{f.protocolo}</p>
                        )}
                      </div>
                    </TableCell>

                    {/* Data */}
                    <TableCell className="py-3">
                      <div>
                        <p className="text-xs text-foreground">{f.data ? formatDateBR(f.data) : "—"}</p>
                        {f.canal && <p className="text-[10px] text-muted-foreground">{f.canal}</p>}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {f.isNonEval && (
                          <Badge className="bg-warning/15 text-warning text-[9px] gap-0.5 px-1.5 py-0 h-auto border border-warning/30">
                            <AlertTriangle className="h-2.5 w-2.5" /> Não avaliável
                          </Badge>
                        )}
                        {f.hasResult && (
                          <Badge className="bg-accent/15 text-accent text-[9px] gap-0.5 px-1.5 py-0 h-auto">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Analisado
                          </Badge>
                        )}
                        {f.approvedAsOfficial && (
                          <Badge className="bg-accent/15 text-accent text-[9px] gap-0.5 px-1.5 py-0 h-auto">
                            <ShieldCheck className="h-2.5 w-2.5" /> Oficial
                          </Badge>
                        )}
                        {isProcessingThis && (
                          <Badge className="bg-primary/15 text-primary text-[9px] gap-0.5 px-1.5 py-0 h-auto animate-pulse">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processando
                          </Badge>
                        )}
                        {f.status === "erro" && (
                          <Badge className="bg-destructive/15 text-destructive text-[9px] gap-0.5 px-1.5 py-0 h-auto">
                            <AlertTriangle className="h-2.5 w-2.5" /> Erro
                          </Badge>
                        )}
                        {!f.hasResult && !f.isNonEval && !isProcessingThis && f.status !== "erro" && (
                          <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 h-auto">
                            Pendente
                          </Badge>
                        )}
                        {/* Pending days badge */}
                        {!f.hasResult && !f.isNonEval && daysPending > 0 && (
                          <Badge
                            className={cn(
                              "text-[9px] gap-0.5 px-1.5 py-0 h-auto",
                              isOverdue
                                ? "bg-destructive/15 text-destructive border border-destructive/30"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            {daysPending}d
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Tipo */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1">
                        {f.isAutoEligible ? (
                          <Badge className="bg-primary/10 text-primary text-[9px] px-1.5 py-0 h-auto gap-0.5">
                            <Zap className="h-2.5 w-2.5" /> Auto IA
                          </Badge>
                        ) : f.hasResult ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-auto">
                            {f.result?.classificacao || "—"}
                          </Badge>
                        ) : f.isNonEval ? (
                          <span className="text-[10px] text-muted-foreground">
                            {ineligibility?.reason || "N/A"}
                          </span>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 h-auto gap-0.5">
                            <UserCheck className="h-2.5 w-2.5" /> Manual
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Aptos IA */}
                    <TableCell className="py-3 text-center">
                      {f.isAutoEligible ? (
                        <Zap className="h-4 w-4 text-accent inline-block" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Nota */}
                    <TableCell className="py-3">
                      {nota10 != null ? (
                        <span
                          className={cn(
                            "text-sm font-bold",
                            nota10 >= 9
                              ? "text-accent"
                              : nota10 >= 7
                                ? "text-primary"
                                : nota10 >= 5
                                  ? "text-warning"
                                  : "text-destructive"
                          )}
                        >
                          {nota10.toFixed(1).replace(".", ",")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Ação */}
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Main action button */}
                        {!f.isNonEval && !f.hasResult && (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 gap-1 text-xs font-semibold"
                            onClick={() => onStartMentoria(f)}
                            disabled={!canStartAnalysis}
                          >
                            {isReading || isProcessingThis ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlayCircle className="h-3 w-3" />
                            )}
                            Analisar
                          </Button>
                        )}
                        {f.hasResult && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 gap-1 text-xs font-semibold border-accent/30 text-accent hover:bg-accent/10"
                            onClick={() => onOpenMentoria(f)}
                          >
                            <BookOpen className="h-3 w-3" />
                            Ver
                          </Button>
                        )}

                        {/* Utility icons */}
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenFile(f)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">Preview</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {f.hasResult && !f.approvedAsOfficial && f.evaluationId && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 text-accent border-accent/30 hover:bg-accent/10"
                                  onClick={() => onApproveOfficial(f)}
                                  disabled={approvingIds.has(f.id)}
                                >
                                  {approvingIds.has(f.id) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Aprovar como Oficial</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {isAdmin && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onOpenDiagnostic(f)}>
                                  <Bug className="h-3.5 w-3.5" />
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
                                className="h-7 w-7 text-destructive/70 hover:text-destructive"
                                onClick={() => onRemoveFile(f.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">Remover</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MentoriaUnifiedTable;
