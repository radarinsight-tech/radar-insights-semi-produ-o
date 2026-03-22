import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio, X, ChevronDown, ChevronRight, Phone, ShieldCheck, Route,
  MessageSquare, ArrowRightLeft, Clock, AlertTriangle, Bot, UserX, Timer, Milestone, Zap
} from "lucide-react";
import { extractUraContext } from "@/lib/conversationParser";
import { buildJourneyTimeline, formatDuration, type JourneyTimeline, type JourneyMilestone } from "@/lib/uraJourneyTimeline";
import type { ParsedMessage, StructuredConversation } from "@/lib/conversationParser";
import type { UraContext, UraStatus } from "@/lib/uraContextSummarizer";

interface UraContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawText?: string;
  atendente?: string;
  structuredConversation?: StructuredConversation;
}

interface SectionConfig {
  title: string;
  icon: typeof Phone;
  items: { label: string; value: string }[];
}

const STATUS_CONFIG: Record<UraStatus, { title: string; description: string; icon: typeof Radio }> = {
  with_ura: { title: "Contexto URA", description: "Jornada pré-atendimento identificada", icon: Radio },
  no_ura: { title: "Sem dados de URA", description: "Atendimento humano direto — sem interação automática detectada", icon: Phone },
  ura_only: { title: "URA sem atendente", description: "Atendimento puramente automático — nenhum atendente humano identificado", icon: Bot },
  ura_ambiguous: { title: "URA não identificada com segurança", description: "Não foi possível classificar o fluxo da URA com precisão", icon: AlertTriangle },
};

const ALERT_COLORS: Record<string, string> = {
  ok: "bg-accent/15 text-accent border-accent/30",
  moderate: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  long: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const ALERT_DOT: Record<string, string> = {
  ok: "bg-accent",
  moderate: "bg-yellow-500",
  long: "bg-orange-500",
  critical: "bg-destructive",
};

const MILESTONE_ICON_COLORS: Record<string, { border: string; bg: string }> = {
  ura_start: { border: "border-muted-foreground", bg: "bg-muted" },
  greeting: { border: "border-muted-foreground", bg: "bg-muted" },
  menu: { border: "border-primary", bg: "bg-primary/20" },
  invalid_option: { border: "border-destructive", bg: "bg-destructive/20" },
  valid_option: { border: "border-accent", bg: "bg-accent/20" },
  auth_request: { border: "border-muted-foreground", bg: "bg-muted" },
  auth_received: { border: "border-accent", bg: "bg-accent/20" },
  problem_request: { border: "border-muted-foreground", bg: "bg-muted" },
  problem_informed: { border: "border-primary", bg: "bg-primary/20" },
  transfer: { border: "border-warning", bg: "bg-warning/20" },
  queue: { border: "border-muted-foreground", bg: "bg-muted" },
  human_start: { border: "border-accent", bg: "bg-accent/30" },
  survey: { border: "border-muted-foreground", bg: "bg-muted" },
  reminder: { border: "border-muted-foreground", bg: "bg-muted" },
  client_interaction: { border: "border-primary", bg: "bg-primary/15" },
  generic: { border: "border-border", bg: "bg-background" },
};

/* ─── Journey Summary Card ──────────────────────────────────────── */

function JourneySummary({ timeline }: { timeline: JourneyTimeline }) {
  if (!timeline.hasTimestamps && timeline.milestones.length === 0) return null;

  const hasAnyTime = timeline.tempoUra !== undefined || timeline.tempoFila !== undefined || timeline.tempoTotalPreAtendimento !== undefined;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Timer className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
          Resumo da Jornada
        </span>
      </div>

      {/* Time metrics */}
      {hasAnyTime && (
        <div className="grid grid-cols-3 gap-2">
          <TimeMetric label="Tempo na URA" seconds={timeline.tempoUra} />
          <TimeMetric label="Tempo em fila" seconds={timeline.tempoFila} alert={timeline.queueAlert?.level} />
          <TimeMetric label="Até atendimento" seconds={timeline.tempoTotalPreAtendimento} />
        </div>
      )}

      {/* Queue alert */}
      {timeline.queueAlert && timeline.queueAlert.level !== "ok" && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ALERT_COLORS[timeline.queueAlert.level]}`}>
          <div className={`w-2 h-2 rounded-full ${ALERT_DOT[timeline.queueAlert.level]} animate-pulse`} />
          <span className="text-[11px] font-semibold">{timeline.queueAlert.label}</span>
          {timeline.tempoFila !== undefined && (
            <span className="text-[10px] ml-auto opacity-80">{formatDuration(timeline.tempoFila)}</span>
          )}
        </div>
      )}

      {/* URA difficulty alert */}
      {timeline.difficultyAlert?.detected && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
          <Zap className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <span className="text-[11px] font-semibold text-orange-700">Dificuldade na URA detectada</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {timeline.difficultyAlert.reasons.map((r, i) => (
                <span key={i} className="text-[10px] text-orange-600/80 bg-orange-500/10 rounded px-1.5 py-0.5">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No timestamps fallback */}
      {!hasAnyTime && timeline.milestones.length > 0 && (
        <p className="text-[10px] text-muted-foreground/70 italic">
          Timestamps não disponíveis — cálculo de tempos indisponível
        </p>
      )}
    </div>
  );
}

function TimeMetric({ label, seconds, alert }: { label: string; seconds?: number; alert?: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${
      alert && alert !== "ok" ? ALERT_COLORS[alert] : "border-border/40 bg-background/50"
    }`}>
      <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${alert && alert !== "ok" ? "" : "text-foreground"}`}>
        {seconds !== undefined ? formatDuration(seconds) : "—"}
      </p>
    </div>
  );
}

/* ─── Chronological Timeline ────────────────────────────────────── */

function ChronologicalTimeline({ milestones }: { milestones: JourneyMilestone[] }) {
  if (milestones.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-0">
      <div className="flex items-center gap-2 mb-3">
        <Milestone className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
          Linha do Tempo
        </span>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1">
          {milestones.length} etapas
        </Badge>
      </div>

      {milestones.map((m, i) => {
        const colors = MILESTONE_ICON_COLORS[m.type || "generic"] || MILESTONE_ICON_COLORS.generic;
        const isLast = i === milestones.length - 1;
        const isHuman = m.type === "human_start";
        const isInvalid = m.type === "invalid_option";

        return (
          <div key={i} className="flex items-start gap-3 relative">
            {/* Vertical connector */}
            {!isLast && (
              <div className="absolute left-[7px] top-[18px] w-px h-[calc(100%)] bg-border/50" />
            )}

            {/* Dot */}
            <div className={`w-[15px] h-[15px] rounded-full border-2 shrink-0 mt-0.5 z-10 ${colors.border} ${colors.bg} ${
              isHuman ? "ring-2 ring-accent/30" : ""
            }`} />

            {/* Content */}
            <div className={`pb-3 min-w-0 flex-1 ${isInvalid ? "opacity-80" : ""}`}>
              <p className={`text-[11px] font-semibold leading-tight ${
                isHuman ? "text-accent" : isInvalid ? "text-destructive" : "text-foreground"
              }`}>
                {m.label}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {m.time && (
                  <span className="text-[10px] text-muted-foreground font-mono">{m.time}</span>
                )}
                {m.speaker && m.type !== "human_start" && (
                  <span className="text-[10px] text-muted-foreground truncate">{m.speaker}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Dialog ───────────────────────────────────────────────── */

const UraContextDialog = ({ open, onOpenChange, rawText, atendente, structuredConversation }: UraContextDialogProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["detalhes"]));

  const uraContext = useMemo(() => {
    if (!rawText) return null;
    return extractUraContext(rawText, atendente);
  }, [rawText, atendente]);

  const timeline = useMemo(() => {
    if (!rawText) return null;
    const preParsed = structuredConversation?.messages;
    return buildJourneyTimeline(rawText, atendente, preParsed);
  }, [rawText, atendente, structuredConversation]);

  const sections: SectionConfig[] = useMemo(() => {
    if (!uraContext || uraContext.status === "no_ura") return [];

    const fluxoItems: { label: string; value: string }[] = [];
    const eventosItems: { label: string; value: string }[] = [];

    for (const item of uraContext.items) {
      const label = item.label.toLowerCase();
      if (label.includes("protocolo") || label.includes("remetente") || label.includes("saudação") || label.includes("autenticação")) {
        fluxoItems.push(item);
      } else {
        eventosItems.push(item);
      }
    }

    return [
      { title: "Detalhes Identificados", icon: Route, items: [...fluxoItems, ...eventosItems] },
    ].filter(s => s.items.length > 0);
  }, [uraContext]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const status = uraContext?.status || "no_ura";
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const hasData = sections.length > 0;
  const showJourney = timeline && (timeline.milestones.length > 0 || timeline.hasTimestamps);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border/60 bg-gradient-to-r from-muted/40 to-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <StatusIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <DialogTitle className="text-xs font-extrabold text-foreground uppercase tracking-[0.1em]">
                  {cfg.title}
                </DialogTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">{cfg.description}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-72px)]">
          <div className="p-6 space-y-3">
            {/* Missing raw text */}
            {!rawText && (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                  <AlertTriangle className="h-5 w-5 text-destructive/60" />
                </div>
                <p className="text-sm font-semibold text-foreground">Texto do atendimento indisponível</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  O conteúdo bruto do PDF não foi encontrado. Reimporte o arquivo para restaurar os dados do atendimento.
                </p>
              </div>
            )}

            {/* No URA — human-only */}
            {rawText && status === "no_ura" && (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Phone className="h-5 w-5 text-primary/60" />
                </div>
                <p className="text-sm font-semibold text-foreground">Sem dados de URA</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Este atendimento foi identificado como humano direto, sem interação automática prévia.
                </p>
              </div>
            )}

            {/* URA only */}
            {status === "ura_only" && (
              <div className="flex flex-col items-center text-center py-6 mb-3">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-3">
                  <Bot className="h-5 w-5 text-warning" />
                </div>
                <p className="text-sm font-semibold text-foreground">URA sem atendente</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Este atendimento foi composto apenas por mensagens automáticas.
                </p>
              </div>
            )}

            {/* Ambiguous */}
            {status === "ura_ambiguous" && (
              <div className="flex flex-col items-center text-center py-6 mb-3">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-semibold text-foreground">URA não identificada com segurança</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Foram detectadas mensagens automáticas, mas não foi possível classificar o fluxo com precisão.
                </p>
              </div>
            )}

            {/* Data sections — with_ura, ura_only, ura_ambiguous */}
            {(status === "with_ura" || ((status === "ura_only" || status === "ura_ambiguous") && hasData)) && (
              <>
                {/* Journey Summary */}
                {showJourney && <JourneySummary timeline={timeline!} />}

                {/* Chronological Timeline */}
                {showJourney && timeline!.milestones.length > 0 && (
                  <ChronologicalTimeline milestones={timeline!.milestones} />
                )}

                {/* Summary badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {uraContext?.autenticacao && (
                    <Badge variant="outline" className="text-[10px] gap-1 font-medium">
                      <ShieldCheck className="h-3 w-3 text-accent" /> Autenticado
                    </Badge>
                  )}
                  {uraContext?.transferencia && (
                    <Badge variant="outline" className="text-[10px] gap-1 font-medium">
                      <ArrowRightLeft className="h-3 w-3 text-warning" /> Transferido
                    </Badge>
                  )}
                  {uraContext?.audioDetectado && (
                    <Badge variant="outline" className="text-[10px] gap-1 font-medium">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" /> Áudio detectado
                    </Badge>
                  )}
                  {uraContext?.pesquisaSatisfacao && (
                    <Badge variant="outline" className="text-[10px] gap-1 font-medium">
                      <Clock className="h-3 w-3 text-primary" /> Pesquisa enviada
                    </Badge>
                  )}
                </div>

                {/* Collapsible detail sections */}
                {sections.map((section, idx) => {
                  const key = `detalhes-${idx}`;
                  const isOpen = expandedSections.has("detalhes");
                  const Icon = section.icon;
                  return (
                    <Collapsible key={key} open={isOpen} onOpenChange={() => toggleSection("detalhes")}>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full rounded-xl border border-border/50 bg-muted/10 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
                          {section.title}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1">
                          {section.items.length}
                        </Badge>
                        <div className="ml-auto">
                          {isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-1.5 rounded-xl border border-border/40 bg-background/50 p-4 space-y-2.5">
                          {section.items.map((item, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <span className="text-[10px] text-muted-foreground font-semibold shrink-0 mt-0.5 min-w-[90px]">
                                {item.label}
                              </span>
                              <span className="text-[12px] text-foreground leading-snug break-words">
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </>
            )}

            {/* with_ura but no data */}
            {status === "with_ura" && !hasData && !showJourney && (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <Radio className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Sem dados de URA</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Nenhuma interação automática (URA) foi identificada neste atendimento.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UraContextDialog;
