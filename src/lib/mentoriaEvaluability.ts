import type { StructuredConversation } from "./conversationParser";
import { detectEvaluability, type EvaluabilityResult } from "./evaluabilityDetector";

export interface MentoriaEvaluabilityState {
  evaluable: boolean;
  nonEvaluable: boolean;
  reason?: string;
}

export interface MentoriaIneligibilityState {
  ineligible: boolean;
  reason?: string;
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
  // Rule: every attendance with any content is evaluable.
  // Audio-only without transcription is the only exception where we still allow but flag.
  // The 19-question matrix adapts — questions that don't apply are marked "não aplicável".
  return {
    evaluable: true,
    nonEvaluable: false,
    reason: undefined,
  };
}

export function resolvePersistedMentoriaEvaluability(result: unknown): MentoriaEvaluabilityState | null {
  if (!isRecord(result)) return null;

  const reason =
    normalizeReason(result.motivo_nao_avaliavel) ??
    normalizeReason(result._nonEvaluableReason) ??
    normalizeReason(result.motivo_inelegivel) ??
    normalizeReason(result._ineligibleReason);

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

export function resolvePersistedMentoriaIneligibility(result: unknown): MentoriaIneligibilityState | null {
  if (!isRecord(result)) return null;

  const reason =
    normalizeReason(result.motivo_inelegivel) ??
    normalizeReason(result._ineligibleReason) ??
    normalizeReason(result.motivo_nao_avaliavel) ??
    normalizeReason(result._nonEvaluableReason);

  const ineligible = normalizeBoolean(result.inelegivel) ?? normalizeBoolean(result._ineligible);
  if (typeof ineligible === "boolean") {
    return {
      ineligible,
      reason,
    };
  }

  const evaluability = resolvePersistedMentoriaEvaluability(result);
  if (evaluability) {
    return {
      ineligible: evaluability.nonEvaluable,
      reason: evaluability.reason,
    };
  }

  return null;
}

export function mergePersistedMentoriaEvaluability(result: unknown, state: MentoriaEvaluabilityState) {
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