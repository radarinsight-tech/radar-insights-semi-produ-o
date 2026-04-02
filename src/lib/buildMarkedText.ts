/**
 * buildMarkedText — Reconstrói o texto do atendimento a partir de mensagens
 * parseadas, inserindo marcadores explícitos de seção (URA, HUMANO, PÓS-ATENDIMENTO)
 * para reduzir contaminação na avaliação da IA.
 *
 * NÃO altera o parser nem a pré-análise. Apenas formata o texto enviado à edge function.
 */

import type { StructuredConversation, ParsedMessage } from "./conversationParser";

// ─── Post-attendance detection (mirrors FormattedChatText patterns) ─────

const POST_ATTENDANCE_PATTERNS = [
  /queremos\s+saber\s+como\s+foi/i,
  /pesquisa\s+de\s+satisfação/i,
  /avalie\s+(?:nosso|o)\s+atendimento/i,
  /notamos\s+que\s+voc[eê]\s+n[aã]o\s+finalizou/i,
  /pesquisa\s+não\s+respondida/i,
  /pesquisa\s+de\s+satisfa[cç][aã]o\s+encerrada/i,
  /excelente\s*[\/|]\s*bom\s*[\/|]\s*regular/i,
  /nota\s+de\s+\d+\s+a\s+\d+/i,
];

function isPostAttendance(msg: ParsedMessage): boolean {
  return (msg.role === "bot" || msg.role === "sistema") &&
    POST_ATTENDANCE_PATTERNS.some(p => p.test(msg.text));
}

// ─── Section types ───────────────────────────────────────────────────

type Section = "ura" | "humano" | "pos";

function classifySection(msg: ParsedMessage, postStarted: boolean): Section {
  if (postStarted) return "pos";
  if (isPostAttendance(msg)) return "pos";
  if (msg.role === "bot" || msg.role === "sistema") return "ura";
  // cliente and atendente belong to the human evaluation zone
  return "humano";
}

// ─── Format a single message line ───────────────────────────────────

function formatLine(msg: ParsedMessage): string {
  const time = msg.time ? ` (${msg.time})` : "";
  return `${msg.speaker}${time}: ${msg.text}`;
}

// ─── Main builder ───────────────────────────────────────────────────

const MARKER_URA_START = "[URA/BOT — NÃO AVALIAR]";
const MARKER_URA_END = "[FIM URA/BOT]";
const MARKER_HUMANO_START = "[ATENDENTE HUMANO — INÍCIO DA AVALIAÇÃO]";
const MARKER_HUMANO_END = "[FIM ATENDENTE HUMANO]";
const MARKER_POS_START = "[PÓS-ATENDIMENTO — NÃO AVALIAR]";
const MARKER_POS_END = "[FIM PÓS-ATENDIMENTO]";

/**
 * Converts a StructuredConversation into a marked text string suitable for
 * sending to the analyze-attendance edge function.
 *
 * Falls back to rawText if structured data is unavailable or empty.
 */
export function buildMarkedText(
  structured: StructuredConversation | undefined | null,
  rawText: string,
): string {
  // Fallback: if no structured messages, return raw text unchanged
  if (!structured?.messages?.length) return rawText;

  const messages = structured.messages;
  const lines: string[] = [];
  let currentSection: Section | null = null;
  let postStarted = false;

  for (const msg of messages) {
    const section = classifySection(msg, postStarted);

    // Once post-attendance starts, it stays
    if (section === "pos") postStarted = true;

    // Close previous section if changing
    if (currentSection && currentSection !== section) {
      if (currentSection === "ura") lines.push(MARKER_URA_END);
      else if (currentSection === "humano") lines.push(MARKER_HUMANO_END);
      else if (currentSection === "pos") lines.push(MARKER_POS_END);
      lines.push("");
    }

    // Open new section if changing
    if (currentSection !== section) {
      if (section === "ura") lines.push(MARKER_URA_START);
      else if (section === "humano") lines.push(MARKER_HUMANO_START);
      else if (section === "pos") lines.push(MARKER_POS_START);
      currentSection = section;
    }

    lines.push(formatLine(msg));
  }

  // Close last section
  if (currentSection === "ura") lines.push(MARKER_URA_END);
  else if (currentSection === "humano") lines.push(MARKER_HUMANO_END);
  else if (currentSection === "pos") lines.push(MARKER_POS_END);

  return lines.join("\n");
}
