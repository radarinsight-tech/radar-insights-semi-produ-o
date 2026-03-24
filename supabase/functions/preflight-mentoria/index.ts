import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckResult {
  key: string;
  label: string;
  category: "configuracao" | "infraestrutura" | "credito" | "autenticacao" | "limite";
  layer: "app" | "edge_function" | "supabase" | "provedor_ia" | "workspace";
  status: "ok" | "erro" | "aviso";
  message?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({
        ready: false,
        checks: [{
          key: "auth",
          label: "Autenticação",
          category: "autenticacao",
          layer: "app",
          status: "erro",
          message: "Token de autenticação não fornecido. Faça login novamente.",
        }],
      });
    }

    const checks: CheckResult[] = [];

    // 1. Check Supabase connectivity
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      checks.push({
        key: "supabase_config",
        label: "Configuração do backend",
        category: "configuracao",
        layer: "supabase",
        status: "erro",
        message: "Variáveis de ambiente do backend não configuradas.",
      });
    } else {
      // Quick connectivity test using health endpoint
      try {
        const testResp = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
        });
        // Any 2xx/3xx/404/406 means Supabase is reachable and responding
        if (testResp.ok || testResp.status === 404 || testResp.status === 406 || testResp.status === 200) {
          checks.push({
            key: "supabase_conn",
            label: "Conexão com backend",
            category: "infraestrutura",
            layer: "supabase",
            status: "ok",
          });
        } else {
          checks.push({
            key: "supabase_conn",
            label: "Conexão com backend",
            category: "infraestrutura",
            layer: "supabase",
            status: "erro",
            message: `Backend retornou status ${testResp.status}. Tente novamente em alguns instantes.`,
          });
        }
      } catch (e) {
        checks.push({
          key: "supabase_conn",
          label: "Conexão com backend",
          category: "infraestrutura",
          layer: "supabase",
          status: "erro",
          message: "Não foi possível conectar ao backend. Verifique sua conexão.",
        });
      }
    }

    // 2. Check LOVABLE_API_KEY (AI provider)
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      checks.push({
        key: "ai_key",
        label: "Chave do provedor de IA",
        category: "configuracao",
        layer: "provedor_ia",
        status: "erro",
        message: "Chave de acesso ao provedor de IA não configurada. Contate o administrador.",
      });
    } else {
      // 3. Test AI provider with a minimal request
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
        });

        if (aiResp.status === 402) {
          checks.push({
            key: "ai_credits",
            label: "Créditos de processamento",
            category: "credito",
            layer: "provedor_ia",
            status: "erro",
            message: "Créditos insuficientes para executar análises. Adicione créditos em Configurações > Workspace > Uso.",
          });
        } else if (aiResp.status === 429) {
          checks.push({
            key: "ai_rate",
            label: "Limite de requisições",
            category: "limite",
            layer: "provedor_ia",
            status: "aviso",
            message: "Limite temporário de requisições atingido. Aguarde alguns minutos antes de iniciar.",
          });
        } else if (!aiResp.ok) {
          const body = await aiResp.text().catch(() => "");
          console.error("[Preflight][AI][erro]", { status: aiResp.status, body });
          checks.push({
            key: "ai_provider",
            label: "Provedor de IA",
            category: "infraestrutura",
            layer: "provedor_ia",
            status: "erro",
            message: `Provedor de IA retornou erro (${aiResp.status}). Tente novamente em instantes.`,
          });
        } else {
          // Consume body
          await aiResp.text().catch(() => {});
          checks.push({
            key: "ai_provider",
            label: "Provedor de IA",
            category: "infraestrutura",
            layer: "provedor_ia",
            status: "ok",
          });
          checks.push({
            key: "ai_credits",
            label: "Créditos de processamento",
            category: "credito",
            layer: "provedor_ia",
            status: "ok",
          });
        }
      } catch (e) {
        console.error("[Preflight][AI][exception]", e);
        checks.push({
          key: "ai_provider",
          label: "Provedor de IA",
          category: "infraestrutura",
          layer: "provedor_ia",
          status: "erro",
          message: "Não foi possível conectar ao provedor de IA.",
        });
      }
    }

    // 4. Check analyze-attendance function availability
    if (supabaseUrl) {
      try {
        // OPTIONS request to check function exists
        const fnResp = await fetch(`${supabaseUrl}/functions/v1/analyze-attendance`, {
          method: "OPTIONS",
          headers: { Authorization: authHeader },
        });
        // Any response (including CORS preflight 204) means function is deployed
        checks.push({
          key: "edge_fn",
          label: "Função de análise",
          category: "infraestrutura",
          layer: "edge_function",
          status: "ok",
        });
      } catch {
        checks.push({
          key: "edge_fn",
          label: "Função de análise",
          category: "infraestrutura",
          layer: "edge_function",
          status: "erro",
          message: "Função de análise indisponível. Pode estar em deploy ou com erro.",
        });
      }
    }

    // 5. Check request body for batch-specific limits
    let batchSize = 0;
    try {
      const body = await req.json().catch(() => ({}));
      batchSize = typeof body?.batchSize === "number" ? body.batchSize : 0;
    } catch { /* no body is fine */ }

    if (batchSize > 50) {
      checks.push({
        key: "batch_limit",
        label: "Limite do lote",
        category: "limite",
        layer: "app",
        status: "aviso",
        message: `Lote com ${batchSize} atendimentos. Recomendamos até 50 por vez para melhor desempenho.`,
      });
    }

    // Auth check passed (we got here)
    checks.push({
      key: "auth",
      label: "Autenticação",
      category: "autenticacao",
      layer: "app",
      status: "ok",
    });

    const hasError = checks.some((c) => c.status === "erro");
    const hasWarning = checks.some((c) => c.status === "aviso");

    console.info("[Preflight][Resultado]", {
      ready: !hasError,
      total_checks: checks.length,
      errors: checks.filter((c) => c.status === "erro").length,
      warnings: checks.filter((c) => c.status === "aviso").length,
    });

    return json({
      ready: !hasError,
      hasWarnings: hasWarning,
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[Preflight][Erro]", message);
    return json({
      ready: false,
      checks: [{
        key: "system",
        label: "Sistema",
        category: "infraestrutura",
        layer: "edge_function",
        status: "erro",
        message: "Erro interno na pré-checagem. Tente novamente.",
      }],
    }, 500);
  }
});
