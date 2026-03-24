/**
 * Mentoria Scoring Engine — Regression Tests
 *
 * Validates scoring calculation, classification thresholds,
 * and bonus tier mapping to prevent regressions.
 */

import { describe, it, expect } from "vitest";
import {
  calculateScore,
  classify,
  CRITERIA_WEIGHTS,
  TOTAL_POSSIBLE,
  scoreFromFullReport,
  analyzeCriteriaFailures,
} from "@/lib/mentoriaScoring";
import type { SugestaoResultado } from "@/lib/mentoriaPreAnalysis";

// ─── Helpers ────────────────────────────────────────────────────────────

function makeRespostas(defaultResp: SugestaoResultado): Array<{ numero: number; resposta: SugestaoResultado }> {
  return CRITERIA_WEIGHTS.map(c => ({ numero: c.numero, resposta: defaultResp }));
}

// ─── 1. Weight integrity ────────────────────────────────────────────────

describe("Scoring weights integrity", () => {
  it("should have exactly 19 criteria", () => {
    expect(CRITERIA_WEIGHTS).toHaveLength(19);
  });

  it("should total exactly 100 points", () => {
    expect(TOTAL_POSSIBLE).toBe(100);
  });

  it("should have 4 categories", () => {
    const cats = new Set(CRITERIA_WEIGHTS.map(c => c.categoria));
    expect(cats.size).toBe(4);
    expect(cats).toContain("Postura e Comunicação");
    expect(cats).toContain("Entendimento e Condução");
    expect(cats).toContain("Solução e Confirmação");
    expect(cats).toContain("Encerramento e Valor");
  });

  it("category weights should sum correctly", () => {
    const sums: Record<string, number> = {};
    for (const c of CRITERIA_WEIGHTS) {
      sums[c.categoria] = (sums[c.categoria] || 0) + c.peso;
    }
    expect(sums["Postura e Comunicação"]).toBe(25);
    expect(sums["Entendimento e Condução"]).toBe(30);
    expect(sums["Solução e Confirmação"]).toBe(28);
    expect(sums["Encerramento e Valor"]).toBe(17);
  });
});

// ─── 2. Score calculation ───────────────────────────────────────────────

describe("Score calculation", () => {
  it("all SIM should give 100", () => {
    const result = calculateScore(makeRespostas("SIM"));
    expect(result.nota100).toBe(100);
    expect(result.pontosObtidos).toBe(100);
    expect(result.classificacao).toBe("Excelente");
  });

  it("all NÃO should give 0", () => {
    const result = calculateScore(makeRespostas("NÃO"));
    expect(result.nota100).toBe(0);
    expect(result.pontosObtidos).toBe(0);
    expect(result.classificacao).toBe("Crítico");
  });

  it("all PARCIAL should give ~50", () => {
    const result = calculateScore(makeRespostas("PARCIAL"));
    expect(result.nota100).toBeGreaterThanOrEqual(49);
    expect(result.nota100).toBeLessThanOrEqual(51);
  });

  it("missing criteria default to NÃO", () => {
    const result = calculateScore([]);
    expect(result.nota100).toBe(0);
  });

  it("nota10 should be nota100 / 10", () => {
    const result = calculateScore(makeRespostas("SIM"));
    expect(result.nota10).toBe(10);
  });

  it("porCategoria percentuals should be consistent", () => {
    const result = calculateScore(makeRespostas("SIM"));
    for (const cat of Object.values(result.porCategoria)) {
      expect(cat.percentual).toBe(100);
      expect(cat.obtidos).toBe(cat.possiveis);
    }
  });
});

// ─── 3. Classification thresholds ───────────────────────────────────────

describe("Classification thresholds (anti-regression)", () => {
  it("85+ = Excelente", () => {
    expect(classify(85)).toBe("Excelente");
    expect(classify(100)).toBe("Excelente");
  });

  it("65-84 = Bom atendimento", () => {
    expect(classify(65)).toBe("Bom atendimento");
    expect(classify(84)).toBe("Bom atendimento");
  });

  it("45-64 = Abaixo do esperado", () => {
    expect(classify(45)).toBe("Abaixo do esperado");
    expect(classify(64)).toBe("Abaixo do esperado");
  });

  it("< 45 = Crítico", () => {
    expect(classify(44)).toBe("Crítico");
    expect(classify(0)).toBe("Crítico");
  });
});

// ─── 4. Bonus tier mapping ─────────────────────────────────────────────

describe("Bonus tier mapping (anti-regression)", () => {
  const BONUS_BASE = 1200;

  function bonusTier(nota: number): number {
    if (nota >= 95) return BONUS_BASE;
    if (nota >= 85) return BONUS_BASE * 0.9;
    if (nota >= 70) return BONUS_BASE * 0.7;
    if (nota >= 50) return BONUS_BASE * 0.3;
    return 0;
  }

  it("95-100 = 100% (R$ 1200)", () => {
    expect(bonusTier(95)).toBe(1200);
    expect(bonusTier(100)).toBe(1200);
  });

  it("85-94 = 90% (R$ 1080)", () => {
    expect(bonusTier(85)).toBe(1080);
    expect(bonusTier(94)).toBe(1080);
  });

  it("70-84 = 70% (R$ 840)", () => {
    expect(bonusTier(70)).toBe(840);
    expect(bonusTier(84)).toBe(840);
  });

  it("50-69 = 30% (R$ 360)", () => {
    expect(bonusTier(50)).toBe(360);
    expect(bonusTier(69)).toBe(360);
  });

  it("< 50 = 0%", () => {
    expect(bonusTier(49)).toBe(0);
    expect(bonusTier(0)).toBe(0);
  });
});

// ─── 5. scoreFromFullReport ─────────────────────────────────────────────

describe("scoreFromFullReport", () => {
  it("returns null for invalid input", () => {
    expect(scoreFromFullReport(null)).toBeNull();
    expect(scoreFromFullReport(undefined)).toBeNull();
    expect(scoreFromFullReport({})).toBeNull();
    expect(scoreFromFullReport({ criterios: "invalid" })).toBeNull();
  });

  it("parses a valid full_report", () => {
    const report = {
      criterios: CRITERIA_WEIGHTS.map(c => ({
        numero: c.numero,
        resultado: "SIM",
      })),
    };
    const result = scoreFromFullReport(report);
    expect(result).not.toBeNull();
    expect(result!.nota100).toBe(100);
  });
});

// ─── 6. analyzeCriteriaFailures ─────────────────────────────────────────

describe("analyzeCriteriaFailures", () => {
  it("identifies criteria with highest failure rates", () => {
    const evaluations = [
      { full_report: { criterios: CRITERIA_WEIGHTS.map(c => ({ numero: c.numero, resultado: c.numero === 1 ? "NÃO" : "SIM" })) } },
      { full_report: { criterios: CRITERIA_WEIGHTS.map(c => ({ numero: c.numero, resultado: c.numero === 1 ? "NÃO" : "SIM" })) } },
    ];
    const failures = analyzeCriteriaFailures(evaluations);
    expect(failures[0].numero).toBe(1);
    expect(failures[0].taxaFalha).toBe(100);
  });

  it("handles empty evaluations", () => {
    const failures = analyzeCriteriaFailures([]);
    expect(failures).toHaveLength(19);
    expect(failures.every(f => f.totalAvaliacoes === 0)).toBe(true);
  });
});
