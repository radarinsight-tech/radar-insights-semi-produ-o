/**
 * URA Journey Timeline — reconstructs the temporal journey of an attendance,
 * calculates times between stages, and identifies operational bottlenecks.
 */

import { parseConversationText, type ParsedMessage } from "./conversationParser";

export interface JourneyMilestone {
  label: string;
  time?: string;
  date?: string;
  /** Absolute timestamp in ms (for calculations) */
  ts?: number;
  speaker?: string;
  role?: string;
}

export interface QueueAlert {
  level: "ok" | "moderate" | "long" | "critical";
  label: string;
  color: string;
}

export interface JourneyTimeline {
  milestones: JourneyMilestone[];
  /** Duration in seconds */
  tempoUra?: number;
  tempoFila?: number;
  tempoTotalPreAtendimento?: number;
  queueAlert?: QueueAlert;
  hasTimestamps: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

const BOT_SPEAKERS = /^(marte|bot|sistema|robô|robo|ura|automático|automatico|assistente\s*virtual|chatbot|especialista\s*virtual)\b/i;

function parseTimestamp(msg: ParsedMessage): number | undefined {
  if (!msg.time) return undefined;

  const timeParts = msg.time.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!timeParts) return undefined;

  const hours = parseInt(timeParts[1], 10);
  const minutes = parseInt(timeParts[2], 10);
  const seconds = timeParts[3] ? parseInt(timeParts[3], 10) : 0;

  let year = 2026, month = 0, day = 1;

  if (msg.date) {
    // dd/mm/yyyy
    const dateParts = msg.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateParts) {
      day = parseInt(dateParts[1], 10);
      month = parseInt(dateParts[2], 10) - 1;
      year = parseInt(dateParts[3], 10);
    }
  }

  return new Date(year, month, day, hours, minutes, seconds).getTime();
}

function isTransferMessage(text: string): boolean {
  return /transferi(?:u|ndo)\s+(?:o\s+)?atendimento|assumiu\s+(?:o\s+)?atendimento|atendimento\s+(?:será\s+)?transferido|setor\s+responsável|fila\s+de\s+atendimento/i.test(text);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}min ${secs}s` : `${mins}min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}min`;
}

function classifyQueue(seconds: number): QueueAlert {
  const mins = seconds / 60;
  if (mins > 15) return { level: "critical", label: "Gargalo crítico", color: "text-destructive" };
  if (mins > 10) return { level: "long", label: "Fila longa", color: "text-orange-600" };
  if (mins > 5) return { level: "moderate", label: "Fila moderada", color: "text-yellow-600" };
  return { level: "ok", label: "Fila normal", color: "text-accent" };
}

// ─── Main ───────────────────────────────────────────────────────────

export function buildJourneyTimeline(rawText: string, atendente?: string): JourneyTimeline {
  const messages = parseConversationText(rawText, atendente);

  if (messages.length === 0) {
    return { milestones: [], hasTimestamps: false };
  }

  const milestones: JourneyMilestone[] = [];

  let inicioUra: JourneyMilestone | undefined;
  let entradaFila: JourneyMilestone | undefined;
  let atendimentoHumano: JourneyMilestone | undefined;

  // Find first URA/bot message
  for (const msg of messages) {
    if (msg.role === "bot" || BOT_SPEAKERS.test(msg.speaker)) {
      inicioUra = {
        label: "Início da URA",
        time: msg.time,
        date: msg.date,
        ts: parseTimestamp(msg),
        speaker: msg.speaker,
        role: "bot",
      };
      break;
    }
  }

  // Find transfer / queue entry
  for (const msg of messages) {
    if (isTransferMessage(msg.text)) {
      entradaFila = {
        label: "Entrada na fila",
        time: msg.time,
        date: msg.date,
        ts: parseTimestamp(msg),
        speaker: msg.speaker,
        role: msg.role,
      };
      break;
    }
  }

  // Find first human attendant message
  for (const msg of messages) {
    if (msg.role === "atendente") {
      atendimentoHumano = {
        label: "Atendimento humano",
        time: msg.time,
        date: msg.date,
        ts: parseTimestamp(msg),
        speaker: msg.speaker,
        role: "atendente",
      };
      break;
    }
  }

  // First client interaction
  const firstClient = messages.find(m => m.role === "cliente");
  const clienteMilestone: JourneyMilestone | undefined = firstClient
    ? {
        label: "Interação do cliente",
        time: firstClient.time,
        date: firstClient.date,
        ts: parseTimestamp(firstClient),
        speaker: firstClient.speaker,
        role: "cliente",
      }
    : undefined;

  // Build ordered milestones
  if (inicioUra) milestones.push(inicioUra);
  if (clienteMilestone) milestones.push(clienteMilestone);
  if (entradaFila) milestones.push(entradaFila);
  if (atendimentoHumano) milestones.push(atendimentoHumano);

  // Sort by timestamp if available
  milestones.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const hasTimestamps = milestones.some(m => m.ts !== undefined);

  // Calculate durations
  let tempoUra: number | undefined;
  let tempoFila: number | undefined;
  let tempoTotalPreAtendimento: number | undefined;
  let queueAlert: QueueAlert | undefined;

  if (hasTimestamps) {
    if (inicioUra?.ts && entradaFila?.ts && entradaFila.ts > inicioUra.ts) {
      tempoUra = Math.round((entradaFila.ts - inicioUra.ts) / 1000);
    }

    if (entradaFila?.ts && atendimentoHumano?.ts && atendimentoHumano.ts > entradaFila.ts) {
      tempoFila = Math.round((atendimentoHumano.ts - entradaFila.ts) / 1000);
      queueAlert = classifyQueue(tempoFila);
    }

    if (inicioUra?.ts && atendimentoHumano?.ts && atendimentoHumano.ts > inicioUra.ts) {
      tempoTotalPreAtendimento = Math.round((atendimentoHumano.ts - inicioUra.ts) / 1000);
    }

    // If no queue entry but we have URA start and human, treat URA→human as total
    if (!entradaFila && inicioUra?.ts && atendimentoHumano?.ts && atendimentoHumano.ts > inicioUra.ts) {
      tempoTotalPreAtendimento = Math.round((atendimentoHumano.ts - inicioUra.ts) / 1000);
    }
  }

  return {
    milestones,
    tempoUra,
    tempoFila,
    tempoTotalPreAtendimento,
    queueAlert,
    hasTimestamps,
  };
}

export { formatDuration };
