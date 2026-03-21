/**
 * URA Context Summarizer — generates a structured summary of the URA interaction.
 */

import type { ClassifiedMessage } from "./messageClassifier";

export type UraStatus = "with_ura" | "no_ura" | "ura_only" | "ura_ambiguous";

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
}

export function summarizeUraContext(uraMessages: ClassifiedMessage[], allMessages: ClassifiedMessage[]): UraContext {
  // Determine URA status
  const hasUra = uraMessages.length > 0;
  const humanMessages = allMessages.filter(m => m.category === "HUMANO" && m.role === "atendente");
  const hasHuman = humanMessages.length > 0;

  let status: UraStatus;
  if (!hasUra) {
    status = "no_ura";
  } else if (hasUra && !hasHuman) {
    status = "ura_only";
  } else if (hasUra && hasHuman) {
    status = "with_ura";
  } else {
    status = "ura_ambiguous";
  }

  if (!hasUra) {
    return {
      items: [],
      status,
    };
  }

  const items: { label: string; value: string }[] = [];
  let protocolo: string | undefined;
  let entradaCliente: string | undefined;
  let opcaoMenu: string | undefined;
  let autenticacao: string | undefined;
  let motivoCliente: string | undefined;
  let transferencia: string | undefined;
  let pesquisaSatisfacao: string | undefined;
  let audioDetectado = false;

  for (const msg of uraMessages) {
    const t = msg.text;

    // Protocolo
    const protMatch = t.match(/protocolo[\s:]*(\d[\d.\-/]+)/i);
    if (protMatch && !protocolo) {
      protocolo = protMatch[1];
      items.push({ label: "Protocolo", value: protocolo });
    }

    // Menu option chosen (look at client responses around this message)
    if (/menu|opção|escolha|digite/i.test(t) && !opcaoMenu) {
      const idx = allMessages.indexOf(msg);
      for (let i = idx + 1; i < Math.min(idx + 3, allMessages.length); i++) {
        if (allMessages[i]?.role === "cliente") {
          opcaoMenu = allMessages[i].text.trim();
          items.push({ label: "Opção escolhida", value: opcaoMenu });
          break;
        }
      }
    }

    // Authentication
    if (/cpf|cnpj|informe.*número|autenticação/i.test(t) && !autenticacao) {
      const idx = allMessages.indexOf(msg);
      for (let i = idx + 1; i < Math.min(idx + 3, allMessages.length); i++) {
        if (allMessages[i]?.role === "cliente") {
          const clientText = allMessages[i].text.trim();
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
      const idx = allMessages.indexOf(msg);
      for (let i = idx + 1; i < Math.min(idx + 3, allMessages.length); i++) {
        if (allMessages[i]?.role === "cliente" && allMessages[i].text.trim().length > 5) {
          motivoCliente = allMessages[i].text.trim().slice(0, 120);
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

    // Satisfaction survey
    if (/pesquisa.*satisfação|avalie.*atendimento/i.test(t) && !pesquisaSatisfacao) {
      pesquisaSatisfacao = "Pesquisa enviada";
      items.push({ label: "Pesquisa de satisfação", value: pesquisaSatisfacao });
    }

    // Audio detection
    if (/áudio|audio|mensagem\s+de\s+voz/i.test(t)) {
      audioDetectado = true;
    }
  }

  // Client entrance (first client message)
  const firstClientMsg = allMessages.find(m => m.role === "cliente");
  if (firstClientMsg && !entradaCliente) {
    entradaCliente = firstClientMsg.text.trim().slice(0, 100);
    if (entradaCliente && entradaCliente.length > 2) {
      items.unshift({ label: "Entrada do cliente", value: entradaCliente });
    }
  }

  if (audioDetectado) {
    items.push({ label: "Observação", value: "Áudio enviado pelo cliente (não interpretado pela URA)" });
  }

  if (items.length === 0) {
    items.push({ label: "URA", value: `${uraMessages.length} mensagem(ns) automática(s) detectada(s)` });
  }

  // If we have URA but items are very sparse, it might be ambiguous
  if (hasUra && items.length <= 1 && !protocolo && !opcaoMenu && !autenticacao) {
    status = "ura_ambiguous";
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
