import { useMemo, useState } from "react";
import { User, Bot, MessageSquare, Clock, ChevronDown, ChevronRight, Radio, FileText, MessageCircle } from "lucide-react";
import { classifyMessages, type ClassifiedMessage, type MessageCategory } from "@/lib/messageClassifier";
import { summarizeUraContext, type UraContext } from "@/lib/uraContextSummarizer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────

interface ConversationMessage {
  speaker: string;
  role: "atendente" | "cliente" | "bot" | "sistema";
  text: string;
  time?: string;
  date?: string;
}

interface ConversationViewProps {
  rawText: string;
  atendente?: string;
}

// ─── Bot / system detection ──────────────────────────────────────

const BOT_NAMES = new Set([
  "marte", "bot", "sistema", "robô", "robo", "automático", "automatico",
  "assistente virtual", "chatbot", "ura",
]);

const SYSTEM_KEYWORDS = /^(sistema|info|aviso|nota|notificação|alerta|transferência|fila)\b/i;

function isBotName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return BOT_NAMES.has(lower) || /^(bot|sistema|robô|robo|marte|ura)\b/i.test(lower);
}

// ─── Parser ──────────────────────────────────────────────────────

function parseConversation(rawText: string, knownAtendente?: string): ConversationMessage[] {
  const lines = rawText.split("\n");
  const messages: ConversationMessage[] = [];

  const clienteLabelMatch = rawText.match(/(?:cliente|solicitante|requerente)\s*[:\-]\s*([^\n\r]+)/i);
  const clienteName = clienteLabelMatch?.[1]?.trim().split(/[,\-\|\/]/)[0].trim().toLowerCase();

  const patterns: {
    regex: RegExp;
    extract: (m: RegExpMatchArray) => { speaker: string; time?: string; date?: string; text: string };
  }[] = [
    { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*\((\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\)\s*:\s*(.+)/, extract: (m) => ({ speaker: m[1].trim(), date: m[2], time: m[3], text: m[4].trim() }) },
    { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*\((\d{2}:\d{2}(?::\d{2})?)\)\s*:\s*(.+)/, extract: (m) => ({ speaker: m[1].trim(), time: m[2], text: m[3].trim() }) },
    { regex: /^\[(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/, extract: (m) => ({ speaker: m[3].trim(), date: m[1], time: m[2], text: m[4].trim() }) },
    { regex: /^\[(\d{2}:\d{2}(?::\d{2})?)\]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/, extract: (m) => ({ speaker: m[2].trim(), time: m[1], text: m[3].trim() }) },
    { regex: /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s*[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/, extract: (m) => ({ speaker: m[3].trim(), date: m[1], time: m[2], text: m[4].trim() }) },
    { regex: /^(\d{2}:\d{2}(?::\d{2})?)\s*[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/, extract: (m) => ({ speaker: m[2].trim(), time: m[1], text: m[3].trim() }) },
    { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s*$/, extract: (m) => ({ speaker: m[1].trim(), date: m[2], time: m[3], text: "" }) },
    { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,30}?)\s*:\s*(.+)/, extract: (m) => ({ speaker: m[1].trim(), text: m[2].trim() }) },
  ];

  let currentMessage: ConversationMessage | null = null;

  const pushCurrent = () => {
    if (currentMessage) {
      currentMessage.text = currentMessage.text.trim();
      if (currentMessage.text || currentMessage.role === "sistema") {
        messages.push(currentMessage);
      }
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentMessage) currentMessage.text += "\n";
      continue;
    }

    let matched = false;
    for (const pattern of patterns) {
      const match = trimmed.match(pattern.regex);
      if (!match) continue;
      const extracted = pattern.extract(match);
      if (extracted.speaker.length < 2) continue;
      const role = classifyRole(extracted.speaker, knownAtendente, clienteName);
      pushCurrent();
      currentMessage = { speaker: extracted.speaker, role, text: extracted.text, time: extracted.time, date: extracted.date };
      matched = true;
      break;
    }

    if (!matched && currentMessage) {
      currentMessage.text += "\n" + trimmed;
    } else if (!matched && !currentMessage) {
      currentMessage = { speaker: "Sistema", role: "sistema", text: trimmed };
    }
  }

  pushCurrent();
  return messages;
}

function classifyRole(speaker: string, knownAtendente?: string, clienteName?: string): "atendente" | "cliente" | "bot" | "sistema" {
  const lower = speaker.toLowerCase().trim();
  if (isBotName(speaker)) return "bot";
  if (SYSTEM_KEYWORDS.test(speaker)) return "sistema";
  if (knownAtendente) {
    const atenLower = knownAtendente.toLowerCase().trim();
    if (lower === atenLower || lower.includes(atenLower) || atenLower.includes(lower)) return "atendente";
  }
  if (clienteName && (lower === clienteName || lower.includes(clienteName) || clienteName.includes(lower))) return "cliente";
  if (/^cliente\b/i.test(speaker)) return "cliente";
  return "atendente";
}

// ─── Role config ─────────────────────────────────────────────────

const roleConfig = {
  atendente: { label: "Atendente", icon: User, bgClass: "bg-primary/10", nameClass: "text-primary", bubbleClass: "bg-primary/5 border-primary/20" },
  cliente: { label: "Cliente", icon: MessageSquare, bgClass: "bg-accent/10", nameClass: "text-accent", bubbleClass: "bg-accent/5 border-accent/20" },
  bot: { label: "Bot", icon: Bot, bgClass: "bg-muted/40", nameClass: "text-muted-foreground", bubbleClass: "bg-muted/30 border-border" },
  sistema: { label: "Sistema", icon: Bot, bgClass: "bg-muted/20", nameClass: "text-muted-foreground", bubbleClass: "bg-muted/20 border-border/50" },
};

// ─── Sub-components ──────────────────────────────────────────────

const MessageBubble = ({ msg, isTemplate }: { msg: ClassifiedMessage; isTemplate?: boolean }) => {
  const config = roleConfig[msg.role];
  const Icon = config.icon;
  const isClient = msg.role === "cliente";
  const isSistema = msg.role === "sistema";

  if (isSistema) {
    return (
      <div className="flex justify-center py-1">
        <div className="text-[10px] text-muted-foreground/70 bg-muted/30 rounded-full px-3 py-1 max-w-[80%] text-center truncate">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isClient ? "items-end" : "items-start"} max-w-[85%] ${isClient ? "ml-auto" : "mr-auto"}`}>
      <div className={`flex items-center gap-1.5 mb-0.5 px-1 ${isClient ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center justify-center h-5 w-5 rounded-full ${config.bgClass}`}>
          <Icon className={`h-3 w-3 ${config.nameClass}`} />
        </div>
        <span className={`text-[10px] font-semibold ${config.nameClass}`}>{msg.speaker}</span>
        {isTemplate && (
          <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-muted-foreground/30 text-muted-foreground font-medium">
            Template
          </Badge>
        )}
        {(msg.time || msg.date) && (
          <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {msg.date && <span>{msg.date}</span>}
            {msg.time && <span>{msg.time}</span>}
          </span>
        )}
      </div>
      <div className={`rounded-xl border px-4 py-2.5 ${config.bubbleClass} ${isClient ? "rounded-tr-sm" : "rounded-tl-sm"} ${isTemplate ? "opacity-75" : ""}`}>
        <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
      </div>
    </div>
  );
};

const UraContextBlock = ({ context }: { context: UraContext }) => (
  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
        <Radio className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Contexto do Atendimento (URA)</h3>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {context.items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-[10px] text-muted-foreground font-semibold shrink-0 mt-0.5">{item.label}:</span>
          <span className="text-[12px] text-foreground leading-snug">{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Main component ──────────────────────────────────────────────

const ConversationView = ({ rawText, atendente }: ConversationViewProps) => {
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const { classified, uraContext, humanMessages, templateMessages, hasStructure } = useMemo(() => {
    const parsed = parseConversation(rawText, atendente);
    const hasStruct = parsed.filter(m => m.role !== "sistema").length >= 2;
    if (!hasStruct) return { classified: [], uraContext: null, humanMessages: [], templateMessages: [], hasStructure: false };

    const cls = classifyMessages(parsed);
    const ura = cls.filter(m => m.category === "URA");
    const ctx = summarizeUraContext(ura, cls);
    const human = cls.filter(m =>
      m.category === "HUMANO" || m.role === "cliente" ||
      m.category === "TEMPLATE_CONVERSACIONAL"
    );
    const templates = cls.filter(m =>
      m.category === "TEMPLATE_INFORMATIVO" ||
      (m.category === "TEMPLATE_CONVERSACIONAL" && m.role !== "cliente")
    );

    return { classified: cls, uraContext: ctx, humanMessages: human, templateMessages: templates, hasStructure: true };
  }, [rawText, atendente]);

  if (!hasStructure) {
    const paragraphs = rawText.split(/\n{2,}/).filter(Boolean);
    return (
      <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border bg-muted/20 p-5 space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap font-mono break-words">{p.trim()}</p>
        ))}
      </div>
    );
  }

  const hasUra = uraContext && uraContext.items.length > 0;
  const hasTemplates = templateMessages.length > 0;

  return (
    <div className="max-h-[55vh] overflow-y-auto space-y-4">
      {/* Block 1: URA Context */}
      {hasUra && <UraContextBlock context={uraContext} />}

      {/* Block 2: Human interaction */}
      <div className="rounded-xl border border-border bg-background/50 p-3 space-y-1.5">
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-3 w-3 text-primary" />
          </div>
          <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">Atendimento Humano</h3>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
            {humanMessages.length} msg
          </Badge>
        </div>
        {humanMessages.map((msg, i) => (
          <MessageBubble
            key={i}
            msg={msg}
            isTemplate={msg.category === "TEMPLATE_CONVERSACIONAL"}
          />
        ))}
      </div>

      {/* Block 3: Templates (collapsed) */}
      {hasTemplates && (
        <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full rounded-xl border border-border/50 bg-muted/10 px-4 py-2.5 hover:bg-muted/20 transition-colors">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Templates utilizados
            </span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1">
              {templateMessages.length}
            </Badge>
            <div className="ml-auto">
              {templatesOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-xl border border-border/40 bg-muted/10 p-3 space-y-1.5">
              {templateMessages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} isTemplate />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default ConversationView;
