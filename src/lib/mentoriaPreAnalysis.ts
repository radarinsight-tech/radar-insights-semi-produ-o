/**
 * Mentoria Pre-Analysis Engine
 * Automatically suggests SIM/NÃO/FORA DO ESCOPO for the 19 mentorship criteria
 * based on structured conversation analysis.
 */

import type { ParsedMessage, StructuredConversation } from "./conversationParser";
import type { UraContext } from "./uraContextSummarizer";

export type SugestaoResultado = "SIM" | "NÃO" | "FORA DO ESCOPO";
export type Confianca = "alta" | "media" | "baixa";

export interface PreAnalysisSuggestion {
  numero: number;
  nome: string;
  categoria: string;
  sugestao: SugestaoResultado;
  justificativa: string;
  evidencia?: string;
  confianca: Confianca;
}

export interface PreAnalysisResult {
  suggestions: PreAnalysisSuggestion[];
  metadata: {
    totalMessages: number;
    humanMessages: number;
    clientMessages: number;
    attendantMessages: number;
    avgResponseTimeSec?: number;
    attendantName?: string;
    clientName?: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function getHumanMessages(msgs: ParsedMessage[]): ParsedMessage[] {
  return msgs.filter(m => m.role === "atendente" || m.role === "cliente");
}

function getAttendantMessages(msgs: ParsedMessage[]): ParsedMessage[] {
  return msgs.filter(m => m.role === "atendente");
}

function getClientMessages(msgs: ParsedMessage[]): ParsedMessage[] {
  return msgs.filter(m => m.role === "cliente");
}

function findFirstAttendantMsg(msgs: ParsedMessage[]): ParsedMessage | undefined {
  return msgs.find(m => m.role === "atendente");
}

function findFirstClientMsg(msgs: ParsedMessage[]): ParsedMessage | undefined {
  return msgs.find(m => m.role === "cliente");
}

function getAttendantName(msgs: ParsedMessage[]): string | undefined {
  const att = findFirstAttendantMsg(msgs);
  return att?.speaker;
}

function getClientName(msgs: ParsedMessage[]): string | undefined {
  const client = findFirstClientMsg(msgs);
  return client?.speaker;
}

function findEvidence(msgs: ParsedMessage[], pattern: RegExp, role?: string): string | undefined {
  for (const m of msgs) {
    if (role && m.role !== role) continue;
    const match = m.text.match(pattern);
    if (match) {
      // Return a short excerpt around the match
      const idx = m.text.indexOf(match[0]);
      const start = Math.max(0, idx - 30);
      const end = Math.min(m.text.length, idx + match[0].length + 50);
      let excerpt = m.text.slice(start, end).trim();
      if (start > 0) excerpt = "..." + excerpt;
      if (end < m.text.length) excerpt += "...";
      return excerpt;
    }
  }
  return undefined;
}

function allText(msgs: ParsedMessage[], role?: string): string {
  return msgs
    .filter(m => !role || m.role === role)
    .map(m => m.text)
    .join(" ");
}

function parseISOTimestamp(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calculate average response time of attendant (in seconds).
 * Measures time between client message and next attendant response.
 */
function calcAvgResponseTime(msgs: ParsedMessage[]): number | undefined {
  const times: number[] = [];
  for (let i = 0; i < msgs.length - 1; i++) {
    if (msgs[i].role === "cliente" && msgs[i].isoTimestamp) {
      // Find next attendant message
      for (let j = i + 1; j < msgs.length; j++) {
        if (msgs[j].role === "atendente" && msgs[j].isoTimestamp) {
          const t1 = parseISOTimestamp(msgs[i].isoTimestamp);
          const t2 = parseISOTimestamp(msgs[j].isoTimestamp);
          if (t1 && t2) {
            const diff = (t2.getTime() - t1.getTime()) / 1000;
            if (diff > 0 && diff < 3600) times.push(diff); // ignore > 1h gaps
          }
          break;
        }
      }
    }
  }
  if (times.length === 0) return undefined;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

function containsClientName(text: string, clientName?: string): boolean {
  if (!clientName) return false;
  const firstName = clientName.split(/\s+/)[0];
  if (!firstName || firstName.length < 2) return false;
  return new RegExp(`\\b${firstName}\\b`, "i").test(text);
}

// ─── Reactive Execution Detection ───────────────────────────────────

/**
 * Detects if the attendant merely executed an action based on prior context
 * (URA, phone history, previous ticket) without actively validating with the client.
 */
function detectReactiveExecution(attMsgs: ParsedMessage[], clientMsgs: ParsedMessage[], attText: string): {
  isReactive: boolean;
  hasActiveValidation: boolean;
  reason: string;
} {
  const directExecutionPatterns = /(?:(?:estou\s+)?(?:enviando|encaminhando|gerando|emitindo)\s+(?:o\s+)?(?:boleto|fatura|segunda\s+via|arquivo|documento|comprovante|contrato|link)|(?:segue|aqui\s+está|pronto|feito|já\s+(?:enviei|encaminhei|gerei|fiz))|(?:vou\s+(?:enviar|encaminhar|gerar))\s+(?:o\s+)?(?:boleto|fatura|segunda\s+via|arquivo))/gi;

  const activeValidationPatterns = /(?:(?:você|senhor[a]?)\s+(?:precisa|deseja|gostaria|quer)\b|(?:pode|poderia)\s+(?:me\s+)?(?:confirmar|informar|dizer)|(?:é\s+isso\s+mesmo|correto|certo)\s*\?|(?:antes\s+de\s+)?(?:prosseguir|continuar).*(?:confirmar|validar)|(?:me\s+(?:confirma|diz|informa))|(?:posso\s+confirmar))/gi;

  const execMatches = attText.match(directExecutionPatterns) || [];
  const validationMatches = attText.match(activeValidationPatterns) || [];
  const questionMarks = (attText.match(/\?/g) || []).length;

  const hasActiveValidation = validationMatches.length >= 1 || questionMarks >= 2;
  const isReactive = execMatches.length >= 1 && !hasActiveValidation && clientMsgs.length <= 4;

  let reason = "";
  if (isReactive) {
    reason = "Atendente executou ação diretamente com base no contexto prévio, sem validação ativa com o cliente.";
  } else if (execMatches.length >= 1 && hasActiveValidation) {
    reason = "Atendente executou ação, mas com validação ativa do cliente.";
  }

  return { isReactive, hasActiveValidation, reason };
}

function hasPriorContextDemand(allMsgs: ParsedMessage[], uraContext?: UraContext): boolean {
  if (uraContext && uraContext.items.length > 0) {
    const hasMenu = uraContext.items.some(i => /menu|opção|selecion/i.test(i.label + " " + i.value));
    const hasProblem = uraContext.items.some(i => /motivo|problema|solicitação|demanda/i.test(i.label));
    if (hasMenu || hasProblem) return true;
  }
  const firstHumanIdx = allMsgs.findIndex(m => m.role === "atendente");
  if (firstHumanIdx > 0) {
    const botText = allMsgs.slice(0, firstHumanIdx).filter(m => m.role === "bot" || m.role === "sistema").map(m => m.text).join(" ");
    if (/(?:transferindo|sua\s+solicitação|motivo\s+do\s+contato|protocolo)/i.test(botText)) return true;
  }
  return false;
}

// ─── Criteria Analyzers ─────────────────────────────────────────────

type CriterionAnalyzer = (msgs: ParsedMessage[], ctx: AnalysisContext) => Omit<PreAnalysisSuggestion, "numero" | "nome" | "categoria">;

interface AnalysisContext {
  clientName?: string;
  attendantName?: string;
  avgResponseTimeSec?: number;
  uraContext?: UraContext;
  attMsgs: ParsedMessage[];
  clientMsgs: ParsedMessage[];
  allMsgs: ParsedMessage[];
  attText: string;
  clientText: string;
  reactiveExecution: { isReactive: boolean; hasActiveValidation: boolean; reason: string };
  hasPriorContext: boolean;
}

// 1. Informou o nome e se apresentou?
const c1: CriterionAnalyzer = (msgs, ctx) => {
  // Expanded patterns: "Sou [nome]", "Aqui é [nome]", "Meu nome é [nome]", "Sou o(a) [nome], especialista..."
  const namePatterns = [
    /meu\s+nome\s+é\s+\w+/i,
    /me\s+chamo\s+\w+/i,
    /sou\s+(?:o|a)\s+\w+/i,
    /sou\s+\w+[,.]?\s*(?:especialista|analista|atendente|consultor[a]?|suporte)?/i,
    /aqui\s+(?:é|quem\s+fala)\s+(?:o|a)?\s*\w+/i,
    /(?:olá|oi|bom\s+dia|boa\s+tarde|boa\s+noite)[,!.\s]+(?:meu\s+nome|me\s+chamo|sou|aqui\s+é)/i,
  ];
  const combinedPattern = new RegExp(namePatterns.map(p => p.source).join("|"), "i");

  const evidence = findEvidence(msgs, combinedPattern, "atendente");
  if (evidence) {
    return { sugestao: "SIM", justificativa: "Atendente se apresentou pelo nome.", evidencia: evidence, confianca: "alta" };
  }

  // Check first attendant message specifically
  const firstAtt = findFirstAttendantMsg(msgs);
  if (firstAtt) {
    if (combinedPattern.test(firstAtt.text)) {
      return { sugestao: "SIM", justificativa: "Primeira mensagem contém apresentação do atendente.", evidencia: firstAtt.text.slice(0, 120), confianca: "alta" };
    }
    // Greeting with attendant name from speaker field (implicit presentation)
    if (/(?:olá|oi|bom\s+dia|boa\s+tarde|boa\s+noite)/i.test(firstAtt.text) && firstAtt.speaker && firstAtt.speaker.length >= 2) {
      return { sugestao: "NÃO", justificativa: "Atendente cumprimentou mas não se identificou explicitamente pelo nome no texto.", evidencia: firstAtt.text.slice(0, 100), confianca: "media" };
    }
  }
  return { sugestao: "NÃO", justificativa: "Não foi encontrada apresentação do atendente no histórico.", confianca: "media" };
};

// 2. Foi cordial e simpático?
const c2: CriterionAnalyzer = (msgs, ctx) => {
  const negativePatterns = /(?:não\s+é\s+meu\s+problema|se\s+vira|dane-se|não\s+posso\s+fazer\s+nada|infelizmente\s+não)/gi;
  const negativeMatches = ctx.attText.match(negativePatterns);
  const negEvidence = findEvidence(msgs, negativePatterns, "atendente");

  if (negativeMatches && negativeMatches.length > 0) {
    return { sugestao: "NÃO", justificativa: "Linguagem inadequada ou falta de cordialidade detectada.", evidencia: negEvidence, confianca: "alta" };
  }

  // Basic greetings count as cordiality (any single greeting is enough)
  const greetingPatterns = /(?:olá|oi\b|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem|como\s+(?:posso|vai))/gi;
  const positivePatterns = /(?:por\s+favor|obrigad[oa]|com\s+prazer|fico\s+feliz|à\s+disposição|disponível|ajudar|prazer|gentileza|por\s+gentileza)/gi;

  const greetingMatches = ctx.attText.match(greetingPatterns);
  const positiveMatches = ctx.attText.match(positivePatterns);
  const greetCount = greetingMatches?.length || 0;
  const positiveCount = positiveMatches?.length || 0;
  const totalCordiality = greetCount + positiveCount;

  if (totalCordiality >= 2) {
    const ev = findEvidence(msgs, greetingPatterns, "atendente") || findEvidence(msgs, positivePatterns, "atendente");
    return { sugestao: "SIM", justificativa: `Cordialidade presente com ${totalCordiality} expressões (saudações e/ou cortesias).`, evidencia: ev, confianca: "alta" };
  }
  if (totalCordiality >= 1) {
    const ev = findEvidence(msgs, greetingPatterns, "atendente") || findEvidence(msgs, positivePatterns, "atendente");
    return { sugestao: "SIM", justificativa: `Saudação ou expressão cordial identificada.`, evidencia: ev, confianca: "media" };
  }
  return { sugestao: "NÃO", justificativa: "Não foram encontradas saudações nem expressões de cordialidade nas mensagens do atendente.", confianca: "media" };
};

// 3. Chamou o cliente pelo nome?
const c3: CriterionAnalyzer = (msgs, ctx) => {
  if (!ctx.clientName) {
    return { sugestao: "NÃO", justificativa: "Nome do cliente não identificado no histórico para verificar.", confianca: "baixa" };
  }
  const firstName = ctx.clientName.split(/\s+/)[0];
  if (!firstName || firstName.length < 2) {
    return { sugestao: "NÃO", justificativa: "Nome do cliente muito curto para busca confiável.", confianca: "baixa" };
  }
  
  const nameRegex = new RegExp(`\\b${firstName}\\b`, "i");
  let count = 0;
  let evidence: string | undefined;
  for (const m of ctx.attMsgs) {
    if (nameRegex.test(m.text)) {
      count++;
      if (!evidence) evidence = m.text.slice(0, 100);
    }
  }
  
  if (count >= 2) return { sugestao: "SIM", justificativa: `Atendente chamou o cliente pelo nome ${count} vezes.`, evidencia: evidence, confianca: "alta" };
  if (count === 1) return { sugestao: "SIM", justificativa: "Atendente chamou o cliente pelo nome.", evidencia: evidence, confianca: "media" };
  return { sugestao: "NÃO", justificativa: `Atendente não chamou o cliente pelo nome (${firstName}).`, confianca: "media" };
};

// 4. Respondeu dentro do tempo adequado?
const c4: CriterionAnalyzer = (msgs, ctx) => {
  const avg = ctx.avgResponseTimeSec;
  if (avg == null) return { sugestao: "NÃO", justificativa: "Não foi possível calcular tempo de resposta (timestamps ausentes).", confianca: "baixa" };
  
  const avgMin = avg / 60;
  // Up to 3 min → SIM, up to 5 min → SIM (within resolution window), above → NÃO
  if (avgMin <= 3) return { sugestao: "SIM", justificativa: `Tempo médio de resposta: ${avgMin.toFixed(1)} minutos (adequado).`, confianca: "alta" };
  if (avgMin <= 5) return { sugestao: "SIM", justificativa: `Tempo médio de resposta: ${avgMin.toFixed(1)} minutos (dentro do limite aceitável).`, confianca: "media" };
  if (avgMin <= 8) return { sugestao: "NÃO", justificativa: `Tempo médio de resposta: ${avgMin.toFixed(1)} minutos (acima do ideal).`, confianca: "alta" };
  return { sugestao: "NÃO", justificativa: `Tempo médio de resposta: ${avgMin.toFixed(1)} minutos (acima do esperado).`, confianca: "alta" };
};

// 5. Utilizou linguagem profissional?
const c5: CriterionAnalyzer = (msgs, ctx) => {
  const informalPatterns = /(?:\bvc\b|\bpq\b|\btb\b|\bblz\b|\bshow\b|\btop\b|\bfala\s+aí\b|\bpó\b|\btá\b|\bné\b|\bfmz\b|\bpdc\b|\bkk+\b|\brs+\b|\bhaha)/gi;
  const informal = ctx.attText.match(informalPatterns);
  const profPatterns = /(?:senhor[a]?\b|prezad[oa]\b|informamos|solicitamos|encaminhamos|conforme|procedimento|protocolo|orientação|análise)/gi;
  const prof = ctx.attText.match(profPatterns);
  
  if (informal && informal.length >= 3) {
    const ev = findEvidence(msgs, informalPatterns, "atendente");
    return { sugestao: "NÃO", justificativa: `Linguagem informal detectada (${informal.length} ocorrências): ${informal.slice(0, 3).join(", ")}.`, evidencia: ev, confianca: "alta" };
  }
  if (informal && informal.length >= 1) {
    const ev = findEvidence(msgs, informalPatterns, "atendente");
    return { sugestao: "NÃO", justificativa: `Expressões informais detectadas: ${informal.join(", ")}.`, evidencia: ev, confianca: "media" };
  }
  if (prof && prof.length >= 2) {
    return { sugestao: "SIM", justificativa: "Linguagem profissional consistente ao longo do atendimento.", confianca: "media" };
  }
  return { sugestao: "SIM", justificativa: "Não foram detectadas expressões informais ou inadequadas.", confianca: "baixa" };
};

// 6. Fez perguntas para entender o problema?
const c6: CriterionAnalyzer = (msgs, ctx) => {
  const questionPattern = /\?/g;
  const questions = ctx.attText.match(questionPattern);
  const probingPatterns = /(?:pode\s+me\s+(?:explicar|informar|dizer)|qual\s+(?:é|seria)|como\s+(?:aconteceu|ocorreu|está)|quando\s+(?:começou|aconteceu)|o\s+que\s+(?:aconteceu|houve)|poderia\s+detalhar|me\s+conte|entendo.*(?:situação|problema))/gi;
  const probing = ctx.attText.match(probingPatterns);
  
  const qCount = questions?.length || 0;
  const pCount = probing?.length || 0;
  
  // If demand was already in prior context and attendant didn't actively validate
  if (ctx.hasPriorContext && ctx.reactiveExecution.isReactive) {
    if (qCount >= 1) {
      const ev = findEvidence(msgs, /\?/, "atendente");
      return { sugestao: "NÃO", justificativa: "A demanda estava indicada no contexto anterior. Atendente fez pergunta(s), mas sem validação confirmatória da necessidade real.", evidencia: ev, confianca: "media" };
    }
    return { sugestao: "NÃO", justificativa: "A demanda estava indicada no contexto anterior, mas não houve validação ativa com o cliente. Atendente executou diretamente sem confirmar.", confianca: "alta" };
  }
  
  if (pCount >= 2 || qCount >= 3) {
    const ev = findEvidence(msgs, probingPatterns, "atendente") || findEvidence(msgs, /\?/, "atendente");
    return { sugestao: "SIM", justificativa: `Atendente fez ${qCount} perguntas, incluindo ${pCount} sondagens direcionadas.`, evidencia: ev, confianca: "alta" };
  }
  if (qCount >= 1) {
    const ev = findEvidence(msgs, /\?/, "atendente");
    return { sugestao: "NÃO", justificativa: `Atendente fez ${qCount} pergunta(s), mas sem sondagem aprofundada.`, evidencia: ev, confianca: "media" };
  }
  return { sugestao: "NÃO", justificativa: "Atendente não fez perguntas para compreender o problema.", confianca: "media" };
};

// 7. Identificou corretamente a solicitação?
const c7: CriterionAnalyzer = (msgs, ctx) => {
  const ackPatterns = /(?:entendi|compreendi|então\s+(?:você|o\s+senhor)|sua\s+solicitação|sua\s+demanda|sobre\s+(?:o|a)\s+(?:seu|sua)|(?:vou|vamos)\s+(?:verificar|resolver|analisar|tratar))/gi;
  const ack = ctx.attText.match(ackPatterns);
  
  // Reactive execution: even if attendant "acknowledged", without active validation it's partial
  if (ctx.hasPriorContext && ctx.reactiveExecution.isReactive) {
    if (ack && ack.length >= 1) {
      const ev = findEvidence(msgs, ackPatterns, "atendente");
      return { sugestao: "NÃO", justificativa: "Atendente executou a solicitação com base no histórico, sem condução confirmatória com o cliente.", evidencia: ev, confianca: "media" };
    }
    return { sugestao: "NÃO", justificativa: "Solicitação resolvida a partir de contexto prévio, sem que o atendente confirmasse ou validasse a demanda com o cliente.", confianca: "media" };
  }
  
  if (ack && ack.length >= 2) {
    const ev = findEvidence(msgs, ackPatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente demonstrou compreensão da solicitação.", evidencia: ev, confianca: "media" };
  }
  if (ack && ack.length >= 1) {
    const ev = findEvidence(msgs, ackPatterns, "atendente");
    return { sugestao: "NÃO", justificativa: "Indicação fraca de identificação da demanda.", evidencia: ev, confianca: "baixa" };
  }
  return { sugestao: "NÃO", justificativa: "Não há evidência clara de que o atendente identificou a solicitação.", confianca: "baixa" };
};

// 8. Demonstrou disposição para ouvir?
const c8: CriterionAnalyzer = (msgs, ctx) => {
  const listenPatterns = /(?:entendo|compreendo|realmente|sei\s+como|imagino|lamento|sinto\s+muito|com\s+certeza|claro|perfeit[oa]|pode\s+contar|estou\s+aqui)/gi;
  const listen = ctx.attText.match(listenPatterns);
  
  const lCount = listen?.length || 0;
  
  // In reactive executions, listening is limited since attendant didn't engage
  if (ctx.reactiveExecution.isReactive && lCount < 2) {
    return { sugestao: "NÃO", justificativa: "Atendimento de execução reativa — interação limitada para avaliar escuta ativa. O atendente executou sem engajamento conversacional.", confianca: "media" };
  }
  
  if (lCount >= 3) {
    const ev = findEvidence(msgs, listenPatterns, "atendente");
    return { sugestao: "SIM", justificativa: `Atendente demonstrou escuta ativa com ${lCount} expressões empáticas.`, evidencia: ev, confianca: "media" };
  }
  if (lCount >= 1) {
    const ev = findEvidence(msgs, listenPatterns, "atendente");
    return { sugestao: "NÃO", justificativa: "Sinais insuficientes de disposição para ouvir.", evidencia: ev, confianca: "baixa" };
  }
  return { sugestao: "NÃO", justificativa: "Não foram encontradas expressões de escuta ativa.", confianca: "baixa" };
};

// 9. Agiu com agilidade e proatividade?
const c9: CriterionAnalyzer = (msgs, ctx) => {
  const proactivePatterns = /(?:já\s+(?:estou|vou)|vou\s+(?:verificar|resolver|providenciar|encaminhar)|(?:estou|vamos)\s+(?:agilizando|resolvendo|encaminhando)|imediatamente|prontamente|já\s+(?:resolvi|fiz|encaminhei))/gi;
  const proactive = ctx.attText.match(proactivePatterns);
  
  const pCount = proactive?.length || 0;
  const avgTime = ctx.avgResponseTimeSec;
  
  // Reactive execution with speed is agilidade, but cap at PARCIAL if no validation
  if (ctx.reactiveExecution.isReactive) {
    if (pCount >= 1 || (avgTime != null && avgTime <= 120)) {
      const ev = findEvidence(msgs, proactivePatterns, "atendente");
      return { sugestao: "PARCIAL", justificativa: "Atendente foi ágil na execução, porém atuou de forma reativa com base no contexto prévio, sem proatividade na condução do atendimento.", evidencia: ev, confianca: "media" };
    }
    return { sugestao: "NÃO", justificativa: "Execução reativa sem evidências de agilidade ou proatividade na condução.", confianca: "media" };
  }
  
  if (pCount >= 2 || (pCount >= 1 && avgTime != null && avgTime <= 120)) {
    const ev = findEvidence(msgs, proactivePatterns, "atendente");
    return { sugestao: "SIM", justificativa: `Atendente demonstrou proatividade (${pCount} ações diretas).`, evidencia: ev, confianca: "media" };
  }
  if (pCount >= 1) {
    const ev = findEvidence(msgs, proactivePatterns, "atendente");
    return { sugestao: "PARCIAL", justificativa: "Alguma proatividade detectada, mas poderia ser mais ágil.", evidencia: ev, confianca: "baixa" };
  }
  return { sugestao: "NÃO", justificativa: "Não foram encontradas evidências claras de agilidade ou proatividade.", confianca: "baixa" };
};

// 10. Buscou retenção em cancelamentos?
const c10: CriterionAnalyzer = (msgs, ctx) => {
  const isCancelamento = /cancelar|cancelamento|desistir|encerrar\s+(?:o\s+)?(?:contrato|plano|serviço)/i.test(ctx.clientText);
  if (!isCancelamento) {
    return { sugestao: "SIM", justificativa: "Não se aplica: atendimento não envolve cancelamento.", confianca: "alta" };
  }
  
  const retencaoPatterns = /(?:posso\s+(?:oferecer|sugerir)|(?:temos|existe)\s+(?:uma?\s+)?(?:alternativa|opção|oferta)|desconto|benefício|manter|reter|(?:antes\s+de\s+)?cancelar.*(?:considerar|avaliar)|vantag)/gi;
  const retencao = ctx.attText.match(retencaoPatterns);
  
  if (retencao && retencao.length >= 2) {
    const ev = findEvidence(msgs, retencaoPatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente buscou retenção oferecendo alternativas.", evidencia: ev, confianca: "alta" };
  }
  if (retencao && retencao.length >= 1) {
    const ev = findEvidence(msgs, retencaoPatterns, "atendente");
    return { sugestao: "PARCIAL", justificativa: "Tentativa de retenção foi feita mas de forma superficial.", evidencia: ev, confianca: "media" };
  }
  return { sugestao: "NÃO", justificativa: "Cliente mencionou cancelamento mas atendente não buscou retenção.", confianca: "alta" };
};

// 11. Informou registro da solução no sistema?
const c11: CriterionAnalyzer = (msgs, ctx) => {
  const registroPatterns = /(?:registr(?:ei|ado|ando)|protocolado|anotado|lançado|(?:abri|criei)\s+(?:um\s+)?(?:chamado|protocolo|ticket|ordem\s+de\s+serviço)|(?:seu|o)\s+protocolo\s+é|número\s+(?:do\s+)?protocolo)/gi;
  const registro = ctx.attText.match(registroPatterns);
  
  if (registro && registro.length >= 1) {
    const ev = findEvidence(msgs, registroPatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente informou o registro/protocolo da solução.", evidencia: ev, confianca: "alta" };
  }
  return { sugestao: "NÃO", justificativa: "Não há menção a registro, protocolo ou anotação no sistema.", confianca: "media" };
};

// 12. Confirmou se o cliente ficou confortável?
const c12: CriterionAnalyzer = (msgs, ctx) => {
  const confirmPatterns = /(?:ficou\s+(?:claro|tranquilo|confortável|satisfeito)|(?:está|ficou)\s+(?:ok|tudo\s+bem|de\s+acordo)|(?:restou|ficou)\s+(?:alguma\s+)?dúvida|(?:entendeu|compreendeu)\s+(?:tudo|bem)|(?:posso|mais\s+alguma?\s+)(?:ajudar|coisa))/gi;
  const confirm = ctx.attText.match(confirmPatterns);
  
  if (confirm && confirm.length >= 1) {
    const ev = findEvidence(msgs, confirmPatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente verificou se o cliente ficou confortável.", evidencia: ev, confianca: "alta" };
  }
  return { sugestao: "NÃO", justificativa: "Atendente não confirmou conforto ou satisfação do cliente.", confianca: "media" };
};

// 13. Buscou alternativa quando necessário?
const c13: CriterionAnalyzer = (msgs, ctx) => {
  const problemIndicators = /(?:não\s+(?:consigo|funciona|deu)|problema|erro|falha|reclamação|insatisf)/i.test(ctx.clientText);
  if (!problemIndicators) {
    return { sugestao: "SIM", justificativa: "Não houve necessidade aparente de buscar alternativas.", confianca: "baixa" };
  }
  
  const altPatterns = /(?:outra\s+(?:opção|alternativa|forma)|podemos\s+(?:tentar|fazer)|(?:também|outra)\s+possibilidade|(?:vou|posso)\s+(?:verificar|buscar)\s+(?:outra|uma)|alternativa|solução\s+(?:diferente|alternativa))/gi;
  const alt = ctx.attText.match(altPatterns);
  
  if (alt && alt.length >= 1) {
    const ev = findEvidence(msgs, altPatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente ofereceu alternativa diante de dificuldade.", evidencia: ev, confianca: "media" };
  }
  return { sugestao: "NÃO", justificativa: "Havia necessidade de alternativa, mas atendente não ofereceu.", confianca: "media" };
};

// 14. Realizou testes com o cliente?
const c14: CriterionAnalyzer = (msgs, ctx) => {
  const isTechSupport = /(?:suporte\s+técnico|técnic[oa]|internet|conexão|wi-?fi|sinal|velocidade|lento|reiniciar|cabo|modem|roteador)/i.test(ctx.clientText + " " + ctx.attText);
  if (!isTechSupport) {
    return { sugestao: "SIM", justificativa: "Não se aplica: atendimento não é de suporte técnico.", confianca: "media" };
  }
  
  const testPatterns = /(?:(?:vamos|pode)\s+(?:testar|verificar|reiniciar)|faça\s+(?:o\s+)?teste|teste\s+(?:agora|aí)|reinici(?:e|ar|ou)|(?:está|ficou)\s+(?:funcionando|estável|normal)|deu\s+certo|resolveu)/gi;
  const tests = ctx.attText.match(testPatterns);
  
  if (tests && tests.length >= 2) {
    const ev = findEvidence(msgs, testPatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente realizou testes com o cliente.", evidencia: ev, confianca: "alta" };
  }
  if (tests && tests.length >= 1) {
    const ev = findEvidence(msgs, testPatterns, "atendente");
    return { sugestao: "PARCIAL", justificativa: "Teste parcial identificado, mas sem confirmação completa.", evidencia: ev, confianca: "media" };
  }
  return { sugestao: "NÃO", justificativa: "Atendimento técnico sem testes realizados com o cliente.", confianca: "media" };
};

// 15. Confirmou se restaram dúvidas?
const c15: CriterionAnalyzer = (msgs, ctx) => {
  const doubtPatterns = /(?:(?:restou|ficou|tem|há)\s+(?:alguma\s+)?(?:dúvida|pergunta|questão)|(?:posso|mais\s+alguma?\s+)(?:ajudar|coisa|dúvida)|(?:algo\s+mais|mais\s+algo)\s+(?:que|em\s+que|para))/gi;
  const doubt = ctx.attText.match(doubtPatterns);
  
  if (doubt && doubt.length >= 1) {
    const ev = findEvidence(msgs, doubtPatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente perguntou se restaram dúvidas.", evidencia: ev, confianca: "alta" };
  }
  return { sugestao: "NÃO", justificativa: "Atendente não confirmou se restaram dúvidas.", confianca: "media" };
};

// 16. Cliente demonstrou satisfação?
const c16: CriterionAnalyzer = (msgs, ctx) => {
  const satisfPatterns = /(?:obrigad[oa]|agradeço|excelente|ótimo|perfeito|muito\s+bom|show|valeu|resolveu|funcionou|era\s+(?:isso|só\s+isso)|maravilh[oa]|top)/gi;
  const dissatPatterns = /(?:insatisfeit[oa]|absurdo|péssimo|horrível|nunca\s+mais|vou\s+reclamar|ouvidoria|procon|cancelar|desist)/gi;
  
  const satis = ctx.clientText.match(satisfPatterns);
  const dissat = ctx.clientText.match(dissatPatterns);
  
  if (dissat && dissat.length >= 1) {
    const ev = findEvidence(msgs, dissatPatterns, "cliente");
    return { sugestao: "NÃO", justificativa: "Cliente expressou insatisfação durante o atendimento.", evidencia: ev, confianca: "alta" };
  }
  if (satis && satis.length >= 2) {
    const ev = findEvidence(msgs, satisfPatterns, "cliente");
    return { sugestao: "SIM", justificativa: `Cliente demonstrou satisfação (${satis.length} expressões positivas).`, evidencia: ev, confianca: "alta" };
  }
  if (satis && satis.length >= 1) {
    const ev = findEvidence(msgs, satisfPatterns, "cliente");
    return { sugestao: "PARCIAL", justificativa: "Cliente expressou alguma satisfação, mas de forma moderada.", evidencia: ev, confianca: "media" };
  }
  return { sugestao: "NÃO", justificativa: "Não há expressões claras de satisfação do cliente.", confianca: "baixa" };
};

// 17. Informou serviços ou benefícios?
const c17: CriterionAnalyzer = (msgs, ctx) => {
  const infoPatterns = /(?:(?:temos|oferecemos|disponibilizamos)\s+(?:o\s+)?(?:serviço|benefício|plano|pacote)|(?:você|senhor)\s+(?:tem\s+direito|pode\s+(?:usar|utilizar|acessar))|(?:app|aplicativo|portal|site)\s+(?:do\s+cliente|da\s+empresa)|canal\s+de\s+atendimento|(?:vantag|benefíci))/gi;
  const info = ctx.attText.match(infoPatterns);
  
  if (info && info.length >= 1) {
    const ev = findEvidence(msgs, infoPatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente informou sobre serviços ou benefícios.", evidencia: ev, confianca: "media" };
  }
  return { sugestao: "NÃO", justificativa: "Atendente não mencionou serviços ou benefícios disponíveis.", confianca: "baixa" };
};

// 18. Verificou possibilidade de upgrade?
const c18: CriterionAnalyzer = (msgs, ctx) => {
  const upgradePatterns = /(?:upgrade|migração|plano\s+(?:superior|melhor|mais\s+rápido)|aumentar\s+(?:a\s+)?velocidade|(?:trocar|mudar)\s+(?:de\s+)?plano|oferta\s+(?:especial|exclusiva)|promoção)/gi;
  const upgrade = ctx.attText.match(upgradePatterns);
  
  if (upgrade && upgrade.length >= 1) {
    const ev = findEvidence(msgs, upgradePatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente verificou ou ofereceu possibilidade de upgrade.", evidencia: ev, confianca: "alta" };
  }
  return { sugestao: "NÃO", justificativa: "Atendente não verificou possibilidade de upgrade ou melhoria de plano.", confianca: "baixa" };
};

// 19. Atualizou dados do cliente?
const c19: CriterionAnalyzer = (msgs, ctx) => {
  const updatePatterns = /(?:atualiz(?:ar|ei|ado|ando)\s+(?:os?\s+)?(?:dados|cadastro|endereço|telefone|e-?mail)|(?:seus?\s+)?(?:dados|cadastro)\s+(?:está|estão)\s+(?:atualizado|correto)|confirmar?\s+(?:os?\s+)?(?:dados|endereço|telefone|nome))/gi;
  const update = ctx.attText.match(updatePatterns);
  
  if (update && update.length >= 1) {
    const ev = findEvidence(msgs, updatePatterns, "atendente");
    return { sugestao: "SIM", justificativa: "Atendente atualizou ou confirmou dados cadastrais.", evidencia: ev, confianca: "alta" };
  }
  return { sugestao: "NÃO", justificativa: "Não houve atualização ou confirmação de dados cadastrais.", confianca: "baixa" };
};

// ─── Criteria definitions ───────────────────────────────────────────

const CRITERIA: Array<{ numero: number; nome: string; categoria: string; analyzer: CriterionAnalyzer }> = [
  { numero: 1, nome: "Informou o nome e se apresentou?", categoria: "Postura e Comunicação", analyzer: c1 },
  { numero: 2, nome: "Foi cordial e simpático?", categoria: "Postura e Comunicação", analyzer: c2 },
  { numero: 3, nome: "Chamou o cliente pelo nome?", categoria: "Postura e Comunicação", analyzer: c3 },
  { numero: 4, nome: "Respondeu dentro do tempo adequado?", categoria: "Postura e Comunicação", analyzer: c4 },
  { numero: 5, nome: "Utilizou linguagem profissional?", categoria: "Postura e Comunicação", analyzer: c5 },
  { numero: 6, nome: "Fez perguntas para entender o problema?", categoria: "Entendimento e Condução", analyzer: c6 },
  { numero: 7, nome: "Identificou corretamente a solicitação?", categoria: "Entendimento e Condução", analyzer: c7 },
  { numero: 8, nome: "Demonstrou disposição para ouvir?", categoria: "Entendimento e Condução", analyzer: c8 },
  { numero: 9, nome: "Agiu com agilidade e proatividade?", categoria: "Entendimento e Condução", analyzer: c9 },
  { numero: 10, nome: "Buscou retenção em cancelamentos?", categoria: "Entendimento e Condução", analyzer: c10 },
  { numero: 11, nome: "Informou registro da solução no sistema?", categoria: "Solução e Confirmação", analyzer: c11 },
  { numero: 12, nome: "Confirmou se o cliente ficou confortável?", categoria: "Solução e Confirmação", analyzer: c12 },
  { numero: 13, nome: "Buscou alternativa quando necessário?", categoria: "Solução e Confirmação", analyzer: c13 },
  { numero: 14, nome: "Realizou testes com o cliente?", categoria: "Solução e Confirmação", analyzer: c14 },
  { numero: 15, nome: "Confirmou se restaram dúvidas?", categoria: "Solução e Confirmação", analyzer: c15 },
  { numero: 16, nome: "Cliente demonstrou satisfação?", categoria: "Encerramento e Valor", analyzer: c16 },
  { numero: 17, nome: "Informou serviços ou benefícios?", categoria: "Encerramento e Valor", analyzer: c17 },
  { numero: 18, nome: "Verificou possibilidade de upgrade?", categoria: "Encerramento e Valor", analyzer: c18 },
  { numero: 19, nome: "Atualizou dados do cliente?", categoria: "Encerramento e Valor", analyzer: c19 },
];

// ─── Main Analysis Function ─────────────────────────────────────────

export function runPreAnalysis(
  conversation: StructuredConversation,
  uraContext?: UraContext,
): PreAnalysisResult {
  const msgs = conversation.messages;
  const attMsgs = getAttendantMessages(msgs);
  const clientMsgs = getClientMessages(msgs);
  const attendantName = getAttendantName(msgs);
  const clientName = getClientName(msgs);
  const avgResponseTimeSec = calcAvgResponseTime(msgs);

  const attText = allText(msgs, "atendente");
  const clientText = allText(msgs, "cliente");

  const ctx: AnalysisContext = {
    clientName,
    attendantName,
    avgResponseTimeSec,
    uraContext,
    attMsgs,
    clientMsgs,
    allMsgs: msgs,
    attText,
    clientText,
    reactiveExecution: detectReactiveExecution(attMsgs, clientMsgs, attText),
    hasPriorContext: hasPriorContextDemand(msgs, uraContext),
  };

  const suggestions: PreAnalysisSuggestion[] = CRITERIA.map(c => {
    const result = c.analyzer(msgs, ctx);
    return {
      numero: c.numero,
      nome: c.nome,
      categoria: c.categoria,
      ...result,
    };
  });

  return {
    suggestions,
    metadata: {
      totalMessages: msgs.length,
      humanMessages: getHumanMessages(msgs).length,
      clientMessages: clientMsgs.length,
      attendantMessages: attMsgs.length,
      avgResponseTimeSec,
      attendantName,
      clientName,
    },
  };
}
