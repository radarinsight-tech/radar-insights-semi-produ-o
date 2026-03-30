import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio, X, ChevronDown, ChevronRight, Phone, ShieldCheck, Route,
  MessageSquare, ArrowRightLeft, Clock, AlertTriangle, Bot, Timer, Milestone, Zap, Info,
  Hourglass, UserCheck, FileText
} from "lucide-react";
import { extractUraContext } from "@/lib/conversationParser";
import { buildJourneyTimeline, formatDuration, type JourneyTimeline, type JourneyMilestone } from "@/lib/uraJourneyTimeline";
import { extractProtocolTimestamps, calculateUraTimeMetrics, formatMinutes, type UraTimeMetrics } from "@/lib/uraTimestampExtractor";
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
  ura_valid: { title: "Contexto URA", description: "Jornada pré-atendimento identificada", icon: Radio },
  ura_irrelevant: { title: "URA irrelevante", description: "Automação detectada apenas após o atendimento humano", icon: Info },
  no_ura: { title: "Sem URA", description: "Atendimento iniciado diretamente com atendente", icon: Phone },
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

const CENARIO_CONFIG: Record<UraTimeMetrics["cenario"], { icon: typeof Radio; color: string; bg: string }> = {
  sem_ura: { icon: Phone, color: "text-accent", bg: "bg-accent/10" },
  com_ura: { icon: Radio, color: "text-primary", bg: "bg-primary/10" },
  somente_ura: { icon: Bot, color: "text-warning", bg: "bg-warning/10" },
};

/* ─── Protocol Time Metrics Card ────────────────────────────────── */

function ProtocolTimeMetrics({ metrics }: { metrics: UraTimeMetrics }) {
  const cfg = CENARIO_CONFIG[metrics.cenario];
  const CenarioIcon = cfg.icon;

  return (
    <div className="space-y-3">
      {/* Scenario indicator */}
      <div className={`flex items-center gap-2.5 rounded-xl border border-border/50 ${cfg.bg} px-4 py-3`}>
        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
          <CenarioIcon className={`h-4 w-4 ${cfg.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-bold ${cfg.color} uppercase tracking-wide`}>
            {metrics.cenarioLabel.split("—")[0]?.trim()}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
            {metrics.cenarioDescricao}
          </p>
        </div>
      </div>

      {/* 3 metric cards */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          icon={Hourglass}
          label="Tempo na URA/fila"
          value={formatMinutes(metrics.tempoFilaMinutos)}
          highlight={metrics.cenario === "com_ura" && (metrics.tempoFilaMinutos ?? 0) > 5}
        />
        <MetricCard
          icon={UserCheck}
          label="Tempo de atendimento"
          value={formatMinutes(metrics.tempoAtendimentoMinutos)}
          highlight={false}
        />
        <MetricCard
          icon={Clock}
          label="Tempo total"
          value={formatMinutes(metrics.tempoTotalMinutos)}
          highlight={false}
        />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, highlight }: { icon: typeof Clock; label: string; value: string; highlight: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${
      highlight ? "border-warning/40 bg-warning/5" : "border-border/40 bg-muted/10"
    }`}>
      <div className="flex justify-center mb-1.5">
        <Icon className={`h-4 w-4 ${highlight ? "text-warning" : "text-muted-foreground"}`} />
      </div>
      <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-1">{label}</p>
      <p className={`text-base font-bold ${highlight ? "text-warning" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

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

      {hasAnyTime && (
        <div className="grid grid-cols-3 gap-2">
          <TimeMetric label="Tempo na URA" seconds={timeline.tempoUra} />
          <TimeMetric label="Tempo em fila" seconds={timeline.tempoFila} alert={timeline.queueAlert?.level} />
          <TimeMetric label="Até atendimento" seconds={timeline.tempoTotalPreAtendimento} />
        </div>
      )}

      {timeline.queueAlert && timeline.queueAlert.level !== "ok" && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ALERT_COLORS[timeline.queueAlert.level]}`}>
          <div className={`w-2 h-2 rounded-full ${ALERT_DOT[timeline.queueAlert.level]} animate-pulse`} />
          <span className="text-[11px] font-semibold">{timeline.queueAlert.label}</span>
          {timeline.tempoFila !== undefined && (
            <span className="text-[10px] ml-auto opacity-80">{formatDuration(timeline.tempoFila)}</span>
          )}
        </div>
      )}

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
            {!isLast && (
              <div className="absolute left-[7px] top-[18px] w-px h-[calc(100%)] bg-border/50" />
            )}
            <div className={`w-[15px] h-[15px] rounded-full border-2 shrink-0 mt-0.5 z-10 ${colors.border} ${colors.bg} ${
              isHuman ? "ring-2 ring-accent/30" : ""
            }`} />
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

/* ─── Raw Text Collapsible ──────────────────────────────────────── */

function RawTextSection({ rawText }: { rawText: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full rounded-xl border border-border/50 bg-muted/10 px-4 py-2.5 hover:bg-muted/20 transition-colors">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
          Ver texto completo do atendimento
        </span>
        <div className="ml-auto">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 rounded-xl border border-border/40 bg-background/50 p-4 max-h-[40vh] overflow-y-auto">
          <pre className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words font-mono">
            {rawText}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
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

  // Extract protocol-level timestamps and calculate metrics
  const timeMetrics = useMemo(() => {
    if (!rawText) return null;
    const timestamps = extractProtocolTimestamps(rawText);
    if (!timestamps.horarioAbertura && !timestamps.inicioAtendimento && !timestamps.fimAtendimento) return null;
    return calculateUraTimeMetrics(timestamps, rawText);
  }, [rawText]);

  const sections: SectionConfig[] = useMemo(() => {
    if (!uraContext || uraContext.status !== "ura_valid") return [];

    const allItems = uraContext.items;
    return [
      { title: "Detalhes Identificados", icon: Route, items: allItems },
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
  const showJourney = status === "ura_valid" && timeline && (timeline.milestones.length > 0 || timeline.hasTimestamps);

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

            {/* ═══ Protocol Time Metrics (always shown when available) ═══ */}
            {rawText && timeMetrics && (
              <ProtocolTimeMetrics metrics={timeMetrics} />
            )}

            {/* ═══ State: no_ura (only if no time metrics) ═══ */}
            {rawText && status === "no_ura" && !timeMetrics && (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Phone className="h-5 w-5 text-primary/60" />
                </div>
                <p className="text-sm font-semibold text-foreground">Atendimento iniciado diretamente com atendente</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Nenhuma interação automática (URA) foi detectada neste atendimento.
                </p>
              </div>
            )}

            {/* ═══ State: ura_irrelevant ═══ */}
            {rawText && status === "ura_irrelevant" && !timeMetrics && (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Info className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Sem URA relevante no pré-atendimento</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                    O atendimento foi iniciado diretamente com atendente humano. As interações automáticas detectadas ocorreram apenas após o atendimento.
                  </p>
                </div>
              </div>
            )}

            {/* Post-attendance items (for ura_irrelevant or ura_valid) */}
            {rawText && uraContext?.postAttendanceItems && uraContext.postAttendanceItems.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                    Interações automáticas pós-atendimento
                  </span>
                </div>
                <div className="space-y-2">
                  {uraContext.postAttendanceItems.map((item, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-[10px] text-muted-foreground font-semibold shrink-0 mt-0.5 min-w-[90px]">
                        {item.label}
                      </span>
                      <span className="text-[12px] text-foreground/70 leading-snug">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ State: ura_valid ═══ */}
            {rawText && status === "ura_valid" && (
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

                {/* ura_valid but empty */}
                {!hasData && !showJourney && !timeMetrics && (
                  <div className="flex flex-col items-center text-center py-10">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <Radio className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">URA detectada sem detalhes extraídos</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                      Foram encontradas mensagens automáticas antes do atendente, mas não foi possível extrair detalhes específicos.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ═══ Raw Text Collapsible (always at the bottom when text exists) ═══ */}
            {rawText && (
              <RawTextSection rawText={rawText} />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UraContextDialog;
