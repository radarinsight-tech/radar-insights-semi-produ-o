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

export async function listOpaAttendances(limite = 100): Promise<OpaListResponse> {
  return opaFetch<OpaListResponse>({ action: "list", limite });
}

export async function getOpaAttendanceMessages(attendanceId: string): Promise<OpaMessagesResponse> {
  return opaFetch<OpaMessagesResponse>({ action: "messages", attendanceId });
}
