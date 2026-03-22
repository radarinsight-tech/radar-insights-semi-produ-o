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
  // This handles OPA-style exports and non-standard formats
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

  // Protocolo
  const protMatch = text.match(RAW_URA_PATTERNS.protocolo);
  if (protMatch) {
    protocolo = protMatch[1];
    items.push({ label: "Protocolo", value: protocolo });
  }

  // Marte / saudação
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

  // Menu detection (text + block)
  const hasMenu = RAW_URA_PATTERNS.menu.test(text);
  const hasMenuBlock = RAW_URA_PATTERNS.menuBlock.test(text);
  if (hasMenu || hasMenuBlock) {
    // Try to extract the menu text
    const menuMatch = text.match(/(?:em\s+que\s+posso[^\n\r]{0,80}|menu[^\n\r]{0,80}|escolha[^\n\r]{0,80})/i);
    opcaoMenu = menuMatch ? menuMatch[0].trim().slice(0, 120) : "Menu de opções detectado";
    items.push({ label: "Menu detectado", value: opcaoMenu });
  }

  // Autenticação
  if (RAW_URA_PATTERNS.autenticacao.test(text)) {
    autenticacao = "Solicitação de CPF/CNPJ detectada";
    items.push({ label: "Autenticação", value: autenticacao });
  }

  // Motivo / problema
  const problemaMatch = text.match(RAW_URA_PATTERNS.problema);
  if (problemaMatch) {
    // Try to get the line after the prompt
    const idx = text.indexOf(problemaMatch[0]);
    const after = text.slice(idx + problemaMatch[0].length, idx + problemaMatch[0].length + 200);
    const nextLine = after.split("\n").find(l => l.trim().length > 5);
    motivoCliente = nextLine?.trim().slice(0, 120) || "Cliente solicitado a descrever o problema";
    items.push({ label: "Motivo informado", value: motivoCliente });
  }

  // Transferência
  const transMatch = text.match(/(?:transferi(?:u|ndo)[^\n\r]{0,120}|assumiu\s+(?:o\s+)?atendimento[^\n\r]{0,80}|atendimento\s+(?:será\s+)?transferido[^\n\r]{0,80})/i);
  if (transMatch) {
    transferencia = transMatch[0].trim().slice(0, 120);
    items.push({ label: "Transferência", value: transferencia });
  }

  // Pesquisa de satisfação
  if (RAW_URA_PATTERNS.pesquisa.test(text)) {
    pesquisaSatisfacao = "Pesquisa enviada";
    items.push({ label: "Pesquisa de satisfação", value: pesquisaSatisfacao });
  }

  // Áudio
  if (RAW_URA_PATTERNS.audio.test(text)) {
    audioDetectado = true;
    items.push({ label: "Observação", value: "Áudio detectado no atendimento" });
  }

  // Determine status
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
