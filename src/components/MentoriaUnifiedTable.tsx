import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye, ShieldCheck, Bug, Trash2, Loader2, PlayCircle, CheckCircle2,
  AlertTriangle, BookOpen, Zap, Clock, MoreHorizontal,
} from "lucide-react";
import { cn, formatDateBR, notaToScale10 } from "@/lib/utils";
import {
  resolvePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
} from "@/lib/mentoriaEvaluability";
import type { WorkflowStatus } from "@/components/MentoriaDetailDialog";

type StatusFilter = "todos" | "pendentes" | "em_analise" | "finalizados" | "nao_avaliaveis" | "aptos_ia" | "audio";

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
  onAnalyzeSelected?: (ids: string[]) => void;
}

const STATUS_FILTERS: { key: StatusFilter; label: string; color?: string; tooltip: string }[] = [
  { key: "todos", label: "Todos", tooltip: "Exibe todos os atendimentos importados no lote atual" },
  { key: "pendentes", label: "Pendentes", tooltip: "Atendimentos aguardando análise da IA" },
  { key: "aptos_ia", label: "⚡ Aptos IA", color: "indigo", tooltip: "PDFs válidos prontos para análise automática. Clique em Analisar para processar" },
  { key: "em_analise", label: "Em análise", tooltip: "Atendimentos sendo processados pela IA no momento" },
  { key: "nao_avaliaveis", label: "Não avaliáveis", tooltip: "PDFs sem conteúdo válido para auditoria (áudio, sem interação, duplicados)" },
  { key: "audio", label: "🎙️ Áudio", color: "amber", tooltip: "Atendimentos com áudio — auditoria não realizada por conteúdo de voz" },
];

const getDaysPending = (addedAt?: Date): number => {
  if (!addedAt) return 0;
  const now = new Date();
  return Math.floor((now.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24));
};

// Status dot colors
const statusDot = (category: string, isProcessing: boolean) => {
  if (isProcessing) return "bg-primary animate-pulse";
  switch (category) {
    case "finalizados": return "bg-accent";
    case "em_analise": return "bg-blue-500";
    case "nao_avaliaveis": return "bg-warning";
    default: return "bg-muted-foreground/40";
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
}: MentoriaUnifiedTableProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isBusy = processing || batchProcessing;

  const categorized = useMemo(() => {
    return files.map((f) => {
      const ws = getWorkflowStatus(f.id);
      const ev = resolvePersistedMentoriaEvaluability(f.result);
      const isNonEval = ev?.nonEvaluable === true;
      const hasResult = f.status === "analisado" && f.result;
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
      if (isNonEval) category = "nao_avaliaveis";
      else if (ws === "finalizado" || hasResult) category = "finalizados";
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
      finalizados: categorized.filter((f) => f.category === "finalizados").length,
      nao_avaliaveis: 0,
      aptos_ia: 0,
      audio: 0,
    };
    for (const f of visibleItems) {
      if (f.category === "pendentes") counts.pendentes++;
      else if (f.category === "em_analise") counts.em_analise++;
      else if (f.category === "nao_avaliaveis") counts.nao_avaliaveis++;
      if (f.isAutoEligible) counts.aptos_ia++;
      if (f.isAudio) counts.audio++;
    }
    return counts;
  }, [visibleItems, categorized]);

  const eligibleIds = useMemo(() => {
    return new Set(filtered.filter((f) => f.isAutoEligible).map((f) => f.id));
  }, [filtered]);

  const allEligibleSelected = eligibleIds.size > 0 && [...eligibleIds].every((id) => selectedIds.has(id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        eligibleIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        eligibleIds.forEach((id) => next.delete(id));
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

  const selectedCount = [...selectedIds].filter((id) => eligibleIds.has(id) || categorized.some((f) => f.id === id && f.isAutoEligible)).length;

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
                          : "bg-primary text-primary-foreground shadow-sm"
                      : sf.color === "indigo"
                        ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40"
                        : sf.color === "amber"
                          ? "text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40"
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
                      <span className="inline-flex">
                        <Checkbox
                          checked={allEligibleSelected}
                          onCheckedChange={(checked) => handleSelectAll(!!checked)}
                          aria-label="Selecionar todos elegíveis"
                          className={cn(eligibleIds.size === 0 && "opacity-30 pointer-events-none")}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Selecionar todos os atendimentos da página</p></TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="w-[30%] text-xs font-bold uppercase tracking-wide">
                  <Tooltip><TooltipTrigger asChild><span className="cursor-default">Atendente</span></TooltipTrigger><TooltipContent side="bottom"><p>Nome do atendente e protocolo do atendimento</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="w-[12%] text-xs font-bold uppercase tracking-wide">
                  <Tooltip><TooltipTrigger asChild><span className="cursor-default">Data</span></TooltipTrigger><TooltipContent side="bottom"><p>Data de realização do atendimento</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="w-[15%] text-xs font-bold uppercase tracking-wide">
                  <Tooltip><TooltipTrigger asChild><span className="cursor-default">Status</span></TooltipTrigger><TooltipContent side="bottom"><p>Situação atual da análise (Pendente, Analisado, Em análise, Não avaliável)</p></TooltipContent></Tooltip>
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
                const canStartAnalysis = !processing && !batchProcessing && !isReading && f.status !== "erro" && !f.isNonEval && !f.hasResult;
                const isEligible = eligibleIds.has(f.id);

                return (
                  <TableRow
                    key={f.id}
                    className={cn(
                      "group transition-colors",
                      highlightedFileId === f.id && "bg-primary/5",
                      f.approvedAsOfficial && "border-l-[3px] border-l-accent",
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell className="py-3 text-center w-10">
                      {isEligible ? (
                        <Checkbox
                          checked={selectedIds.has(f.id)}
                          onCheckedChange={(checked) => handleToggle(f.id, !!checked)}
                          aria-label={`Selecionar ${f.atendente || f.name}`}
                        />
                      ) : null}
                    </TableCell>

                    {/* Atendente + protocolo */}
                    <TableCell className="py-3 w-[30%]">
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {f.atendente || <span className="italic text-muted-foreground">Não identificado</span>}
                        </p>
                        {f.protocolo && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{f.protocolo}</p>
                        )}
                      </div>
                    </TableCell>

                    {/* Data */}
                    <TableCell className="py-3 w-[12%]">
                      <p className="text-xs text-foreground">{f.data ? formatDateBR(f.data) : "—"}</p>
                    </TableCell>

                    {/* Status dot + label */}
                    <TableCell className="py-3 w-[15%]">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusDot(f.category, isProcessingThis))} />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {f.isNonEval ? "N/A" : isProcessingThis ? "Processando" : f.hasResult ? "Analisado" : f.category === "em_analise" ? "Em análise" : "Pendente"}
                        </span>
                        {isOverdue && (
                          <Badge className="bg-destructive/15 text-destructive text-[8px] px-1 py-0 h-auto gap-0.5">
                            <Clock className="h-2 w-2" />{daysPending}d
                          </Badge>
                        )}
                        {f.approvedAsOfficial && (
                          <ShieldCheck className="h-3 w-3 text-accent" />
                        )}
                      </div>
                    </TableCell>

                    {/* Nota */}
                    <TableCell className="py-3 w-[10%] text-center">
                      {nota10 != null ? (
                        <span className={cn(
                          "text-sm font-bold",
                          nota10 >= 9 ? "text-accent" : nota10 >= 7 ? "text-primary" : nota10 >= 5 ? "text-warning" : "text-destructive"
                        )}>
                          {nota10.toFixed(1).replace(".", ",")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Ação — main button + overflow menu */}
                    <TableCell className="py-3 w-[20%] text-right">
                      <div className="flex items-center justify-end gap-1 flex-nowrap">
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
                                <DropdownMenuItem onClick={() => onOpenFile(f)}>
                                  <Eye className="h-3.5 w-3.5 mr-2" /> Preview
                                </DropdownMenuItem>
                              </TooltipTrigger>
                              <TooltipContent side="left"><p>Pré-visualizar o PDF do atendimento</p></TooltipContent>
                            </Tooltip>
                            {f.hasResult && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem onClick={() => onOpenMentoria(f)}>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-border/30 bg-[#1a1a2e] px-5 py-3 shadow-xl">
          <span className="text-sm font-medium text-white">
            {selectedCount} selecionado(s)
          </span>
          <Button
            size="sm"
            className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => {
              const ids = [...selectedIds].filter((id) =>
                categorized.some((f) => f.id === id && f.isAutoEligible)
              );
              if (onAnalyzeSelected) {
                onAnalyzeSelected(ids);
              } else if (onBatchAnalyze) {
                onBatchAnalyze(ids.length);
              }
              setSelectedIds(new Set());
            }}
            disabled={isBusy}
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            ⚡ Analisar selecionados ({selectedCount})
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => setSelectedIds(new Set())}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
};

export default MentoriaUnifiedTable;
