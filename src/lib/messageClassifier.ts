/**
 * Message Classifier — separates chat messages into URA, TEMPLATE, and HUMANO layers.
 * Designed for robustness: classification failures default to HUMANO (never blocks import).
 */

export type MessageCategory = "URA" | "TEMPLATE_INFORMATIVO" | "TEMPLATE_CONVERSACIONAL" | "HUMANO";

export interface ClassifiedMessage {
  speaker: string;
  role: "atendente" | "cliente" | "bot" | "sistema";
  text: string;
  time?: string;
  date?: string;
  category: MessageCategory;
}

// ─── URA detection ───────────────────────────────────────────────

const URA_SPEAKERS = new Set([
  "marte", "bot", "sistema", "ura", "robô", "robo",
  "assistente virtual", "chatbot", "automatico", "automático",
  "especialista virtual",
]);

const URA_PATTERNS = [
  /protocolo\s*(de\s+atendimento)?[\s:]*\d/i,
  /bem[- ]?vindo|olá!?\s*(eu\s+sou|me\s+chamo|meu\s+nome)/i,
  /digite\s+o?\s*(número|opção|cpf|cnpj)/i,
  /menu\s+(principal|de\s+opções)/i,
  /escolha\s+uma?\s+(das\s+)?opç/i,
  /informe\s+(seu|o)\s+(cpf|cnpj|número)/i,
  /transferindo\s+(para|ao|você)/i,
  /encaminhando\s+(para|ao|seu)/i,
  /aguarde\s+(enquanto|um\s+momento|que)/i,
  /pesquisa\s+de\s+satisfação/i,
  /avalie\s+(nosso|o)\s+atendimento/i,
  /nota\s+de\s+\d+\s+a\s+\d+/i,
  /atendimento\s+será\s+transferido/i,
  /fila\s+de\s+atendimento/i,
  /setor\s+responsável/i,
  /descreva\s+(seu|o)\s+problema/i,
  /lembrete.*pesquisa\s+não\s+respondida/i,
  /opção\s+inválida/i,
  /não\s+entendi.*tente\s+novamente/i,
];

// ─── Template detection ──────────────────────────────────────────

const TEMPLATE_VARIABLE_PATTERN = /\{\{[^}]+\}\}|\[NOME[^\]]*\]|\[PLANO[^\]]*\]|\[VALOR[^\]]*\]|\[DATA[^\]]*\]|\[EMPRESA[^\]]*\]/i;

const TEMPLATE_INFORMATIVO_PATTERNS = [
  /segue\s+(abaixo|as?\s+informaç)/i,
  /confira\s+(abaixo|as?\s+opções)/i,
  /acesse\s+(o\s+link|pelo\s+app|nosso\s+site)/i,
  /passo\s+a\s+passo/i,
  /(?:1[°º]|primeiro)\s+passo/i,
  /benefícios\s+(disponíveis|inclusos|do\s+plano)/i,
  /canais\s+de\s+atendimento/i,
  /horário\s+de\s+funcionamento/i,
  /www\.\S+\.\S+/i,
  /https?:\/\/\S+/i,
];

const TEMPLATE_CONVERSACIONAL_PATTERNS = [
  /meu\s+nome\s+é\s+\S+.*como\s+posso\s+(te\s+)?ajudar/i,
  /obrigad[oa]\s+por\s+(entrar\s+em\s+contato|nos\s+procurar|aguardar)/i,
  /foi\s+um\s+prazer\s+atend/i,
  /posso\s+ajudar\s+em\s+algo\s+mais/i,
  /caso\s+precise.*estamos\s+à\s+disposição/i,
  /fico\s+à\s+disposição/i,
  /tenha\s+um\s+(ótimo|bom|excelente)\s+(dia|tarde|noite)/i,
  /agradecemos\s+(o\s+contato|a\s+preferência|sua\s+paciência)/i,
  /estou\s+assumindo\s+(seu|o)\s+atendimento/i,
];

// ─── Thresholds ──────────────────────────────────────────────────

const TEMPLATE_MIN_LENGTH = 200; // chars for informational template detection

// ─── Classifier ──────────────────────────────────────────────────

function isUraSpeaker(speaker: string): boolean {
  return URA_SPEAKERS.has(speaker.toLowerCase().trim());
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

export function classifyMessage(
  speaker: string,
  role: "atendente" | "cliente" | "bot" | "sistema",
  text: string,
): MessageCategory {
  try {
    const trimmed = text.trim();

    // 1. URA: bot/sistema speakers or URA-patterned content from known bots
    if (role === "bot" || role === "sistema" || isUraSpeaker(speaker)) {
      if (matchesAny(trimmed, URA_PATTERNS)) return "URA";
      // Long bot messages with lists → informational template
      if (trimmed.length >= TEMPLATE_MIN_LENGTH && matchesAny(trimmed, TEMPLATE_INFORMATIVO_PATTERNS)) {
        return "TEMPLATE_INFORMATIVO";
      }
      return "URA"; // default for bot/sistema
    }

    // 2. Cliente messages are always HUMANO
    if (role === "cliente") return "HUMANO";

    // 3. Atendente messages: check for templates
    if (TEMPLATE_VARIABLE_PATTERN.test(trimmed)) return "TEMPLATE_CONVERSACIONAL";

    // Informational templates: long + pattern match
    if (trimmed.length >= TEMPLATE_MIN_LENGTH && matchesAny(trimmed, TEMPLATE_INFORMATIVO_PATTERNS)) {
      return "TEMPLATE_INFORMATIVO";
    }

    // Conversational templates
    if (matchesAny(trimmed, TEMPLATE_CONVERSACIONAL_PATTERNS)) {
      // Short conversational templates from attendants are borderline — 
      // only classify if the message is relatively short (likely a canned response)
      if (trimmed.length < 300) return "TEMPLATE_CONVERSACIONAL";
    }

    // Default for attendant: HUMANO
    return "HUMANO";
  } catch {
    // Never block on classification failure
    return "HUMANO";
  }
}

export function classifyMessages(
  messages: Array<{ speaker: string; role: "atendente" | "cliente" | "bot" | "sistema"; text: string; time?: string; date?: string }>
): ClassifiedMessage[] {
  return messages.map(msg => ({
    ...msg,
    category: classifyMessage(msg.speaker, msg.role, msg.text),
  }));
}

// ─── Filtering helpers ───────────────────────────────────────────

export function getHumanMessages(classified: ClassifiedMessage[]): ClassifiedMessage[] {
  return classified.filter(m =>
    m.category === "HUMANO" || m.role === "cliente" ||
    (m.category === "TEMPLATE_CONVERSACIONAL" && m.role === "atendente")
  );
}

export function getUraMessages(classified: ClassifiedMessage[]): ClassifiedMessage[] {
  return classified.filter(m => m.category === "URA");
}

export function getTemplateMessages(classified: ClassifiedMessage[]): ClassifiedMessage[] {
  return classified.filter(m =>
    m.category === "TEMPLATE_INFORMATIVO" ||
    (m.category === "TEMPLATE_CONVERSACIONAL" && m.role !== "cliente")
  );
}
