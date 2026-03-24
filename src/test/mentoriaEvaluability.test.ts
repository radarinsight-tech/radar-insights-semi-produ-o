import { describe, expect, it } from "vitest";
import {
  detectMentoriaEvaluability,
  mergePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
  resolvePersistedMentoriaEvaluability,
} from "@/lib/mentoriaEvaluability";

describe("mentoria evaluability persistence", () => {
  it("classifica atendimento sem mensagens como avaliável (regra: toda conversa é avaliável)", () => {
    const result = detectMentoriaEvaluability({
      hasAudio: false,
      rawText: undefined,
      structuredConversation: undefined,
    });

    expect(result.nonEvaluable).toBe(false);
    expect(result.evaluable).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("classifica áudio sem transcrição como avaliável (não bloqueia)", () => {
    const result = detectMentoriaEvaluability({
      hasAudio: true,
      rawText: "Download de áudio",
      structuredConversation: { messages: [] } as any,
    });

    expect(result.nonEvaluable).toBe(false);
    expect(result.evaluable).toBe(true);
  });

  it("persiste e restaura a flag de avaliabilidade", () => {
    const persisted = mergePersistedMentoriaEvaluability(undefined, {
      evaluable: false,
      nonEvaluable: true,
      reason: "Sem resposta do cliente",
    });

    expect(persisted).toMatchObject({
      avaliavel: false,
      inelegivel: true,
      motivo_inelegivel: "Sem resposta do cliente",
      motivo_nao_avaliavel: "Sem resposta do cliente",
      _ineligible: true,
      _nonEvaluable: true,
    });

    expect(resolvePersistedMentoriaEvaluability(persisted)).toEqual({
      evaluable: false,
      nonEvaluable: true,
      reason: "Sem resposta do cliente",
    });

    expect(resolvePersistedMentoriaIneligibility(persisted)).toEqual({
      ineligible: true,
      reason: "Sem resposta do cliente",
    });
  });
});
