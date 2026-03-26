export type OfficialApprovalOrigin = "manual" | "automatic";

type AuditLogRecord = Record<string, unknown>;

const isAuditLogRecord = (value: unknown): value is AuditLogRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeAttendantName = (name?: string | null) =>
  (name ?? "").trim().toLocaleLowerCase("pt-BR");

export const getOfficialApprovalOrigin = (auditLog: unknown): OfficialApprovalOrigin | undefined => {
  if (!isAuditLogRecord(auditLog)) return undefined;

  const rawOrigin = auditLog.approvalType ?? auditLog.origem ?? auditLog.approvalOrigin;

  if (rawOrigin === "automatic" || rawOrigin === "automatica") return "automatic";
  if (rawOrigin === "manual") return "manual";

  return undefined;
};

export const buildOfficialAuditLog = (
  origin: OfficialApprovalOrigin,
  currentAuditLog?: unknown,
) => {
  const now = new Date().toISOString();
  const base = isAuditLogRecord(currentAuditLog) ? currentAuditLog : {};

  return {
    ...base,
    approvalType: origin,
    approvalOrigin: origin,
    origem: origin === "automatic" ? "automatica" : "manual",
    approvedAsOfficial: true,
    aprovadoComoOficial: true,
    approvedAt: now,
  };
};

// ─── Structured audit trail ────────────────────────────────────────

export type AuditAction = "criado" | "atualizado" | "excluido" | "aprovado";

export interface AuditRecord {
  protocolo: string;
  atendente: string;
  acao: AuditAction;
  origem: "manual" | "automatica";
  data: string;
  usuario?: string;
}

export function logAudit(record: AuditRecord) {
  console.log("[Auditoria]", record);
}