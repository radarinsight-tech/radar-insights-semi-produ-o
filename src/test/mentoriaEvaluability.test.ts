import { describe, expect, it } from "vitest";
import {
  detectMentoriaEvaluability,
  mergePersistedMentoriaEvaluability,
  resolvePersistedMentoriaEvaluability,
} from "@/lib/mentoriaEvaluability";

describe("mentoria evaluability persistence", () => {
  it("classifica atendimento sem mensagens parseadas como não avaliável", () => {
    const result = detectMentoriaEvaluability({
      hasAudio: false,
      rawText: undefined,
      structuredConversation: undefined,
    });

    expect(result.nonEvaluable).toBe(true);
    expect(result.evaluable).toBe(false);
    expect(result.reason).toBe("Sem mensagens suficientes para avaliação");
  });

  it("classifica áudio sem transcrição válida como não avaliável", () => {
    const result = detectMentoriaEvaluability({
      hasAudio: true,
      rawText: "Download de áudio",
      structuredConversation: { messages: [] } as any,
    });

    expect(result.nonEvaluable).toBe(true);
    expect(result.evaluable).toBe(false);
    expect(result.reason).toBe("Áudio sem transcrição válida");
  });

  it("persiste e restaura a flag de avaliabilidade", () => {
    const persisted = mergePersistedMentoriaEvaluability(undefined, {
      evaluable: false,
      nonEvaluable: true,
      reason: "Sem resposta do cliente",
    });

    expect(persisted).toMatchObject({
      avaliavel: false,
      motivo_nao_avaliavel: "Sem resposta do cliente",
      _nonEvaluable: true,
    });

    expect(resolvePersistedMentoriaEvaluability(persisted)).toEqual({
      evaluable: false,
      nonEvaluable: true,
      reason: "Sem resposta do cliente",
    });
  });
});