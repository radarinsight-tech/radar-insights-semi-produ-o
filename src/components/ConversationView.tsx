import { useMemo } from "react";
import { User, Bot, MessageSquare } from "lucide-react";

interface ConversationMessage {
  speaker: string;
  role: "atendente" | "cliente" | "bot" | "sistema";
  text: string;
  time?: string;
}

interface ConversationViewProps {
  rawText: string;
  atendente?: string;
}

/** Known bot/system names */
const BOT_NAMES = new Set([
  "marte", "bot", "sistema", "robô", "robo", "automático", "automatico",
  "assistente virtual", "chatbot",
]);

function isBotName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return BOT_NAMES.has(lower) || /^(bot|sistema|robô|robo)\b/i.test(lower);
}

/**
 * Parse raw PDF text into structured conversation messages.
 * Supports common patterns:
 *  - "Name (HH:MM): message"
 *  - "[HH:MM] Name: message"
 *  - "Name: message"
 *  - "HH:MM - Name: message"
 */
function parseConversation(rawText: string, knownAtendente?: string): ConversationMessage[] {
  const lines = rawText.split("\n");
  const messages: ConversationMessage[] = [];

  // Detect "Cliente:" label in header to identify client name
  const clienteLabelMatch = rawText.match(/(?:cliente|solicitante|requerente)\s*[:\-]\s*([^\n\r]+)/i);
  const clienteName = clienteLabelMatch?.[1]?.trim().split(/[,\-\|\/]/)[0].trim().toLowerCase();

  // Regex patterns for speaker lines
  const patterns = [
    // "Name (14:30): message"
    /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]+?)\s*\((\d{2}:\d{2})\)\s*:\s*(.+)/,
    // "[14:30] Name: message"
    /^\[(\d{2}:\d{2})\]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]+?)\s*:\s*(.+)/,
    // "14:30 - Name: message"
    /^(\d{2}:\d{2})\s*[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]+?)\s*:\s*(.+)/,
    // "Name: message" (no time)
    /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{2,30}?)\s*:\s*(.+)/,
  ];

  let currentMessage: ConversationMessage | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentMessage) currentMessage.text += "\n";
      continue;
    }

    let matched = false;

    for (let pi = 0; pi < patterns.length; pi++) {
      const match = trimmed.match(patterns[pi]);
      if (!match) continue;

      let speaker: string;
      let time: string | undefined;
      let text: string;

      if (pi === 0) {
        // Name (time): text
        speaker = match[1].trim();
        time = match[2];
        text = match[3].trim();
      } else if (pi === 1 || pi === 2) {
        // [time] Name: text  OR  time - Name: text
        time = match[1];
        speaker = match[2].trim();
        text = match[3].trim();
      } else {
        // Name: text (no time)
        speaker = match[1].trim();
        text = match[2].trim();
      }

      // Determine role
      const role = classifyRole(speaker, knownAtendente, clienteName);

      // Push previous message
      if (currentMessage) {
        currentMessage.text = currentMessage.text.trim();
        messages.push(currentMessage);
      }

      currentMessage = { speaker, role, text, time };
      matched = true;
      break;
    }

    if (!matched && currentMessage) {
      // Continuation of previous message
      currentMessage.text += "\n" + trimmed;
    } else if (!matched && !currentMessage) {
      // Header/preamble text — store as sistema
      if (currentMessage) {
        currentMessage.text = currentMessage.text.trim();
        messages.push(currentMessage);
      }
      currentMessage = { speaker: "Sistema", role: "sistema", text: trimmed };
    }
  }

  if (currentMessage) {
    currentMessage.text = currentMessage.text.trim();
    messages.push(currentMessage);
  }

  return messages;
}

function classifyRole(
  speaker: string,
  knownAtendente?: string,
  clienteName?: string
): "atendente" | "cliente" | "bot" | "sistema" {
  const lower = speaker.toLowerCase().trim();

  if (isBotName(speaker)) return "bot";

  // Check explicit keywords
  if (/^(sistema|info|aviso|nota)\b/i.test(speaker)) return "sistema";

  // If we know the atendente name, match against it
  if (knownAtendente) {
    const atenLower = knownAtendente.toLowerCase().trim();
    if (lower === atenLower || lower.includes(atenLower) || atenLower.includes(lower)) {
      return "atendente";
    }
  }

  // If we know the client name, match it
  if (clienteName && (lower === clienteName || lower.includes(clienteName) || clienteName.includes(lower))) {
    return "cliente";
  }

  // Fallback heuristic: if no known names, return "atendente" for unrecognized
  return "atendente";
}

const roleConfig = {
  atendente: {
    label: "Atendente",
    icon: User,
    bgClass: "bg-primary/10",
    borderClass: "border-l-primary",
    nameClass: "text-primary",
  },
  cliente: {
    label: "Cliente",
    icon: MessageSquare,
    bgClass: "bg-accent/10",
    borderClass: "border-l-accent",
    nameClass: "text-accent",
  },
  bot: {
    label: "Bot",
    icon: Bot,
    bgClass: "bg-muted/50",
    borderClass: "border-l-muted-foreground",
    nameClass: "text-muted-foreground",
  },
  sistema: {
    label: "Sistema",
    icon: Bot,
    bgClass: "bg-muted/30",
    borderClass: "border-l-border",
    nameClass: "text-muted-foreground",
  },
};

const ConversationView = ({ rawText, atendente }: ConversationViewProps) => {
  const messages = useMemo(() => parseConversation(rawText, atendente), [rawText, atendente]);

  // If parsing found very few structured messages, fall back to raw text
  const hasStructure = messages.filter((m) => m.role !== "sistema").length >= 2;

  if (!hasStructure) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed text-foreground border border-border">
        {rawText}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
      {messages.map((msg, i) => {
        const config = roleConfig[msg.role];
        const Icon = config.icon;

        return (
          <div
            key={i}
            className={`rounded-lg border-l-3 ${config.borderClass} ${config.bgClass} p-3`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-3.5 w-3.5 ${config.nameClass}`} />
              <span className={`text-xs font-semibold ${config.nameClass}`}>
                {msg.speaker}
              </span>
              {msg.time && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {msg.time}
                </span>
              )}
            </div>
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap pl-5.5">
              {msg.text}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationView;
