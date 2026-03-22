import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, AlertCircle, Sparkles, Check, Pencil, MessageSquareQuote, ChevronDown, ChevronUp } from "lucide-react";
import type { PreAnalysisSuggestion, PreAnalysisResult, SugestaoResultado, Confianca } from "@/lib/mentoriaPreAnalysis";

interface PreAnalysisPanelProps {
  analysis: PreAnalysisResult;
  onAcceptAll?: () => void;
}

const confiancaConfig: Record<Confianca, { label: string; color: string }> = {
  alta: { label: "Alta", color: "bg-accent/15 text-accent border-accent/30" },
  media: { label: "Média", color: "bg-warning/15 text-warning border-warning/30" },
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground border-border" },
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

const PreAnalysisPanel = ({ analysis, onAcceptAll }: PreAnalysisPanelProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [acceptedItems, setAcceptedItems] = useState<Set<number>>(new Set());

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map(cat => ({
      categoria: cat,
      items: analysis.suggestions.filter(s => s.categoria === cat),
    }));
  }, [analysis.suggestions]);

  const stats = useMemo(() => {
    const sim = analysis.suggestions.filter(s => s.sugestao === "SIM").length;
    const nao = analysis.suggestions.filter(s => s.sugestao === "NÃO").length;
    const parcial = analysis.suggestions.filter(s => s.sugestao === "PARCIAL").length;
    const alta = analysis.suggestions.filter(s => s.confianca === "alta").length;
    return { sim, nao, parcial, alta };
  }, [analysis.suggestions]);

  const toggleExpand = (num: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  };

  const acceptItem = (num: number) => {
    setAcceptedItems(prev => new Set(prev).add(num));
  };

  const handleAcceptAll = () => {
    setAcceptedItems(new Set(analysis.suggestions.map(s => s.numero)));
    onAcceptAll?.();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-background border border-primary/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-foreground uppercase tracking-[0.1em]">Pré-Análise Automática</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sugestões baseadas no conteúdo do atendimento</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 font-semibold"
            onClick={handleAcceptAll}
          >
            <Check className="h-3.5 w-3.5" /> Aceitar todas
          </Button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            <span className="font-bold text-accent">{stats.sim}</span>
            <span className="text-muted-foreground">SIM</span>
          </span>
          <span className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="font-bold text-destructive">{stats.nao}</span>
            <span className="text-muted-foreground">NÃO</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-warning" />
            <span className="font-bold text-warning">{stats.parcial}</span>
            <span className="text-muted-foreground">PARCIAL</span>
          </span>
          <span className="text-muted-foreground ml-auto">
            Confiança alta: <span className="font-bold text-foreground">{stats.alta}/19</span>
          </span>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-muted-foreground">
          <span>Mensagens: <span className="font-bold text-foreground">{analysis.metadata.totalMessages}</span></span>
          <span>Atendente: <span className="font-bold text-foreground">{analysis.metadata.attendantMessages}</span></span>
          <span>Cliente: <span className="font-bold text-foreground">{analysis.metadata.clientMessages}</span></span>
          {analysis.metadata.avgResponseTimeSec != null && (
            <span>Tempo médio: <span className="font-bold text-foreground">{(analysis.metadata.avgResponseTimeSec / 60).toFixed(1)} min</span></span>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-8">
        {grouped.map(({ categoria, items }) => {
          if (items.length === 0) return null;
          const catSim = items.filter(i => i.sugestao === "SIM").length;
          const catTotal = items.length;
          return (
            <div key={categoria}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="text-base">{CATEGORY_ICONS[categoria] || "📋"}</span>
                  <h4 className="text-xs font-extrabold text-primary uppercase tracking-widest">{categoria}</h4>
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {catSim}/{catTotal} positivos
                </span>
              </div>

              <div className="space-y-2">
                {items.map(item => {
                  const isExpanded = expandedItems.has(item.numero);
                  const isAccepted = acceptedItems.has(item.numero);
                  const cfg = sugestaoConfig[item.sugestao];
                  const confCfg = confiancaConfig[item.confianca];
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={item.numero}
                      className={`rounded-xl border p-3.5 transition-all ${isAccepted ? "bg-muted/30 border-border/40 opacity-75" : cfg.bg}`}
                    >
                      {/* Main row */}
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                        <span className="text-[13px] font-semibold text-foreground flex-1 leading-snug">
                          {item.numero}. {item.nome}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Suggestion badge */}
                          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-extrabold border ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </Badge>

                          {/* Confidence */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-bold ${confCfg.color}`}>
                                  {confCfg.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Confiança da sugestão automática
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Auto-suggest indicator */}
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium text-primary border-primary/30 bg-primary/5 gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" /> Auto
                          </Badge>

                          {/* Accept button */}
                          {!isAccepted ? (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => acceptItem(item.numero)}>
                              <Check className="h-3.5 w-3.5 text-accent" />
                            </Button>
                          ) : (
                            <div className="h-6 w-6 flex items-center justify-center">
                              <Check className="h-3.5 w-3.5 text-accent" />
                            </div>
                          )}

                          {/* Expand toggle */}
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(item.numero)}>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Justification (always visible) */}
                      <p className="text-xs text-muted-foreground mt-1.5 ml-6.5 leading-relaxed" style={{ marginLeft: "26px" }}>
                        {item.justificativa}
                      </p>

                      {/* Evidence (expanded) */}
                      {isExpanded && item.evidencia && (
                        <div className="mt-2.5 ml-6.5 rounded-lg px-3 py-2 text-[11px] italic border-l-[3px] border-primary/40 bg-primary/5 text-foreground/80" style={{ marginLeft: "26px" }}>
                          <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-50" />
                          "{item.evidencia}"
                        </div>
                      )}

                      {isExpanded && !item.evidencia && (
                        <p className="text-[10px] text-muted-foreground/60 mt-2 italic" style={{ marginLeft: "26px" }}>
                          Sem trecho de evidência encontrado no texto.
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
    </div>
  );
};

export default PreAnalysisPanel;
