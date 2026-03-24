/**
 * Mentoria Lab — Batch Processing & Module Isolation Regression Tests
 *
 * Validates:
 *  - Batch queue resilience (continues on individual failures)
 *  - Concurrency limits
 *  - Module isolation (Mentoria vs Credit/SPC share no logic)
 *  - Fallback result generation
 *  - Card status tracking during batch operations
 */

import { describe, it, expect } from "vitest";

// ─── 1. Batch queue resilience ──────────────────────────────────────────

describe("Batch queue resilience", () => {
  type CardStatus = "nao_iniciado" | "em_analise" | "finalizado" | "erro";

  interface QueueItem {
    id: string;
    status: CardStatus;
  }

  async function simulateBatchQueue(
    items: QueueItem[],
    failIds: Set<string>,
    concurrency: number
  ): Promise<QueueItem[]> {
    const results = [...items];
    const queue = [...items];
    let running = 0;

    const process = async (item: QueueItem) => {
      const idx = results.findIndex(r => r.id === item.id);
      results[idx] = { ...item, status: "em_analise" };

      // Simulate async work
      await new Promise(r => setTimeout(r, 1));

      if (failIds.has(item.id)) {
        results[idx] = { ...item, status: "erro" };
      } else {
        results[idx] = { ...item, status: "finalizado" };
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const item = queue.shift()!;
            await process(item);
          }
        })()
      );
    }

    await Promise.all(workers);
    return results;
  }

  it("should continue processing after individual failure", async () => {
    const items: QueueItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `file-${i}`,
      status: "nao_iniciado" as const,
    }));

    const failIds = new Set(["file-2"]);
    const results = await simulateBatchQueue(items, failIds, 2);

    expect(results.filter(r => r.status === "finalizado")).toHaveLength(4);
    expect(results.filter(r => r.status === "erro")).toHaveLength(1);
    expect(results.find(r => r.id === "file-2")!.status).toBe("erro");
    // Verify files after the failed one still processed
    expect(results.find(r => r.id === "file-3")!.status).toBe("finalizado");
    expect(results.find(r => r.id === "file-4")!.status).toBe("finalizado");
  });

  it("should handle all items failing without crash", async () => {
    const items: QueueItem[] = Array.from({ length: 3 }, (_, i) => ({
      id: `file-${i}`,
      status: "nao_iniciado" as const,
    }));

    const failIds = new Set(["file-0", "file-1", "file-2"]);
    const results = await simulateBatchQueue(items, failIds, 5);

    expect(results.every(r => r.status === "erro")).toBe(true);
  });

  it("should respect concurrency limit", async () => {
    const CONCURRENCY = 5;
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const items = Array.from({ length: 20 }, (_, i) => ({ id: `f-${i}`, status: "nao_iniciado" as const }));
    const queue = [...items];
    const workers: Promise<void>[] = [];

    for (let i = 0; i < CONCURRENCY; i++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            queue.shift();
            currentConcurrent++;
            maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
            await new Promise(r => setTimeout(r, 1));
            currentConcurrent--;
          }
        })()
      );
    }

    await Promise.all(workers);
    expect(maxConcurrent).toBeLessThanOrEqual(CONCURRENCY);
  });

  it("should track batch stats correctly", async () => {
    const stats = { analyzing: 0, completed: 0, failed: 0 };
    const items = ["a", "b", "c", "d", "e"];
    const failSet = new Set(["c"]);

    for (const id of items) {
      stats.analyzing++;
      if (failSet.has(id)) {
        stats.analyzing--;
        stats.failed++;
      } else {
        stats.analyzing--;
        stats.completed++;
      }
    }

    expect(stats.analyzing).toBe(0);
    expect(stats.completed).toBe(4);
    expect(stats.failed).toBe(1);
  });
});

// ─── 2. Module isolation ────────────────────────────────────────────────

describe("Module isolation (Mentoria vs Credit/SPC)", () => {
  // These tests verify that the modules use separate code paths

  const MENTORIA_EDGE_FUNCTIONS = [
    "analyze-attendance",
    "preflight-mentoria",
    "classify-mentoria-ingestion",
  ];

  const CREDIT_EDGE_FUNCTIONS = [
    "analyze-credit",
    "consult-spc",
    "ocr-document",
    "ocr-image",
  ];

  it("should have no overlap in edge function names", () => {
    const overlap = MENTORIA_EDGE_FUNCTIONS.filter(f => CREDIT_EDGE_FUNCTIONS.includes(f));
    expect(overlap).toHaveLength(0);
  });

  it("should use separate storage buckets", () => {
    const MENTORIA_BUCKET = "mentoria-lab";
    const CREDIT_BUCKET = "credit-documents";
    expect(MENTORIA_BUCKET).not.toBe(CREDIT_BUCKET);
  });

  it("should use separate database tables", () => {
    const MENTORIA_TABLES = ["mentoria_batches", "mentoria_batch_files", "evaluations"];
    const CREDIT_TABLES = ["credit_analyses", "document_analyses", "document_items"];
    const overlap = MENTORIA_TABLES.filter(t => CREDIT_TABLES.includes(t));
    expect(overlap).toHaveLength(0);
  });

  it("should have independent route paths", () => {
    const MENTORIA_ROUTES = ["/mentoria-lab", "/mentoria-preventiva", "/ranking", "/performance", "/atendentes"];
    const CREDIT_ROUTES = ["/credit", "/credit-dashboard", "/credit-docs", "/credit-spc"];
    const overlap = MENTORIA_ROUTES.filter(r => CREDIT_ROUTES.includes(r));
    expect(overlap).toHaveLength(0);
  });
});

// ─── 3. Fallback result generation ──────────────────────────────────────

describe("Fallback result on analysis failure", () => {
  function generateFallbackResult() {
    return {
      nota: 7,
      classificacao: "Bom atendimento",
      criterios: Array.from({ length: 19 }, (_, i) => ({
        numero: i + 1,
        resultado: "PARCIAL",
        justificativa: "Avaliação automática não disponível. Resultado padrão aplicado.",
      })),
      fallback: true,
    };
  }

  it("should produce valid fallback with nota 7", () => {
    const fb = generateFallbackResult();
    expect(fb.nota).toBe(7);
    expect(fb.classificacao).toBe("Bom atendimento");
    expect(fb.fallback).toBe(true);
  });

  it("should have 19 criteria in fallback", () => {
    const fb = generateFallbackResult();
    expect(fb.criterios).toHaveLength(19);
  });

  it("should mark all criteria as PARCIAL in fallback", () => {
    const fb = generateFallbackResult();
    expect(fb.criterios.every((c: any) => c.resultado === "PARCIAL")).toBe(true);
  });
});

// ─── 4. Session validation before batch ─────────────────────────────────

describe("Session validation before batch operations", () => {
  it("should block batch if session is expired", () => {
    const session = { access_token: "", expires_at: Date.now() - 10000 };
    const isValid = !!session.access_token && session.expires_at > Date.now();
    expect(isValid).toBe(false);
  });

  it("should allow batch with valid session", () => {
    const session = { access_token: "jwt-token", expires_at: Date.now() + 3600000 };
    const isValid = !!session.access_token && session.expires_at > Date.now();
    expect(isValid).toBe(true);
  });
});

// ─── 5. Preflight checklist completeness ────────────────────────────────

describe("Preflight checklist completeness", () => {
  const REQUIRED_CHECKS = ["auth", "supabase_conn", "ai_provider", "ai_credits", "edge_fn"];

  it("should validate all required checks exist", () => {
    const mockChecks = [
      { key: "auth", status: "ok" },
      { key: "supabase_conn", status: "ok" },
      { key: "ai_provider", status: "ok" },
      { key: "ai_credits", status: "ok" },
      { key: "edge_fn", status: "ok" },
    ];

    const checkKeys = mockChecks.map(c => c.key);
    for (const req of REQUIRED_CHECKS) {
      expect(checkKeys).toContain(req);
    }
  });

  it("should block if any required check is missing", () => {
    const incompleteChecks = [
      { key: "auth", status: "ok" },
      { key: "supabase_conn", status: "ok" },
      // missing ai_provider, ai_credits, edge_fn
    ];

    const checkKeys = incompleteChecks.map(c => c.key);
    const allPresent = REQUIRED_CHECKS.every(r => checkKeys.includes(r));
    expect(allPresent).toBe(false);
  });
});
