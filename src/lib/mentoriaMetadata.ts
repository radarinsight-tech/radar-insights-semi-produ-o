/**
 * Metadata extraction utilities for Mentoria Lab PDFs.
 * Extracts: protocolo, atendente, data, canal, hasAudio, tipo from raw PDF text.
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
  // Explicit audio file markers
  if (/\.mp3|\.wav|\.ogg|\.m4a|\.opus|\.aac/i.test(lower)) return true;
  if (/gravacao_de_voz|gravação_de_voz|mensagem_de_voz/i.test(lower)) return true;
  if (/download\s+de\s+[aá]udio/i.test(lower)) return true;
  if (/mensagem\s+de\s+voz/i.test(lower)) return true;
  if (/\b[aá]udio\s+(enviado|recebido|anexado|detectado)\b/i.test(lower)) return true;
  // Emoji marker
  if (lower.includes("🎵")) return true;
  // General audio keywords
  return /\b(áudio|audio|gravação|gravacao|escuta|ligação|ligacao|chamada)\b/.test(lower);
}

// ── Imagem ─────────────────────────────────────────────────────────────
export function detectImage(text: string): boolean {
  const lower = text.toLowerCase();
  // Explicit image file extensions
  if (/\.(jpg|jpeg|png|webp|gif|bmp|tiff|svg)\b/i.test(lower)) return true;
  // Keywords
  if (/\b(imagem|image|foto|fotografia|captura\s+de\s+tela|screenshot|print)\b/i.test(lower)) return true;
  // Emoji marker
  if (lower.includes("📷")) return true;
  return false;
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
  "bandaturbo", "especialista virtual", "seu especialista virtual",
  "especialista virtual da bandaturbo", "seu especialista virtual da bandaturbo",
]);

/** Institutional / non-person terms to always exclude */
const INSTITUTIONAL_TERMS = new Set([
  "protocolo", "cliente", "sistema", "atendente", "agente", "operador",
  "informação", "informacao", "aviso", "nota", "observação", "observacao",
  "setor", "departamento", "equipe", "time", "fila", "canal", "status",
  "tipo", "data", "horário", "horario", "inicio", "início", "fim",
]);

/** Regex for company-like names (contains Internet, Telecom, LTDA, etc.) */
const COMPANY_PATTERN = /\b(internet|telecom|telecomunica|ltda|s\.?a\.?|eireli|me\b|fibra|provedor|banda\s*larga|serviços|servicos|tecnologia|soluções|solucoes|group|corp|inc|bandaturbo|banda\s*turbo)\b/i;

/** Regex to block any extracted name containing bot/company keywords */
const BOT_COMPANY_KEYWORDS = /bandaturbo|banda\s*turbo|especialista\s+virtual|atendimento\s+autom[aá]tico|assistente\s+virtual/i;

function isBot(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return BOT_NAMES.has(lower) || /^(bot|sistema|robô|robo)\b/i.test(lower) || BOT_COMPANY_KEYWORDS.test(lower);
}

function isInstitutional(name: string): boolean {
  const lower = name.toLowerCase().trim();
  // Full name match
  if (INSTITUTIONAL_TERMS.has(lower)) return true;
  // First word match (e.g. "Setor Financeiro" → "setor")
  const firstWord = lower.split(/\s+/)[0];
  if (INSTITUTIONAL_TERMS.has(firstWord)) return true;
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
  // Reject names starting with prepositions
  if (/^(da|do|de|das|dos|e|em|com|para|por|ao|aos|à|às)\s/i.test(trimmed)) return false;
  // Reject institutional/company names
  if (isInstitutional(trimmed)) return false;
  return true;
}

/** Prefixes to strip from attendant name fields (e.g. "Seu atendente: Bruna") */
const ATTENDANT_PREFIXES = /^(?:seu\s+atendente|sua\s+atendente|seu|sua|atendente)\s*[:\-]?\s*/i;

/** Names that are invalid as attendant — pronouns, labels, generic roles */
const INVALID_ATTENDANT_NAMES = new Set([
  "seu", "sua", "seu atendente", "sua atendente",
  "atendente", "agente", "operador", "analista",
  "consultor", "responsável", "responsavel", "nome",
]);

/** Check if a value is just a pronoun/prefix/label with no real name */
function isInvalidAttendantName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return INVALID_ATTENDANT_NAMES.has(lower);
}

export function extractAtendente(text: string): string | undefined {
  const result = _extractAtendenteRaw(text);
  if (!result) return undefined;
  const lower = result.toLowerCase().trim();
  // Block pronouns/labels
  const BLOCKED = ["seu", "sua", "seu atendente", "sua atendente"];
  if (BLOCKED.includes(lower)) return undefined;
  // Block any name containing bot/company keywords
  if (BOT_COMPANY_KEYWORDS.test(lower)) return undefined;
  return result;
}

function _extractAtendenteRaw(text: string): string | undefined {
  // Strategy 0: "Seu atendente\nNome" or "Seu atendente Nome" pattern (BandaTurbo PDFs)
  // Matches both newline-separated and space-separated variants
  const seuBlockPattern = /(?:seu|sua)\s+atendente\s*[:\-]?\s*[\n\s]\s*([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)+)/gi;
  const seuBlockMatches = [...text.matchAll(seuBlockPattern)];
  for (const m of seuBlockMatches) {
    const name = m[1].trim().replace(/\s+/g, " ");
    if (name && !isBot(name) && !isInvalidAttendantName(name) && !isInstitutional(name) && name.length >= 3) {
      return name;
    }
  }

  // Strategy 0.5: Standalone name lines (BandaTurbo block format)
  // e.g. "Dilcele Furtado\nOlá, tudo bem?\nLida - ..."
  const standalonePattern = /^([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)+)$/gm;
  const standaloneCounts = new Map<string, number>();
  for (const m of [...text.matchAll(standalonePattern)]) {
    const name = m[1].trim();
    if (!name || isBot(name) || isInstitutional(name) || isInvalidAttendantName(name)) continue;
    if (BOT_COMPANY_KEYWORDS.test(name.toLowerCase())) continue;
    standaloneCounts.set(name, (standaloneCounts.get(name) || 0) + 1);
    // Also count the first-2-word prefix (e.g. "Dani Porto" from "Dani Porto Internet")
    const words = name.split(/\s+/);
    if (words.length > 2) {
      const prefix2 = words.slice(0, 2).join(" ");
      if (prefix2 && !isBot(prefix2) && !isInstitutional(prefix2) && !isInvalidAttendantName(prefix2)) {
        standaloneCounts.set(prefix2, (standaloneCounts.get(prefix2) || 0) + 1);
      }
    }
  }
  if (standaloneCounts.size > 0) {
    const clientHeader = text.match(/(?:cliente|solicitante)\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim().split(/[,\-\|\/]/)[0].trim() || "";
    const sortedStandalone = [...standaloneCounts.entries()]
      .filter(([name]) => name.toLowerCase() !== clientHeader.toLowerCase())
      .sort((a, b) => b[1] - a[1]);
    if (sortedStandalone.length > 0 && sortedStandalone[0][1] >= 2) {
      return sortedStandalone[0][0];
    }
  }

  // Strategy 1: Explicit labels
  const labelPatterns = [
    /(?:seu\s+atendente|sua\s+atendente|atendente|agente|operador|analista|consultor|responsável)\s*[:\-]\s*([^\n\r]+)/gi,
    /(?:transferido\s+para|encaminhado\s+para|atendido\s+por)\s*[:\-]?\s*([^\n\r]+)/gi,
  ];

  for (const pattern of labelPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      let candidate = m[1].trim().replace(/\s+/g, " ");
      // Strip residual prefixes
      candidate = candidate.replace(ATTENDANT_PREFIXES, "").trim();
      // Take only the name part (before any extra info like date, id, etc.)
      const namePart = candidate.split(/[,\-\|\/]/)[0].trim();
      if (namePart && !isBot(namePart) && !isInvalidAttendantName(namePart) && !isInstitutional(namePart) && isLikelyPersonName(namePart)) {
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

  // Strategy 3: Presentation patterns in chat body
  // "Sou [Nome Sobrenome], especialista..." / "Aqui é [Nome]" / "Meu nome é [Nome]"
  const presentationPatterns = [
    /\bsou\s+(?:o\s+|a\s+)?([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)[\s,]/i,
    /\baqui\s+[eé]\s+(?:o|a)?\s*([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)/i,
    /\bmeu\s+nome\s+[eé]\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)/i,
  ];

  for (const pattern of presentationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      if (!isBot(name) && !isInvalidAttendantName(name) && !isInstitutional(name) && name.length >= 3) {
        return name.replace(/\b([A-Za-zÀ-ÿ])/g, (c) => c.toUpperCase());
      }
    }
  }

  // Strategy 4: Most frequent single-name speaker (relaxed: allow single word)
  const singleNameCounts = new Map<string, number>();
  const singleNamePatterns = [
    /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]+)\s*\(\d{2}:\d{2}\)\s*:/gm,
    /^\[?\d{2}:\d{2}\]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]+)\s*:/gm,
    /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.]+)\s*:/gm,
  ];

  for (const pattern of singleNamePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      const name = m[1].trim();
      if (!name || name.length < 3 || isBot(name) || isInstitutional(name)) continue;
      if (clienteName && name.toLowerCase() === clienteName) continue;
      // Skip if it looks like a header label
      if (/^(protocolo|cliente|atendente|canal|data|tipo|status|setor|departamento|horário|início|fim|equipe|fila)/i.test(name)) continue;
      singleNameCounts.set(name, (singleNameCounts.get(name) || 0) + 1);
    }
  }

  if (singleNameCounts.size > 0) {
    const sorted = [...singleNameCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] >= 2) {
      return sorted[0][0];
    }
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
  if (counts.size === 0) return "Não identificado";
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
  hasImage: boolean;
  tipo: string;
}

export function extractAllMetadata(text: string): PdfMetadata {
  return {
    protocolo: extractProtocolo(text),
    atendente: extractAtendente(text),
    data: extractData(text),
    canal: extractCanal(text),
    hasAudio: detectAudio(text),
    hasImage: detectImage(text),
    tipo: extractTipoAtendimento(text),
  };
}
