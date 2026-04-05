const OPA_PROXY_URL = "https://opa-node-proxy.onrender.com/opa";

export interface OpaAttendance {
  id: string;
  protocolo: string;
  cliente: string;
  atendente: string;
  status: string;
  data_inicio: string;
  data_fim: string;
  canal: string;
  setor: string;
}

export interface OpaListResponse {
  attendances: OpaAttendance[];
  total: number;
}

export interface OpaMessagesResponse {
  attendanceId: string;
  totalMessages: number;
  structuredText: string;
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
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export async function listOpaAttendances(params: OpaListParams = {}): Promise<OpaListResponse> {
  const body: Record<string, unknown> = { action: "list", limite: params.limite ?? 100 };
  if (params.status) body.status = params.status;
  if (params.dataInicio) body.dataInicio = params.dataInicio;
  if (params.dataFim) body.dataFim = params.dataFim;
  return opaFetch<OpaListResponse>(body);
}

export async function getOpaAttendanceMessages(attendanceId: string): Promise<OpaMessagesResponse> {
  return opaFetch<OpaMessagesResponse>({ action: "messages", attendanceId });
}
