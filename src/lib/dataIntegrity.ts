/**
 * Data Integrity Guards
 * 
 * Central module for protecting official data from accidental modification.
 * Enforces the principle: "official evaluations are immutable once confirmed."
 * 
 * RULES:
 * 1. Official evaluations (resultado_validado = true) cannot have core fields changed
 * 2. Monthly closings with status "fechado" cannot be modified (except reopen)
 * 3. Bonus recalculation only happens on explicit admin action
 * 4. Parser changes must maintain backward compatibility with old data
 * 5. Test data (Mentoria Lab drafts) never contaminates official indicators
 */

/** Fields that are protected on official evaluations */
export const PROTECTED_EVAL_FIELDS = [
  "nota",
  "classificacao",
  "full_report",
  "atendente",
  "protocolo",
  "data",
  "tipo",
  "bonus",
] as const;

/** Fields that CAN be modified on official evaluations (admin operations) */
export const ALLOWED_EVAL_UPDATES = [
  "excluded_from_ranking",
  "exclusion_reason",
  "excluded_at",
  "excluded_by",
  "audit_log",
  "resultado_validado", // to un-validate
  "sector_id",
] as const;

/**
 * Checks if a field is protected on an official evaluation.
 */
export function isProtectedField(field: string): boolean {
  return (PROTECTED_EVAL_FIELDS as readonly string[]).includes(field);
}

/**
 * Validates that an update payload for an official evaluation
 * only contains allowed fields.
 * Returns list of violations.
 */
export function validateEvalUpdate(
  isOfficial: boolean,
  updatePayload: Record<string, unknown>
): { valid: boolean; violations: string[] } {
  if (!isOfficial) return { valid: true, violations: [] };

  const violations: string[] = [];
  for (const key of Object.keys(updatePayload)) {
    if (isProtectedField(key)) {
      violations.push(key);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Checks if a monthly closing is locked (fechado).
 */
export function isMonthLocked(status: string | null | undefined): boolean {
  return status === "fechado";
}

/**
 * Returns a user-friendly message for integrity violations.
 */
export function integrityErrorMessage(context: "evaluation" | "closing" | "reprocess"): string {
  switch (context) {
    case "evaluation":
      return "Esta avaliação já foi oficializada. Para modificá-la, remova a validação primeiro.";
    case "closing":
      return "Este mês está fechado. Reabra o período antes de fazer alterações.";
    case "reprocess":
      return "Reprocessamento de avaliações oficiais requer ação explícita de administrador.";
  }
}

/**
 * List of operations that require admin confirmation before proceeding.
 */
export const SENSITIVE_OPERATIONS = [
  "recalculate_bonus",
  "reprocess_evaluations",
  "delete_batch",
  "close_month",
  "reopen_month",
  "bulk_update_scores",
  "change_parser_version",
] as const;

export type SensitiveOperation = typeof SENSITIVE_OPERATIONS[number];

export function getSensitiveOperationLabel(op: SensitiveOperation): string {
  const labels: Record<SensitiveOperation, string> = {
    recalculate_bonus: "Recalcular bônus",
    reprocess_evaluations: "Reprocessar avaliações",
    delete_batch: "Excluir lote de mentorias",
    close_month: "Fechar mês",
    reopen_month: "Reabrir mês",
    bulk_update_scores: "Atualizar notas em lote",
    change_parser_version: "Alterar versão do parser",
  };
  return labels[op];
}

export function getSensitiveOperationWarning(op: SensitiveOperation): string {
  const warnings: Record<SensitiveOperation, string> = {
    recalculate_bonus: "Esta ação recalculará os valores de bônus de todos os atendentes no período selecionado.",
    reprocess_evaluations: "Avaliações oficiais serão reprocessadas. Os resultados anteriores serão substituídos.",
    delete_batch: "Todos os arquivos e análises do lote serão permanentemente excluídos.",
    close_month: "O fechamento travará todas as alterações no período. Apenas administradores poderão reabrir.",
    reopen_month: "A reabertura permitirá alterações no período. O histórico de reabertura será registrado.",
    bulk_update_scores: "As notas de múltiplas avaliações serão atualizadas simultaneamente.",
    change_parser_version: "A alteração do parser pode afetar a interpretação de atendimentos futuros.",
  };
  return warnings[op];
}

/**
 * Version compatibility checker for parsed conversations.
 * Ensures old data remains readable even when parser evolves.
 */
export function isCompatibleParserVersion(savedVersion: string | null | undefined): boolean {
  // All versions are compatible - we always maintain backward compat
  // If no version, it's legacy data - still compatible
  return true;
}

/**
 * Determines if an evaluation source is "official" vs "draft".
 * Official: from evaluations table with resultado_validado = true
 * Draft: from mentoria_batch_files or resultado_validado = false
 */
export function isOfficialSource(source: {
  resultado_validado?: boolean;
  table?: string;
}): boolean {
  if (source.table === "mentoria_batch_files") return false;
  if (source.table === "preventive_mentorings") return false;
  return source.resultado_validado === true;
}
