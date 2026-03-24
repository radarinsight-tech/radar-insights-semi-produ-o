import type { StructuredConversation } from "./conversationParser";
import { detectEvaluability, type EvaluabilityResult } from "./evaluabilityDetector";

export interface MentoriaEvaluabilityState {
  evaluable: boolean;
  nonEvaluable: boolean;
  reason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeReason(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function toMentoriaEvaluabilityState(result: EvaluabilityResult): MentoriaEvaluabilityState {
  return {
    evaluable: result.evaluable,
    nonEvaluable: !result.evaluable,
    reason: result.reason,
  };
}

export function detectMentoriaEvaluability(params: {
  structuredConversation?: StructuredConversation;
  rawText?: string;
  hasAudio?: boolean;
}): MentoriaEvaluabilityState {
  const { structuredConversation, rawText, hasAudio } = params;
  const totalMessages = structuredConversation?.messages?.length ?? 0;

  const hasHumanTranscription = structuredConversation?.messages?.some((msg) => {
    if (msg.role !== "cliente" && msg.role !== "atendente") return false;
    return msg.text.trim().length > 0;
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
      reason: "Sem mensagens suficientes para avaliação",
    };
  }

  return toMentoriaEvaluabilityState(detectEvaluability(structuredConversation, rawText));
}

export function resolvePersistedMentoriaEvaluability(result: unknown): MentoriaEvaluabilityState | null {
  if (!isRecord(result)) return null;

  const reason = normalizeReason(result.motivo_nao_avaliavel) ?? normalizeReason(result._nonEvaluableReason);

  if (typeof result.avaliavel === "boolean") {
    return {
      evaluable: result.avaliavel,
      nonEvaluable: !result.avaliavel,
      reason,
    };
  }

  if (typeof result._evaluable === "boolean") {
    return {
      evaluable: result._evaluable,
      nonEvaluable: !result._evaluable,
      reason,
    };
  }

  if (typeof result._nonEvaluable === "boolean") {
    return {
      evaluable: !result._nonEvaluable,
      nonEvaluable: result._nonEvaluable,
      reason,
    };
  }

  return null;
}

export function mergePersistedMentoriaEvaluability(result: unknown, state: MentoriaEvaluabilityState) {
  const base = isRecord(result) ? result : {};

  return {
    ...base,
    avaliavel: state.evaluable,
    motivo_nao_avaliavel: state.reason ?? null,
    _evaluable: state.evaluable,
    _nonEvaluable: state.nonEvaluable,
    _nonEvaluableReason: state.reason ?? null,
  };
}