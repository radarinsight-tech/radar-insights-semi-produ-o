import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio, X, ChevronDown, ChevronRight, Phone, ShieldCheck, Route, MessageSquare,
  ArrowRightLeft, Clock, AlertTriangle
} from "lucide-react";
import { classifyMessages } from "@/lib/messageClassifier";
import { summarizeUraContext, type UraContext } from "@/lib/uraContextSummarizer";

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

const UraContextDialog = ({ open, onOpenChange, rawText, atendente }: UraContextDialogProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["fluxo", "jornada", "eventos"]));

  const uraContext = useMemo(() => {
    if (!rawText) return null;

    // Parse raw text into messages
    const lines = rawText.split("\n");
    const messages: { speaker: string; role: "atendente" | "cliente" | "bot" | "sistema"; text: string; time?: string; date?: string }[] = [];

    const patterns = [
      { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*\((\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\)\s*:\s*(.+)/, extract: (m: RegExpMatchArray) => ({ speaker: m[1].trim(), date: m[2], time: m[3], text: m[4].trim() }) },
      { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*\((\d{2}:\d{2}(?::\d{2})?)\)\s*:\s*(.+)/, extract: (m: RegExpMatchArray) => ({ speaker: m[1].trim(), time: m[2], text: m[3].trim() }) },
      { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,30}?)\s*:\s*(.+)/, extract: (m: RegExpMatchArray) => ({ speaker: m[1].trim(), text: m[2].trim() }) },
    ];

    let current: typeof messages[0] | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let matched = false;
      for (const p of patterns) {
        const match = trimmed.match(p.regex);
        if (match) {
          if (current) messages.push(current);
          const ext = p.extract(match);
          const lower = ext.speaker.toLowerCase();
          const isBotOrSystem = /^(marte|bot|sistema|robô|robo|ura|automático)\b/i.test(lower);
          const isAtendente = atendente && (lower.includes(atendente.toLowerCase()) || atendente.toLowerCase().includes(lower));
          const role = isBotOrSystem ? "bot" as const : isAtendente ? "atendente" as const : "cliente" as const;
          current = { ...ext, role };
          matched = true;
          break;
        }
      }
      if (!matched && current) current.text += "\n" + trimmed;
    }
    if (current) messages.push(current);

    const classified = classifyMessages(messages);
    const ura = classified.filter(m => m.category === "URA");
    return summarizeUraContext(ura, classified);
  }, [rawText, atendente]);

  const sections: SectionConfig[] = useMemo(() => {
    if (!uraContext) return [];

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

  const hasData = sections.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border/60 bg-gradient-to-r from-muted/40 to-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Radio className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <DialogTitle className="text-xs font-extrabold text-foreground uppercase tracking-[0.1em]">
                  Contexto URA
                </DialogTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">Informações pré-atendimento</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-72px)]">
          <div className="p-6 space-y-3">
            {!hasData ? (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <Radio className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Sem dados de URA</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Nenhuma interação automática (URA) foi identificada neste atendimento.
                </p>
              </div>
            ) : (
              <>
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
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UraContextDialog;
