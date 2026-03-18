/**
 * Metadata extraction utilities for Mentoria Lab PDFs.
 * Extracts: protocolo, atendente, data, canal, hasAudio from raw PDF text.
 */

// ── Protocolo ──────────────────────────────────────────────────────────
export function extractProtocolo(text: string): string | undefined {
  // BT-prefixed protocols (e.g. BT202681899)
  const btMatch = text.match(/\b(BT\d{6,})\b/i);
  if (btMatch) return btMatch[1].toUpperCase();

  // Generic "protocolo: XYZ"
  const labelMatch = text.match(/(?:protocolo|prot\.?)\s*[:\-]?\s*([A-Za-z0-9]{5,})/i);
  if (labelMatch) return labelMatch[1];

  // Fallback: long numeric sequence that could be a protocol
  const numericMatch = text.match(/\b(\d{8,})\b/);
  if (numericMatch) return numericMatch[1];

  return undefined;
}

// ── Canal ──────────────────────────────────────────────────────────────
export function extractCanal(text: string): string {
  const lower = text.toLowerCase();

  // Order matters — more specific first
  if (lower.includes("whatsapp") || lower.includes("wpp") || lower.includes("whats")) return "WhatsApp";
  if (/\b(telefone|ligação|ligacao|chamada telefônica|chamada telefonica|telefonema)\b/.test(lower)) return "Telefone";
  if (/\b(e-?mail)\b/.test(lower)) return "E-mail";
  // "chat" is very generic — require it near service context to avoid false positives
  if (/\b(chat|webchat|chat online)\b/.test(lower)) return "Chat";

  return "Não identificado";
}

// ── Áudio ──────────────────────────────────────────────────────────────
export function detectAudio(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(áudio|audio|gravação|gravacao|escuta|ligação|ligacao|chamada)\b/.test(lower);
}

// ── Data do atendimento ────────────────────────────────────────────────
export function extractData(text: string): string | undefined {
  // Priority 1: explicit labels like "Data do atendimento: 01/06/2025" or "Início: 01/06/2025 14:30"
  const labelPatterns = [
    /(?:data\s+(?:do\s+)?atendimento|in[ií]cio|data\s+de\s+abertura|data\s+de\s+in[ií]cio|aberto\s+em|criado\s+em)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i,
    /(?:data\s+(?:do\s+)?atendimento|in[ií]cio|data\s+de\s+abertura|data\s+de\s+in[ií]cio|aberto\s+em|criado\s+em)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i,
  ];

  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match) {
      return normalizeDate(match[1]);
    }
  }

  // Priority 2: timestamp at beginning of conversation lines (e.g. "01/06/2025 14:30 - Nome:")
  const timestampLine = text.match(/^(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/m);
  if (timestampLine) return timestampLine[1];

  // Priority 3: first date found in the document
  const firstDate = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (firstDate) return firstDate[1];

  // ISO format fallback
  const isoDate = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDate) {
    const [y, m, d] = isoDate[1].split("-");
    return `${d}/${m}/${y}`;
  }

  return undefined;
}

function normalizeDate(raw: string): string {
  // If ISO format, convert to dd/mm/yyyy
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}

// ── Atendente ──────────────────────────────────────────────────────────
// Known system/bot names to exclude
const BOT_NAMES = new Set([
  "marte", "bot", "sistema", "robô", "robo", "automático", "automatico",
  "assistente virtual", "atendimento automático", "chatbot",
]);

/** Institutional / non-person terms to always exclude */
const INSTITUTIONAL_TERMS = new Set([
  "protocolo", "cliente", "sistema", "atendente", "agente", "operador",
  "informação", "informacao", "aviso", "nota", "observação", "observacao",
]);

/** Regex for company-like names (contains Internet, Telecom, LTDA, etc.) */
const COMPANY_PATTERN = /\b(internet|telecom|telecomunica|ltda|s\.?a\.?|eireli|me\b|fibra|provedor|banda\s*larga|serviços|servicos|tecnologia|soluções|solucoes|group|corp|inc)\b/i;

function isBot(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return BOT_NAMES.has(lower) || /^(bot|sistema|robô|robo)\b/i.test(lower);
}

function isInstitutional(name: string): boolean {
  const lower = name.toLowerCase().trim();
  // Single-word institutional terms
  if (INSTITUTIONAL_TERMS.has(lower)) return true;
  // Company-like names
  if (COMPANY_PATTERN.test(lower)) return true;
  return false;
}

function isLikelyPersonName(name: string): boolean {
  const trimmed = name.trim();
  // Must have at least 2 words (first + last name)
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return false;
  if (trimmed.length < 5) return false;
  // No URLs, emails, numbers-only
  if (/[@:\/\d]{3,}/.test(trimmed)) return false;
  // Should mostly be letters and spaces
  if (!/^[A-Za-zÀ-ÿ\s'.]+$/.test(trimmed)) return false;
  // Reject institutional/company names
  if (isInstitutional(trimmed)) return false;
  return true;
}

export function extractAtendente(text: string): string | undefined {
  // Strategy 1: Explicit labels
  const labelPatterns = [
    /(?:atendente|agente|operador|analista|consultor|responsável)\s*[:\-]\s*([^\n\r]+)/gi,
    /(?:transferido\s+para|encaminhado\s+para|atendido\s+por)\s*[:\-]?\s*([^\n\r]+)/gi,
  ];

  for (const pattern of labelPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      const candidate = m[1].trim().replace(/\s+/g, " ");
      // Take only the name part (before any extra info like date, id, etc.)
      const namePart = candidate.split(/[,\-\|\/]/)[0].trim();
      if (namePart && !isBot(namePart) && isLikelyPersonName(namePart)) {
        return namePart;
      }
    }
  }

  // Strategy 2: Conversation pattern — find human names sending messages
  // Patterns like "Nome: mensagem" or "Nome (14:30): mensagem" or "[14:30] Nome: mensagem"
  const messagePatterns = [
    /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]+?)\s*\(\d{2}:\d{2}\)\s*:/gm,
    /^\[?\d{2}:\d{2}\]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]+?)\s*:/gm,
    /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]+?)\s*:/gm,
  ];

  // Extract the "Cliente:" name to exclude it
  const clienteMatch = text.match(/(?:cliente|solicitante|requerente)\s*[:\-]\s*([^\n\r]+)/i);
  const clienteName = clienteMatch?.[1]?.trim().toLowerCase().split(/[,\-\|\/]/)[0].trim();

  // Count name occurrences to find the most active participant
  const nameCounts = new Map<string, number>();

  for (const pattern of messagePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      const name = m[1].trim().replace(/\s+/g, " ");
      if (!name || !isLikelyPersonName(name) || isBot(name)) continue;
      // Skip if this matches the client name
      if (clienteName && name.toLowerCase() === clienteName) continue;
      const key = name;
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    }
  }

  // Return the most frequent non-bot, non-client name
  if (nameCounts.size > 0) {
    const sorted = [...nameCounts.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
  }

  return undefined;
}

// ── Tipo de Atendimento ────────────────────────────────────────────────
const TIPO_PATTERNS: [RegExp, string][] = [
  [/\b(financeiro|fatura|boleto|cobran[cç]a|pagamento|d[ée]bito|cr[eé]dito|negocia[çc][aã]o|segunda\s+via|reembolso|inadimpl[eê]ncia|d[ií]vida|parcelamento|refinanciamento|taxa|juros|multa)\b/i, "Financeiro"],
  [/\b(suporte\s+t[eé]cnico|problema\s+t[eé]cnico|conex[aã]o|internet\s+lenta|sem\s+conex[aã]o|queda|instabilidade|configura[çc][aã]o|roteador|modem|wi-?fi|sinal|velocidade|lentid[aã]o|ping|lat[eê]ncia|erro|falha|n[aã]o\s+funciona|defeito|travando|reiniciar|reset|suporte|assist[eê]ncia\s+t[eé]cnica|manuten[çc][aã]o)\b/i, "Suporte Técnico"],
  [/\b(venda|contrata[çc][aã]o|novo\s+plano|ades[aã]o|oferta|promo[çc][aã]o|combo|pacote|assinar|contratar|plano|upgrade|downgrade|migra[çc][aã]o\s+de\s+plano|trocar\s+plano|mudar\s+plano|altera[çc][aã]o\s+de\s+plano|comercial|proposta)\b/i, "Comercial"],
  [/\b(cancelamento|cancelar|desist[eê]ncia|encerrar\s+contrato|rescis[aã]o)\b/i, "Cancelamento"],
  [/\b(reten[çc][aã]o|manter|fideliza[çc][aã]o|contraproposta|desconto\s+para\s+ficar|n[aã]o\s+cancelar)\b/i, "Retenção"],
  [/\b(mudan[çc]a\s+de\s+endere[çc]o|transfer[eê]ncia\s+de\s+endere[çc]o|altera[çc][aã]o\s+de\s+endere[çc]o|novo\s+endere[çc]o)\b/i, "Mudança de Endereço"],
  [/\b(instala[çc][aã]o|agendar\s+instala|visita\s+t[eé]cnica|t[eé]cnico\s+ir|agendar\s+visita)\b/i, "Instalação"],
  [/\b(informa[çc][oõ]es|d[uú]vida|consulta|como\s+funciona|gostaria\s+de\s+saber|orienta[çc][aã]o|esclarecimento|pergunta|ajuda|auxilio|aux[ií]lio)\b/i, "Informações Gerais"],
  [/\b(reclama[çc][aã]o|reclamar|insatisfa[çc][aã]o|insatisfeito|ouvidoria|registro\s+de\s+reclama)\b/i, "Reclamação"],
];

export function extractTipoAtendimento(text: string): string {
  const counts = new Map<string, number>();
  for (const [pattern, tipo] of TIPO_PATTERNS) {
    const matches = text.match(new RegExp(pattern, "gi"));
    if (matches) counts.set(tipo, (counts.get(tipo) || 0) + matches.length);
  }
  if (counts.size === 0) return "Outro";
  // Return the type with most keyword hits
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// ── Combined extraction ────────────────────────────────────────────────
export interface PdfMetadata {
  protocolo?: string;
  atendente?: string;
  data?: string;
  canal: string;
  hasAudio: boolean;
  tipo: string;
}

export function extractAllMetadata(text: string): PdfMetadata {
  return {
    protocolo: extractProtocolo(text),
    atendente: extractAtendente(text),
    data: extractData(text),
    canal: extractCanal(text),
    hasAudio: detectAudio(text),
    tipo: extractTipoAtendimento(text),
  };
}
