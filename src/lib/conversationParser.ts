/**
 * Shared conversation parser — extracts structured messages from raw PDF text.
 * Used by both MentoriaLab (import) and UraContextDialog (display).
 */

import { classifyMessages, type ClassifiedMessage } from "./messageClassifier";
import { summarizeUraContext, type UraContext } from "./uraContextSummarizer";

export interface ParsedMessage {
  speaker: string;
  role: "atendente" | "cliente" | "bot" | "sistema";
  text: string;
  time?: string;
  date?: string;
}

// Known bot/system speaker names
const BOT_SPEAKERS = /^(marte|bot|sistema|robô|robo|ura|automático|automatico|assistente\s*virtual|chatbot|especialista\s*virtual)\b/i;

// Patterns to extract messages from conversation text (ordered by specificity)
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

/**
 * Parse raw conversation text into structured messages.
 */
export function parseConversationText(rawText: string, atendente?: string): ParsedMessage[] {
  if (!rawText) return [];

  const lines = rawText.split("\n");
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
        const ext = p.extract(match);
        const role = determineRole(ext.speaker, atendente);
        current = { ...ext, role } as ParsedMessage;
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
 * Full pipeline: parse → classify → summarize URA context.
 */
export function extractUraContext(rawText: string, atendente?: string): UraContext {
  const messages = parseConversationText(rawText, atendente);
  if (messages.length < 2) {
    return { items: [], status: "no_ura" };
  }
  const classified = classifyMessages(messages);
  const ura = classified.filter(m => m.category === "URA");
  return summarizeUraContext(ura, classified);
}
