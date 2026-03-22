/**
 * URA Context Summarizer — generates a structured summary of the URA interaction.
 *
 * Implements 3 MUTUALLY EXCLUSIVE states:
 *  1. "ura_valid"      — real pre-attendance automation (Marte/bot BEFORE first human)
 *  2. "ura_irrelevant"  — automation exists only AFTER the first human (e.g. survey)
 *  3. "no_ura"          — no automation detected at all
 */

import type { ClassifiedMessage } from "./messageClassifier";

export type UraStatus = "ura_valid" | "ura_irrelevant" | "no_ura";

export interface UraContext {
  protocolo?: string;
  entradaCliente?: string;
  opcaoMenu?: string;
  autenticacao?: string;
  motivoCliente?: string;
  transferencia?: string;
  pesquisaSatisfacao?: string;
  audioDetectado?: boolean;
  items: { label: string; value: string }[];
  status: UraStatus;
  /** Human-readable reason for the status decision */
  statusReason: string;
  /** Post-attendance automation items (surveys, reminders) */
  postAttendanceItems?: { label: string; value: string }[];
}

// ─── URA event signals (pre-attendance) ──────────────────────────
const PRE_ATTENDANCE_SIGNALS = [
  /menu|opção|escolha|digite/i,
  /cpf|cnpj|autenticação|informe.*número/i,
  /descreva.*problema|motivo|assunto/i,
  /transferindo|encaminhando|atendimento.*transferido|setor.*responsável/i,
  /em\s+que\s+posso\s+(?:lhe\s+)?auxili/i,
  /bem[- ]?vindo|sou\s+(?:seu|o)\s+especialista/i,
  /opção\s+inválida/i,
  /fila\s+de\s+atendimento|aguarde/i,
];

// ─── Post-attendance signals ─────────────────────────────────────
const POST_ATTENDANCE_SIGNALS = [
  /pesquisa\s+de\s+satisfação|avalie\s+(?:nosso|o)\s+atendimento/i,
  /lembrete|pesquisa\s+não\s+respondida/i,
  /nota\s+de\s+\d+\s+a\s+\d+/i,
  /como\s+foi\s+(?:sua|a)\s+experiência/i,
  /encerr(?:ado|amento)/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

export function summarizeUraContext(
  allMessages: ClassifiedMessage[],
): UraContext {
  // ── Step 1: Find the first human attendant message ──────────────
  const firstHumanIdx = allMessages.findIndex(
    m => m.category === "HUMANO" && m.role === "atendente"
  );

  const preHumanMsgs = firstHumanIdx >= 0 ? allMessages.slice(0, firstHumanIdx) : allMessages;
  const postHumanMsgs = firstHumanIdx >= 0 ? allMessages.slice(firstHumanIdx + 1) : [];

  // ── Step 2: Identify bot messages BEFORE the first human ────────
  const preUra = preHumanMsgs.filter(m => m.category === "URA");
  const preUraWithSignals = preUra.filter(m => matchesAny(m.text, PRE_ATTENDANCE_SIGNALS));

  // ── Step 3: Identify bot messages AFTER the first human ─────────
  const postUra = postHumanMsgs.filter(m => m.category === "URA");
  const postUraWithSignals = postUra.filter(m => matchesAny(m.text, POST_ATTENDANCE_SIGNALS));

  // ── Step 4: Determine status ────────────────────────────────────
  const hasPreUra = preUra.length > 0;
  const hasPreUraSignals = preUraWithSignals.length > 0;
  const hasPostUra = postUra.length > 0;

  let status: UraStatus;
  let statusReason: string;

  if (hasPreUra && (hasPreUraSignals || preUra.length >= 2)) {
    status = "ura_valid";
    statusReason = `${preUra.length} mensagem(ns) automática(s) antes do atendente humano, ${preUraWithSignals.length} com sinais de URA`;
  } else if (!hasPreUra && hasPostUra) {
    status = "ura_irrelevant";
    statusReason = `Nenhuma automação pré-atendimento. ${postUra.length} mensagem(ns) automática(s) encontrada(s) apenas após o atendente humano (pesquisa/lembrete)`;
  } else if (!hasPreUra && !hasPostUra) {
    status = "no_ura";
    statusReason = "Nenhuma mensagem automática (URA/bot) detectada no atendimento";
  } else {
    // hasPreUra but no signals and < 2 messages — single generic bot message
    status = "no_ura";
    statusReason = `${preUra.length} mensagem(ns) automática(s) pré-atendimento sem sinais de URA identificáveis`;
  }

  // ── Step 5: If no_ura, return early ─────────────────────────────
  if (status === "no_ura") {
    return { items: [], status, statusReason };
  }

  // ── Step 6: If ura_irrelevant, collect post-attendance info ─────
  if (status === "ura_irrelevant") {
    const postItems: { label: string; value: string }[] = [];
    for (const msg of postUra) {
      if (/pesquisa\s+de\s+satisfação|avalie/i.test(msg.text)) {
        postItems.push({ label: "Pesquisa de satisfação", value: "Enviada após atendimento" });
      } else if (/lembrete|pesquisa\s+não\s+respondida/i.test(msg.text)) {
        postItems.push({ label: "Lembrete", value: "Pesquisa não respondida" });
      } else {
        postItems.push({ label: "Automação pós-atendimento", value: msg.text.slice(0, 120) });
      }
    }
    return { items: [], status, statusReason, postAttendanceItems: postItems };
  }

  // ── Step 7: ura_valid — extract details from pre-human messages ─
  const items: { label: string; value: string }[] = [];
  let protocolo: string | undefined;
  let entradaCliente: string | undefined;
  let opcaoMenu: string | undefined;
  let autenticacao: string | undefined;
  let motivoCliente: string | undefined;
  let transferencia: string | undefined;
  let pesquisaSatisfacao: string | undefined;
  let audioDetectado = false;

  for (const msg of preUra) {
    const t = msg.text;

    // Protocolo
    const protMatch = t.match(/protocolo[\s:]*(\d[\d.\-/]+)/i);
    if (protMatch && !protocolo) {
      protocolo = protMatch[1];
      items.push({ label: "Protocolo", value: protocolo });
    }

    // Menu option chosen
    if (/menu|opção|escolha|digite/i.test(t) && !opcaoMenu) {
      const idx = preHumanMsgs.indexOf(msg);
      for (let i = idx + 1; i < Math.min(idx + 3, preHumanMsgs.length); i++) {
        if (preHumanMsgs[i]?.role === "cliente") {
          opcaoMenu = preHumanMsgs[i].text.trim();
          items.push({ label: "Opção escolhida", value: opcaoMenu });
          break;
        }
      }
    }

    // Authentication
    if (/cpf|cnpj|informe.*número|autenticação/i.test(t) && !autenticacao) {
      const idx = preHumanMsgs.indexOf(msg);
      for (let i = idx + 1; i < Math.min(idx + 3, preHumanMsgs.length); i++) {
        if (preHumanMsgs[i]?.role === "cliente") {
          const clientText = preHumanMsgs[i].text.trim();
          if (/\d{3}[\d.\-/]+/.test(clientText)) {
            autenticacao = "CPF/CNPJ informado";
            items.push({ label: "Autenticação", value: autenticacao });
            break;
          }
        }
      }
    }

    // Client motive
    if (/descreva.*problema|motivo|assunto/i.test(t) && !motivoCliente) {
      const idx = preHumanMsgs.indexOf(msg);
      for (let i = idx + 1; i < Math.min(idx + 3, preHumanMsgs.length); i++) {
        if (preHumanMsgs[i]?.role === "cliente" && preHumanMsgs[i].text.trim().length > 5) {
          motivoCliente = preHumanMsgs[i].text.trim().slice(0, 120);
          items.push({ label: "Motivo informado", value: motivoCliente });
          break;
        }
      }
    }

    // Transfer
    if (/transferindo|encaminhando|atendimento.*transferido|setor.*responsável/i.test(t) && !transferencia) {
      transferencia = t.slice(0, 120);
      items.push({ label: "Transferência", value: transferencia });
    }

    // Audio
    if (/áudio|audio|mensagem\s+de\s+voz/i.test(t)) {
      audioDetectado = true;
    }
  }

  // Client entrance (first client message before human)
  const firstClientMsg = preHumanMsgs.find(m => m.role === "cliente");
  if (firstClientMsg && !entradaCliente) {
    entradaCliente = firstClientMsg.text.trim().slice(0, 100);
    if (entradaCliente && entradaCliente.length > 2) {
      items.unshift({ label: "Entrada do cliente", value: entradaCliente });
    }
  }

  // Post-attendance survey (informational only, separate from pre-attendance)
  const postItems: { label: string; value: string }[] = [];
  for (const msg of postUra) {
    if (/pesquisa\s+de\s+satisfação|avalie/i.test(msg.text)) {
      pesquisaSatisfacao = "Pesquisa enviada";
      postItems.push({ label: "Pesquisa de satisfação", value: "Enviada após atendimento" });
    } else if (/lembrete|pesquisa\s+não\s+respondida/i.test(msg.text)) {
      postItems.push({ label: "Lembrete", value: "Pesquisa não respondida" });
    }
  }

  if (audioDetectado) {
    items.push({ label: "Observação", value: "Áudio enviado pelo cliente (não interpretado pela URA)" });
  }

  if (items.length === 0) {
    items.push({ label: "URA", value: `${preUra.length} mensagem(ns) automática(s) detectada(s)` });
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
    statusReason,
    postAttendanceItems: postItems.length > 0 ? postItems : undefined,
  };
}
