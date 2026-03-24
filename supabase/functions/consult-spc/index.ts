import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Radar Insight internal model ──
interface RadarInsightSpcResult {
  nome: string;
  cpf: string;
  cpfFormatado: string;
  tipo: "CPF" | "CNPJ";
  situacaoCpf: string;
  registroSpc: number;
  pendenciasSerasa: number;
  protestos: number;
  chequesSemFundo: number;
  totalOcorrencias: number;
  valorTotalPendencias: number;
  consultas30dias: number;
  consultas90dias: number;
  protocoloConsulta: string;
  dataHoraConsulta: string;
  classificacaoRisco: "Baixo risco" | "Médio risco" | "Alto risco";
  modoConsulta: "simulacao" | "producao";
}

function formatCpfCnpj(digits: string): string {
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskOperator(op: string): string {
  if (op.length <= 4) return "****";
  return op.slice(0, 2) + "***" + op.slice(-2);
}

// ── Normaliser ──
function normalizarRespostaSPC(raw: Record<string, unknown>, cpf: string, nome: string): RadarInsightSpcResult {
  const digits = String(raw.cpf ?? cpf).replace(/\D/g, "");
  const isCnpj = digits.length === 14;

  const registroSpc = Number(raw.registroSpc ?? 0);
  const pendenciasSerasa = Number(raw.pendenciasSerasa ?? 0);
  const protestos = Number(raw.protestos ?? 0);
  const chequesSemFundo = Number(raw.chequesSemFundo ?? 0);
  const totalOcorrencias = registroSpc + pendenciasSerasa + protestos + chequesSemFundo;
  const valorTotalPendencias = Number(raw.valorTotalPendencias ?? 0);

  let classificacaoRisco: RadarInsightSpcResult["classificacaoRisco"] = "Médio risco";
  if (registroSpc === 0 && pendenciasSerasa === 0 && protestos === 0) classificacaoRisco = "Baixo risco";
  else if (registroSpc > 3 || valorTotalPendencias > 3000) classificacaoRisco = "Alto risco";

  return {
    nome: String(raw.nome ?? (nome || "Nome não informado")),
    cpf: digits,
    cpfFormatado: formatCpfCnpj(digits),
    tipo: isCnpj ? "CNPJ" : "CPF",
    situacaoCpf: String(
      raw.situacaoCpf ?? (registroSpc === 0 && pendenciasSerasa === 0 ? "Regular" : "Com restrições"),
    ),
    registroSpc,
    pendenciasSerasa,
    protestos,
    chequesSemFundo,
    totalOcorrencias,
    valorTotalPendencias,
    consultas30dias: Number(raw.consultas30dias ?? 0),
    consultas90dias: Number(raw.consultas90dias ?? 0),
    protocoloConsulta: String(raw.protocoloConsulta ?? `SIM-${Date.now()}`),
    dataHoraConsulta: String(raw.dataHoraConsulta ?? new Date().toLocaleString("pt-BR")),
    classificacaoRisco,
    modoConsulta: "simulacao",
  };
}

// ── Simulated data ──
function gerarDadosSimulados(digits: string, nome: string): Record<string, unknown> {
  const seed = digits.split("").reduce((a, b) => a + Number(b), 0);

  if (digits === "12345678900") {
    return {
      cpf: digits,
      nome: nome || "Nome não informado",
      situacaoCpf: "Regular",
      registroSpc: 0,
      pendenciasSerasa: 0,
      protestos: 0,
      chequesSemFundo: 0,
      valorTotalPendencias: 0,
      consultas30dias: 1,
      consultas90dias: 3,
      protocoloConsulta: `SIM-${Date.now()}`,
      dataHoraConsulta: new Date().toLocaleString("pt-BR"),
    };
  }
  if (digits === "98765432100") {
    return {
      cpf: digits,
      nome: nome || "Nome não informado",
      situacaoCpf: "Com restrições",
      registroSpc: 4,
      pendenciasSerasa: 2,
      protestos: 1,
      chequesSemFundo: 1,
      valorTotalPendencias: 4500,
      consultas30dias: 5,
      consultas90dias: 12,
      protocoloConsulta: `SIM-${Date.now()}`,
      dataHoraConsulta: new Date().toLocaleString("pt-BR"),
    };
  }

  const registroSpc = seed % 7;
  const pendenciasSerasa = seed % 4;
  const protestos = seed % 3;
  const chequesSemFundo = seed % 2;
  const valorTotalPendencias = registroSpc === 0 && pendenciasSerasa === 0 ? 0 : ((seed * 127) % 8000) + 50;

  return {
    cpf: digits,
    nome: nome || "Nome não informado",
    situacaoCpf: registroSpc === 0 && pendenciasSerasa === 0 ? "Regular" : "Com restrições",
    registroSpc,
    pendenciasSerasa,
    protestos,
    chequesSemFundo,
    valorTotalPendencias,
    consultas30dias: seed % 6,
    consultas90dias: seed % 15,
    protocoloConsulta: `SIM-${Date.now()}`,
    dataHoraConsulta: new Date().toLocaleString("pt-BR"),
  };
}

// ── Real SPC 643 call ──
async function consultarSPCReal(
  cpf: string,
  _nome: string,
  operator: string,
  password: string,
  endpoint: string,
): Promise<{
  success: boolean;
  status: number;
  data: Record<string, unknown> | null;
  raw_response: string;
  elapsed_ms: number;
}> {
  const digits = cpf.replace(/\D/g, "");
  const tipoConsumidor = digits.length === 14 ? "J" : "F";

  const payload = {
    codigoProduto: "643",
    tipoConsumidor,
    documentoConsumidor: digits,
  };
  console.log("PAYLOAD FINAL:", JSON.stringify(payload));
  console.log("TIPO CONSUMIDOR:", tipoConsumidor);
  console.log("DOCUMENTO FINAL:", digits);

  const ts = new Date().toISOString();

  // Generate Base64 using TextEncoder (equivalent to Node Buffer.from, no btoa/unescape)
  const encoder = new TextEncoder();
  const credentialBytes = encoder.encode(`${operator}:${password}`);
  const authToken = btoa(String.fromCharCode(...credentialBytes));

  const maskedPassword = password.length > 2 ? password.slice(0, 1) + "***" + password.slice(-1) : "***";

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
    Accept: "application/json",
    Authorization: `Basic ${authToken}`,
  };

  // Temporary diagnostic: log the final Authorization value for comparison with Postman
  console.log(`[SPC] ══ AUTH DIAGNOSTIC ══`);
  console.log(`[SPC] Authorization header value: Basic ${authToken}`);
  console.log(`[SPC] Credential length (bytes): ${credentialBytes.length}`);

  // ── Diagnostic log: REQUEST ──
  console.log(`[SPC] ════════════ REQUEST ════════════`);
  console.log(`[SPC] Timestamp: ${ts}`);
  console.log(`[SPC] Method: POST`);
  console.log(`[SPC] Endpoint: ${endpoint}`);
  console.log(`[SPC] Auth type: Basic (operator:password base64)`);
  console.log(`[SPC] Operator: ${maskOperator(operator)}`);
  console.log(`[SPC] Password: ${maskedPassword}`);
  console.log(`[SPC] Document: ${digits.slice(0, 3)}***${digits.slice(-2)}`);
  console.log(`[SPC] Headers: ${JSON.stringify({ ...headers, Authorization: "Basic <masked>" })}`);
  console.log(`[SPC] Body: ${JSON.stringify(payload)}`);

  const start = performance.now();

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const elapsed_ms = Math.round(performance.now() - start);
  const rawText = await response.text();

  // ── Diagnostic log: RESPONSE ──
  const errorCategory =
    response.status === 401
      ? "AUTH_ERROR"
      : response.status === 403
        ? "FORBIDDEN/WAF"
        : response.status >= 400 && response.status < 500
          ? "CLIENT_ERROR"
          : response.status >= 500
            ? "SERVER_ERROR"
            : "SUCCESS";

  console.log(`[SPC] ════════════ RESPONSE ════════════`);
  console.log(`[SPC] Status: ${response.status} (${errorCategory})`);
  console.log(`[SPC] Elapsed: ${elapsed_ms}ms`);
  console.log(`[SPC] Body (first 800 chars): ${rawText.slice(0, 800)}`);
  console.log(`[SPC] ════════════ END ════════════`);

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Response is not JSON – keep raw text
  }

  return {
    success: response.ok,
    status: response.status,
    data: parsed,
    raw_response: rawText,
    elapsed_ms,
  };
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { cpfCnpj, nome, mode } = body as { cpfCnpj: string; nome?: string; mode?: string };

    const digits = (cpfCnpj ?? "").replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      return new Response(JSON.stringify({ error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spcMode = Deno.env.get("SPC_MODE") || mode || "simulation";
    const clientName = nome?.trim() || "Nome não informado";

    // ── SIMULATION MODE ──
    if (spcMode !== "production") {
      const rawResponse = gerarDadosSimulados(digits, clientName);
      const result = normalizarRespostaSPC(rawResponse, digits, clientName);
      result.modoConsulta = "simulacao";
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PRODUCTION MODE ──
    const operator = Deno.env.get("SPC_OPERATOR");
    const password = Deno.env.get("SPC_PASSWORD");
    const endpoint = Deno.env.get("SPC_ENDPOINT");

    if (!operator || !password || !endpoint) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SPC_CREDENTIALS_MISSING",
          message: "Credenciais SPC não configuradas (SPC_OPERATOR, SPC_PASSWORD ou SPC_ENDPOINT).",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate that SPC_ENDPOINT is a proper URL
    if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      console.error(`[SPC] SPC_ENDPOINT inválido: "${endpoint}" — deve começar com https://`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "SPC_ENDPOINT_INVALID",
          message: `SPC_ENDPOINT não é uma URL válida. Valor atual não começa com http(s)://. Corrija a variável de ambiente SPC_ENDPOINT com a URL completa da API do SPC (ex: https://api.spcbrasil.org.br/...).`,
          current_value_hint: endpoint.slice(0, 6) + "***",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Execute real call
    const spcResult = await consultarSPCReal(digits, clientName, operator, password, endpoint);

    // If API returned an error (403, 401, 500, etc), return raw details
    if (!spcResult.success) {
      const errorCategory =
        spcResult.status === 401
          ? "AUTH_ERROR"
          : spcResult.status === 403
            ? "FORBIDDEN_WAF"
            : spcResult.status >= 400 && spcResult.status < 500
              ? "CLIENT_ERROR"
              : "SERVER_ERROR";

      return new Response(
        JSON.stringify({
          success: false,
          status: spcResult.status,
          error: `SPC_API_ERROR_${spcResult.status}`,
          error_category: errorCategory,
          message: `API SPC retornou status ${spcResult.status}`,
          diagnostico: {
            endpoint_usado: endpoint,
            metodo: "POST",
            autenticacao: "Basic (operator:password)",
            operador: maskOperator(operator),
            payload_enviado: {
              codigoProduto: "643",
              tipoConsumidor: digits.length === 14 ? "J" : "F",
              documentoConsumidor: `${digits.slice(0, 3)}***${digits.slice(-2)}`,
            },
          },
          raw_response: spcResult.data ?? spcResult.raw_response,
          elapsed_ms: spcResult.elapsed_ms,
          timestamp: new Date().toISOString(),
        }),
        { status: spcResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Success – normalize into internal model
    const result = normalizarRespostaSPC(spcResult.data ?? {}, digits, clientName);
    result.modoConsulta = "producao";

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[consult-spc] Unhandled error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({
        success: false,
        error: "INTERNAL_ERROR",
        message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
