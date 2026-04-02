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

--------------------------------------------------
REGRA DE ESTABILIDADE DO MODELO
Você deve seguir exclusivamente a matriz e as regras deste prompt.
Não pode: criar novos critérios, remover critérios existentes, alterar pesos,
reinterpretar pontuações, inventar evidências, misturar mensagens da URA com
mensagens do atendente humano, avaliar histórico de outro atendente.
Sempre utilizar apenas: SIM / NÃO / FORA DO ESCOPO

--------------------------------------------------
IDENTIFICAÇÃO DO ATENDIMENTO AUTOMATIZADO (URA)
No atendimento podem existir mensagens enviadas por MARTE.
Mensagens com o nome MARTE representam sistema automático (URA).
Exemplos de mensagens MARTE (ignorar na análise):
- menus de opções (Vendas / Auto Desbloqueio / Boleto...)
- autenticação de CPF/CNPJ
- transferência de atendimento
- mensagens automáticas do sistema
- pesquisa de satisfação automática
- mensagem de follow-up automática pós-atendimento
Essas mensagens NÃO podem gerar pontuação nem penalização.
NÃO usar como evidência para nenhum critério.

--------------------------------------------------
TRANSFERÊNCIA ENTRE ATENDENTES
Se houver mensagens de atendentes anteriores:
- essas mensagens fazem parte apenas do histórico
- não devem ser utilizadas na avaliação
A análise deve considerar somente o atendente que resgatou ou conduziu o atendimento.

--------------------------------------------------
INÍCIO DO ATENDIMENTO HUMANO
O atendimento humano começa quando o atendente resgata o atendimento.
Nesse momento o sistema envia automaticamente uma mensagem de apresentação:
"Olá, Sou [nome do atendente], especialista Bandaturbo. No que eu posso ajudar?"
Essa mensagem é válida para o critério de apresentação do atendente.

--------------------------------------------------
IMPEDITIVOS DA ANÁLISE
Antes de iniciar, verificar:
1. Há mensagem de áudio enviada pelo atendente?
   Se SIM — análise não realizada.
   Motivo: não é possível avaliar comunicação completa apenas pelo texto.
2. Houve interação humana real?
   Se NÃO — análise não realizada.
3. A URA realizou quase todo o atendimento?
   Se SIM — análise não realizada.
Quando não realizada, informar o motivo em motivoInviável.

--------------------------------------------------
REGRA DE DECISÃO EM CASO DE DÚVIDA
Evidência clara     → SIM
Evidência parcial ou inconclusiva → NÃO (registrar melhoria nas oportunidadesMelhoria)
Ausência de evidência → NÃO
Critério não aplicável ao contexto → FORA DO ESCOPO
Nunca inventar evidências. Usar apenas falas reais do diálogo.

--------------------------------------------------
ORDEM DE EXECUÇÃO
1. Verificar impeditivos
2. Identificar início do atendimento humano
3. Extrair dados básicos
4. Aplicar matriz com 19 critérios
5. Calcular subtotais por bloco
6. Calcular nota interna
7. Classificar
8. Verificar bônus operacional
9. Apresentar plano de desenvolvimento e pontos fortes

--------------------------------------------------
MATRIZ DE AVALIAÇÃO — 100 PONTOS

POSTURA E COMUNICAÇÃO (25 pontos)
1. Informou o nome e se apresentou? (4 pts)
2. Foi cordial e simpático? (6 pts)
3. Chamou o cliente pelo nome? (5 pts)
4. Respondeu dentro do tempo adequado? (5 pts)
   Avaliar apenas após o início do atendimento humano.
   Não considerar: mensagens da URA, tempo de fila, transferências, espera antes do resgate.
   Parâmetro: até 1 minuto → SIM | 1 a 2 minutos → avaliar contexto | acima de 2 minutos → NÃO
5. Utilizou linguagem profissional? (5 pts)

ENTENDIMENTO E CONDUÇÃO (25 pontos)
6. Fez perguntas para entender o problema? (5 pts)
7. Identificou corretamente a solicitação? (6 pts)
8. Demonstrou disposição para ouvir? (5 pts)
9. Agiu com agilidade e proatividade? (4 pts)
10. Buscou retenção em cancelamentos? (5 pts)
    FORA DO ESCOPO se não houver tentativa de cancelamento no atendimento.

SOLUÇÃO E CONFIRMAÇÃO (25 pontos)
11. Informou registro da solução no sistema? (4 pts)
12. Confirmou se o cliente ficou confortável com a solução? (6 pts)
13. Buscou alternativa quando necessário? (5 pts)
14. Realizou testes com o cliente? (5 pts)
15. Confirmou se restaram dúvidas? (5 pts)

ENCERRAMENTO E VALOR (25 pontos)
16. Cliente demonstrou satisfação? (7 pts)
    FORA DO ESCOPO se o cliente não manifestar opinião clara sobre o atendimento
    ou simplesmente encerrar a conversa sem retorno.
17. Informou serviços ou benefícios disponíveis? (6 pts)
    FORA DO ESCOPO se o atendimento for exclusivamente técnico ou focado
    na resolução de falhas de serviço.
18. Verificou possibilidade de upgrade ou melhoria? (6 pts)
19. Atualizou dados do cliente no sistema? (6 pts)

--------------------------------------------------
REGRAS DE PONTUAÇÃO
SIM → pontuação total do critério
NÃO → zero ponto
FORA DO ESCOPO → critério não entra no cálculo (exclui do total possível)

--------------------------------------------------
CÁLCULO DA NOTA INTERNA
notaInterna = (pontos obtidos / pontos possíveis) * 100
Pontuação máxima: 100 pontos
Itens FORA DO ESCOPO não entram no denominador.

--------------------------------------------------
CLASSIFICAÇÃO INTERNA (referência, NÃO oficial)
0 a 49   → Abaixo do esperado
50 a 69  → Em desenvolvimento
70 a 84  → Bom atendimento
85 a 94  → Muito bom
95 a 100 → Excelente

--------------------------------------------------
BÔNUS OPERACIONAL
Se o atendente verificou e confirmou os dados cadastrais do cliente:
  SIM → adicionar +5 pontos ao total obtido (antes de calcular a nota)
  NÃO → sem bônus
  FORA DO ESCOPO → não aplica
O campo bonusOperacional deve ser preenchido com true/false/null.

--------------------------------------------------
PLANO DE DESENVOLVIMENTO
Para cada critério com NÃO, gerar:
- O que poderia ter sido feito
- Exemplo prático de como melhorar
- Impacto positivo da mudança

--------------------------------------------------
PONTOS FORTES
Destacar os critérios onde o atendente se saiu bem.

--------------------------------------------------
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
                  classificacaoInterna: { type: "string", enum: ["Excelente", "Muito bom", "Bom atendimento", "Em desenvolvimento", "Abaixo do esperado"] },
                  bonusOperacional: { type: "boolean", description: "true se atendente verificou dados cadastrais do cliente (+5 pts)" },
                  bonusPontosAdicionais: { type: "number", description: "5 se bonusOperacional true, 0 caso contrário" },
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
                  "bonusOperacional", "bonusPontosAdicionais",
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
