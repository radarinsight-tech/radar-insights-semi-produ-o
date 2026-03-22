/**
 * Structured conversation parser — extracts individual messages with author,
 * timestamp, and role from raw PDF text. Supports multiple export formats
 * including OPA-style block layout.
 *
 * This is the SINGLE SOURCE OF TRUTH for conversation structure.
 */

import { classifyMessages, type ClassifiedMessage } from "./messageClassifier";
import { summarizeUraContext, type UraContext, type UraStatus } from "./uraContextSummarizer";

export interface ParsedMessage {
  speaker: string;
  role: "atendente" | "cliente" | "bot" | "sistema";
  text: string;
  time?: string;
  date?: string;
  /** ISO timestamp when available */
  isoTimestamp?: string;
}

/** Structured conversation ready for persistence */
export interface StructuredConversation {
  messages: ParsedMessage[];
  format: "inline" | "block" | "whatsapp" | "unknown";
  totalMessages: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  /** Whether normalization was applied */
  normalized?: boolean;
}

// Known bot/system speaker names
const BOT_SPEAKERS = /^(marte|bot|sistema|robô|robo|ura|automático|automatico|assistente\s*virtual|chatbot|especialista\s*virtual)\b/i;

// ─── Portuguese month map ───────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  janeiro: "01", fevereiro: "02", "março": "03", marco: "03",
  abril: "04", maio: "05", junho: "06", julho: "07",
  agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

const MONTH_NAMES = "janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

/**
 * Parse Portuguese long date format: "7 de março de 2026 09:34"
 * Returns { date: "07/03/2026", time: "09:34" } or undefined.
 */
function parsePortugueseDate(text: string): { date: string; time: string } | undefined {
  const match = text.match(
    new RegExp(`(\\d{1,2})\\s+de\\s+(${MONTH_NAMES})\\s+de\\s+(\\d{4})\\s+(\\d{2}:\\d{2}(?::\\d{2})?)`, "i")
  );
  if (!match) return undefined;
  const day = match[1].padStart(2, "0");
  const monthKey = match[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const month = MONTH_MAP[monthKey] || MONTH_MAP[match[2].toLowerCase()];
  if (!month) return undefined;
  const year = match[3];
  const time = match[4];
  return { date: `${day}/${month}/${year}`, time };
}

// ─── TEXT NORMALIZATION ─────────────────────────────────────────────
// PDF extractors often strip line breaks, producing flat text like:
//   "Marte6 de março de 2026 11:22Olá! Eu sou Marte..."
// This step re-inserts line breaks to create parseable blocks.

const PT_DATE_REGEX = new RegExp(
  `(\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES})\\s+de\\s+\\d{4}\\s+\\d{2}:\\d{2}(?::\\d{2})?)`,
  "gi"
);

const SHORT_DATE_REGEX = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/g;

/**
 * Check if a line looks like a standalone date (Portuguese or short).
 */
function isDateLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (parsePortugueseDate(trimmed)) return true;
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(trimmed)) return true;
  return false;
}

/**
 * Check if a line looks like a speaker name (short, capitalized, no date/number prefix).
 */
function isNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 50) return false;
  if (/^\d/.test(trimmed)) return false;
  // Must start with a letter
  if (!/^[A-Za-zÀ-ÿ]/.test(trimmed)) return false;
  // Should be short (a name, not a sentence)
  if (trimmed.split(/\s+/).length > 6) return false;
  // Should not contain date patterns
  if (/\d{2}\/\d{2}\/\d{4}/.test(trimmed)) return false;
  if (new RegExp(`\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES})`, "i").test(trimmed)) return false;
  // Allow names with or without colons (some formats use "Name:" on its own line)
  const nameOnly = trimmed.replace(/:$/, "").trim();
  if (nameOnly.length < 2 || nameOnly.length > 45) return false;
  return true;
}

/**
 * Normalize raw PDF text to restore structure by inserting line breaks
 * before dates and speaker names. This is the mandatory pre-processing
 * step before any parsing.
 */
export function normalizeRawText(rawText: string): { text: string; wasNormalized: boolean } {
  if (!rawText) return { text: rawText, wasNormalized: false };

  let normalized = rawText;

  // Step 1: Insert line break BEFORE Portuguese dates (e.g., "6 de março de 2026 11:22")
  normalized = normalized.replace(
    new RegExp(`([^\\n])\\s*(\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES})\\s+de\\s+\\d{4}\\s+\\d{2}:\\d{2})`, "gi"),
    "$1\n$2"
  );

  // Step 2: Insert line break BEFORE short dates (dd/mm/yyyy HH:mm)
  normalized = normalized.replace(
    /([^\n])\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/g,
    "$1\n$2"
  );

  // Step 3: Insert line break AFTER date+time patterns (before message content)
  normalized = normalized.replace(
    new RegExp(`(\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES})\\s+de\\s+\\d{4}\\s+\\d{2}:\\d{2}(?::\\d{2})?)\\s*([A-Za-zÀ-ÿ])`, "gi"),
    "$1\n$2"
  );
  normalized = normalized.replace(
    /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)\s*([A-Za-zÀ-ÿ])/g,
    "$1\n$2"
  );

  // Step 4: If a name is glued to a date, separate them
  // e.g., "Marte6 de março" → "Marte\n6 de março"
  normalized = normalized.replace(
    new RegExp(`^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s'.]{1,40}?)(\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES}))`, "gmi"),
    "$1\n$2"
  );

  // Step 5: Insert line break before capitalized names that precede a date on next line
  normalized = normalized.replace(
    new RegExp(`([.!?…"'])\\s*([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\\s+[A-ZÀ-Ÿa-zà-ÿ]+){0,4})\\s*\\n\\s*(\\d{1,2}\\s+de)`, "gm"),
    "$1\n$2\n$3"
  );

  // Step 6: Separate name on same line as date: "Maylla Ferreira 7 de março..." → separate lines
  normalized = normalized.replace(
    new RegExp(`^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s'.]{1,40})\\s+(\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES})\\s+de\\s+\\d{4}\\s+\\d{2}:\\d{2})`, "gmi"),
    "$1\n$2"
  );

  const wasNormalized = normalized !== rawText;
  return { text: normalized, wasNormalized };
}

// ─── Inline message patterns (ordered by specificity) ───────────────

const MESSAGE_PATTERNS = [
  // "Nome (dd/mm/yyyy HH:mm): text"
  { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,40}?)\s*\((\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\)\s*:\s*(.+)/,
    extract: (m: RegExpMatchArray) => ({ speaker: m[1].trim(), date: m[2], time: m[3], text: m[4].trim() }) },
  // "Nome (HH:mm): text"
  { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,40}?)\s*\((\d{2}:\d{2}(?::\d{2})?)\)\s*:\s*(.+)/,
    extract: (m: RegExpMatchArray) => ({ speaker: m[1].trim(), time: m[2], text: m[3].trim() }) },
  // "[HH:mm] Nome: text"
  { regex: /^\[(\d{2}:\d{2}(?::\d{2})?)\]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,40}?)\s*:\s*(.+)/,
    extract: (m: RegExpMatchArray) => ({ speaker: m[2].trim(), time: m[1], text: m[3].trim() }) },
  // "dd/mm/yyyy HH:mm - Nome: text" (WhatsApp format)
  { regex: /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s*[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,40}?)\s*:\s*(.+)/,
    extract: (m: RegExpMatchArray) => ({ speaker: m[3].trim(), date: m[1], time: m[2], text: m[4].trim() }) },
  // "Nome: text" (simplest)
  { regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,35}?)\s*:\s*(.+)/,
    extract: (m: RegExpMatchArray) => ({ speaker: m[1].trim(), text: m[2].trim() }) },
];

// ─── OPA Block format detection ─────────────────────────────────────

/**
 * Detect if text is in OPA block format where messages are structured as:
 * [Name]
 * [Date in Portuguese] or [dd/mm/yyyy HH:mm]
 * [Message content]
 */
function isBlockFormat(text: string): boolean {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Count how many name+date pairs we find in sequence
  let blockPairs = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (isNameLine(lines[i]) && isDateLine(lines[i + 1])) {
      blockPairs++;
      i++; // skip the date line
    }
  }
  if (blockPairs >= 2) return true;

  // Fallback: check for Portuguese long dates (strong OPA signal)
  const longDates = text.match(new RegExp(`\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES})\\s+de\\s+\\d{4}\\s+\\d{2}:\\d{2}`, "gi"));
  if (longDates && longDates.length >= 2) return true;

  return false;
}

/**
 * Parse OPA-style block format where each message is:
 * Line 1: Speaker name
 * Line 2: Date/time (Portuguese format or dd/mm/yyyy HH:mm)
 * Line 3+: Message content (until next speaker block)
 *
 * Uses a two-pass approach:
 * 1. Find all block start positions (name + date pairs)
 * 2. Extract message content between consecutive block starts
 */
function parseBlockFormat(text: string, atendente?: string): ParsedMessage[] {
  const lines = text.split("\n");
  const messages: ParsedMessage[] = [];

  // First pass: find all block start positions
  const blockStarts: { nameIdx: number; dateIdx: number }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isNameLine(line)) {
      // Look at next non-empty line for a date
      let nextIdx = i + 1;
      while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;
      if (nextIdx < lines.length && isDateLine(lines[nextIdx].trim())) {
        blockStarts.push({ nameIdx: i, dateIdx: nextIdx });
        i = nextIdx; // skip past the date line
      }
    }
  }

  if (blockStarts.length === 0) return [];

  // Second pass: extract messages using block boundaries
  for (let b = 0; b < blockStarts.length; b++) {
    const { nameIdx, dateIdx } = blockStarts[b];
    const speaker = lines[nameIdx].trim().replace(/:$/, "").trim();
    const dateLine = lines[dateIdx].trim();

    const ptDate = parsePortugueseDate(dateLine);
    const shortDate = dateLine.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);
    const date = ptDate?.date || shortDate?.[1];
    const time = ptDate?.time || shortDate?.[2];

    // Message content: from line after date until next block's name line (or end)
    const contentStart = dateIdx + 1;
    const contentEnd = (b + 1 < blockStarts.length)
      ? blockStarts[b + 1].nameIdx
      : lines.length;

    const textLines: string[] = [];
    for (let j = contentStart; j < contentEnd; j++) {
      const msgLine = lines[j].trim();
      if (msgLine) textLines.push(msgLine);
    }

    const role = determineRole(speaker, atendente);
    const isoTs = dateTimeToISO(date, time);

    messages.push({
      speaker,
      role,
      text: textLines.join("\n"),
      time,
      date,
      isoTimestamp: isoTs,
    });
  }

  return messages;
}

// ─── Helpers ────────────────────────────────────────────────────────

function determineRole(speaker: string, atendente?: string): "atendente" | "cliente" | "bot" | "sistema" {
  const lower = speaker.toLowerCase().trim();
  if (BOT_SPEAKERS.test(lower)) return "bot";
  if (/^sistema$/i.test(lower)) return "sistema";
  if (atendente) {
    const atLower = atendente.toLowerCase().trim();
    if (lower === atLower || lower.includes(atLower) || atLower.includes(lower)) return "atendente";
  }
  return "cliente";
}

function dateTimeToISO(date?: string, time?: string): string | undefined {
  if (!date || !time) return undefined;
  const dp = date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!dp) return undefined;
  const tp = time.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!tp) return undefined;
  return `${dp[3]}-${dp[2]}-${dp[1]}T${tp[1]}:${tp[2]}:${tp[3] || "00"}`;
}

/**
 * Parse raw conversation text into structured messages.
 * Applies normalization first, then detects format (block vs inline).
 */
export function parseConversationText(rawText: string, atendente?: string): ParsedMessage[] {
  if (!rawText) return [];

  // MANDATORY: normalize text before parsing
  const { text: normalized } = normalizeRawText(rawText);

  // Try OPA block format first
  if (isBlockFormat(normalized)) {
    const blockMessages = parseBlockFormat(normalized, atendente);
    if (blockMessages.length >= 2) return blockMessages;
  }

  // Fall back to inline pattern matching
  const lines = normalized.split("\n");
  const messages: ParsedMessage[] = [];
  let current: ParsedMessage | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;
    for (const p of MESSAGE_PATTERNS) {
      const match = trimmed.match(p.regex);
      if (match) {
        if (current) messages.push(current);
        const ext = p.extract(match) as Partial<ParsedMessage> & { speaker: string; text: string };
        const role = determineRole(ext.speaker, atendente);
        const isoTs = dateTimeToISO(ext.date as string | undefined, ext.time as string | undefined);
        current = { ...ext, role, isoTimestamp: isoTs } as ParsedMessage;
        matched = true;
        break;
      }
    }
    if (!matched && current) {
      current.text += "\n" + trimmed;
    }
  }
  if (current) messages.push(current);

  return messages;
}

/**
 * Full structured parse: returns a StructuredConversation object
 * suitable for persistence and downstream use.
 */
export function parseStructuredConversation(rawText: string, atendente?: string): StructuredConversation {
  if (!rawText) {
    return { messages: [], format: "unknown", totalMessages: 0 };
  }

  // MANDATORY: normalize first
  const { text: normalized, wasNormalized } = normalizeRawText(rawText);

  const isBlock = isBlockFormat(normalized);
  let messages: ParsedMessage[];
  let format: StructuredConversation["format"];

  if (isBlock) {
    messages = parseBlockFormat(normalized, atendente);
    format = messages.length >= 2 ? "block" : "unknown";
  } else {
    messages = [];
    format = "unknown";
  }

  // If block didn't yield results, try inline
  if (messages.length < 2) {
    // Use normalized text for inline parsing too
    const lines = normalized.split("\n");
    const inlineMessages: ParsedMessage[] = [];
    let current: ParsedMessage | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let matched = false;
      for (const p of MESSAGE_PATTERNS) {
        const match = trimmed.match(p.regex);
        if (match) {
          if (current) inlineMessages.push(current);
          const ext = p.extract(match) as Partial<ParsedMessage> & { speaker: string; text: string };
          const role = determineRole(ext.speaker, atendente);
          const isoTs = dateTimeToISO(ext.date as string | undefined, ext.time as string | undefined);
          current = { ...ext, role, isoTimestamp: isoTs } as ParsedMessage;
          matched = true;
          break;
        }
      }
      if (!matched && current) {
        current.text += "\n" + trimmed;
      }
    }
    if (current) inlineMessages.push(current);

    if (inlineMessages.length >= 2) {
      messages = inlineMessages;
      const hasWhatsApp = rawText.match(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s*[-–]/);
      format = hasWhatsApp ? "whatsapp" : "inline";
    }
  }

  const timestamps = messages.map(m => m.isoTimestamp).filter(Boolean) as string[];

  return {
    messages,
    format,
    totalMessages: messages.length,
    firstTimestamp: timestamps[0],
    lastTimestamp: timestamps[timestamps.length - 1],
    normalized: wasNormalized,
  };
}

/**
 * Full pipeline: parse → classify → summarize URA context.
 * Falls back to raw-text scanning when structured parsing fails.
 */
export function extractUraContext(rawText: string, atendente?: string): UraContext {
  const messages = parseConversationText(rawText, atendente);

  // If structured parsing found enough messages, use the full pipeline
  if (messages.length >= 2) {
    const classified = classifyMessages(messages);
    const ura = classified.filter(m => m.category === "URA");
    const ctx = summarizeUraContext(ura, classified);
    // If pipeline found URA or text doesn't have URA signals, return as-is
    if (ctx.status !== "no_ura" || !hasRawUraSignals(rawText)) {
      return ctx;
    }
  }

  // Fallback: scan raw text directly for URA indicators
  return extractUraFromRawText(rawText);
}

// ─── Raw-text URA detection (fallback) ──────────────────────────────

/** Quick check: does the raw text contain any URA-like signals? */
function hasRawUraSignals(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\bmarte\b/i.test(lower) ||
    /\btransferiu\s+(o\s+)?atendimento/i.test(lower) ||
    /\bassumiu\s+(o\s+)?atendimento/i.test(lower) ||
    /em\s+que\s+posso\s+(lhe\s+)?auxili/i.test(lower) ||
    /menu\s+(principal|de\s+opções)/i.test(lower) ||
    /digite\s+(o?\s*)?(número|opção|cpf)/i.test(lower) ||
    /protocolo\s*(de\s+atendimento)?[\s:]*\d/i.test(lower) ||
    /pesquisa\s+de\s+satisfação/i.test(lower) ||
    /fila\s+de\s+atendimento/i.test(lower)
  );
}

/** Patterns for detecting URA elements directly in raw text */
const RAW_URA_PATTERNS = {
  protocolo: /protocolo[\s:]*([A-Z]*\d[\d.\-/A-Z]+)/i,
  marte: /\bmarte\b/i,
  saudacao: /(?:bem[- ]?vindo|olá|oi)[!,.]?\s*(?:eu\s+sou|me\s+chamo|meu\s+nome|como\s+posso|em\s+que\s+posso)/i,
  menu: /(?:em\s+que\s+posso\s+(?:lhe\s+)?auxili|escolha\s+uma|selecione|opç(?:ão|ões)|menu)/i,
  menuBlock: /(?:vendas|auto\s*desbloqueio|boleto|atendimento\s+geral|suporte\s+t[eé]cnico|financeiro|comercial|cancelamento)/i,
  autenticacao: /(?:informe\s+(?:seu|o)\s+(?:cpf|cnpj)|digite\s+(?:seu|o)\s+(?:cpf|cnpj)|cpf\/cnpj|autenticação)/i,
  autenticacaoResposta: /\b\d{3}[\d.\-/]{5,}\b/,
  transferencia: /(?:transferi(?:u|ndo)|encaminha(?:ndo|do)|assumiu\s+(?:o\s+)?atendimento|atendimento\s+(?:será\s+)?transferido|setor\s+responsável)/i,
  pesquisa: /(?:pesquisa\s+de\s+satisfação|avalie\s+(?:nosso|o)\s+atendimento|nota\s+de\s+\d+\s+a\s+\d+)/i,
  lembrete: /(?:lembrete|pesquisa\s+não\s+respondida)/i,
  problema: /(?:descreva\s+(?:seu|o)\s+(?:problema|assunto|motivo)|qual\s+(?:é\s+)?(?:o\s+)?(?:seu\s+)?(?:problema|assunto|motivo))/i,
  fila: /(?:fila\s+de\s+atendimento|aguarde|um\s+momento)/i,
  audio: /(?:\.mp3|\.wav|\.ogg|\.m4a|gravac[aã]o.?de.?voz|mensagem\s+de\s+voz|download\s+de\s+[aá]udio)/i,
};

/** Extract URA context directly from raw text when structured parsing fails */
function extractUraFromRawText(text: string): UraContext {
  if (!hasRawUraSignals(text)) {
    return { items: [], status: "no_ura" };
  }

  const items: { label: string; value: string }[] = [];
  let protocolo: string | undefined;
  let opcaoMenu: string | undefined;
  let autenticacao: string | undefined;
  let motivoCliente: string | undefined;
  let transferencia: string | undefined;
  let pesquisaSatisfacao: string | undefined;
  let audioDetectado = false;
  let entradaCliente: string | undefined;

  const protMatch = text.match(RAW_URA_PATTERNS.protocolo);
  if (protMatch) {
    protocolo = protMatch[1];
    items.push({ label: "Protocolo", value: protocolo });
  }

  const hasMarte = RAW_URA_PATTERNS.marte.test(text);
  const hasSaudacao = RAW_URA_PATTERNS.saudacao.test(text);
  if (hasMarte) {
    items.push({ label: "Remetente automático", value: "Marte (URA/Bot)" });
  }
  if (hasSaudacao) {
    const saudMatch = text.match(/(?:bem[- ]?vindo|olá|oi)[!,.]?\s*[^\n\r]{0,120}/i);
    if (saudMatch) {
      items.push({ label: "Saudação inicial", value: saudMatch[0].trim().slice(0, 120) });
    }
  }

  const hasMenu = RAW_URA_PATTERNS.menu.test(text);
  const hasMenuBlock = RAW_URA_PATTERNS.menuBlock.test(text);
  if (hasMenu || hasMenuBlock) {
    const menuMatch = text.match(/(?:em\s+que\s+posso[^\n\r]{0,80}|menu[^\n\r]{0,80}|escolha[^\n\r]{0,80})/i);
    opcaoMenu = menuMatch ? menuMatch[0].trim().slice(0, 120) : "Menu de opções detectado";
    items.push({ label: "Menu detectado", value: opcaoMenu });
  }

  if (RAW_URA_PATTERNS.autenticacao.test(text)) {
    autenticacao = "Solicitação de CPF/CNPJ detectada";
    items.push({ label: "Autenticação", value: autenticacao });
  }

  const problemaMatch = text.match(RAW_URA_PATTERNS.problema);
  if (problemaMatch) {
    const idx = text.indexOf(problemaMatch[0]);
    const after = text.slice(idx + problemaMatch[0].length, idx + problemaMatch[0].length + 200);
    const nextLine = after.split("\n").find(l => l.trim().length > 5);
    motivoCliente = nextLine?.trim().slice(0, 120) || "Cliente solicitado a descrever o problema";
    items.push({ label: "Motivo informado", value: motivoCliente });
  }

  const transMatch = text.match(/(?:transferi(?:u|ndo)[^\n\r]{0,120}|assumiu\s+(?:o\s+)?atendimento[^\n\r]{0,80}|atendimento\s+(?:será\s+)?transferido[^\n\r]{0,80})/i);
  if (transMatch) {
    transferencia = transMatch[0].trim().slice(0, 120);
    items.push({ label: "Transferência", value: transferencia });
  }

  if (RAW_URA_PATTERNS.pesquisa.test(text)) {
    pesquisaSatisfacao = "Pesquisa enviada";
    items.push({ label: "Pesquisa de satisfação", value: pesquisaSatisfacao });
  }

  if (RAW_URA_PATTERNS.audio.test(text)) {
    audioDetectado = true;
    items.push({ label: "Observação", value: "Áudio detectado no atendimento" });
  }

  const hasHumanIndicator = RAW_URA_PATTERNS.transferencia.test(text);
  let status: UraStatus;
  if (hasMarte && hasHumanIndicator) {
    status = "with_ura";
  } else if (hasMarte && !hasHumanIndicator) {
    status = "ura_only";
  } else if (items.length <= 1) {
    status = "ura_ambiguous";
  } else {
    status = "with_ura";
  }

  if (items.length === 0) {
    items.push({ label: "URA", value: "Sinais de URA detectados no texto" });
  }

  return {
    protocolo,
    entradaCliente,
    opcaoMenu,
    autenticacao,
    motivoCliente,
    transferencia,
    pesquisaSatisfacao,
    audioDetectado,
    items,
    status,
  };
}
