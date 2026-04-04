const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPA_BASE_URL = Deno.env.get("OPA_SUITE_BASE_URL") || "";
const OPA_TOKEN = Deno.env.get("OPA_SUITE_TOKEN") || "";

interface OpaMessage {
  id: string;
  mensagem?: string;
  data?: string;
  tipo?: string;
  tipoDestinatario?: string;
  id_user?: string | null;
  id_atend?: { id?: string; nome?: string; tipo?: string } | string | null;
  arquivo?: string | null;
  [key: string]: unknown;
}

function classifyAuthor(msg: OpaMessage): string {
  if (msg.id_user) return "Cliente";

  const atend = msg.id_atend;
  if (atend && typeof atend === "object") {
    if (atend.tipo === "bot") return "Bot";
    return atend.nome || "Atendente";
  }
  if (atend && typeof atend === "string") return "Atendente";

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
      const text = (msg.mensagem || "").trim();
      if (!text) return null;
      return `[${ts}] ${author}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

async function opaFetch(path: string, params?: Record<string, string>) {
  const url = new URL(path, OPA_BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${OPA_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Opa API ${res.status}: ${body}`);
  }
  return res.json();
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

    // --- LIST: listar atendimentos finalizados ---
    if (action === "list") {
      const { status, dataInicio, dataFim, limite } = params as {
        status?: string;
        dataInicio?: string;
        dataFim?: string;
        limite?: number;
      };

      const query: Record<string, string> = {};
      if (status) query.status = status;
      else query.status = "F"; // F = finalizado
      if (dataInicio) query.dataInicio = dataInicio;
      if (dataFim) query.dataFim = dataFim;
      if (limite) query.limite = String(limite);

      const data = await opaFetch("/api/v1/atendimento", query);

      const attendances = Array.isArray(data) ? data : data?.atendimentos ?? data?.data ?? [];

      const list = attendances.map((a: Record<string, unknown>) => ({
        id: a.id,
        protocolo: a.protocolo || a.id,
        cliente: a.cliente || a.nome_cliente || null,
        atendente: typeof a.atendente === "object" && a.atendente
          ? (a.atendente as Record<string, unknown>).nome
          : a.atendente || null,
        status: a.status,
        data_inicio: a.data_inicio || a.dataInicio || null,
        data_fim: a.data_fim || a.dataFim || null,
        canal: a.canal || null,
        setor: a.setor || a.departamento || null,
      }));

      return new Response(JSON.stringify({ attendances: list, total: list.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- MESSAGES: buscar mensagens + transformer ---
    if (action === "messages") {
      const { attendanceId } = params as { attendanceId?: string };
      if (!attendanceId) {
        return new Response(
          JSON.stringify({ error: "attendanceId é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await opaFetch("/api/v1/atendimento/mensagem", { id_rota: attendanceId });

      const rawMessages: OpaMessage[] = Array.isArray(data)
        ? data
        : data?.mensagens ?? data?.data ?? [];

      const structuredText = transformMessages(rawMessages);

      // Extrair nome do atendente (primeiro humano encontrado)
      let attendantName: string | null = null;
      for (const msg of rawMessages) {
        const atend = msg.id_atend;
        if (atend && typeof atend === "object" && atend.tipo !== "bot" && atend.nome) {
          attendantName = atend.nome;
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
