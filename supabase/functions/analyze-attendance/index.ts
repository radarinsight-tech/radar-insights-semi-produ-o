import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Radar Insight FALE 4.3, um sistema especialista em análise de qualidade de atendimentos.

Analise o texto do atendimento fornecido e retorne o resultado completo da avaliação.

Regras de avaliação:
- Nota de 0 a 10, com uma casa decimal
- Classificação baseada na nota: "Excelente" (9-10), "Ótimo" (8-8.9), "Bom" (7-7.9), "Regular" (abaixo de 7)
- Bônus: true se nota >= 9
- Identifique o protocolo, atendente, tipo de atendimento e se houve atualização cadastral a partir do texto
- Se algum campo não puder ser identificado, use "Não identificado"
- Liste de 2 a 5 pontos de melhoria concretos e acionáveis para o atendente

Critérios de avaliação (19 critérios):
1. Saudação inicial adequada
2. Identificação do atendente
3. Empatia e cordialidade
4. Escuta ativa
5. Compreensão do problema
6. Clareza na comunicação
7. Linguagem adequada (sem gírias/informalidades excessivas)
8. Procedimentos corretos seguidos
9. Conhecimento técnico demonstrado
10. Proatividade na resolução
11. Oferecimento de alternativas
12. Tempo de resposta entre mensagens
13. Atualização cadastral verificada
14. Confirmação de dados do cliente
15. Registro correto das informações
16. Resolução efetiva do problema
17. Encerramento adequado
18. Pesquisa de satisfação oferecida
19. Despedida cordial

Para cada critério, avalie se estava no escopo do atendimento, se foi atendido ou não, e forneça uma explicação breve.
Forneça também uma orientação final consolidada para o atendente.`;

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
              description: "Retorna o resultado completo da análise do atendimento incluindo todos os 19 critérios",
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
                  pontosMelhoria: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de 2 a 5 pontos de melhoria concretos e acionáveis",
                  },
                  criterios: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        numero: { type: "number", description: "Número do critério (1-19)" },
                        nome: { type: "string", description: "Nome do critério" },
                        noEscopo: { type: "boolean", description: "Se o critério estava no escopo do atendimento" },
                        atendido: { type: "boolean", description: "Se o critério foi atendido" },
                        explicacao: { type: "string", description: "Explicação breve sobre a avaliação deste critério" },
                      },
                      required: ["numero", "nome", "noEscopo", "atendido", "explicacao"],
                      additionalProperties: false,
                    },
                    description: "Avaliação detalhada dos 19 critérios",
                  },
                  orientacaoFinal: { type: "string", description: "Orientação final consolidada para o atendente com recomendações de melhoria" },
                },
                required: ["data", "protocolo", "tipo", "atendente", "atualizacaoCadastral", "nota", "classificacao", "bonus", "pontosMelhoria", "criterios", "orientacaoFinal"],
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
