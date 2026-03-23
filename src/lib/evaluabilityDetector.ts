/**
 * Evaluability Detector
 * Identifies attendances that lack sufficient interaction for meaningful evaluation.
 * Returns a flag + reason without blocking the flow.
 */

import type { StructuredConversation, ParsedMessage } from "./conversationParser";

export interface EvaluabilityResult {
  evaluable: boolean;
  reason?: string;
  details: {
    totalMessages: number;
    humanMessages: number;
    clientMessages: number;
    attendantMessages: number;
    hasBackAndForth: boolean;
    onlyAutomated: boolean;
    clientResponded: boolean;
  };
}

const MIN_HUMAN_MESSAGES = 3;
const MIN_BACK_AND_FORTH = 1; // at least 1 exchange (client → attendant or vice-versa)

function isAutomatedMessage(msg: ParsedMessage): boolean {
  if (msg.role === "bot" || msg.role === "sistema") return true;
  // Template-like attendant messages
  const templatePatterns = [
    /meu\s+nome\s+é\s+\S+.*como\s+posso\s+(te\s+)?ajudar/i,
    /obrigad[oa]\s+por\s+(entrar\s+em\s+contato|nos\s+procurar|aguardar)/i,
    /foi\s+um\s+prazer\s+atend/i,
    /posso\s+ajudar\s+em\s+algo\s+mais/i,
    /caso\s+precise.*estamos\s+à\s+disposição/i,
    /tenha\s+um\s+(ótimo|bom|excelente)\s+(dia|tarde|noite)/i,
    /agradecemos\s+(o\s+contato|a\s+preferência)/i,
    /pesquisa\s+de\s+satisfação/i,
    /avalie\s+(nosso|o)\s+atendimento/i,
  ];
  return templatePatterns.some(p => p.test(msg.text));
}

function countBackAndForth(msgs: ParsedMessage[]): number {
  let exchanges = 0;
  let lastRole: string | null = null;
  for (const msg of msgs) {
    if (msg.role === "bot" || msg.role === "sistema") continue;
    if (lastRole && lastRole !== msg.role) {
      exchanges++;
    }
    lastRole = msg.role;
  }
  return exchanges;
}

/**
 * Detect if an attendance has sufficient interaction for evaluation.
 * Works with structured conversation data (parsed messages).
 */
export function detectEvaluability(conversation: StructuredConversation | undefined, rawText?: string): EvaluabilityResult {
  const defaultDetails = {
    totalMessages: 0,
    humanMessages: 0,
    clientMessages: 0,
    attendantMessages: 0,
    hasBackAndForth: false,
    onlyAutomated: true,
    clientResponded: false,
  };

  if (!conversation || !conversation.messages || conversation.messages.length === 0) {
    // No structured conversation available — can't determine evaluability yet
    // Assume evaluable until we have parsed data to judge
    return {
      evaluable: true,
      details: defaultDetails,
    };
  }

  const msgs = conversation.messages;
  const clientMsgs = msgs.filter(m => m.role === "cliente");
  const attendantMsgs = msgs.filter(m => m.role === "atendente");
  const humanMsgs = [...clientMsgs, ...attendantMsgs];
  const backAndForthCount = countBackAndForth(msgs);

  // Check if non-automated attendant messages exist
  const nonAutomatedAttendant = attendantMsgs.filter(m => !isAutomatedMessage(m));
  const nonAutomatedClient = clientMsgs.filter(m => {
    const trivialClient = /^(sim|não|ok|obrigad[oa]|tchau|valeu|1|2|3|4|5|6|7|8|9|0|\*)$/i;
    return !trivialClient.test(m.text.trim());
  });

  const onlyAutomated = nonAutomatedAttendant.length === 0;
  const clientResponded = clientMsgs.length > 0;
  const hasBackAndForth = backAndForthCount >= MIN_BACK_AND_FORTH;

  const details = {
    totalMessages: msgs.length,
    humanMessages: humanMsgs.length,
    clientMessages: clientMsgs.length,
    attendantMessages: attendantMsgs.length,
    hasBackAndForth,
    onlyAutomated,
    clientResponded,
  };

  // Rule 1: No attendant messages at all
  if (attendantMsgs.length === 0) {
    return {
      evaluable: false,
      reason: "Sem participação de atendente humano",
      details,
    };
  }

  // Rule 2: Only automated/template messages from attendant
  if (onlyAutomated && nonAutomatedAttendant.length === 0) {
    return {
      evaluable: false,
      reason: "Apenas mensagens automáticas ou padrão do atendente",
      details,
    };
  }

  // Rule 3: No client interaction at all
  if (clientMsgs.length === 0) {
    return {
      evaluable: false,
      reason: "Sem resposta do cliente",
      details,
    };
  }

  // Rule 4: No back-and-forth (no real exchange)
  if (!hasBackAndForth) {
    return {
      evaluable: false,
      reason: "Sem troca de mensagens entre atendente e cliente",
      details,
    };
  }

  // Rule 5: Too few human messages for meaningful evaluation
  if (humanMsgs.length < MIN_HUMAN_MESSAGES) {
    return {
      evaluable: false,
      reason: "Interação insuficiente para avaliação (menos de 3 mensagens humanas)",
      details,
    };
  }

  return {
    evaluable: true,
    details,
  };
}
