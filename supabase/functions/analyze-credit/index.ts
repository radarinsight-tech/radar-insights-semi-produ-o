import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Radar Insight — Motor de Análise de Crédito. Você recebe o texto extraído de uma consulta SPC/Serasa (PDF ou imagem) e deve aplicar EXATAMENTE as regras abaixo.

IMPORTANTE: O sistema NÃO USA "Aprovar" ou "Reprovar". Toda análise resulta em uma FAIXA DE TAXA. A análise SEMPRE começa tentando enquadrar na isenção e sobe progressivamente.

CAMPOS A EXTRAIR DO DOCUMENTO:
- nome completo
- cpf_cnpj
- tipo_pessoa (PF ou PJ)
- score (se disponível)
- quantidade_registros_negativos
- valor_total_negativado (em reais)
- lista de credores com: nome, valor, categoria, data_registro, antiguidade_meses
- possui_protesto (true/false)

CATEGORIAS DE CREDOR (classificar cada credor):
- educacao
- banco_financeira
- empresa_cnpj_atividade_profissional
- comercio_varejo
- energia_agua
- moradia_imobiliaria
- provedor_internet
- protesto

ORDEM OBRIGATÓRIA DE APLICAÇÃO DAS REGRAS (escada de faixas):

A análise SEMPRE começa pela Regra 01 (isenção) e sobe progressivamente. A Regra Especial é verificada em paralelo e, se aplicável, SOBREPÕE qualquer outra regra.

1. REGRA 01 — ISENÇÃO (somente 1 registro negativo)
   - Aplicar quando houver EXATAMENTE 1 registro negativo.
   - Enquadrar como isento nos casos:
     a) educacao: 1 registro negativo
     b) banco_financeira: 1 registro negativo com antiguidade > 12 meses
     c) empresa_cnpj_atividade_profissional: 1 registro negativo ligado à atividade profissional/empresarial
     d) comercio_varejo: 1 registro negativo, valor até R$300,00, antiguidade > 24 meses
   - Se elegível:
     - Com documento válido em nome do contratante → ISENTAR (taxa_total = 0)
     - Sem documento válido → taxa_instalacao = 100, taxa_analise_credito = 0, taxa_total = 100
   - regra_aplicada = "regra_01_isencao"
   - classificacao_final = "isento" ou "taxa_100_documentacao"
   - motivo_decisao = "Cliente de baixo risco com restrição de baixo impacto para telecom."

2. REGRA 02 — TAXA R$100,00 (somente 1 registro negativo, não elegível à Regra 01)
   - Aplicar somente quando houver EXATAMENTE 1 registro negativo e não enquadrar na Regra 01.
   - Enquadrar nos casos:
     a) comercio_varejo: 1 registro, valor > R$300,00 OU antiguidade < 12 meses
     b) banco_financeira: 1 registro, valor até R$10.000,00, antiguidade < 12 meses
     c) energia_agua: 1 registro, antiguidade < 12 meses
     d) moradia_imobiliaria: 1 registro ligado a aluguel, condomínio ou imobiliária
   - Se elegível:
     - Com documento válido → taxa_instalacao = 100, taxa_analise_credito = 0, taxa_total = 100
     - Sem documento válido → taxa_instalacao = 100, taxa_analise_credito = 100, taxa_total = 200
   - regra_aplicada = "regra_02_taxa_100"
   - classificacao_final = "taxa_100" ou "taxa_200_composta"
   - motivo_decisao = "Risco leve com condição adicional de atenção."

3. REGRA 03 — TAXA R$200,00 (não enquadrar nas regras 01 e 02)
   - Enquadrar nos casos:
     a) comercio_varejo: 2-3 registros, valor total > R$1.500,00, antiguidade < 24 meses
     b) banco_financeira: 2-3 registros, valor total > R$5.000,00, antiguidade < 24 meses
     c) energia_agua: 2 registros, valor total > R$800,00, antiguidade < 12 meses
   - Se elegível:
     - Com documento válido → taxa_instalacao = 0, taxa_analise_credito = 200, taxa_total = 200
     - Sem documento válido → taxa_instalacao = 100, taxa_analise_credito = 200, taxa_total = 300
   - regra_aplicada = "regra_03_taxa_200"
   - classificacao_final = "taxa_200" ou "taxa_300_composta"
   - motivo_decisao = "Risco moderado alto com múltiplos registros e maior exposição financeira."

4. REGRA 04 — TAXA R$300,00 (não enquadrar nas regras anteriores)
   - Enquadrar nos casos:
     a) comercio_varejo: 4+ registros, valor total > R$3.000,00, antiguidade < 36 meses
     b) banco_financeira: 4+ registros, valor total > R$10.000,00, antiguidade < 36 meses
     c) energia_agua: 3+ registros, valor total > R$1.200,00, antiguidade < 24 meses
     d) protesto: existência de protesto em cartório ativo (SEMPRE enquadrar protesto aqui, NUNCA reprovar)
   - Se elegível:
     - Com documento válido → taxa_instalacao = 0, taxa_analise_credito = 300, taxa_total = 300
     - Sem documento válido → taxa_instalacao = 100, taxa_analise_credito = 300, taxa_total = 400
   - regra_aplicada = "regra_04_taxa_300"
   - classificacao_final = "taxa_300" ou "taxa_400_composta"
   - motivo_decisao = "Risco alto com múltiplos registros, alto valor negativado ou protesto ativo."
   - ESTA É A REGRA DE FALLBACK: se nenhuma regra anterior se aplicar, usar esta.

5. REGRA ESPECIAL — DÉBITO COM PROVEDOR DE INTERNET (sobrepõe todas as outras)
   - Verificar se existe débito com provedor de internet, operadora de internet, provedor regional ou empresa do mesmo segmento de telecomunicações/internet.
   - Se existir:
     - possui_debito_provedor = true
     - taxa_instalacao = 0
     - taxa_analise_credito = 1000
     - taxa_total = 1000
     - regra_aplicada = "regra_especial_debito_provedor"
     - classificacao_final = "taxa_1000"
     - motivo_decisao = "Débito identificado com provedor de internet ou empresa do mesmo segmento. Taxa fixa de R$1.000,00 aplicada, valor revertido em abatimento decrescente das parcelas do plano contratado."
   - Esta regra é NÃO CUMULATIVA com as demais. Se aplicada, SOBREPÕE qualquer outra faixa.

VALIDAÇÃO DOCUMENTAL:
- Documentos aceitos (SOMENTE em nome do contratante):
  1. Conta de água ou luz com mínimo de 3 meses de consumo
  2. Último boleto pago do provedor atual
  3. Contrato de aluguel com mínimo de 12 meses e firma reconhecida
  4. Escritura do imóvel em nome do contratante
- Se o documento não estiver em nome do contratante → documento INVÁLIDO
- NUNCA aprovar documento em nome de terceiro
- Como a análise é feita a partir da consulta SPC/Serasa (que não contém documentos), o campo documento_em_nome_do_contratante deve ser definido como false e o campo tipo_documento como "nao_apresentado", a menos que haja informação explícita no texto sobre documentação.

REGRAS IMPORTANTES:
- NUNCA usar "REPROVAR" ou "REPROVADO" como resultado. Toda análise resulta em uma faixa de taxa.
- NÃO misturar regra de provedor com credor comum
- Respeitar EXATAMENTE a ordem progressiva: isenção → R$100 → R$200 → R$300 → R$1.000
- Separar SEMPRE taxa de instalação e taxa de análise de crédito
- Considerar documento válido SOMENTE se em nome do contratante
- Protesto SEMPRE enquadra na Regra 04 (R$300), nunca como reprovação
- Se alguma informação não puder ser identificada, usar "Não identificado no documento"
- Nunca inventar dados. Usar apenas o que está presente no documento.`;

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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analise a seguinte consulta de CPF/CNPJ e aplique as regras de decisão na ordem de prioridade:\n\n${text}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "retornar_analise_credito",
              description: "Retorna o resultado completo da análise de crédito com motor de decisão aplicado",
              parameters: {
                type: "object",
                properties: {
                  nome: { type: "string", description: "Nome completo do consultado" },
                  cpf_cnpj: { type: "string", description: "CPF ou CNPJ formatado" },
                  tipo_pessoa: { type: "string", enum: ["PF", "PJ"], description: "Pessoa Física ou Jurídica" },
                  score: { type: "string", description: "Score de crédito se disponível, senão 'Não identificado no documento'" },
                  quantidade_registros_negativos: { type: "number", description: "Quantidade total de registros negativos" },
                  valor_total_negativado: { type: "string", description: "Valor total negativado em formato R$ X.XXX,XX" },
                  credores: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string", description: "Nome do credor" },
                        valor: { type: "string", description: "Valor da dívida em R$" },
                        categoria: {
                          type: "string",
                          enum: ["educacao", "banco_financeira", "empresa_cnpj_atividade_profissional", "comercio_varejo", "energia_agua", "moradia_imobiliaria", "provedor_internet", "protesto"],
                          description: "Categoria do credor"
                        },
                        data_registro: { type: "string", description: "Data do registro no formato DD/MM/AAAA ou 'Não identificado'" },
                        antiguidade_meses: { type: "number", description: "Antiguidade do registro em meses" },
                      },
                      required: ["nome", "valor", "categoria", "data_registro", "antiguidade_meses"],
                      additionalProperties: false,
                    },
                    description: "Lista de credores identificados com categoria",
                  },
                  possui_protesto: { type: "boolean", description: "Se há protesto em cartório ativo" },
                  possui_debito_provedor: { type: "boolean", description: "Se há débito com provedor de internet" },
                  documento_em_nome_do_contratante: { type: "boolean", description: "Se há documento válido em nome do contratante" },
                  tipo_documento: { type: "string", description: "Tipo do documento apresentado ou 'nao_apresentado'" },
                  taxa_instalacao: { type: "number", description: "Valor da taxa de instalação em reais" },
                  taxa_analise_credito: { type: "number", description: "Valor da taxa de análise de crédito em reais" },
                  taxa_total: { type: "number", description: "Valor total das taxas (instalação + análise)" },
                  classificacao_final: {
                    type: "string",
                    enum: ["isento", "taxa_100", "taxa_100_documentacao", "taxa_200", "taxa_200_composta", "taxa_300", "taxa_300_composta", "taxa_400_composta", "taxa_1000"],
                    description: "Classificação final da análise"
                  },
                  motivo_decisao: { type: "string", description: "Justificativa objetiva e padronizada da decisão" },
                  regra_aplicada: {
                    type: "string",
                    enum: ["regra_especial_debito_provedor", "regra_01_isencao", "regra_02_taxa_100", "regra_03_taxa_200", "regra_04_taxa_300"],
                    description: "Regra que foi aplicada"
                  },
                  observacoes: { type: "string", description: "Observações adicionais relevantes" },
                  resultado_rapido: { type: "string", description: "Resultado rápido em uma frase curta e direta" },
                },
                required: [
                  "nome", "cpf_cnpj", "tipo_pessoa", "score",
                  "quantidade_registros_negativos", "valor_total_negativado", "credores",
                  "possui_protesto", "possui_debito_provedor",
                  "documento_em_nome_do_contratante", "tipo_documento",
                  "taxa_instalacao", "taxa_analise_credito", "taxa_total",
                  "classificacao_final", "motivo_decisao", "regra_aplicada",
                  "observacoes", "resultado_rapido"
                ],
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
      return new Response(JSON.stringify({ error: "Resposta inválida da IA. Não foi possível concluir a análise." }), {
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
