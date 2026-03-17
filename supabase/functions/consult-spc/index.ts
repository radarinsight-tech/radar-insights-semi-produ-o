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

// ── Normaliser: converts any raw SPC response into our internal model ──
function normalizarRespostaSPC(raw: Record<string, unknown>, cpf: string, nome: string): RadarInsightSpcResult {
  // When the real SPC 643 integration arrives, map raw fields here.
  // For now this is a pass-through for simulated data.
  const digits = String(raw.cpf ?? cpf).replace(/\D/g, "");
  const isCnpj = digits.length === 14;
  const formatted = isCnpj
    ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
    : `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;

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
    nome: String(raw.nome ?? nome || "Nome não informado"),
    cpf: digits,
    cpfFormatado: formatted,
    tipo: isCnpj ? "CNPJ" : "CPF",
    situacaoCpf: String(raw.situacaoCpf ?? (registroSpc === 0 && pendenciasSerasa === 0 ? "Regular" : "Com restrições")),
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

// ── Simulated data generator ──
function gerarDadosSimulados(digits: string, nome: string): Record<string, unknown> {
  const seed = digits.split("").reduce((a, b) => a + Number(b), 0);

  // Known demo CPFs
  if (digits === "12345678900") {
    return {
      cpf: digits, nome: nome || "Nome não informado",
      situacaoCpf: "Regular", registroSpc: 0, pendenciasSerasa: 0, protestos: 0,
      chequesSemFundo: 0, valorTotalPendencias: 0, consultas30dias: 1, consultas90dias: 3,
      protocoloConsulta: `SIM-${Date.now()}`,
      dataHoraConsulta: new Date().toLocaleString("pt-BR"),
    };
  }
  if (digits === "98765432100") {
    return {
      cpf: digits, nome: nome || "Nome não informado",
      situacaoCpf: "Com restrições", registroSpc: 4, pendenciasSerasa: 2, protestos: 1,
      chequesSemFundo: 1, valorTotalPendencias: 4500, consultas30dias: 5, consultas90dias: 12,
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
    cpf: digits, nome: nome || "Nome não informado",
    situacaoCpf: registroSpc === 0 && pendenciasSerasa === 0 ? "Regular" : "Com restrições",
    registroSpc, pendenciasSerasa, protestos, chequesSemFundo,
    valorTotalPendencias,
    consultas30dias: seed % 6,
    consultas90dias: seed % 15,
    protocoloConsulta: `SIM-${Date.now()}`,
    dataHoraConsulta: new Date().toLocaleString("pt-BR"),
  };
}

// ── Real SPC 643 placeholder ──
async function consultarSPCReal(
  cpf: string,
  _operator: string,
  _password: string,
  _endpoint: string,
): Promise<Record<string, unknown>> {
  // TODO: Implement real SPC 643 API call when technical documentation is available.
  // Expected flow:
  // 1. Build SOAP/REST request per SPC 643 spec
  // 2. POST to _endpoint with operator/password auth
  // 3. Parse response XML/JSON
  // 4. Return raw fields for normalizarRespostaSPC()
  console.warn("[SPC] consultarSPCReal called — integration not yet implemented for:", cpf);
  throw new Error("SPC_INTEGRATION_NOT_AVAILABLE");
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse body
    const body = await req.json();
    const { cpfCnpj, nome, mode } = body as { cpfCnpj: string; nome?: string; mode?: string };

    const digits = (cpfCnpj ?? "").replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      return new Response(
        JSON.stringify({ error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine mode: env var overrides, then request param
    const spcMode = Deno.env.get("SPC_MODE") || mode || "simulation";
    const clientName = nome?.trim() || "Nome não informado";

    let rawResponse: Record<string, unknown>;
    let finalMode: "simulacao" | "producao";

    if (spcMode === "production") {
      // Validate required secrets
      const operator = Deno.env.get("SPC_OPERATOR");
      const password = Deno.env.get("SPC_PASSWORD");
      const endpoint = Deno.env.get("SPC_ENDPOINT");

      if (!operator || !password || !endpoint) {
        return new Response(
          JSON.stringify({
            error: "Integração SPC não configurada. Credenciais ausentes (SPC_OPERATOR, SPC_PASSWORD ou SPC_ENDPOINT).",
            code: "SPC_CREDENTIALS_MISSING",
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      try {
        rawResponse = await consultarSPCReal(digits, operator, password, endpoint);
        finalMode = "producao";
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        if (message === "SPC_INTEGRATION_NOT_AVAILABLE") {
          return new Response(
            JSON.stringify({
              error: "Integração SPC real ainda não disponível. A documentação técnica da opção 643 ainda não foi implementada.",
              code: "SPC_INTEGRATION_NOT_AVAILABLE",
            }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ error: `Erro na consulta SPC: ${message}`, code: "SPC_REQUEST_ERROR" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // Simulation mode
      rawResponse = gerarDadosSimulados(digits, clientName);
      finalMode = "simulacao";
    }

    // Normalise into Radar Insight internal model
    const result = normalizarRespostaSPC(rawResponse, digits, clientName);
    result.modoConsulta = finalMode;

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[consult-spc] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno no servidor.", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
