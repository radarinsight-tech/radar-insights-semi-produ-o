import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio, X, ChevronDown, ChevronRight, Phone, ShieldCheck, Route,
  MessageSquare, ArrowRightLeft, Clock, AlertTriangle, Bot, UserX, Timer, Milestone
} from "lucide-react";
import { extractUraContext } from "@/lib/conversationParser";
import { buildJourneyTimeline, formatDuration, type JourneyTimeline } from "@/lib/uraJourneyTimeline";
import type { UraContext, UraStatus } from "@/lib/uraContextSummarizer";

interface UraContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawText?: string;
  atendente?: string;
}

interface SectionConfig {
  title: string;
  icon: typeof Phone;
  items: { label: string; value: string }[];
}

const STATUS_CONFIG: Record<UraStatus, { title: string; description: string; icon: typeof Radio }> = {
  with_ura: { title: "Contexto URA", description: "Informações pré-atendimento identificadas", icon: Radio },
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
          <TimeMetric
            label="Tempo na URA"
            seconds={timeline.tempoUra}
          />
          <TimeMetric
            label="Tempo em fila"
            seconds={timeline.tempoFila}
            alert={timeline.queueAlert?.level}
          />
          <TimeMetric
            label="Até atendimento"
            seconds={timeline.tempoTotalPreAtendimento}
          />
        </div>
      )}

      {/* Queue alert */}
      {timeline.queueAlert && timeline.queueAlert.level !== "ok" && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ALERT_COLORS[timeline.queueAlert.level]}`}>
          <div className={`w-2 h-2 rounded-full ${ALERT_DOT[timeline.queueAlert.level]} animate-pulse`} />
          <span className="text-[11px] font-semibold">{timeline.queueAlert.label}</span>
          {timeline.tempoFila !== undefined && (
            <span className="text-[10px] ml-auto opacity-80">
              {formatDuration(timeline.tempoFila)}
            </span>
          )}
        </div>
      )}

      {/* Milestone timeline */}
      {timeline.milestones.length > 0 && (
        <div className="space-y-0">
          {timeline.milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-3 relative">
              {/* Vertical line */}
              {i < timeline.milestones.length - 1 && (
                <div className="absolute left-[7px] top-[18px] w-px h-[calc(100%)] bg-border/60" />
              )}
              <div className={`w-[15px] h-[15px] rounded-full border-2 shrink-0 mt-0.5 z-10 ${
                m.role === "bot" ? "border-muted-foreground bg-muted" :
                m.role === "atendente" ? "border-accent bg-accent/20" :
                m.role === "cliente" ? "border-primary bg-primary/20" :
                "border-border bg-background"
              }`} />
              <div className="pb-3 min-w-0">
                <p className="text-[11px] font-semibold text-foreground leading-tight">{m.label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {m.time && (
                    <span className="text-[10px] text-muted-foreground font-mono">{m.time}</span>
                  )}
                  {m.speaker && (
                    <span className="text-[10px] text-muted-foreground truncate">{m.speaker}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
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
      <p className={`text-sm font-bold ${
        alert && alert !== "ok" ? "" : "text-foreground"
      }`}>
        {seconds !== undefined ? formatDuration(seconds) : "—"}
      </p>
    </div>
  );
}

/* ─── Main Dialog ───────────────────────────────────────────────── */

const UraContextDialog = ({ open, onOpenChange, rawText, atendente }: UraContextDialogProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["jornada_resumo", "fluxo", "jornada", "eventos"]));

  const uraContext = useMemo(() => {
    if (!rawText) return null;
    return extractUraContext(rawText, atendente);
  }, [rawText, atendente]);

  const timeline = useMemo(() => {
    if (!rawText) return null;
    return buildJourneyTimeline(rawText, atendente);
  }, [rawText, atendente]);

  const sections: SectionConfig[] = useMemo(() => {
    if (!uraContext || uraContext.status === "no_ura") return [];

    const fluxoItems: { label: string; value: string }[] = [];
    const jornadaItems: { label: string; value: string }[] = [];
    const eventosItems: { label: string; value: string }[] = [];

    for (const item of uraContext.items) {
      const label = item.label.toLowerCase();
      if (label.includes("protocolo") || label.includes("entrada") || label.includes("autenticação")) {
        fluxoItems.push(item);
      } else if (label.includes("opção") || label.includes("menu") || label.includes("motivo") || label.includes("caminho")) {
        jornadaItems.push(item);
      } else {
        eventosItems.push(item);
      }
    }

    return [
      { title: "Identificação do Fluxo", icon: Phone, items: fluxoItems },
      { title: "Jornada do Cliente", icon: Route, items: jornadaItems },
      { title: "Eventos Relevantes", icon: AlertTriangle, items: eventosItems },
    ].filter(s => s.items.length > 0);
  }, [uraContext]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const sectionKeys = ["fluxo", "jornada", "eventos"];
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
            {/* Missing raw text — data integrity issue */}
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

            {/* URA only — no human agent */}
            {status === "ura_only" && (
              <div className="flex flex-col items-center text-center py-6 mb-3">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-3">
                  <Bot className="h-5 w-5 text-warning" />
                </div>
                <p className="text-sm font-semibold text-foreground">URA sem atendente</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Este atendimento foi composto apenas por mensagens automáticas. Nenhum atendente humano foi identificado.
                </p>
              </div>
            )}

            {/* Ambiguous URA */}
            {status === "ura_ambiguous" && (
              <div className="flex flex-col items-center text-center py-6 mb-3">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-semibold text-foreground">URA não identificada com segurança</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Foram detectadas mensagens automáticas, mas não foi possível classificar o fluxo da URA com precisão.
                </p>
              </div>
            )}

            {/* Data sections — for with_ura, ura_only, ura_ambiguous with items */}
            {(status === "with_ura" || ((status === "ura_only" || status === "ura_ambiguous") && hasData)) && (
              <>
                {/* ★ Journey Summary — new section */}
                {showJourney && <JourneySummary timeline={timeline!} />}

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

                {/* Collapsible sections */}
                {sections.map((section, idx) => {
                  const key = sectionKeys[idx] || `section-${idx}`;
                  const isOpen = expandedSections.has(key);
                  const Icon = section.icon;
                  return (
                    <Collapsible key={key} open={isOpen} onOpenChange={() => toggleSection(key)}>
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

            {/* with_ura but no extracted data */}
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
