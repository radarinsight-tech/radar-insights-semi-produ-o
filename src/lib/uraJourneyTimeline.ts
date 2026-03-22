/**
 * URA Journey Timeline — reconstructs a detailed chronological journey
 * of the customer before human rescue, with bottleneck & difficulty alerts.
 */

import { parseConversationText, type ParsedMessage, type StructuredConversation } from "./conversationParser";

export interface JourneyMilestone {
  label: string;
  time?: string;
  date?: string;
  ts?: number;
  speaker?: string;
  role?: "bot" | "cliente" | "atendente" | "sistema";
  type?: "ura_start" | "menu" | "invalid_option" | "valid_option" | "auth_request" | "auth_received"
    | "problem_request" | "problem_informed" | "transfer" | "queue" | "human_start" | "survey"
    | "reminder" | "greeting" | "client_interaction" | "generic";
}

export interface QueueAlert {
  level: "ok" | "moderate" | "long" | "critical";
  label: string;
  color: string;
}

export interface UraDifficultyAlert {
  detected: boolean;
  reasons: string[];
}

export interface JourneyTimeline {
  milestones: JourneyMilestone[];
  tempoUra?: number;
  tempoFila?: number;
  tempoTotalPreAtendimento?: number;
  queueAlert?: QueueAlert;
  difficultyAlert?: UraDifficultyAlert;
  hasTimestamps: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

const BOT_SPEAKERS = /^(marte|bot|sistema|robô|robo|ura|automático|automatico|assistente\s*virtual|chatbot|especialista\s*virtual)\b/i;

function parseTimestamp(msg: ParsedMessage): number | undefined {
  // Prefer isoTimestamp if available
  if (msg.isoTimestamp) {
    const d = new Date(msg.isoTimestamp);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  if (!msg.time) return undefined;
  const timeParts = msg.time.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!timeParts) return undefined;
  const hours = parseInt(timeParts[1], 10);
  const minutes = parseInt(timeParts[2], 10);
  const seconds = timeParts[3] ? parseInt(timeParts[3], 10) : 0;
  let year = 2026, month = 0, day = 1;
  if (msg.date) {
    const dateParts = msg.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateParts) {
      day = parseInt(dateParts[1], 10);
      month = parseInt(dateParts[2], 10) - 1;
      year = parseInt(dateParts[3], 10);
    }
  }
  return new Date(year, month, day, hours, minutes, seconds).getTime();
}

function isBot(msg: ParsedMessage): boolean {
  return msg.role === "bot" || BOT_SPEAKERS.test(msg.speaker);
}

// ─── Text classifiers ──────────────────────────────────────────────

const PATTERNS = {
  greeting: /(?:bem[- ]?vindo|olá|oi)[!,.]?\s*(?:eu\s+sou|me\s+chamo|como\s+posso|em\s+que\s+posso)/i,
  menu: /(?:em\s+que\s+posso\s+(?:lhe\s+)?auxili|escolha\s+uma|selecione|menu\s+(?:principal|de\s+opções))/i,
  menuBlock: /(?:vendas|auto\s*desbloqueio|boleto|atendimento\s+geral|suporte\s+t[eé]cnico|financeiro|comercial|cancelamento)/i,
  invalidOption: /(?:opç[aã]o\s+inv[aá]lida|não\s+(?:é|eh)\s+uma\s+opç[aã]o|(?:n[aã]o\s+)?(?:entendi|compreendi)|tente\s+novamente|opção\s+não\s+reconhecida|valor\s+inv[aá]lido)/i,
  authRequest: /(?:informe\s+(?:seu|o)\s+(?:cpf|cnpj)|digite\s+(?:seu|o)\s+(?:cpf|cnpj)|cpf\/cnpj|autenticação|identificação)/i,
  authResponse: /^\s*\d{3}[\d.\-/]{5,}\s*$/,
  problemRequest: /(?:descreva\s+(?:seu|o)\s+(?:problema|assunto|motivo)|qual\s+(?:é\s+)?(?:o\s+)?(?:seu\s+)?(?:problema|assunto|motivo)|informe\s+o\s+motivo|conte\s+(?:nos|pra\s+gente))/i,
  transfer: /(?:transferi(?:u|ndo)\s+(?:o\s+)?atendimento|assumiu\s+(?:o\s+)?atendimento|atendimento\s+(?:será\s+)?transferido|setor\s+responsável|fila\s+de\s+atendimento|encaminhando\s+(?:para|ao))/i,
  survey: /(?:pesquisa\s+de\s+satisfação|avalie\s+(?:nosso|o)\s+atendimento|nota\s+de\s+\d+\s+a\s+\d+)/i,
  reminder: /(?:lembrete|pesquisa\s+não\s+respondida)/i,
  queue: /(?:aguarde|um\s+momento|você\s+está\s+na\s+fila|posição\s+\d|em\s+breve\s+(?:um|será))/i,
  validOption: /(?:vendas|auto\s*desbloqueio|boleto|atendimento\s+geral|suporte\s+t[eé]cnico|financeiro|comercial|cancelamento|2[aª]\s*via|nego[cs]ia[çc][aã]o)/i,
};

function classifyMessageType(msg: ParsedMessage, prevMsg?: ParsedMessage): JourneyMilestone["type"] {
  const t = msg.text;
  if (PATTERNS.greeting.test(t)) return "greeting";
  if (PATTERNS.invalidOption.test(t)) return "invalid_option";
  if (PATTERNS.authRequest.test(t)) return "auth_request";
  if (PATTERNS.problemRequest.test(t)) return "problem_request";
  if (PATTERNS.transfer.test(t)) return "transfer";
  if (PATTERNS.survey.test(t)) return "survey";
  if (PATTERNS.reminder.test(t)) return "reminder";
  if (PATTERNS.queue.test(t)) return "queue";
  if (PATTERNS.menu.test(t) || (isBot(msg) && PATTERNS.menuBlock.test(t))) return "menu";

  // Client responses to specific prompts
  if (msg.role === "cliente" && prevMsg) {
    if (PATTERNS.authRequest.test(prevMsg.text) || PATTERNS.authResponse.test(t)) return "auth_received";
    if (PATTERNS.problemRequest.test(prevMsg.text)) return "problem_informed";
    if (prevMsg.role === "bot" && (PATTERNS.menu.test(prevMsg.text) || PATTERNS.menuBlock.test(prevMsg.text))) {
      return PATTERNS.validOption.test(t) ? "valid_option" : "valid_option";
    }
  }

  return "generic";
}

function milestoneLabel(type: JourneyMilestone["type"], text: string, speaker?: string): string {
  const short = (s: string, max = 60) => s.length > max ? s.slice(0, max) + "…" : s;

  switch (type) {
    case "ura_start": return "URA iniciou atendimento";
    case "greeting": return "Saudação automática";
    case "menu": return "Menu apresentado";
    case "invalid_option": return "Opção inválida detectada";
    case "valid_option": return `Cliente escolheu: ${short(text, 50)}`;
    case "auth_request": return "URA solicitou autenticação";
    case "auth_received": return "Cliente autenticado";
    case "problem_request": return "URA solicitou descrição do problema";
    case "problem_informed": return `Problema informado: ${short(text, 50)}`;
    case "transfer": return "Transferido para fila";
    case "queue": return "Aguardando na fila";
    case "human_start": return `Atendimento humano iniciado por ${speaker || "atendente"}`;
    case "survey": return "Pesquisa de satisfação enviada";
    case "reminder": return "Lembrete de pesquisa";
    case "client_interaction": return `Cliente: ${short(text, 50)}`;
    default: return short(text, 60);
  }
}

// ─── Main ───────────────────────────────────────────────────────────

export function buildJourneyTimeline(rawText: string, atendente?: string): JourneyTimeline {
  const messages = parseConversationText(rawText, atendente);

  if (messages.length === 0) {
    return { milestones: [], hasTimestamps: false };
  }

  const milestones: JourneyMilestone[] = [];
  const difficultyReasons: string[] = [];

  let uraStartTs: number | undefined;
  let transferTs: number | undefined;
  let humanStartTs: number | undefined;
  let foundUraStart = false;
  let foundHuman = false;
  let menuCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prevMsg = i > 0 ? messages[i - 1] : undefined;
    const ts = parseTimestamp(msg);

    // URA start: first bot message
    if (!foundUraStart && isBot(msg)) {
      foundUraStart = true;
      uraStartTs = ts;
      milestones.push({
        label: milestoneLabel("ura_start", msg.text, msg.speaker),
        time: msg.time, date: msg.date, ts, speaker: msg.speaker,
        role: "bot", type: "ura_start",
      });
      continue;
    }

    // Human start: first attendant message
    if (!foundHuman && msg.role === "atendente") {
      foundHuman = true;
      humanStartTs = ts;
      milestones.push({
        label: milestoneLabel("human_start", msg.text, msg.speaker),
        time: msg.time, date: msg.date, ts, speaker: msg.speaker,
        role: "atendente", type: "human_start",
      });
      // Stop collecting URA milestones after human rescue
      break;
    }

    const type = classifyMessageType(msg, prevMsg);

    // Skip generic bot/client messages that don't add analytical value
    if (type === "generic") {
      // Still track first client interaction in the URA phase
      if (msg.role === "cliente" && !milestones.some(m => m.role === "cliente")) {
        milestones.push({
          label: milestoneLabel("client_interaction", msg.text, msg.speaker),
          time: msg.time, date: msg.date, ts, speaker: msg.speaker,
          role: "cliente", type: "client_interaction",
        });
      }
      continue;
    }

    // Track difficulty signals
    if (type === "invalid_option") {
      invalidCount++;
    }
    if (type === "menu") {
      menuCount++;
      if (menuCount > 1) {
        difficultyReasons.push("Menu repetido " + menuCount + " vezes");
      }
    }

    // Record transfer timestamp
    if (type === "transfer" && !transferTs) {
      transferTs = ts;
    }

    const role: JourneyMilestone["role"] = isBot(msg) ? "bot" : msg.role === "cliente" ? "cliente" : "bot";

    milestones.push({
      label: milestoneLabel(type, msg.text, msg.speaker),
      time: msg.time, date: msg.date, ts, speaker: msg.speaker,
      role, type,
    });
  }

  // Difficulty alert
  if (invalidCount > 0) {
    difficultyReasons.unshift(`${invalidCount} opção(ões) inválida(s)`);
  }

  const difficultyAlert: UraDifficultyAlert = {
    detected: difficultyReasons.length > 0,
    reasons: difficultyReasons,
  };

  // Sort by timestamp
  milestones.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const hasTimestamps = milestones.some(m => m.ts !== undefined);

  // Calculate durations
  let tempoUra: number | undefined;
  let tempoFila: number | undefined;
  let tempoTotalPreAtendimento: number | undefined;
  let queueAlert: QueueAlert | undefined;

  if (hasTimestamps) {
    if (uraStartTs && transferTs && transferTs > uraStartTs) {
      tempoUra = Math.round((transferTs - uraStartTs) / 1000);
    }
    if (transferTs && humanStartTs && humanStartTs > transferTs) {
      tempoFila = Math.round((humanStartTs - transferTs) / 1000);
      queueAlert = classifyQueue(tempoFila);
    }
    if (uraStartTs && humanStartTs && humanStartTs > uraStartTs) {
      tempoTotalPreAtendimento = Math.round((humanStartTs - uraStartTs) / 1000);
    }
    if (!transferTs && uraStartTs && humanStartTs && humanStartTs > uraStartTs) {
      tempoTotalPreAtendimento = Math.round((humanStartTs - uraStartTs) / 1000);
    }
  }

  return {
    milestones,
    tempoUra,
    tempoFila,
    tempoTotalPreAtendimento,
    queueAlert,
    difficultyAlert,
    hasTimestamps,
  };
}

function classifyQueue(seconds: number): QueueAlert {
  const mins = seconds / 60;
  if (mins > 15) return { level: "critical", label: "Gargalo crítico", color: "text-destructive" };
  if (mins > 10) return { level: "long", label: "Fila longa", color: "text-orange-600" };
  if (mins > 5) return { level: "moderate", label: "Fila moderada", color: "text-yellow-600" };
  return { level: "ok", label: "Fila normal", color: "text-accent" };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}min ${secs}s` : `${mins}min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}min`;
}
