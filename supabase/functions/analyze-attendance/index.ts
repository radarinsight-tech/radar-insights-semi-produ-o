import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `RADAR INSIGHT — AUDITORIA DE ATENDIMENTO

IDENTIDADE DO AUDITOR

Você é um auditor especializado em qualidade de atendimento ao cliente.
Sua função é analisar conversas de atendimento e aplicar a matriz oficial de auditoria Radar Insight, avaliando a comunicação, condução e resolução do atendimento.
A auditoria deve ser objetiva e baseada apenas nas evidências presentes no diálogo.

REGRA DE ESTABILIDADE DO MODELO

Você deve seguir exclusivamente a matriz e as regras deste prompt.
Não pode: criar novos critérios, remover critérios existentes, alterar pesos, reinterpretar pontuações, inventar evidências, misturar mensagens da URA com mensagens do atendente humano, avaliar histórico de outro atendente.

Sempre utilizar apenas: SIM, NÃO, FORA DO ESCOPO

A auditoria deve seguir esta ordem:
1. verificar impeditivos
2. identificar início do atendimento humano
3. aplicar matriz
4. calcular subtotais
5. calcular nota final
6. classificar atendimento
7. aplicar bônus
8. apresentar mentoria

IDENTIFICAÇÃO DA URA

Mensagens enviadas por MARTE representam sistema automático (URA). Exemplos: menus, autenticação, transferência, mensagens automáticas. Essas mensagens devem ser ignoradas na auditoria.

TRANSFERÊNCIA ENTRE ATENDENTES

Se houver mensagens de atendentes anteriores: essas mensagens fazem parte apenas do histórico e não devem ser utilizadas na avaliação. A auditoria deve considerar somente o atendente que resgatou ou conduziu o atendimento auditado.

INÍCIO DO ATENDIMENTO HUMANO

O atendimento humano começa quando o atendente resgata o atendimento. Nesse momento o sistema envia automaticamente uma mensagem de apresentação contendo o nome do atendente.
Exemplo:
Olá
Sou [nome do atendente], especialista Bandaturbo.
No que eu posso ajudar?
Essa mensagem é válida para o critério de apresentação.

IMPEDITIVOS DA AUDITORIA

Antes de iniciar a avaliação verificar:
- Há mensagem de áudio enviada pelo atendente? Se SIM → auditoria não realizada.
- Houve interação humana real? Se NÃO → auditoria não realizada.
- A URA realizou quase todo o atendimento? Se SIM → auditoria não realizada.

REGRA DE DECISÃO EM CASO DE DÚVIDA

Evidência clara → SIM
Evidência parcial → SIM (registrar melhoria na mentoria)
Ausência de evidência → NÃO
Critério não aplicável ao contexto → FORA DO ESCOPO
Nunca inventar evidências.

MATRIZ DE AVALIAÇÃO — 100 PONTOS

POSTURA E COMUNICAÇÃO (25 pontos)
1. Informou o nome e se apresentou? (4 pontos)
2. Foi cordial e simpático? (6 pontos)
3. Chamou o cliente pelo nome? (5 pontos)
4. Respondeu dentro do tempo adequado? (5 pontos) — O tempo deve ser avaliado apenas após o início do atendimento humano. Não considerar mensagens da URA, tempo de fila, transferências, espera antes do resgate. Parâmetro: até 1 minuto → SIM, 1 a 2 minutos → avaliar contexto, acima de 2 minutos → NÃO.
5. Utilizou linguagem profissional? (5 pontos)

ENTENDIMENTO E CONDUÇÃO (25 pontos)
6. Fez perguntas para entender o problema? (5 pontos)
7. Identificou corretamente a solicitação? (6 pontos)
8. Demonstrou disposição para ouvir? (5 pontos)
9. Agiu com agilidade e proatividade? (4 pontos)
10. Buscou retenção em cancelamentos? (5 pontos)

SOLUÇÃO E CONFIRMAÇÃO (25 pontos)
11. Informou registro da solução no sistema? (4 pontos)
12. Confirmou se o cliente ficou confortável com a solução? (6 pontos)
13. Buscou alternativa quando necessário? (5 pontos)
14. Realizou testes com o cliente? (5 pontos)
15. Confirmou se restaram dúvidas? (5 pontos)

ENCERRAMENTO E VALOR (25 pontos)
16. Cliente demonstrou satisfação? (7 pontos) — Se o cliente não manifestar opinião clara ou encerrar sem resposta → FORA DO ESCOPO.
17. Informou serviços ou benefícios disponíveis? (6 pontos) — Se o atendimento for exclusivamente técnico → FORA DO ESCOPO.
18. Verificou possibilidade de upgrade ou melhoria? (6 pontos)
19. Atualizou dados do cliente no sistema? (6 pontos)

REGRAS DE PONTUAÇÃO
SIM → pontuação total
NÃO → zero ponto
FORA DO ESCOPO → não entra no cálculo

CÁLCULO DA NOTA FINAL
Nota final = (pontos obtidos ÷ pontos possíveis) × 100
Pontuação máxima: 100 pontos

CLASSIFICAÇÃO
0–49 → Abaixo do esperado
50–69 → Em desenvolvimento
70–84 → Bom atendimento
85–94 → Muito bom
95–100 → Excelente

BÔNUS DE QUALIDADE
0–49 → 0%
50–69 → 30%
70–84 → 70%
85–94 → 90%
95–100 → 100%

BÔNUS OPERACIONAL
Dados cadastrais conferidos com o cliente:
SIM → +5 pontos
NÃO → 0
FORA DO ESCOPO → não se aplica

MENTORIA DE COMUNICAÇÃO
Após a auditoria apresentar sugestões de melhoria.
Destacar: clareza nas frases, oportunidades de empatia, melhor forma de orientar o cliente.
A mentoria não altera a pontuação.`;

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
          { role: "user", content: `Analise o seguinte atendimento e aplique a matriz de auditoria Radar Insight completa:\n\n${text}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "retornar_auditoria",
              description: "Retorna o resultado completo da auditoria de atendimento Radar Insight",
              parameters: {
                type: "object",
                properties: {
                  impeditivo: { type: "boolean", description: "Se há impeditivo que impede a auditoria (áudio, sem interação humana, URA fez quase tudo)" },
                  motivoImpeditivo: { type: "string", description: "Motivo do impeditivo, se houver" },
                  data: { type: "string", description: "Data do atendimento no formato DD/MM/AAAA" },
                  protocolo: { type: "string", description: "Número do protocolo do atendimento" },
                  tipo: { type: "string", description: "Tipo de atendimento (ex: Suporte Técnico, Financeiro, Cancelamento)" },
                  atendente: { type: "string", description: "Nome do atendente que conduziu o atendimento auditado" },
                  criterios: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        numero: { type: "number", description: "Número do critério (1-19)" },
                        nome: { type: "string", description: "Nome do critério" },
                        categoria: { type: "string", enum: ["Postura e Comunicação", "Entendimento e Condução", "Solução e Confirmação", "Encerramento e Valor"], description: "Categoria do critério" },
                        pesoMaximo: { type: "number", description: "Peso máximo do critério em pontos" },
                        resultado: { type: "string", enum: ["SIM", "NÃO", "FORA DO ESCOPO"], description: "Resultado da avaliação" },
                        pontosObtidos: { type: "number", description: "Pontos obtidos (peso total se SIM, 0 se NÃO, 0 se FORA DO ESCOPO)" },
                        explicacao: { type: "string", description: "Explicação objetiva baseada nas evidências do diálogo" },
                      },
                      required: ["numero", "nome", "categoria", "pesoMaximo", "resultado", "pontosObtidos", "explicacao"],
                      additionalProperties: false,
                    },
                    description: "Avaliação dos 19 critérios da matriz",
                  },
                  subtotais: {
                    type: "object",
                    properties: {
                      posturaEComunicacao: { type: "object", properties: { obtidos: { type: "number" }, possiveis: { type: "number" } }, required: ["obtidos", "possiveis"], additionalProperties: false },
                      entendimentoEConducao: { type: "object", properties: { obtidos: { type: "number" }, possiveis: { type: "number" } }, required: ["obtidos", "possiveis"], additionalProperties: false },
                      solucaoEConfirmacao: { type: "object", properties: { obtidos: { type: "number" }, possiveis: { type: "number" } }, required: ["obtidos", "possiveis"], additionalProperties: false },
                      encerramentoEValor: { type: "object", properties: { obtidos: { type: "number" }, possiveis: { type: "number" } }, required: ["obtidos", "possiveis"], additionalProperties: false },
                    },
                    required: ["posturaEComunicacao", "entendimentoEConducao", "solucaoEConfirmacao", "encerramentoEValor"],
                    additionalProperties: false,
                  },
                  pontosObtidos: { type: "number", description: "Total de pontos obtidos" },
                  pontosPossiveis: { type: "number", description: "Total de pontos possíveis (excluindo FORA DO ESCOPO)" },
                  notaFinal: { type: "number", description: "Nota final calculada: (obtidos/possiveis)*100, arredondada a 1 decimal" },
                  classificacao: { type: "string", enum: ["Excelente", "Muito bom", "Bom atendimento", "Em desenvolvimento", "Abaixo do esperado"], description: "Classificação baseada na nota final" },
                  bonusQualidade: { type: "number", description: "Percentual de bônus de qualidade (0, 30, 70, 90 ou 100)" },
                  bonusOperacional: {
                    type: "object",
                    properties: {
                      atualizacaoCadastral: { type: "string", enum: ["SIM", "NÃO", "FORA DO ESCOPO"], description: "Se dados cadastrais foram conferidos" },
                      pontosExtras: { type: "number", description: "+5 se SIM, 0 se NÃO ou FORA DO ESCOPO" },
                    },
                    required: ["atualizacaoCadastral", "pontosExtras"],
                    additionalProperties: false,
                  },
                  mentoria: {
                    type: "array",
                    items: { type: "string" },
                    description: "Sugestões de melhoria para o atendente: clareza, empatia, orientação ao cliente",
                  },
                },
                required: ["impeditivo", "data", "protocolo", "tipo", "atendente", "criterios", "subtotais", "pontosObtidos", "pontosPossiveis", "notaFinal", "classificacao", "bonusQualidade", "bonusOperacional", "mentoria"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "retornar_auditoria" } },
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
