import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcularBonus, formatBRL, notaToScale10, formatDateBR } from "@/lib/utils";
import type { StructuredConversation } from "@/lib/conversationParser";
import type { ExtractedAudio, ExtractedImage } from "@/lib/pdfMediaExtractor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, XCircle, MinusCircle, ShieldAlert, ShieldCheck,
  MessageSquareQuote, Printer, X, Award, TrendingUp, AlertTriangle, Lightbulb,
  User, Calendar, FileText, Hash, Radio, ChevronRight, List, CheckSquare, Save, Edit3,
  Zap, Check, RotateCcw, Filter, Send, Eye, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import UraContextDialog from "@/components/UraContextDialog";
import CriterionCard, { type CriterionCardData, type CriterionMode, type CriterionDecision, type DecisionStatus } from "@/components/CriterionCard";
import { runPreAnalysis, type PreAnalysisResult, type PreAnalysisSuggestion, type SugestaoResultado, type Confianca } from "@/lib/mentoriaPreAnalysis";
import {
  calculateScore, classify, classificacaoColor, classificacaoBg,
  CRITERIA_WEIGHTS, TOTAL_POSSIBLE,
  type ScoringResult,
} from "@/lib/mentoriaScoring";
import type { UraContext } from "@/lib/uraContextSummarizer";
import { extractUraContext } from "@/lib/conversationParser";

// Re-export for backward compat
export type { CriterionDecision, DecisionStatus } from "@/components/CriterionCard";

export interface SemiAutoResult {
  decisions: CriterionDecision[];
  score: ScoringResult;
  confirmed: boolean;
}

export type WorkflowStatus = "nao_iniciado" | "em_analise" | "finalizado";
export type DetailDialogMode = "report" | "review";

interface MentoriaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: any;
  fileName: string;
  rawText?: string;
  atendente?: string;
  structuredConversation?: StructuredConversation;
  workflowStatus?: WorkflowStatus;
  onMarkFinished?: () => void;
  onNextFile?: () => void;
  hasNextFile?: boolean;
  nonEvaluable?: boolean;
  nonEvaluableReason?: string;
  tipoAnalise?: string | null;
  initialStep?: "revisao" | "relatorio";
  audioBlobs?: ExtractedAudio[];
  imageBlobs?: ExtractedImage[];
  mode?: DetailDialogMode;
  fileId?: string;
  onSemiAutoSaved?: (mergedResult: Record<string, unknown>) => void;
}

const CATEGORY_ORDER = [
  "Postura e Comunicação",
  "Entendimento e Condução",
  "Solução e Confirmação",
  "Encerramento e Valor",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Postura e Comunicação": "💬",
  "Entendimento e Condução": "🎯",
  "Solução e Confirmação": "✅",
  "Encerramento e Valor": "⭐",
};

const classColor = (c: string) => {
  if (c === "Excelente" || c === "Muito bom") return "bg-accent text-accent-foreground";
  if (c === "Bom atendimento") return "bg-primary text-primary-foreground";
  if (c === "Necessita mentoria" || c === "Abaixo do esperado") return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
};

const notaColor = (nota: number | null | undefined) => {
  if (nota == null) return "text-muted-foreground";
  const n10 = notaToScale10(nota);
  if (n10 >= 9) return "text-accent";
  if (n10 >= 7) return "text-primary";
  if (n10 >= 5) return "text-warning";
  return "text-destructive";
};

const findRelevantExcerpt = (rawText: string | undefined, explicacao: string): string | null => {
  if (!rawText || !explicacao) return null;
  const quoteMatch = explicacao.match(/[""\u201C\u201D]([^""\u201C\u201D]{10,150})[""\u201C\u201D]|"([^"]{10,150})"/);
  if (quoteMatch) return quoteMatch[1] || quoteMatch[2];
  return null;
};

const createDefaultDecision = (
  item: Pick<CriterionCardData, "numero" | "sugestao" | "confianca">,
): CriterionDecision => ({
  numero: item.numero,
  sugestaoOriginal: item.sugestao,
  decisaoFinal: item.sugestao,
  status: item.confianca === "alta" ? "accepted" : "pending",
  editadoManualmente: false,
  confiancaOriginal: item.confianca,
});

function ensureDecisionState(
  cardItems: CriterionCardData[],
  decisions: Map<number, CriterionDecision>,
): Map<number, CriterionDecision> {
  const normalized = new Map<number, CriterionDecision>();

  for (const item of cardItems) {
    normalized.set(item.numero, decisions.get(item.numero) ?? createDefaultDecision(item));
  }

  return normalized;
}

type FilterMode = "all" | "pending" | "accepted" | "adjusted" | "rejected";

/* ═══ MANUAL REVIEW FALLBACK ═══ */
const CLASSIFICACOES = ["Excelente", "Muito bom", "Bom atendimento", "Necessita mentoria", "Abaixo do esperado"];

interface ManualReviewFallbackProps {
  result: any;
  onSave: (patch: { notaFinal: number; classificacao: string; observacoes: string }) => void;
}

const ManualReviewFallback = ({ result, onSave }: ManualReviewFallbackProps) => {
  const [notaFinal, setNotaFinal] = useState<number>(result?.notaFinal ?? result?.nota ?? 0);
  const [classificacao, setClassificacao] = useState<string>(result?.classificacao ?? "Bom atendimento");
  const [observacoes, setObservacoes] = useState<string>("");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
        <Edit3 className="h-5 w-5 text-primary shrink-0" />
        <div>
          <p className="text-sm font-bold text-foreground">Revisão Manual</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            A pré-análise automática não está disponível. Preencha os campos abaixo.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-foreground uppercase tracking-wider">Nota Final (0–100)</label>
        <Input type="number" min={0} max={100} value={notaFinal} onChange={(e) => setNotaFinal(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="max-w-[160px]" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-foreground uppercase tracking-wider">Classificação</label>
        <Select value={classificacao} onValueChange={setClassificacao}>
          <SelectTrigger className="max-w-[280px]"><SelectValue /></SelectTrigger>
          <SelectContent>{CLASSIFICACOES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-foreground uppercase tracking-wider">Observações</label>
        <Textarea rows={4} placeholder="Descreva pontos de melhoria..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      <Button size="sm" className="gap-1.5 text-xs" onClick={() => onSave({ notaFinal, classificacao, observacoes })}>
        <Save className="h-3.5 w-3.5" /> Salvar Revisão
      </Button>
    </div>
  );
};

/* ═══ MAIN COMPONENT ═══ */
const MentoriaDetailDialog = ({
  open, onOpenChange, result, fileName, rawText, atendente, structuredConversation,
  workflowStatus, onMarkFinished, onNextFile, hasNextFile, nonEvaluable, nonEvaluableReason,
  tipoAnalise, initialStep, audioBlobs, imageBlobs, mode = "review", fileId, onSemiAutoSaved,
}: MentoriaDetailDialogProps) => {
  const isReadonly = mode === "report";
  const isAudit = mode === "review";
  const [uraOpen, setUraOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [localConfirmed, setLocalConfirmed] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const decisionSourceRef = useRef<string | null>(null);

  // Pre-analysis
  const preAnalysis: PreAnalysisResult | null = useMemo(() => {
    const msgs = structuredConversation && Array.isArray(structuredConversation.messages) ? structuredConversation.messages : [];
    if (msgs.length >= 2) {
      try {
        let uraCtx: UraContext | undefined;
        const safeRawText = typeof rawText === "string" ? rawText : "";
        if (safeRawText) { try { uraCtx = extractUraContext(safeRawText, atendente); } catch { /* */ } }
        const fromConversation = runPreAnalysis(structuredConversation, uraCtx);
        if (fromConversation) return fromConversation;
      } catch { /* */ }
    }
    const criteriosArr = result?.criterios;
    if (Array.isArray(criteriosArr) && criteriosArr.length > 0) {
      const suggestions: PreAnalysisSuggestion[] = criteriosArr.map((c: any) => ({
        numero: c.numero,
        nome: c.nome || CRITERIA_WEIGHTS.find(cw => cw.numero === c.numero)?.nome || `Critério ${c.numero}`,
        categoria: c.categoria || CRITERIA_WEIGHTS.find(cw => cw.numero === c.numero)?.categoria || "",
        sugestao: (c.resultado === "SIM" ? "SIM" : c.resultado === "FORA DO ESCOPO" ? "FORA DO ESCOPO" : "NÃO") as SugestaoResultado,
        justificativa: c.explicacao || "",
        evidencia: undefined,
        confianca: "alta" as Confianca,
      }));
      return { suggestions, metadata: { totalMessages: 0, humanMessages: 0, clientMessages: 0, attendantMessages: 0, attendantName: result?.atendente || atendente } } as PreAnalysisResult;
    }
    return null;
  }, [structuredConversation, rawText, atendente, result]);

  // Decisions state (audit mode)
  const [decisions, setDecisions] = useState<Map<number, CriterionDecision>>(new Map());

  // Enriched card data
  const cardItems: CriterionCardData[] = useMemo(() => {
    if (!preAnalysis) return [];
    const iaCriterios: any[] = result?.criterios || [];
    return preAnalysis.suggestions.map(s => {
      const iaCrit = iaCriterios.find((c: any) => c.numero === s.numero);
      return {
        numero: s.numero,
        nome: s.nome,
        categoria: s.categoria,
        justificativa: iaCrit?.explicacao || s.justificativa,
        evidencia: s.evidencia,
        confianca: iaCrit ? "alta" as Confianca : s.confianca,
        sugestao: iaCrit ? (iaCrit.resultado === "SIM" ? "SIM" : iaCrit.resultado === "FORA DO ESCOPO" ? "FORA DO ESCOPO" : "NÃO") as SugestaoResultado : s.sugestao,
        pontosObtidos: iaCrit?.pontosObtidos,
        pesoMaximo: iaCrit?.pesoMaximo,
      };
    });
  }, [preAnalysis, result]);

  const persistedDecisions = useMemo(() => {
    const saved = result?._semiAutoDecisions;
    if (!Array.isArray(saved)) return new Map<number, CriterionDecision>();

    return new Map<number, CriterionDecision>(
      saved
        .filter((decision): decision is CriterionDecision => !!decision && typeof decision.numero === "number")
        .map((decision) => [decision.numero, decision]),
    );
  }, [result]);

  const decisionSourceKey = fileId ?? fileName ?? result?.protocolo ?? "mentoria-detail";
  const isConfirmed = isReadonly || Boolean(result?._semiAutoConfirmed) || localConfirmed;

  const normalizedDecisions = useMemo(() => {
    const sourceDecisions = decisions.size > 0 ? decisions : persistedDecisions;
    return ensureDecisionState(cardItems, sourceDecisions);
  }, [cardItems, decisions, persistedDecisions]);

  useEffect(() => {
    if (!open) {
      decisionSourceRef.current = null;
      setLocalConfirmed(false);
      setDecisions(new Map());
      return;
    }

    if (decisionSourceRef.current !== decisionSourceKey) {
      decisionSourceRef.current = decisionSourceKey;
      setLocalConfirmed(false);
      setDecisions(ensureDecisionState(cardItems, persistedDecisions));
      return;
    }

    setDecisions((prev) => ensureDecisionState(cardItems, prev.size > 0 ? prev : persistedDecisions));
  }, [open, decisionSourceKey, cardItems, persistedDecisions]);

  // Score preview (audit)
  const currentScore = useMemo(() => {
    if (normalizedDecisions.size === 0) return null;
    const respostas = [...normalizedDecisions.values()].map(d => ({ numero: d.numero, resposta: d.decisaoFinal }));
    return calculateScore(respostas);
  }, [normalizedDecisions]);

  // Stats (audit)
  const stats = useMemo(() => {
    const all = [...normalizedDecisions.values()];
    return {
      total: all.length,
      accepted: all.filter(d => d.status === "accepted").length,
      adjusted: all.filter(d => d.status === "adjusted").length,
      rejected: all.filter(d => d.status === "rejected").length,
      pending: all.filter(d => d.status === "pending").length,
      readyToConfirm: all.every(d => d.status !== "pending"),
    };
  }, [normalizedDecisions]);

  // Decision actions
  const updateDecision = useCallback((numero: number, update: Partial<CriterionDecision>) => {
    setDecisions(prev => {
      const next = ensureDecisionState(cardItems, prev.size > 0 ? prev : persistedDecisions);
      const current = next.get(numero);
      if (current) next.set(numero, { ...current, ...update });
      return next;
    });
  }, [cardItems, persistedDecisions]);

  const acceptItem = (numero: number) => {
    const d = normalizedDecisions.get(numero);
    if (!d) return;
    updateDecision(numero, { status: "accepted", decisaoFinal: d.sugestaoOriginal, editadoManualmente: false });
  };

  const rejectItem = (numero: number) => {
    const d = normalizedDecisions.get(numero);
    if (!d) return;
    const opposite: SugestaoResultado = d.sugestaoOriginal === "SIM" ? "NÃO" : "SIM";
    updateDecision(numero, { status: "rejected", decisaoFinal: opposite, editadoManualmente: true });
  };

  const adjustItem = (numero: number, newValue: SugestaoResultado) => {
    updateDecision(numero, { status: "adjusted", decisaoFinal: newValue, editadoManualmente: true });
  };

  const acceptAllHigh = () => {
    setDecisions(prev => {
      const next = ensureDecisionState(cardItems, prev.size > 0 ? prev : persistedDecisions);
      for (const [num, d] of next) {
        if (d.confiancaOriginal === "alta") next.set(num, { ...d, status: "accepted", decisaoFinal: d.sugestaoOriginal, editadoManualmente: false });
      }
      return next;
    });
  };

  const acceptAll = () => {
    setDecisions(prev => {
      const next = ensureDecisionState(cardItems, prev.size > 0 ? prev : persistedDecisions);
      for (const [num, d] of next) next.set(num, { ...d, status: "accepted", decisaoFinal: d.sugestaoOriginal, editadoManualmente: false });
      return next;
    });
  };

  const clearAll = () => {
    setDecisions(prev => {
      const next = ensureDecisionState(cardItems, prev.size > 0 ? prev : persistedDecisions);
      for (const [num, d] of next) next.set(num, { ...d, status: "pending", decisaoFinal: d.sugestaoOriginal, editadoManualmente: false });
      return next;
    });
    setLocalConfirmed(false);
  };

  const handleConfirm = async () => {
    const score = currentScore;
    if (!score) return;
    const semiResult: SemiAutoResult = { decisions: [...normalizedDecisions.values()], score, confirmed: true };
    if (!fileId) { toast.error("ID do arquivo não disponível."); return; }
    try {
      const existingResult = (typeof result === "object" && result) ? result : {};
      const mergedResult = {
        ...existingResult,
        _semiAutoDecisions: semiResult.decisions,
        notaFinal: semiResult.score.nota100,
        pontosObtidos: semiResult.score.pontosObtidos,
        pontosPossiveis: semiResult.score.pontosPossiveis,
        classificacao: semiResult.score.classificacao,
        _semiAutoConfirmed: true,
        _semiAutoConfirmedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("mentoria_batch_files").update({ result: mergedResult } as never).eq("id", fileId);
      if (error) throw error;
      setLocalConfirmed(true);
      toast.success("Avaliação confirmada com sucesso.");
      onSemiAutoSaved?.(mergedResult);
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast.error("Falha ao salvar: " + (err?.message || "erro desconhecido"));
    }
  };

  // Print
  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const content = printRef.current.cloneNode(true) as HTMLElement;
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join("\n");
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Mentoria — ${result?.protocolo || "Atendimento"}</title>${styles}<style>@page{size:A4 portrait;margin:12mm 10mm 14mm 10mm;}html,body{margin:0!important;padding:0!important;width:210mm!important;max-width:210mm!important;overflow-x:hidden!important;font-size:10px!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}.print-wrapper{width:100%!important;max-width:190mm!important;margin:0 auto!important;}.print-wrapper *{max-width:100%!important;overflow-wrap:break-word!important;box-sizing:border-box!important;}[data-radix-scroll-area-viewport]{overflow:visible!important;max-height:none!important;}</style></head><body><div class="print-wrapper"></div></body></html>`);
    const wrapper = printWindow.document.querySelector('.print-wrapper');
    if (wrapper) wrapper.appendChild(printWindow.document.adoptNode(content));
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };
  // Group items for display (must be before early returns)
  const grouped = useMemo(() => {
    let items = cardItems;
    if (isAudit && filterMode !== "all") {
      items = items.filter(i => normalizedDecisions.get(i.numero)?.status === filterMode);
    }
    return CATEGORY_ORDER.map(cat => ({
      categoria: cat,
      items: items.filter(i => i.categoria === cat),
    }));
  }, [cardItems, isAudit, filterMode, normalizedDecisions]);

  if (!result) return null;

  const nota = result.notaFinal ?? result.nota;
  const classificacao = result.classificacao || "—";
  const criterios: any[] = result.criterios || [];
  const mentoriaItems: string[] = result.mentoria || result.pontosMelhoria || [];

  const pontosPositivos = criterios.filter((c: any) => c.resultado === "SIM");
  const pontosMelhoria = criterios.filter((c: any) => c.resultado === "NÃO");
  const melhorAcerto = pontosPositivos.length > 0 ? pontosPositivos.reduce((a: any, b: any) => a.pesoMaximo >= b.pesoMaximo ? a : b) : null;
  const principalMelhoria = pontosMelhoria.length > 0 ? pontosMelhoria.reduce((a: any, b: any) => a.pesoMaximo >= b.pesoMaximo ? a : b) : null;
  const totalObtidos = criterios.reduce((s: number, c: any) => s + (c.pontosObtidos || 0), 0);
  const totalPossiveis = criterios.reduce((s: number, c: any) => s + (c.pesoMaximo || 0), 0);

  const displayNota = isAudit && currentScore ? currentScore.nota100 : nota;
  const displayClassificacao = isAudit && currentScore ? currentScore.classificacao : classificacao;
  const displayObtidos = isAudit && currentScore ? currentScore.pontosObtidos : (result.pontosObtidos ?? totalObtidos);
  const displayPossiveis = isAudit && currentScore ? currentScore.pontosPossiveis : (result.pontosPossiveis ?? totalPossiveis);

  const criterionMode: CriterionMode = isAudit ? "audit" : "readonly";

  // Impeditivo case
  if (result.impeditivo) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Mentoria — Auditoria de Atendimento</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center text-center py-6">
            <ShieldAlert className="h-10 w-10 text-warning mb-3" />
            <p className="font-bold text-foreground">Auditoria não realizada</p>
            <p className="text-sm text-muted-foreground mt-2">{result.motivoImpeditivo || "Impeditivo identificado."}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5"><X className="h-4 w-4" /> Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-y-auto flex flex-col">
        {/* ═══ TOOLBAR ═══ */}
        <DialogHeader className="px-8 py-5 border-b border-border/60 bg-gradient-to-r from-muted/40 to-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xs font-extrabold text-primary uppercase tracking-[0.15em] flex items-center gap-2">
                {isReadonly ? "Relatório de Mentoria" : "Auditoria de Mentoria"}
                {tipoAnalise === 'ia' && (
                  <Badge className="bg-purple-600/15 text-purple-700 dark:text-purple-400 text-[9px] px-2 py-0.5 h-auto border-0 normal-case tracking-normal font-semibold">⚡ Analisado por IA</Badge>
                )}
                {tipoAnalise === 'manual' && (
                  <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[9px] px-2 py-0.5 h-auto border-0 normal-case tracking-normal font-semibold">🔍 Manual</Badge>
                )}
                <Badge variant="outline" className={`text-[9px] px-2 py-0.5 font-bold ${isReadonly ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary border-primary/30"}`}>
                  {isReadonly ? "Somente leitura" : "Editável"}
                </Badge>
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-1 truncate max-w-lg font-medium">{fileName}</p>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setUraOpen(true)} className="gap-1.5 text-xs h-8 font-semibold">
                      <Radio className="h-3.5 w-3.5" /> Contexto URA
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[300px]">Jornada do cliente antes do atendimento humano.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8 font-semibold">
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ═══ NON-EVALUABLE WARNING ═══ */}
        {nonEvaluable && (
          <div className="mx-8 mt-4 mb-0 flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div>
              <p className="text-sm font-bold text-warning">Atendimento sem interação suficiente</p>
              <p className="text-xs text-muted-foreground mt-0.5">{nonEvaluableReason || "Troca de mensagens insuficiente."} A nota <strong>não será considerada</strong> em indicadores.</p>
            </div>
          </div>
        )}

        {/* ═══ SINGLE-SCROLL CONTENT ═══ */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ScrollArea className="h-full">
            <div ref={printRef} className="px-8 py-8 space-y-8">

              {/* ═══ 1. HERO — Nota + Classificação + Bônus ═══ */}
              <div className="rounded-2xl bg-gradient-to-br from-muted/50 via-muted/30 to-background border border-border/60 p-5 shadow-sm">
                <div className="flex items-stretch gap-5">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base font-extrabold text-foreground tracking-tight mb-3">Auditoria de Atendimento</h1>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {[
                        { icon: Hash, label: "Protocolo", value: result.protocolo || "—", mono: true },
                        { icon: User, label: "Atendente", value: result.atendente || atendente || "—" },
                        { icon: Calendar, label: "Data", value: formatDateBR(result.data) },
                        { icon: FileText, label: "Tipo", value: result.tipo || "—" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <item.icon className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] text-muted-foreground uppercase tracking-[0.1em] font-semibold leading-none mb-0.5">{item.label}</p>
                            <p className={`text-[13px] font-bold text-foreground truncate leading-tight ${item.mono ? "font-mono" : ""}`}>{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 w-44 flex flex-col items-center justify-center text-center rounded-2xl bg-background border-2 border-border/80 p-4 shadow-md">
                    <p className="text-[8px] text-muted-foreground uppercase tracking-[0.15em] font-bold mb-1">Nota {isAudit ? "(prévia)" : "Final"}</p>
                    <p className={`text-4xl font-black tracking-tighter leading-none ${notaColor(displayNota)}`}>
                      {displayNota != null ? notaToScale10(displayNota).toFixed(1).replace(".", ",") : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 font-medium tabular-nums">
                      {displayObtidos}/{displayPossiveis} pontos
                    </p>
                    <Badge className={`mt-2 text-[10px] px-2.5 py-0.5 font-bold shadow-sm ${classColor(displayClassificacao)}`}>
                      {displayClassificacao}
                    </Badge>
                    {displayNota != null && (() => {
                      const bonus = calcularBonus(displayNota);
                      return (
                        <div className="mt-2.5 pt-2.5 border-t border-border/60 w-full">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <Award className="h-3 w-3 text-primary" />
                            <p className="text-[8px] text-muted-foreground uppercase tracking-[0.1em] font-bold">Bônus</p>
                          </div>
                          <p className="text-sm font-extrabold text-foreground">{bonus.percentual}%</p>
                          <p className="text-[11px] font-semibold text-primary mt-0.5">{formatBRL(bonus.valor)}</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Bonus operacional */}
              {(result.bonusOperacional?.atualizacaoCadastral || result.atualizacaoCadastral) && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium">Atualização Cadastral: <span className="font-bold text-foreground">{result.bonusOperacional?.atualizacaoCadastral ?? result.atualizacaoCadastral ?? "—"}</span></span>
                  {result.bonusOperacional?.pontosExtras && (
                    <Badge variant="outline" className="ml-auto text-accent border-accent/30 font-bold text-[10px]">+{result.bonusOperacional.pontosExtras} pts</Badge>
                  )}
                </div>
              )}

              {/* ═══ AUDIT CONTROLS (only in audit mode) ═══ */}
              {isAudit && preAnalysis && (
                <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-background border border-primary/20 p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground uppercase tracking-[0.1em]">Painel de Revisão</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Revise e confirme as sugestões da IA critério a critério</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    <div className="text-center p-2 rounded-lg bg-card border">
                      <div className="text-[9px] text-muted-foreground uppercase">Total</div>
                      <div className="text-sm font-bold">{stats.total}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-accent/5 border border-accent/20">
                      <div className="text-[9px] text-accent uppercase">Aceitas</div>
                      <div className="text-sm font-bold text-accent">{stats.accepted}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="text-[9px] text-primary uppercase">Ajustadas</div>
                      <div className="text-sm font-bold text-primary">{stats.adjusted}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="text-[9px] text-destructive uppercase">Rejeitadas</div>
                      <div className="text-sm font-bold text-destructive">{stats.rejected}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-warning/5 border border-warning/20">
                      <div className="text-[9px] text-warning uppercase">Pendentes</div>
                      <div className="text-sm font-bold text-warning">{stats.pending}</div>
                    </div>
                  </div>

                  {/* Score preview bar */}
                  {currentScore && (
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-card border">
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Previsão da Nota</div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-black ${classificacaoColor(currentScore.classificacao)}`}>{currentScore.nota100}</span>
                          <span className="text-xs text-muted-foreground">/100</span>
                          <Badge variant="outline" className={`text-[10px] ml-2 ${classificacaoBg(currentScore.classificacao)} ${classificacaoColor(currentScore.classificacao)}`}>{currentScore.classificacao}</Badge>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Pontos</div>
                        <Progress value={(currentScore.pontosObtidos / currentScore.pontosPossiveis) * 100} className="h-2" />
                        <div className="text-[10px] text-muted-foreground mt-1">{currentScore.pontosObtidos}/{currentScore.pontosPossiveis} pontos</div>
                      </div>
                    </div>
                  )}

                  {/* Global actions */}
                  {!isConfirmed && (
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 font-semibold" onClick={acceptAllHigh}>
                        <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Aceitar confiança alta
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 font-semibold" onClick={acceptAll}>
                        <Check className="h-3.5 w-3.5" /> Aceitar todas
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-8 gap-1.5" onClick={clearAll}>
                        <RotateCcw className="h-3.5 w-3.5" /> Limpar decisões
                      </Button>
                      <div className="ml-auto flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
                          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="pending">Pendentes</SelectItem>
                            <SelectItem value="accepted">Aceitas</SelectItem>
                            <SelectItem value="adjusted">Ajustadas</SelectItem>
                            <SelectItem value="rejected">Rejeitadas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual fallback when no preAnalysis in audit mode */}
              {isAudit && !preAnalysis && (
                <ManualReviewFallback
                  result={result}
                  onSave={(patch) => {
                    console.log("Manual review saved:", patch);
                    toast.success("Revisão manual salva.");
                  }}
                />
              )}

              {/* ═══ 2. CRITÉRIOS — Unified CriterionCard ═══ */}
              {(preAnalysis || criterios.length > 0) && (
                <div>
                  <div className="flex items-center gap-3 pb-4 border-b-2 border-foreground/10 mb-8">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-sm font-extrabold text-foreground uppercase tracking-[0.1em]">Critérios de Avaliação</h2>
                  </div>

                  <div className="space-y-8">
                    {grouped.map(({ categoria, items }) => {
                      if (items.length === 0) return null;
                      const catDecided = isAudit
                        ? items.filter(i => {
                            const decision = normalizedDecisions.get(i.numero);
                            return decision ? decision.status !== "pending" : false;
                          }).length
                        : items.filter(i => i.sugestao === "SIM").length;

                      return (
                        <div key={categoria}>
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{CATEGORY_ICONS[categoria] || "📋"}</span>
                              <h4 className="text-xs font-extrabold text-primary uppercase tracking-widest">{categoria}</h4>
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {catDecided}/{items.length} {isReadonly ? "positivos" : "decididas"}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {items.map(item => {
                              const decision = normalizedDecisions.get(item.numero)
                                ?? createDefaultDecision(item);

                              if (import.meta.env.DEV && isAudit && !isConfirmed && !normalizedDecisions.has(item.numero)) {
                                console.error("[MentoriaDetailDialog] Missing decision for visible criterion — fallback applied", { numero: item.numero });
                              }

                              return (
                                <CriterionCard
                                  key={item.numero}
                                  item={item}
                                  mode={criterionMode}
                                  decision={isAudit ? decision : undefined}
                                  confirmed={isConfirmed}
                                  onAccept={isAudit && !isConfirmed ? acceptItem : undefined}
                                  onAdjust={isAudit && !isConfirmed ? adjustItem : undefined}
                                  onReject={isAudit && !isConfirmed ? rejectItem : undefined}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═══ 3. MENTORIA DE COMUNICAÇÃO ═══ */}
              <div>
                <div className="flex items-center gap-3 pb-4 border-b-2 border-foreground/10 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-sm font-extrabold text-foreground uppercase tracking-[0.1em]">Mentoria de Comunicação</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {melhorAcerto && (
                    <div className="rounded-2xl bg-accent/5 border border-accent/20 p-6">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                        </div>
                        <p className="text-[10px] font-extrabold text-accent uppercase tracking-[0.12em]">Principal Acerto</p>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug">{melhorAcerto.nome}</p>
                      <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">{melhorAcerto.explicacao}</p>
                    </div>
                  )}
                  {principalMelhoria && (
                    <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-6">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-8 h-8 rounded-full bg-destructive/15 flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        </div>
                        <p className="text-[10px] font-extrabold text-destructive uppercase tracking-[0.12em]">Principal Melhoria</p>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug">{principalMelhoria.nome}</p>
                      <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">{principalMelhoria.explicacao}</p>
                      {(() => {
                        const ex = findRelevantExcerpt(rawText, principalMelhoria.explicacao);
                        if (!ex) return null;
                        return (
                          <div className="mt-3.5 rounded-lg px-3.5 py-2.5 text-[11px] italic border-l-[3px] border-destructive/40 bg-destructive/5 text-foreground/70">
                            <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-50" />"{ex}"
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {mentoriaItems.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center"><Lightbulb className="h-4 w-4 text-primary" /></div>
                      <p className="text-[10px] font-extrabold text-primary uppercase tracking-[0.12em]">Orientações Práticas</p>
                    </div>
                    <div className="space-y-3.5">
                      {mentoriaItems.map((item, i) => (
                        <div key={i} className="flex gap-3.5 items-start">
                          <span className="text-[10px] font-bold text-primary-foreground shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-0.5">{i + 1}</span>
                          <p className="text-[13px] text-foreground leading-relaxed">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-medium">Radar Insight · Relatório gerado automaticamente</span>
                <span>{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ═══ BOTTOM BAR ═══ */}
        <div className="px-8 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {workflowStatus && (
              <Badge variant="outline" className={`text-[10px] font-bold ${
                workflowStatus === "finalizado" ? "bg-accent/15 text-accent border-accent/30" :
                workflowStatus === "em_analise" ? "bg-primary/15 text-primary border-primary/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {workflowStatus === "finalizado" ? "Finalizado" : workflowStatus === "em_analise" ? "Em análise" : "Não iniciado"}
              </Badge>
            )}
            {/* Audit: pending counter */}
            {isAudit && !isConfirmed && stats.pending > 0 && (
              <p className="text-xs text-warning font-medium">⚠ {stats.pending} pendente{stats.pending > 1 ? "s" : ""}</p>
            )}
            {isAudit && isConfirmed && (
              <p className="text-xs text-accent font-medium flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Confirmada</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Confirm (audit mode) */}
            {isAudit && preAnalysis && !isConfirmed && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" className="gap-1.5 font-bold text-xs bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleConfirm}>
                      <Send className="h-3.5 w-3.5" /> Confirmar avaliação
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[280px]">Consolida todas as decisões e calcula a nota final.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Finalize */}
            {isAudit && workflowStatus !== "finalizado" && onMarkFinished && (
              <Button variant="outline" size="sm" onClick={onMarkFinished} className="gap-1.5 text-xs h-8 font-semibold text-accent border-accent/30 hover:bg-accent/10">
                <CheckSquare className="h-3.5 w-3.5" /> Finalizar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5 text-xs h-8 font-semibold">
              <List className="h-3.5 w-3.5" /> Voltar para lista
            </Button>
            {hasNextFile && onNextFile && (
              <Button size="sm" onClick={onNextFile} className="gap-1.5 text-xs h-8 font-semibold">
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      <UraContextDialog open={uraOpen} onOpenChange={setUraOpen} rawText={rawText} atendente={atendente} structuredConversation={structuredConversation} audioBlobs={audioBlobs} imageBlobs={imageBlobs} />
    </Dialog>
  );
};

export default MentoriaDetailDialog;
