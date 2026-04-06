const OPA_PROXY_URL = "https://opa-node-proxy.onrender.com/opa";

export interface OpaAttendance {
  id: string;
  protocolo: string;
  cliente: string;
  atendente: string;
  atendente_raw?: string;
  atendente_is_technical_id?: boolean;
  id_atendente?: string;
  status: string;
  data_inicio: string;
  data_fim: string;
  canal: string;
  setor: string;
}

export interface OpaListResponse {
  attendances: OpaAttendance[];
  total: number;
  offset?: number;
  hasMore?: boolean;
  attendantsLookup?: Record<string, string>;
}

export interface OpaMessagesResponse {
  attendanceId: string;
  totalMessages: number;
  structuredText: string;
  rawText?: string;
  structuredConversation?: Array<{
    timestamp?: string;
    author: string;
    text: string;
  }>;
  rawMessages: unknown[];
}

async function opaFetch<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(OPA_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro no proxy Opa (${res.status}): ${text.slice(0, 300)}`);
  }

  return res.json();
}

export interface OpaListParams {
  limite?: number;
  offset?: number;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export async function listOpaAttendances(params: OpaListParams = {}): Promise<OpaListResponse> {
  const body: Record<string, unknown> = { action: "list", limite: params.limite ?? 100 };
  if (typeof params.offset === "number" && params.offset > 0) body.offset = params.offset;
  if (params.status) body.status = params.status;
  if (params.dataInicio) body.dataInicio = params.dataInicio;
  if (params.dataFim) body.dataFim = params.dataFim;

  const raw = await opaFetch<any>(body);

  // Map response ensuring new fields are carried through
  const attendances: OpaAttendance[] = (raw.attendances || []).map((a: any) => ({
    id: a.id,
    protocolo: a.protocolo ?? a.id,
    cliente: a.cliente ?? null,
    atendente: a.atendente ?? "",
    atendente_raw: a.atendente_raw ?? a.id_atendente ?? "",
    atendente_is_technical_id: a.atendente_is_technical_id ?? false,
    id_atendente: a.id_atendente ?? "",
    status: a.status ?? null,
    data_inicio: a.data_inicio ?? null,
    data_fim: a.data_fim ?? null,
    canal: a.canal ?? null,
    setor: a.setor ?? null,
  }));

  return {
    attendances,
    total: raw.total ?? attendances.length,
    offset: raw.offset ?? 0,
    hasMore: raw.hasMore ?? false,
    attendantsLookup: raw.attendantsLookup ?? undefined,
  };
}

export async function getOpaAttendanceMessages(attendanceId: string): Promise<OpaMessagesResponse> {
  const raw = await opaFetch<any>({ action: "messages", attendanceId });

  return {
    attendanceId: raw.attendanceId ?? attendanceId,
    totalMessages: raw.totalMessages ?? 0,
    structuredText: raw.structuredText ?? "",
    rawText: raw.rawText ?? raw.structuredText ?? "",
    structuredConversation: raw.structuredConversation ?? undefined,
    rawMessages: raw.rawMessages ?? [],
  };
}
