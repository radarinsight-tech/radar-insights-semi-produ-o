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
    onlyAutomated: false,
    clientResponded: false,
  };

  // Rule: any attendance with any content is evaluable — never block.
  if (!conversation || !conversation.messages || conversation.messages.length === 0) {
    if (rawText && rawText.trim().length > 0) {
      return { evaluable: true, details: defaultDetails };
    }
    // Truly empty — no text at all
    return { evaluable: true, details: defaultDetails };
  }

  const msgs = conversation.messages;
  const clientMsgs = msgs.filter(m => m.role === "cliente");
  const attendantMsgs = msgs.filter(m => m.role === "atendente");
  const humanMsgs = [...clientMsgs, ...attendantMsgs];
  const backAndForthCount = countBackAndForth(msgs);

  const details = {
    totalMessages: msgs.length,
    humanMessages: humanMsgs.length,
    clientMessages: clientMsgs.length,
    attendantMessages: attendantMsgs.length,
    hasBackAndForth: backAndForthCount >= MIN_BACK_AND_FORTH,
    onlyAutomated: false,
    clientResponded: clientMsgs.length > 0,
  };

  // Always evaluable — the 19-question matrix adapts to any scenario
  return { evaluable: true, details };
}
