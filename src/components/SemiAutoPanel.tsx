import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, XCircle, AlertCircle, Sparkles, Check, X, Pencil,
  MessageSquareQuote, ChevronDown, ChevronUp, ShieldCheck, Filter,
  Zap, Eye, RotateCcw, Send,
} from "lucide-react";
import type { PreAnalysisResult, PreAnalysisSuggestion, SugestaoResultado, Confianca } from "@/lib/mentoriaPreAnalysis";
import {
  calculateScore, classify, classificacaoColor, classificacaoBg,
  CRITERIA_WEIGHTS, TOTAL_POSSIBLE,
  type ScoringResult,
} from "@/lib/mentoriaScoring";

/* ─── Types ─── */
export type DecisionStatus = "pending" | "accepted" | "adjusted" | "rejected";

export interface CriterionDecision {
  numero: number;
  sugestaoOriginal: SugestaoResultado;
  decisaoFinal: SugestaoResultado;
  status: DecisionStatus;
  editadoManualmente: boolean;
  confiancaOriginal: Confianca;
}

export interface SemiAutoResult {
  decisions: CriterionDecision[];
  score: ScoringResult;
  confirmed: boolean;
}

interface SemiAutoPanelProps {
  analysis: PreAnalysisResult;
  /** Result from analyze-attendance edge function — when present, pre-fills criteria from IA */
  iaResult?: any;
  onConfirm?: (result: SemiAutoResult) => void;
}

/* ─── Config ─── */
const statusConfig: Record<DecisionStatus, { label: string; color: string; icon: typeof Check }> = {
  pending: { label: "Pendente", color: "text-muted-foreground", icon: Eye },
  accepted: { label: "Aceito", color: "text-accent", icon: Check },
  adjusted: { label: "Ajustado", color: "text-primary", icon: Pencil },
  rejected: { label: "Rejeitado", color: "text-destructive", icon: X },
};

const sugestaoConfig: Record<SugestaoResultado, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  SIM: { label: "SIM", icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10 border-accent/20" },
  NÃO: { label: "NÃO", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  PARCIAL: { label: "PARCIAL", icon: AlertCircle, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
};

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

type FilterMode = "all" | "pending" | "accepted" | "adjusted" | "rejected";

/* ─── Component ─── */
const SemiAutoPanel = ({ analysis, iaResult, onConfirm }: SemiAutoPanelProps) => {
  // Build initial decisions: if iaResult has criterios, use them; otherwise use pre-analysis suggestions
  const [decisions, setDecisions] = useState<Map<number, CriterionDecision>>(() => {
    const map = new Map<number, CriterionDecision>();
    const iaCriterios: any[] = iaResult?.criterios || [];

    for (const s of analysis.suggestions) {
      // Try to find matching IA criterion
      const iaCrit = iaCriterios.find((c: any) => c.numero === s.numero);

      if (iaCrit) {
        // Map IA resultado to SugestaoResultado
        const iaResultado: SugestaoResultado =
          iaCrit.resultado === "SIM" ? "SIM" :
          iaCrit.resultado === "NÃO" ? "NÃO" : "PARCIAL";

        map.set(s.numero, {
          numero: s.numero,
          sugestaoOriginal: iaResultado,
          decisaoFinal: iaResultado,
          status: "accepted", // IA results start as accepted
          editadoManualmente: false,
          confiancaOriginal: "alta", // IA results are high confidence
        });
      } else {
        map.set(s.numero, {
          numero: s.numero,
          sugestaoOriginal: s.sugestao,
          decisaoFinal: s.sugestao,
          status: s.confianca === "alta" ? "accepted" : "pending",
          editadoManualmente: false,
          confiancaOriginal: s.confianca,
        });
      }
    }
    return map;
  });

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [confirmed, setConfirmed] = useState(false);

  // Current score preview
  const currentScore = useMemo(() => {
    const respostas = [...decisions.values()].map(d => ({
      numero: d.numero,
      resposta: d.decisaoFinal,
    }));
    return calculateScore(respostas);
  }, [decisions]);

  // Stats
  const stats = useMemo(() => {
    const all = [...decisions.values()];
    return {
      total: all.length,
      accepted: all.filter(d => d.status === "accepted").length,
      adjusted: all.filter(d => d.status === "adjusted").length,
      rejected: all.filter(d => d.status === "rejected").length,
      pending: all.filter(d => d.status === "pending").length,
      highConf: all.filter(d => d.confiancaOriginal === "alta").length,
      avgConf: (() => {
        const vals = all.map(d => d.confiancaOriginal === "alta" ? 3 : d.confiancaOriginal === "media" ? 2 : 1);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return avg >= 2.5 ? "Alta" : avg >= 1.5 ? "Média" : "Baixa";
      })(),
      readyToConfirm: all.every(d => d.status !== "pending"),
    };
  }, [decisions]);

  const updateDecision = useCallback((numero: number, update: Partial<CriterionDecision>) => {
    setDecisions(prev => {
      const next = new Map(prev);
      const current = next.get(numero);
      if (current) next.set(numero, { ...current, ...update });
      return next;
    });
  }, []);

  const acceptItem = (numero: number) => {
    const d = decisions.get(numero);
    if (!d) return;
    updateDecision(numero, { status: "accepted", decisaoFinal: d.sugestaoOriginal, editadoManualmente: false });
  };

  const rejectItem = (numero: number) => {
    const d = decisions.get(numero);
    if (!d) return;
    const opposite: SugestaoResultado = d.sugestaoOriginal === "SIM" ? "NÃO" : "SIM";
    updateDecision(numero, { status: "rejected", decisaoFinal: opposite, editadoManualmente: true });
  };

  const adjustItem = (numero: number, newValue: SugestaoResultado) => {
    updateDecision(numero, {
      status: "adjusted",
      decisaoFinal: newValue,
      editadoManualmente: true,
    });
  };

  // Global actions
  const acceptAllHigh = () => {
    setDecisions(prev => {
      const next = new Map(prev);
      for (const [num, d] of next) {
        if (d.confiancaOriginal === "alta") {
          next.set(num, { ...d, status: "accepted", decisaoFinal: d.sugestaoOriginal, editadoManualmente: false });
        }
      }
      return next;
    });
  };

  const acceptAll = () => {
    setDecisions(prev => {
      const next = new Map(prev);
      for (const [num, d] of next) {
        next.set(num, { ...d, status: "accepted", decisaoFinal: d.sugestaoOriginal, editadoManualmente: false });
      }
      return next;
    });
  };

  const clearAll = () => {
    setDecisions(prev => {
      const next = new Map(prev);
      for (const [num, d] of next) {
        next.set(num, { ...d, status: "pending", decisaoFinal: d.sugestaoOriginal, editadoManualmente: false });
      }
      return next;
    });
    setConfirmed(false);
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm?.({
      decisions: [...decisions.values()],
      score: currentScore,
      confirmed: true,
    });
  };

  const toggleExpand = (num: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  };

  // Enrich suggestions with IA result justifications when available
  const enrichedSuggestions = useMemo(() => {
    const iaCriterios: any[] = iaResult?.criterios || [];
    return analysis.suggestions.map(s => {
      const iaCrit = iaCriterios.find((c: any) => c.numero === s.numero);
      if (iaCrit) {
        return {
          ...s,
          justificativa: iaCrit.explicacao || s.justificativa,
          evidencia: s.evidencia,
          sugestao: (iaCrit.resultado === "SIM" ? "SIM" : iaCrit.resultado === "NÃO" ? "NÃO" : "PARCIAL") as SugestaoResultado,
          confianca: "alta" as Confianca,
        };
      }
      return s;
    });
  }, [analysis.suggestions, iaResult]);

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    return enrichedSuggestions.filter(s => {
      if (filterMode === "all") return true;
      const d = decisions.get(s.numero);
      return d?.status === filterMode;
    });
  }, [enrichedSuggestions, decisions, filterMode]);

  // Group by category
  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map(cat => ({
      categoria: cat,
      items: filteredSuggestions.filter(s => s.categoria === cat),
    }));
  }, [filteredSuggestions]);

  return (
    <div className="space-y-6">
      {/* ═══ METADATA HEADER (from pre-analysis) ═══ */}
      <div className="flex items-center gap-5 text-sm text-muted-foreground mb-4">
        <span className="flex items-center gap-1.5">💬 Mensagens: <span className="font-bold text-foreground">{analysis.metadata.totalMessages}</span></span>
        <span className="flex items-center gap-1.5">👤 Atendente: <span className="font-bold text-foreground">{analysis.metadata.attendantMessages}</span></span>
        <span className="flex items-center gap-1.5">🙋 Cliente: <span className="font-bold text-foreground">{analysis.metadata.clientMessages}</span></span>
        {analysis.metadata.avgResponseTimeSec != null && (
          <span className="flex items-center gap-1.5">⏱ Tempo médio: <span className="font-bold text-foreground">{(analysis.metadata.avgResponseTimeSec / 60).toFixed(1)} min</span></span>
        )}
      </div>

      {/* ═══ SUMMARY HEADER ═══ */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-background border border-primary/20 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-foreground uppercase tracking-[0.1em]">Revisão</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Revise e confirme as sugestões da IA</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
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
          <div className="text-center p-2 rounded-lg bg-card border">
            <div className="text-[9px] text-muted-foreground uppercase">Confiança</div>
            <div className="text-sm font-bold">{stats.avgConf}</div>
          </div>
        </div>

        {/* Score preview */}
        <div className="flex items-center gap-4 p-3 rounded-xl bg-card border">
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Previsão da Nota</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black ${classificacaoColor(currentScore.classificacao)}`}>
                {currentScore.nota100}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
              <Badge variant="outline" className={`text-[10px] ml-2 ${classificacaoBg(currentScore.classificacao)} ${classificacaoColor(currentScore.classificacao)}`}>
                {currentScore.classificacao}
              </Badge>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Pontos</div>
            <Progress value={(currentScore.pontosObtidos / currentScore.pontosPossiveis) * 100} className="h-2" />
            <div className="text-[10px] text-muted-foreground mt-1">
              {currentScore.pontosObtidos}/{currentScore.pontosPossiveis} pontos
            </div>
          </div>
        </div>
      </div>

      {/* ═══ GLOBAL ACTIONS ═══ */}
      <div className="flex flex-wrap items-center gap-2">
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
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
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

      {/* ═══ CRITERIA LIST ═══ */}
      <div className="space-y-8">
        {grouped.map(({ categoria, items }) => {
          if (items.length === 0) return null;
          const catDecisions = items.map(i => decisions.get(i.numero)!);
          const catAccepted = catDecisions.filter(d => d.status !== "pending").length;

          return (
            <div key={categoria}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="text-base">{CATEGORY_ICONS[categoria] || "📋"}</span>
                  <h4 className="text-xs font-extrabold text-primary uppercase tracking-widest">{categoria}</h4>
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {catAccepted}/{items.length} decididas
                </span>
              </div>

              <div className="space-y-2">
                {items.map(item => {
                  const decision = decisions.get(item.numero)!;
                  const isExpanded = expandedItems.has(item.numero);
                  const cfg = sugestaoConfig[decision.decisaoFinal];
                  const origCfg = sugestaoConfig[decision.sugestaoOriginal];
                  const stCfg = statusConfig[decision.status];
                  const StIcon = stCfg.icon;
                  const requiresReview = decision.confiancaOriginal === "baixa" && decision.status === "pending";
                  const needsAttention = decision.confiancaOriginal === "media" && decision.status === "pending";

                  return (
                    <div
                      key={item.numero}
                      className={`rounded-xl border p-3.5 transition-all ${
                        confirmed ? "opacity-75" :
                        requiresReview ? "border-destructive/30 bg-destructive/5" :
                        needsAttention ? "border-warning/30 bg-warning/5" :
                        decision.status === "accepted" ? "border-accent/20 bg-accent/5" :
                        decision.status === "adjusted" ? "border-primary/20 bg-primary/5" :
                        decision.status === "rejected" ? "border-destructive/20 bg-destructive/5" :
                        "border-border bg-card"
                      }`}
                    >
                      {/* Main row */}
                      <div className="flex items-center gap-2.5">
                        <StIcon className={`h-4 w-4 shrink-0 ${stCfg.color}`} />
                        <span className="text-[13px] font-semibold text-foreground flex-1 leading-snug">
                          {item.numero}. {item.nome}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Current decision badge */}
                          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-extrabold border ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </Badge>

                          {/* Show original if adjusted */}
                          {decision.editadoManualmente && decision.decisaoFinal !== decision.sugestaoOriginal && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 line-through opacity-50">
                                    {origCfg.label}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Sugestão original da IA
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {/* Confidence */}
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-bold ${
                            item.confianca === "alta" ? "bg-accent/15 text-accent border-accent/30" :
                            item.confianca === "media" ? "bg-warning/15 text-warning border-warning/30" :
                            "bg-muted text-muted-foreground border-border"
                          }`}>
                            {item.confianca === "alta" ? "Alta" : item.confianca === "media" ? "Média" : "Baixa"}
                          </Badge>

                          {/* Review required indicator */}
                          {requiresReview && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-destructive text-destructive-foreground border-0 animate-pulse">
                              Revisão obrigatória
                            </Badge>
                          )}

                          {/* Expand */}
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(item.numero)} disabled={confirmed}>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Justification */}
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed" style={{ marginLeft: "26px" }}>
                        {item.justificativa}
                      </p>

                      {/* Actions row */}
                      {!confirmed && (
                        <div className="flex items-center gap-1.5 mt-2.5" style={{ marginLeft: "26px" }}>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={decision.status === "accepted" ? "default" : "outline"}
                                  size="sm"
                                  className="text-[10px] h-6 px-2.5 gap-1 font-semibold"
                                  onClick={() => acceptItem(item.numero)}
                                >
                                  <Check className="h-3 w-3" /> Aceitar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[220px]">
                                Confirma o resultado sugerido pela IA para este critério.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Adjust dropdown */}
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Select
                                    value=""
                                    onValueChange={(v) => adjustItem(item.numero, v as SugestaoResultado)}
                                  >
                                    <SelectTrigger className="h-6 w-[90px] text-[10px] font-semibold">
                                      <Pencil className="h-3 w-3 mr-1" />
                                      Ajustar
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="SIM">SIM</SelectItem>
                                      <SelectItem value="NÃO">NÃO</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[220px]">
                                Substitui o resultado da IA pela sua decisão manual.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={decision.status === "rejected" ? "destructive" : "ghost"}
                                  size="sm"
                                  className="text-[10px] h-6 px-2.5 gap-1 font-semibold"
                                  onClick={() => rejectItem(item.numero)}
                                >
                                  <X className="h-3 w-3" /> Fora de escopo
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[280px]">
                                Exclui este critério do cálculo — use quando o critério não se aplica ao contexto deste atendimento. Mesmo efeito que 'Fora do escopo' automático da IA.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Weight info */}
                          <span className="text-[9px] text-muted-foreground ml-auto">
                            Peso: {CRITERIA_WEIGHTS.find(c => c.numero === item.numero)?.peso || 0} pts
                          </span>
                        </div>
                      )}

                      {/* Evidence (expanded) */}
                      {isExpanded && item.evidencia && (
                        <div className="mt-2.5 rounded-lg px-3 py-2 text-[11px] italic border-l-[3px] border-primary/40 bg-primary/5 text-foreground/80" style={{ marginLeft: "26px" }}>
                          <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-50" />
                          "{item.evidencia}"
                        </div>
                      )}
                      {isExpanded && !item.evidencia && (
                        <p className="text-[10px] text-muted-foreground/60 mt-2 italic" style={{ marginLeft: "26px" }}>
                          Sem trecho de evidência encontrado.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ CONFIRM BUTTON ═══ */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border pt-4 pb-2 -mx-8 px-8">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            {stats.pending > 0 ? (
              <p className="text-xs text-warning font-medium">
                ⚠ {stats.pending} pergunta{stats.pending > 1 ? "s" : ""} ainda pendente{stats.pending > 1 ? "s" : ""}
              </p>
            ) : confirmed ? (
              <p className="text-xs text-accent font-medium flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Avaliação confirmada
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Todas as perguntas foram decididas. Confirme para consolidar a nota.
              </p>
            )}
          </div>
          <Button
            size="sm"
            className="gap-1.5 font-bold text-xs"
            disabled={confirmed}
            onClick={handleConfirm}
          >
            <Send className="h-3.5 w-3.5" />
            {confirmed ? "Confirmada" : "Confirmar avaliação"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SemiAutoPanel;
