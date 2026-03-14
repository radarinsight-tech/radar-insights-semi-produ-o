import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Radar Insight — Análise de Crédito, um sistema especialista em análise de risco de crédito para pessoas físicas com base em consultas SPC/Serasa.

Você receberá o texto extraído de uma consulta de CPF (PDF ou imagem digitalizada). Analise todas as informações disponíveis e retorne um parecer técnico completo.

Regras de análise:

1. Identifique o nome completo, CPF e idade/data de nascimento do consultado.

2. Conte a quantidade total de registros negativos (dívidas, protestos, cheques devolvidos, etc.).

3. Liste todos os credores identificados no documento.

4. Classifique os credores por tipo:
   - Financeiro (bancos, financeiras, cartões)
   - Comércio (lojas, varejo)
   - Serviços (telecomunicações, energia, água)
   - Outros

5. Aplique a seguinte regra de decisão:
   - Se não há registros negativos: APROVADO
   - Se há apenas 1 registro negativo de valor baixo (até R$ 500): APROVADO COM RESSALVA
   - Se há 2 ou mais registros negativos OU valor total acima de R$ 1.000: REPROVADO
   - Se há protestos ou cheques devolvidos: REPROVADO
   - Adapte conforme o contexto do documento

6. Forneça uma orientação operacional clara sobre como proceder.

7. Adicione observações relevantes sobre o perfil de crédito.

8. Gere um resultado rápido em uma frase curta e direta.

Se alguma informação não puder ser identificada no documento, use "Não identificado".`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Texto da consulta é obrigatório" }), {
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
          { role: "user", content: `Analise a seguinte consulta de CPF:\n\n${text}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "retornar_analise_credito",
              description: "Retorna o resultado completo da análise de crédito do CPF consultado",
              parameters: {
                type: "object",
                properties: {
                  nome: { type: "string", description: "Nome completo do consultado" },
                  cpf: { type: "string", description: "CPF do consultado" },
                  idade: { type: "string", description: "Idade ou data de nascimento" },
                  quantidadeRegistrosNegativos: { type: "number", description: "Quantidade total de registros negativos" },
                  valorTotalDividas: { type: "string", description: "Valor total das dívidas encontradas" },
                  credores: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string", description: "Nome do credor" },
                        tipo: { type: "string", enum: ["Financeiro", "Comércio", "Serviços", "Outros"], description: "Classificação do credor" },
                        valor: { type: "string", description: "Valor da dívida com este credor" },
                      },
                      required: ["nome", "tipo", "valor"],
                      additionalProperties: false,
                    },
                    description: "Lista de credores identificados",
                  },
                  regraAplicada: { type: "string", description: "Regra de decisão aplicada com explicação" },
                  decisaoFinal: { type: "string", enum: ["APROVADO", "APROVADO COM RESSALVA", "REPROVADO"], description: "Decisão final da análise" },
                  orientacaoOperacional: { type: "string", description: "Orientação operacional sobre como proceder" },
                  observacoes: { type: "string", description: "Observações relevantes sobre o perfil de crédito" },
                  resultadoRapido: { type: "string", description: "Resultado rápido em uma frase curta e direta" },
                },
                required: ["nome", "cpf", "idade", "quantidadeRegistrosNegativos", "valorTotalDividas", "credores", "regraAplicada", "decisaoFinal", "orientacaoOperacional", "observacoes", "resultadoRapido"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "retornar_analise_credito" } },
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
      return new Response(JSON.stringify({ error: "Erro ao processar análise de crédito" }), {
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
    console.error("analyze-credit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
