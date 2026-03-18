import { useMemo } from "react";
import { User, Bot, MessageSquare, Clock } from "lucide-react";

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

/** Known bot/system names */
const BOT_NAMES = new Set([
  "marte", "bot", "sistema", "robô", "robo", "automático", "automatico",
  "assistente virtual", "chatbot", "ura",
]);

const SYSTEM_KEYWORDS = /^(sistema|info|aviso|nota|notificação|alerta|transferência|fila)\b/i;

function isBotName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return BOT_NAMES.has(lower) || /^(bot|sistema|robô|robo|marte|ura)\b/i.test(lower);
}

/**
 * Extended parser: handles many common chat-export formats from PDFs.
 * Patterns supported:
 *  - "Name (DD/MM/AAAA HH:MM:SS): message"
 *  - "Name (HH:MM): message"
 *  - "[HH:MM] Name: message"
 *  - "[DD/MM/AAAA HH:MM] Name: message"
 *  - "HH:MM - Name: message"
 *  - "DD/MM/AAAA HH:MM - Name: message"
 *  - "Name - DD/MM/AAAA HH:MM:SS" followed by message on next line
 *  - "Name: message"
 *  - Lines starting with date/time then speaker
 */
function parseConversation(rawText: string, knownAtendente?: string): ConversationMessage[] {
  const lines = rawText.split("\n");
  const messages: ConversationMessage[] = [];

  // Detect "Cliente:" label in header to identify client name
  const clienteLabelMatch = rawText.match(/(?:cliente|solicitante|requerente)\s*[:\-]\s*([^\n\r]+)/i);
  const clienteName = clienteLabelMatch?.[1]?.trim().split(/[,\-\|\/]/)[0].trim().toLowerCase();

  // Regex patterns for speaker lines — ordered from most specific to least
  const patterns: {
    regex: RegExp;
    extract: (m: RegExpMatchArray) => { speaker: string; time?: string; date?: string; text: string };
  }[] = [
    {
      // "Name (DD/MM/AAAA HH:MM:SS): message"
      regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*\((\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\)\s*:\s*(.+)/,
      extract: (m) => ({ speaker: m[1].trim(), date: m[2], time: m[3], text: m[4].trim() }),
    },
    {
      // "Name (HH:MM): message"
      regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*\((\d{2}:\d{2}(?::\d{2})?)\)\s*:\s*(.+)/,
      extract: (m) => ({ speaker: m[1].trim(), time: m[2], text: m[3].trim() }),
    },
    {
      // "[DD/MM/AAAA HH:MM] Name: message"
      regex: /^\[(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/,
      extract: (m) => ({ speaker: m[3].trim(), date: m[1], time: m[2], text: m[4].trim() }),
    },
    {
      // "[HH:MM] Name: message"
      regex: /^\[(\d{2}:\d{2}(?::\d{2})?)\]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/,
      extract: (m) => ({ speaker: m[2].trim(), time: m[1], text: m[3].trim() }),
    },
    {
      // "DD/MM/AAAA HH:MM - Name: message"
      regex: /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s*[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/,
      extract: (m) => ({ speaker: m[3].trim(), date: m[1], time: m[2], text: m[4].trim() }),
    },
    {
      // "HH:MM - Name: message"
      regex: /^(\d{2}:\d{2}(?::\d{2})?)\s*[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/,
      extract: (m) => ({ speaker: m[2].trim(), time: m[1], text: m[3].trim() }),
    },
    {
      // "Name - DD/MM/AAAA HH:MM:SS" (message on next line — text captured as empty, continued below)
      regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s*$/,
      extract: (m) => ({ speaker: m[1].trim(), date: m[2], time: m[3], text: "" }),
    },
    {
      // "Name: message" (no time)
      regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,30}?)\s*:\s*(.+)/,
      extract: (m) => ({ speaker: m[1].trim(), text: m[2].trim() }),
    },
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

      // Skip very short speaker names that are likely not names
      if (extracted.speaker.length < 2) continue;

      const role = classifyRole(extracted.speaker, knownAtendente, clienteName);

      pushCurrent();
      currentMessage = {
        speaker: extracted.speaker,
        role,
        text: extracted.text,
        time: extracted.time,
        date: extracted.date,
      };
      matched = true;
      break;
    }

    if (!matched && currentMessage) {
      // Continuation of previous message
      currentMessage.text += "\n" + trimmed;
    } else if (!matched && !currentMessage) {
      // Header/preamble — store as sistema
      currentMessage = { speaker: "Sistema", role: "sistema", text: trimmed };
    }
  }

  pushCurrent();
  return messages;
}

function classifyRole(
  speaker: string,
  knownAtendente?: string,
  clienteName?: string,
): "atendente" | "cliente" | "bot" | "sistema" {
  const lower = speaker.toLowerCase().trim();

  if (isBotName(speaker)) return "bot";
  if (SYSTEM_KEYWORDS.test(speaker)) return "sistema";

  // Match known atendente
  if (knownAtendente) {
    const atenLower = knownAtendente.toLowerCase().trim();
    if (lower === atenLower || lower.includes(atenLower) || atenLower.includes(lower)) {
      return "atendente";
    }
  }

  // Match known client
  if (clienteName && (lower === clienteName || lower.includes(clienteName) || clienteName.includes(lower))) {
    return "cliente";
  }

  // Fallback: if speaker looks like "Cliente" keyword
  if (/^cliente\b/i.test(speaker)) return "cliente";

  return "atendente";
}

const roleConfig = {
  atendente: {
    label: "Atendente",
    icon: User,
    bgClass: "bg-primary/10",
    borderClass: "border-l-primary",
    nameClass: "text-primary",
    bubbleClass: "bg-primary/5 border-primary/20",
    align: "items-start" as const,
  },
  cliente: {
    label: "Cliente",
    icon: MessageSquare,
    bgClass: "bg-accent/10",
    borderClass: "border-l-accent",
    nameClass: "text-accent",
    bubbleClass: "bg-accent/5 border-accent/20",
    align: "items-end" as const,
  },
  bot: {
    label: "Bot",
    icon: Bot,
    bgClass: "bg-muted/40",
    borderClass: "border-l-muted-foreground",
    nameClass: "text-muted-foreground",
    bubbleClass: "bg-muted/30 border-border",
    align: "items-start" as const,
  },
  sistema: {
    label: "Sistema",
    icon: Bot,
    bgClass: "bg-muted/20",
    borderClass: "border-l-border",
    nameClass: "text-muted-foreground",
    bubbleClass: "bg-muted/20 border-border/50",
    align: "items-center" as const,
  },
};

const ConversationView = ({ rawText, atendente }: ConversationViewProps) => {
  const messages = useMemo(() => parseConversation(rawText, atendente), [rawText, atendente]);

  // If parsing found very few structured messages, fall back to improved raw display
  const hasStructure = messages.filter((m) => m.role !== "sistema").length >= 2;

  if (!hasStructure) {
    // Improved fallback: break text into paragraphs and add visual separation
    const paragraphs = rawText.split(/\n{2,}/).filter(Boolean);
    return (
      <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border bg-muted/20 p-5 space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap font-mono break-words">
            {p.trim()}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border bg-background/50 p-3 space-y-1.5">
      {messages.map((msg, i) => {
        const config = roleConfig[msg.role];
        const Icon = config.icon;
        const isClient = msg.role === "cliente";
        const isSistema = msg.role === "sistema";

        // Sistema messages: compact centered divider
        if (isSistema) {
          return (
            <div key={i} className="flex justify-center py-1">
              <div className="text-[10px] text-muted-foreground/70 bg-muted/30 rounded-full px-3 py-1 max-w-[80%] text-center truncate">
                {msg.text}
              </div>
            </div>
          );
        }

        return (
          <div
            key={i}
            className={`flex flex-col ${isClient ? "items-end" : "items-start"} max-w-[85%] ${isClient ? "ml-auto" : "mr-auto"}`}
          >
            {/* Speaker name + time */}
            <div className={`flex items-center gap-1.5 mb-0.5 px-1 ${isClient ? "flex-row-reverse" : ""}`}>
              <div className={`flex items-center justify-center h-5 w-5 rounded-full ${config.bgClass}`}>
                <Icon className={`h-3 w-3 ${config.nameClass}`} />
              </div>
              <span className={`text-[10px] font-semibold ${config.nameClass}`}>
                {msg.speaker}
              </span>
              {(msg.time || msg.date) && (
                <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {msg.date && <span>{msg.date}</span>}
                  {msg.time && <span>{msg.time}</span>}
                </span>
              )}
            </div>

            {/* Message bubble */}
            <div
              className={`rounded-xl border px-3 py-2 ${config.bubbleClass} ${
                isClient ? "rounded-tr-sm" : "rounded-tl-sm"
              }`}
            >
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {msg.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationView;
