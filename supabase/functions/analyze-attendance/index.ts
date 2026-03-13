import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Radar Insight FALE 4.3, um sistema especialista em análise de qualidade de atendimentos.

Analise o texto do atendimento fornecido e retorne EXATAMENTE os campos abaixo em formato estruturado.

Regras de avaliação:
- Nota de 0 a 10, com uma casa decimal
- Classificação baseada na nota: "Excelente" (9-10), "Ótimo" (8-8.9), "Bom" (7-7.9), "Regular" (abaixo de 7)
- Bônus: true se nota >= 9
- Identifique o protocolo, atendente, tipo de atendimento e se houve atualização cadastral a partir do texto
- Se algum campo não puder ser identificado, use "Não identificado"

Critérios de avaliação:
1. Saudação e identificação adequada
2. Empatia e cordialidade
3. Resolução do problema
4. Procedimentos corretos
5. Encerramento adequado
6. Tempo de resposta
7. Clareza na comunicação
8. Registro correto das informações`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Texto do atendimento é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analise o seguinte atendimento:\n\n${text}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "retornar_analise",
              description: "Retorna o resultado estruturado da análise do atendimento",
              parameters: {
                type: "object",
                properties: {
                  data: { type: "string", description: "Data do atendimento no formato DD/MM/AAAA" },
                  protocolo: { type: "string", description: "Número do protocolo do atendimento" },
                  tipo: { type: "string", description: "Tipo de atendimento (ex: Suporte Técnico, Financeiro, Cancelamento, Informação, Reclamação)" },
                  atendente: { type: "string", description: "Nome do atendente" },
                  atualizacaoCadastral: { type: "string", description: "Se houve atualização cadastral: Sim ou Não" },
                  nota: { type: "number", description: "Nota de 0 a 10 com uma casa decimal" },
                  classificacao: { type: "string", enum: ["Excelente", "Ótimo", "Bom", "Regular"], description: "Classificação baseada na nota" },
                  bonus: { type: "boolean", description: "true se nota >= 9" },
                },
                required: ["data", "protocolo", "tipo", "atendente", "atualizacaoCadastral", "nota", "classificacao", "bonus"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "retornar_analise" } },
      }),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (statusCode === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await response.text();
      console.error("AI gateway error:", statusCode, body);
      return new Response(JSON.stringify({ error: "Erro ao processar análise" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Resposta inválida da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-attendance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
