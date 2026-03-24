import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type MessageRole = "atendente" | "cliente" | "bot" | "sistema";

interface ParsedMessage {
  role: MessageRole;
  text: string;
}

interface StructuredConversation {
  messages?: ParsedMessage[];
}

interface EvaluabilityResult {
  evaluable: boolean;
  reason?: string;
}

interface RequestBody {
  batchFileId?: string;
  existingResult?: Record<string, unknown> | null;
  extractedText?: string | null;
  parsedMessages?: StructuredConversation | null;
  hasAudio?: boolean;
  extractionError?: string | null;
  metadata?: {
    protocolo?: string | null;
    atendente?: string | null;
    dataAtendimento?: string | null;
    canal?: string | null;
  };
}

const MIN_HUMAN_MESSAGES = 3;
const MIN_BACK_AND_FORTH = 1;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeReason(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function isAutomatedMessage(msg: ParsedMessage): boolean {
  if (msg.role === "bot" || msg.role === "sistema") return true;

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

  return templatePatterns.some((pattern) => pattern.test(msg.text));
}

function countBackAndForth(messages: ParsedMessage[]): number {
  let exchanges = 0;
  let lastRole: string | null = null;

  for (const msg of messages) {
    if (msg.role === "bot" || msg.role === "sistema") continue;
    if (lastRole && lastRole !== msg.role) {
      exchanges += 1;
    }
    lastRole = msg.role;
  }

  return exchanges;
}

function detectEvaluability(conversation?: StructuredConversation, rawText?: string): EvaluabilityResult {
  if (!conversation?.messages || conversation.messages.length === 0) {
    if (!rawText || rawText.trim().length === 0) {
      return {
        evaluable: false,
        reason: "Sem conteúdo extraído para avaliação",
      };
    }

    return { evaluable: true };
  }

  const messages = conversation.messages;
  const clientMessages = messages.filter((message) => message.role === "cliente");
  const attendantMessages = messages.filter((message) => message.role === "atendente");
  const humanMessages = [...clientMessages, ...attendantMessages];
  const backAndForthCount = countBackAndForth(messages);
  const nonAutomatedAttendant = attendantMessages.filter((message) => !isAutomatedMessage(message));
  const hasBackAndForth = backAndForthCount >= MIN_BACK_AND_FORTH;

  if (attendantMessages.length === 0) {
    return {
      evaluable: false,
      reason: "Sem participação de atendente humano",
    };
  }

  if (nonAutomatedAttendant.length === 0) {
    return {
      evaluable: false,
      reason: "Apenas mensagens automáticas ou padrão do atendente",
    };
  }

  if (clientMessages.length === 0) {
    return {
      evaluable: false,
      reason: "Sem resposta do cliente",
    };
  }

  if (!hasBackAndForth) {
    return {
      evaluable: false,
      reason: "Sem troca de mensagens entre atendente e cliente",
    };
  }

  if (humanMessages.length < MIN_HUMAN_MESSAGES) {
    return {
      evaluable: false,
      reason: "Interação insuficiente para avaliação (menos de 3 mensagens humanas)",
    };
  }

  return { evaluable: true };
}

function detectMentoriaEvaluability(params: {
  structuredConversation?: StructuredConversation;
  rawText?: string;
  hasAudio?: boolean;
  extractionError?: string;
}): EvaluabilityResult & { nonEvaluable: boolean } {
  const { structuredConversation, rawText, hasAudio, extractionError } = params;
  const totalMessages = structuredConversation?.messages?.length ?? 0;

  const hasHumanTranscription = structuredConversation?.messages?.some((message) => {
    if (message.role !== "cliente" && message.role !== "atendente") return false;
    return message.text.trim().length > 0;
  }) ?? false;

  if (hasAudio && !hasHumanTranscription) {
    return {
      evaluable: false,
      nonEvaluable: true,
      reason: "Áudio sem transcrição válida",
    };
  }

  if (totalMessages === 0) {
    return {
      evaluable: false,
      nonEvaluable: true,
      reason: rawText?.trim()
        ? "Sem mensagens suficientes para avaliação"
        : extractionError
          ? `Dados incompletos: ${extractionError}`
          : "Dados incompletos: PDF sem texto extraível (possivelmente digitalizado)",
    };
  }

  const evaluability = detectEvaluability(structuredConversation, rawText);
  return {
    evaluable: evaluability.evaluable,
    nonEvaluable: !evaluability.evaluable,
    reason: evaluability.reason,
  };
}

function resolvePersistedMentoriaIneligibility(result: Record<string, unknown>) {
  const reason =
    normalizeReason(result.motivo_inelegivel) ??
    normalizeReason(result._ineligibleReason) ??
    normalizeReason(result.motivo_nao_avaliavel) ??
    normalizeReason(result._nonEvaluableReason);

  const ineligible = normalizeBoolean(result.inelegivel) ?? normalizeBoolean(result._ineligible);
  if (typeof ineligible === "boolean") {
    return { ineligible, reason };
  }

  return null;
}

function mergePersistedMentoriaEvaluability(result: Record<string, unknown> | null | undefined, state: { evaluable: boolean; nonEvaluable: boolean; reason?: string }) {
  const base = isRecord(result) ? result : {};
  const persistedIneligibility = resolvePersistedMentoriaIneligibility(base);
  const ineligible = (persistedIneligibility?.ineligible ?? false) || state.nonEvaluable;
  const nonEvaluableReason = state.reason;
  const ineligibleReason = persistedIneligibility?.reason ?? (state.nonEvaluable ? state.reason : undefined);

  return {
    ...base,
    avaliavel: state.evaluable,
    inelegivel: ineligible,
    motivo_inelegivel: ineligibleReason ?? null,
    motivo_nao_avaliavel: nonEvaluableReason ?? null,
    _evaluable: state.evaluable,
    _nonEvaluable: state.nonEvaluable,
    _nonEvaluableReason: nonEvaluableReason ?? null,
    _ineligible: ineligible,
    _ineligibleReason: ineligibleReason ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return json({ error: "Configuração do backend indisponível" }, 500);
    }

    const body = (await req.json()) as RequestBody;
    const rawText = typeof body.extractedText === "string" && body.extractedText.trim().length > 0
      ? body.extractedText
      : undefined;
    const parsedMessages = body.parsedMessages && isRecord(body.parsedMessages)
      ? body.parsedMessages as StructuredConversation
      : undefined;
    const hasAudio = Boolean(body.hasAudio);
    const extractionError = normalizeReason(body.extractionError);

    const evaluability = detectMentoriaEvaluability({
      structuredConversation: parsedMessages,
      rawText,
      hasAudio,
      extractionError,
    });

    const mergedResult = mergePersistedMentoriaEvaluability(body.existingResult, evaluability);
    const inelegivel = Boolean(mergedResult.inelegivel ?? mergedResult._ineligible);
    const motivoInelegivel = normalizeReason(mergedResult.motivo_inelegivel) ?? normalizeReason(mergedResult._ineligibleReason) ?? null;
    const motivoNaoAvaliavel = normalizeReason(mergedResult.motivo_nao_avaliavel) ?? normalizeReason(mergedResult._nonEvaluableReason) ?? null;

    console.info("[Mentoria][Ingestao][Avaliabilidade]", {
      id_atendimento: body.batchFileId ?? null,
      avaliavel: evaluability.evaluable,
      inelegivel,
      motivo_inelegivel: motivoInelegivel,
      motivo_nao_avaliavel: motivoNaoAvaliavel,
      has_audio: hasAudio,
      mensagens_parseadas: parsedMessages?.messages?.length ?? 0,
    });

    if (!body.batchFileId) {
      return json({
        result: mergedResult,
        avaliavel: evaluability.evaluable,
        inelegivel,
        motivo_inelegivel: motivoInelegivel,
        motivo_nao_avaliavel: motivoNaoAvaliavel,
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: existingRow, error: lookupError } = await supabase
      .from("mentoria_batch_files")
      .select("id")
      .eq("id", body.batchFileId)
      .maybeSingle();

    if (lookupError) {
      return json({ error: "Falha ao localizar atendimento para classificar", details: lookupError.message }, 500);
    }

    if (!existingRow) {
      return json({ error: "Atendimento não encontrado para classificação" }, 404);
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("mentoria_batch_files")
      .update({
        status: "read",
        protocolo: body.metadata?.protocolo ?? null,
        atendente: body.metadata?.atendente ?? null,
        data_atendimento: body.metadata?.dataAtendimento ?? null,
        canal: body.metadata?.canal ?? "Não identificado",
        has_audio: hasAudio,
        extracted_text: rawText ?? null,
        parsed_messages: parsedMessages ? JSON.parse(JSON.stringify(parsedMessages)) : null,
        result: mergedResult,
        error_message: null,
      } as never)
      .eq("id", body.batchFileId)
      .select("id, status, protocolo, atendente, data_atendimento, canal, has_audio, extracted_text, parsed_messages, result")
      .single();

    if (updateError) {
      return json({ error: "Falha ao persistir classificação do atendimento", details: updateError.message }, 500);
    }

    return json({
      row: updatedRow,
      result: mergedResult,
      avaliavel: evaluability.evaluable,
      inelegivel,
      motivo_inelegivel: motivoInelegivel,
      motivo_nao_avaliavel: motivoNaoAvaliavel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[Mentoria][Ingestao][Avaliabilidade][Erro]", message);
    return json({ error: "Erro ao classificar atendimento na ingestão", details: message }, 500);
  }
});