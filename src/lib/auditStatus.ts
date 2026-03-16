/**
 * Centralized audit status system for Radar Insight.
 *
 * All components MUST use these types and functions instead of
 * interpreting full_report fields directly.
 */

/** Official internal status codes */
export type AuditStatus =
  | "auditado"
  | "erro_fluxo_bot"
  | "nao_auditavel"
  | "em_analise"
  | "erro_processamento";

/** Status metadata for display */
export interface AuditStatusInfo {
  code: AuditStatus;
  label: string;
  description: string;
}

/** Registry of all official statuses */
export const AUDIT_STATUSES: Record<AuditStatus, AuditStatusInfo> = {
  auditado: {
    code: "auditado",
    label: "Auditado",
    description: "Atendimento com conteúdo suficiente e interação humana válida, com auditoria concluída.",
  },
  erro_fluxo_bot: {
    code: "erro_fluxo_bot",
    label: "Erros no Fluxo do BOT",
    description: "Atendimentos onde o bot apresentou erro ou comportamento incorreto no fluxo.",
  },
  nao_auditavel: {
    code: "nao_auditavel",
    label: "Atendimentos Não Auditáveis",
    description: "Casos sem interação humana suficiente ou sem conteúdo válido para auditoria.",
  },
  em_analise: {
    code: "em_analise",
    label: "Em Análise",
    description: "Atendimento enviado e ainda em processamento.",
  },
  erro_processamento: {
    code: "erro_processamento",
    label: "Erro de Processamento",
    description: "Falha técnica que impediu a conclusão da auditoria.",
  },
};

/**
 * Derives the official AuditStatus from a full_report object.
 * Handles legacy field names and normalizes to the standard codes.
 */
export function resolveAuditStatus(
  fullReport: Record<string, unknown> | null | undefined
): AuditStatus {
  if (!fullReport) return "auditado"; // legacy records without report

  const statusBot = fullReport.statusBot as string | undefined;
  const statusAuditoria = fullReport.statusAuditoria as string | undefined;
  const statusAtendimento = fullReport.statusAtendimento as string | undefined;

  // 1. Bot errors take priority
  if (statusBot === "bot_com_falha") return "erro_fluxo_bot";

  // 2. Non-auditable (blocked / impediment)
  if (
    statusAuditoria === "auditoria_bloqueada" ||
    statusAuditoria === "impedimento_detectado"
  ) {
    return "nao_auditavel";
  }

  // 3. Successfully audited
  if (
    statusAtendimento === "auditado" ||
    statusAuditoria === "auditoria_realizada"
  ) {
    return "auditado";
  }

  // 4. Fallback — treat as audited for legacy data
  return "auditado";
}

/**
 * Returns the display label for a given status code.
 */
export function getStatusLabel(status: AuditStatus): string {
  return AUDIT_STATUSES[status].label;
}

/**
 * Checks if an entry matches a given status filter.
 */
export function matchesStatusFilter(
  fullReport: Record<string, unknown> | null | undefined,
  filter: AuditStatus
): boolean {
  return resolveAuditStatus(fullReport) === filter;
}
