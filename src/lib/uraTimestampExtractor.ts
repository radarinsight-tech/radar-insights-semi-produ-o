/**
 * URA Timestamp Extractor — extracts protocol timestamps from PDF header text
 * and calculates wait/service/total time metrics.
 */

export interface ProtocolTimestamps {
  horarioAbertura?: Date;
  inicioAtendimento?: Date;
  fimAtendimento?: Date;
}

export interface UraTimeMetrics {
  tempoFilaMinutos?: number;
  tempoAtendimentoMinutos?: number;
  tempoTotalMinutos?: number;
  cenario: "sem_ura" | "com_ura" | "somente_ura";
  cenarioLabel: string;
  cenarioDescricao: string;
}

const MESES: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

/**
 * Parses a date string like "30 de março de 2026 16:03" or "30 de marco de 2026 16:03"
 */
function parsePtBrDate(dateStr: string): Date | undefined {
  const match = dateStr.match(
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2})/i
  );
  if (!match) return undefined;

  const day = parseInt(match[1], 10);
  const month = MESES[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);

  if (month === undefined) return undefined;
  return new Date(year, month, day, hour, minute);
}

/**
 * Extracts the 3 key timestamps from the raw PDF text header.
 */
export function extractProtocolTimestamps(rawText: string): ProtocolTimestamps {
  const timestamps: ProtocolTimestamps = {};

  const aberturaMatch = rawText.match(/Hor[aá]rio\s+de\s+abertura[:\s]*(.+)/i);
  if (aberturaMatch) {
    timestamps.horarioAbertura = parsePtBrDate(aberturaMatch[1]);
  }

  const inicioMatch = rawText.match(/In[ií]cio\s+do\s+atendimento[:\s]*(.+)/i);
  if (inicioMatch) {
    timestamps.inicioAtendimento = parsePtBrDate(inicioMatch[1]);
  }

  const fimMatch = rawText.match(/Fim\s+do\s+atendimento[:\s]*(.+)/i);
  if (fimMatch) {
    timestamps.fimAtendimento = parsePtBrDate(fimMatch[1]);
  }

  return timestamps;
}

/**
 * Detects whether a human attendant greeting is present in the raw text.
 * Pattern: "Olá, Sou [nome], especialista Bandaturbo..."
 */
function hasHumanGreeting(rawText: string): boolean {
  return /(?:ol[aá]|ola),?\s+sou\s+[\w]+.*(?:especialista|bandaturbo)/i.test(rawText);
}

/**
 * Calculates URA time metrics from extracted timestamps.
 */
export function calculateUraTimeMetrics(
  timestamps: ProtocolTimestamps,
  rawText: string,
): UraTimeMetrics {
  const { horarioAbertura, inicioAtendimento, fimAtendimento } = timestamps;

  // Calculate differences in minutes
  let tempoFilaMinutos: number | undefined;
  let tempoAtendimentoMinutos: number | undefined;
  let tempoTotalMinutos: number | undefined;

  if (horarioAbertura && inicioAtendimento) {
    tempoFilaMinutos = Math.round((inicioAtendimento.getTime() - horarioAbertura.getTime()) / 60000);
    if (tempoFilaMinutos < 0) tempoFilaMinutos = 0;
  }
  if (inicioAtendimento && fimAtendimento) {
    tempoAtendimentoMinutos = Math.round((fimAtendimento.getTime() - inicioAtendimento.getTime()) / 60000);
    if (tempoAtendimentoMinutos < 0) tempoAtendimentoMinutos = 0;
  }
  if (horarioAbertura && fimAtendimento) {
    tempoTotalMinutos = Math.round((fimAtendimento.getTime() - horarioAbertura.getTime()) / 60000);
    if (tempoTotalMinutos < 0) tempoTotalMinutos = 0;
  }

  // Determine scenario
  const hasHuman = hasHumanGreeting(rawText);

  let cenario: UraTimeMetrics["cenario"];
  let cenarioLabel: string;
  let cenarioDescricao: string;

  if (!hasHuman) {
    cenario = "somente_ura";
    cenarioLabel = "SOMENTE URA — Atendimento realizado integralmente pela digital";
    cenarioDescricao = "Nenhuma mensagem de apresentação de atendente encontrada. Atendimento realizado pela URA sem resgate humano.";
  } else if (tempoFilaMinutos !== undefined && tempoFilaMinutos <= 1) {
    cenario = "sem_ura";
    cenarioLabel = "SEM URA — Atendimento iniciado diretamente com atendente";
    cenarioDescricao = "O cliente foi atendido diretamente sem espera significativa na URA/fila digital.";
  } else {
    cenario = "com_ura";
    cenarioLabel = "COM URA — Atendimento digital precedeu o atendente";
    cenarioDescricao = "O cliente passou pela URA/fila digital antes de ser atendido pelo atendente humano.";
  }

  return {
    tempoFilaMinutos,
    tempoAtendimentoMinutos,
    tempoTotalMinutos,
    cenario,
    cenarioLabel,
    cenarioDescricao,
  };
}

/**
 * Formats minutes into a readable string: "X min" or "Xh Ymin"
 */
export function formatMinutes(minutes: number | undefined): string {
  if (minutes === undefined) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
