const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPA_BASE_URL = Deno.env.get("OPA_SUITE_BASE_URL") || "";
const OPA_TOKEN = Deno.env.get("OPA_SUITE_TOKEN") || "";

interface OpaMessage {
  _id: string;
  id_rota?: string;
  mensagem?: string | Record<string, unknown> | null;
  data?: string;
  tipo?: string;
  tipoDestinatario?: string;
  id_user?: string | null;
  id_atend?: string | null;
  arquivo?: string | null;
  [key: string]: unknown;
}

function buildQueryString(body?: Record<string, unknown>): string {
  if (!body) return "";

  const params = new URLSearchParams();
  const filter = body.filter;
  const options = body.options;

  if (filter && typeof filter === "object" && !Array.isArray(filter)) {
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    }
  }

  if (options && typeof options === "object" && !Array.isArray(options)) {
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    }
  }

  return params.toString();
}

function isHtmlResponse(contentType: string | null, text: string): boolean {
  const trimmed = text.trimStart();
  return (
    contentType?.toLowerCase().includes("text/html") === true ||
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html")
  );
}

async function parseOpaResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type");
  const text = await res.text();

  if (isHtmlResponse(contentType, text)) {
    const error = new Error("OPA_HTML_RESPONSE");
    (error as Error & { status?: number; bodyPreview?: string }).status = res.status;
    (error as Error & { status?: number; bodyPreview?: string }).bodyPreview = text.slice(0, 300);
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    if (isHtmlResponse(contentType, text)) {
      const error = new Error("OPA_HTML_RESPONSE");
      (error as Error & { status?: number; bodyPreview?: string }).status = res.status;
      (error as Error & { status?: number; bodyPreview?: string }).bodyPreview = text.slice(0, 300);
      throw error;
    }

    const error = new Error(`Opa API ${res.status}: ${text.slice(0, 300)}`);
    (error as Error & { status?: number; bodyPreview?: string }).status = res.status;
    (error as Error & { status?: number; bodyPreview?: string }).bodyPreview = text.slice(0, 300);
    throw error;
  }
}

function extractText(mensagem: string | Record<string, unknown> | null | undefined): string {
  if (!mensagem) return "";
  if (typeof mensagem === "string") return mensagem.trim();
  const titulo = typeof mensagem.titulo === "string" ? mensagem.titulo.trim() : "";
  let opcoes = "";
  if (Array.isArray(mensagem.opcoes)) {
    const textos = mensagem.opcoes
      .map((o: Record<string, unknown>) => (typeof o.texto === "string" ? o.texto : ""))
      .filter(Boolean);
    if (textos.length) opcoes = `Opções: ${textos.join("; ")}`;
  }
  return [titulo, opcoes].filter(Boolean).join(" | ");
}

function classifyAuthor(msg: OpaMessage): string {
  if (msg.id_user) return "Cliente";
  if (msg.id_atend) return "Atendente";
  return "Sistema";
}

function transformMessages(messages: OpaMessage[]): string {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.data || "").getTime() - new Date(b.data || "").getTime()
  );
  return sorted
    .map((msg) => {
      const author = classifyAuthor(msg);
      const ts = msg.data
        ? new Date(msg.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
        : "??";
      const text = extractText(msg.mensagem);
      if (!text) return null;
      return `[${ts}] ${author}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

async function opaFetch(path: string, body?: Record<string, unknown>) {
  const url = new URL(path, OPA_BASE_URL);
  const headers = {
    Authorization: `Bearer ${OPA_TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const tryPost = async () => {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await parseOpaResponse(res);
    if (!res.ok) {
      throw new Error(`Opa API ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return data;
  };

  const tryGet = async () => {
    const queryString = buildQueryString(body);
    const fallbackUrl = queryString ? `${url.toString()}?${queryString}` : url.toString();
    const res = await fetch(fallbackUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${OPA_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const data = await parseOpaResponse(res);
    if (!res.ok) {
      throw new Error(`Opa API ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return data;
  };

  try {
    return await tryPost();
  } catch (postError) {
    const postDetails = postError as Error & { status?: number; bodyPreview?: string };
    if (postDetails.message !== "OPA_HTML_RESPONSE") {
      throw postError;
    }

    try {
      return await tryGet();
    } catch (getError) {
      const getDetails = getError as Error & { status?: number; bodyPreview?: string };
      const postStatus = postDetails.status ?? "unknown";
      const getStatus = getDetails.status ?? "unknown";
      const postBody = postDetails.bodyPreview ?? postDetails.message;
      const getBody = getDetails.bodyPreview ?? getDetails.message;

      throw new Error(
        `Opa API fallback failed. POST status ${postStatus}: ${postBody}. GET status ${getStatus}: ${getBody}`
      );
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPA_BASE_URL || !OPA_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Secrets OPA_SUITE_BASE_URL ou OPA_SUITE_TOKEN não configurados." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, ...params } = await req.json();

    if (action === "list") {
      const { status, dataInicio, dataFim, limite } = params as {
        status?: string;
        dataInicio?: string;
        dataFim?: string;
        limite?: number;
      };

      const filter: Record<string, unknown> = { status: status || "F" };
      if (dataInicio) filter.dataInicialAbertura = dataInicio;
      if (dataFim) filter.dataFinalAbertura = dataFim;

      const data = await opaFetch("/api/v1/atendimento", {
        filter,
        options: { limit: limite || 100 },
      });

      const attendances: Record<string, unknown>[] = Array.isArray(data?.data) ? data.data : [];

      const list = attendances.map((a) => ({
        id: a._id,
        protocolo: a.protocolo || a._id,
        cliente: a.id_cliente || null,
        atendente: a.id_atendente || null,
        status: a.status || null,
        data_inicio: a.date || null,
        data_fim: a.fim || null,
        canal: a.canal || null,
        setor: a.setor || null,
      }));

      return new Response(JSON.stringify({ attendances: list, total: list.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "messages") {
      const { attendanceId } = params as { attendanceId?: string };
      if (!attendanceId) {
        return new Response(
          JSON.stringify({ error: "attendanceId é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await opaFetch("/api/v1/atendimento/mensagem", {
        filter: { id_rota: attendanceId },
        options: { limit: 100 },
      });

      const rawMessages: OpaMessage[] = Array.isArray(data?.data) ? data.data : [];
      const structuredText = transformMessages(rawMessages);

      let attendantName: string | null = null;
      for (const msg of rawMessages) {
        if (msg.id_atend && !msg.id_user) {
          attendantName = String(msg.id_atend);
          break;
        }
      }

      return new Response(
        JSON.stringify({
          attendanceId,
          attendantName,
          totalMessages: rawMessages.length,
          structuredText,
          rawMessages,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Ação inválida: ${action}. Use "list" ou "messages".` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fetch-opa-attendance]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
