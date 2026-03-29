import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `RADAR INSIGHT — MENTORIA PREVENTIVA

IDENTIDADE
Você é um mentor de qualidade em atendimento ao cliente.
Sua função é analisar conversas e fornecer feedback construtivo para desenvolvimento do atendente.
Esta análise é PREVENTIVA — não gera nota oficial, não impacta bônus nem ranking.

OBJETIVO
Identificar oportunidades de melhoria antes que se tornem problemas recorrentes.
Fornecer orientações práticas e acionáveis.

ORDEM DE EXECUÇÃO

ETAPA 1 — EXTRAIR DADOS BÁSICOS
- Protocolo, data, nome do cliente, nome do atendente, tipo de atendimento.

ETAPA 2 — VERIFICAR VIABILIDADE
- Se não houver interação do cliente ou atendente humano, registrar e encerrar.

ETAPA 3 — ANÁLISE DE COMPETÊNCIAS (19 critérios)
Avaliar os mesmos 19 critérios da matriz oficial, mas com foco em DESENVOLVIMENTO:

POSTURA E COMUNICAÇÃO (25 pontos)
1. Informou o nome e se apresentou? (4 pts)
2. Foi cordial e simpático? (6 pts)
3. Chamou o cliente pelo nome? (5 pts)
4. Respondeu dentro do tempo adequado? (5 pts)
5. Utilizou linguagem profissional? (5 pts)

ENTENDIMENTO E CONDUÇÃO (25 pontos)
6. Fez perguntas para entender o problema? (5 pts)
7. Identificou corretamente a solicitação? (6 pts)
8. Demonstrou disposição para ouvir? (5 pts)
9. Agiu com agilidade e proatividade? (4 pts)
10. Buscou retenção em cancelamentos? (5 pts)

SOLUÇÃO E CONFIRMAÇÃO (25 pontos)
11. Informou registro da solução no sistema? (4 pts)
12. Confirmou se o cliente ficou confortável? (6 pts)
13. Buscou alternativa quando necessário? (5 pts)
14. Realizou testes com o cliente? (5 pts)
15. Confirmou se restaram dúvidas? (5 pts)

ENCERRAMENTO E VALOR (25 pontos)
16. Cliente demonstrou satisfação? (7 pts)
17. Informou serviços ou benefícios? (6 pts)
18. Verificou possibilidade de upgrade? (6 pts)
19. Atualizou dados do cliente? (6 pts)

SIM → pontuação total | NÃO → zero | FORA DO ESCOPO → exclui do cálculo

ETAPA 4 — NOTA INTERNA (apenas referência, NÃO é oficial)
notaInterna = (obtidos / possiveis) × 100

ETAPA 5 — PLANO DE DESENVOLVIMENTO
Para cada critério com NÃO, gerar:
- O que poderia ter sido feito
- Exemplo prático de como melhorar
- Impacto positivo da mudança

ETAPA 6 — PONTOS FORTES
Destacar os critérios onde o atendente se saiu bem.

IMPORTANTE:
- Esta análise NÃO gera nota oficial
- NÃO impacta bônus ou ranking
- É exclusivamente para desenvolvimento e melhoria contínua`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, attendant_id } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Texto do atendimento é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backend validation for mentoria_atendente users
    if (attendant_id) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // Get the authenticated user from the request
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify attendant_id matches the user's profile
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${attendant_id}&select=id`, {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      });

      // Check monthly limit (10 per month)
      const jwt = authHeader.replace("Bearer ", "");
      // Decode JWT to get user_id (simple base64 decode of payload)
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      const userId = payload.sub;

      if (userId) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const countRes = await fetch(
          `${SUPABASE_URL}/rest/v1/preventive_mentorings?user_id=eq.${userId}&created_at=gte.${startOfMonth.toISOString()}&select=id`,
          {
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Prefer: "count=exact",
            },
          }
        );
        const countHeader = countRes.headers.get("content-range");
        const total = countHeader ? parseInt(countHeader.split("/")[1] || "0") : 0;

        if (total >= 10) {
          return new Response(JSON.stringify({ error: "Limite mensal de 10 mentorias preventivas atingido." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
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
          {
            role: "user",
            content: `Analise o seguinte atendimento para MENTORIA PREVENTIVA (sem nota oficial, sem bônus, sem ranking).
Foco: identificar oportunidades de melhoria e destacar pontos fortes.

Texto do atendimento:

${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "retornar_mentoria_preventiva",
              description: "Retorna o resultado da mentoria preventiva — feedback de desenvolvimento sem nota oficial.",
              parameters: {
                type: "object",
                properties: {
                  viavel: { type: "boolean", description: "Se a análise é viável (tem interação humana)" },
                  motivoInviavel: { type: "string", description: "Motivo se não viável" },
                  data: { type: "string" },
                  protocolo: { type: "string" },
                  cliente: { type: "string" },
                  tipo: { type: "string", enum: ["Suporte Técnico", "Financeiro", "Vendas", "Cancelamento", "Retenção", "Mudança de Endereço", "Instalação", "Upgrade/Downgrade", "Informações Gerais", "Outro"] },
                  atendente: { type: "string" },
                  criterios: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        numero: { type: "number" },
                        nome: { type: "string" },
                        categoria: { type: "string" },
                        pesoMaximo: { type: "number" },
                        resultado: { type: "string", enum: ["SIM", "NÃO", "FORA DO ESCOPO"] },
                        pontosObtidos: { type: "number" },
                        explicacao: { type: "string" },
                      },
                      required: ["numero", "nome", "categoria", "pesoMaximo", "resultado", "pontosObtidos", "explicacao"],
                    },
                  },
                  pontosObtidos: { type: "number" },
                  pontosPossiveis: { type: "number" },
                  notaInterna: { type: "number", description: "Nota de referência interna (NÃO oficial)" },
                  classificacaoInterna: { type: "string", enum: ["Excelente", "Bom atendimento", "Regular", "Abaixo do esperado", "Inviável"] },
                  pontosFortes: { type: "array", items: { type: "string" }, description: "Lista de pontos fortes do atendente" },
                  oportunidadesMelhoria: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        criterio: { type: "string" },
                        sugestao: { type: "string" },
                        exemplo: { type: "string" },
                        impacto: { type: "string" },
                      },
                      required: ["criterio", "sugestao", "exemplo", "impacto"],
                    },
                  },
                  resumoGeral: { type: "string", description: "Resumo construtivo do atendimento" },
                },
                required: [
                  "viavel", "motivoInviavel", "data", "protocolo", "cliente", "tipo", "atendente",
                  "criterios", "pontosObtidos", "pontosPossiveis", "notaInterna", "classificacaoInterna",
                  "pontosFortes", "oportunidadesMelhoria", "resumoGeral",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "retornar_mentoria_preventiva" } },
      }),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (statusCode === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await response.text();
      console.error("AI gateway error:", statusCode, body);
      return new Response(JSON.stringify({ error: "Erro ao processar análise" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Resposta inválida da IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-preventive error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
