import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ACTIONS = [
  "sincronizar_opa",
  "confirmar_avaliacao",
  "corrigir_seguranca",
  "limpar_dados_teste",
  "reprocessar_lote",
] as const;

type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, erro: "nao_autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ ok: false, erro: "nao_autorizado" }, 401);
    }

    // Admin-only
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return json({ ok: false, erro: "apenas_administradores" }, 403);
    }

    // Parse & validate body
    if (req.method !== "POST") {
      return json({ ok: false, erro: "metodo_nao_permitido" }, 405);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ ok: false, erro: "corpo_invalido" }, 400);
    }

    const { acao, company_id, params } = body as {
      acao?: string;
      company_id?: string;
      params?: Record<string, unknown>;
    };

    // Validate acao
    if (!acao || !ALLOWED_ACTIONS.includes(acao as AllowedAction)) {
      return json({ ok: false, erro: "acao_nao_permitida" }, 400);
    }

    // Validate company_id
    if (!company_id || typeof company_id !== "string") {
      return json({ ok: false, erro: "company_id_obrigatorio" }, 400);
    }

    const { data: company } = await adminClient
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .maybeSingle();

    if (!company) {
      return json({ ok: false, erro: "empresa_nao_encontrada" }, 404);
    }

    // Action accepted
    return json({
      ok: true,
      mensagem: "acao_recebida_com_sucesso",
      acao,
      company_id,
      executed_by: user.id,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("ops-execute error:", e);
    return json({ ok: false, erro: "erro_interno" }, 500);
  }
});
