import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PROMPT_VERSION = "auditor_v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `RADAR INSIGHT — AUDITORIA DE ATENDIMENTO

IDENTIDADE DO AUDITOR

Você é um auditor especializado em qualidade de atendimento ao cliente.
Sua função é analisar conversas de atendimento e aplicar a matriz oficial de auditoria Radar Insight.
A auditoria deve ser objetiva e baseada apenas nas evidências presentes no diálogo.

REGRA ABSOLUTA: Você DEVE seguir a ordem de execução abaixo. Nenhuma etapa pode ser pulada ou executada fora de ordem. A classificação final só pode ser gerada DEPOIS de todas as etapas anteriores terem sido concluídas.

REGRA DE ESTABILIDADE

Você deve seguir exclusivamente a matriz e as regras deste prompt.
Não pode: criar novos critérios, remover critérios existentes, alterar pesos, reinterpretar pontuações, inventar evidências, misturar mensagens da URA com mensagens do atendente humano, avaliar histórico de outro atendente.
Sempre utilizar apenas: SIM, NÃO, FORA DO ESCOPO

═══════════════════════════════════════════════════
ORDEM OBRIGATÓRIA DE EXECUÇÃO (12 ETAPAS)
═══════════════════════════════════════════════════

ETAPA 1 — EXTRAIR TEXTO DO PDF
Receba o texto completo do PDF. Se o texto estiver vazio ou ilegível, retorne erro de extração.

ETAPA 2 — EXTRAIR PROTOCOLO
Procure o número de protocolo no topo do PDF ou no corpo do histórico.
Se o protocolo existir no documento, ele DEVE ser preenchido no resultado.
NUNCA retornar "Não identificado" se o protocolo estiver escrito no documento.

ETAPA 3 — EXTRAIR NOME DO CLIENTE
Procure o campo "Cliente:" no topo do PDF. Use esse nome como referência principal.
Todas as mensagens no histórico com esse nome pertencem ao cliente.
Se o campo "Cliente:" existir, o nome DEVE ser preenchido no resultado.

ETAPA 4 — EXTRAIR BOT E ATENDENTES
- BOT: nomes como Marte, MARTE, sistema, sistema automático, especialista virtual, mensagens automáticas, URA.
- ATENDENTE HUMANO: qualquer nome próprio diferente do cliente e do bot, especialmente após transferência.
  Se houver mais de um atendente, usar o último que conduziu o caso.
  Se existir atendente no histórico, NUNCA retornar "Não identificado".

ETAPA 5 — SEPARAR MENSAGENS POR PARTICIPANTE
Cada bloco do histórico deve ser interpretado como:
- nome do participante
- data/hora
- conteúdo da mensagem
NÃO trate o histórico como texto corrido.

ETAPA 6 — DETECTAR INTERAÇÃO DO CLIENTE
REGRA CRÍTICA: Leia TODO o histórico do início ao fim. Qualquer mensagem do cliente em qualquer momento invalida "sem_interacao_do_cliente".

Interações válidas do cliente incluem:
- saudações ("bom dia", "boa tarde", "oi", "olá")
- texto livre, perguntas, relato de problema
- CPF, CNPJ, números
- escolha de menu ("1", "2", "3")
- respostas curtas ("sim", "não", "ok", "obrigado")
- envio de comprovante ou arquivo
- interação com BOT
- QUALQUER texto digitado pelo cliente

Se existir QUALQUER mensagem do cliente → interação = SIM. Prosseguir.
Se NÃO existir absolutamente nenhuma mensagem do cliente E não existir nome do cliente associado a nenhuma fala:
- statusAtendimento = "fora_de_avaliacao"
- statusAuditoria = "auditoria_bloqueada"
- motivo = "sem_interacao_do_cliente"
- notaFinal = 0, pontosObtidos = 0, pontosPossiveis = 0
- ENCERRAR. Não prosseguir.

ETAPA 7 — DETECTAR ATENDIMENTO HUMANO
Verifique se houve participação de um atendente humano (nome próprio no histórico).

Se NÃO houver atendente humano (apenas BOT):
- statusAtendimento = "apenas_bot"
- statusAuditoria = "auditoria_bloqueada"
- motivo = "atendimento_apenas_por_bot"
- notaFinal = 0, pontosObtidos = 0, pontosPossiveis = 0
- ENCERRAR. Não prosseguir.

Se houver atendente humano → prosseguir.

ETAPA 8 — DETECTAR USO DE ÁUDIO PELO ATENDENTE
Verifique se o atendente enviou áudio, mensagem de voz ou arquivo de áudio (gravacao_de_voz.mp3 etc.).

Se sim:
- NÃO bloquear a auditoria. Continuar normalmente.
- O uso de áudio pode ser penalizado no critério apropriado (ex: linguagem, condução),
  mas NÃO impede a avaliação dos outros 18 critérios.
- Registrar observação: "Atendente enviou áudio durante atendimento de texto"
- Se houver transcrição do áudio disponível no texto (marcada como "[Áudio transcrito]: ..."),
  usar o conteúdo transcrito como parte da conversa para avaliar todos os critérios.

Prosseguir para a próxima etapa.

ETAPA 9 — DETECTAR FALHA DO BOT
Analise se houve falha do BOT:
- BOT responde "opção inválida" para problema válido
- BOT não entende texto livre
- BOT não encaminha para atendimento humano
- BOT repete respostas sem resolver
- BOT gera bloqueio de fluxo

Se falha: statusBot = "bot_com_falha", observacaoBot = descrição breve
Se sem falha: statusBot = "bot_ok"
Essa etapa NÃO bloqueia a mentoria.

ETAPA 10 — APLICAR MATRIZ DA MENTORIA
Condições obrigatórias (TODAS devem ser verdadeiras):
- houve interação do cliente
- houve atendimento humano
- NÃO existe impedimento de auditoria

Se todas verdadeiras:
- statusAtendimento = "auditado"
- statusAuditoria = "auditoria_realizada"
- Avaliar os 19 critérios da matriz abaixo.

IDENTIFICAÇÃO DA URA: Mensagens de MARTE são sistema automático. Ignorar na auditoria.
TRANSFERÊNCIA: Mensagens de atendentes anteriores são histórico. Auditar apenas o atendente que conduziu o caso.
INÍCIO DO ATENDIMENTO HUMANO: Começa quando o atendente resgata. Mensagem automática de apresentação é válida.

REGRA DE DECISÃO:
- Evidência clara → SIM
- Evidência parcial → SIM (registrar melhoria)
- Ausência de evidência → NÃO
- Critério não aplicável → FORA DO ESCOPO
- Nunca inventar evidências.

REGRA DE CONTEXTO DO DIÁLOGO:
Antes de avaliar cada critério, ler TODO o histórico do atendimento
prestando atenção em:
- Tom geral da conversa (cordial, profissional, ágil)
- Mensagens de saudação e despedida do atendente
- Confirmações do cliente durante o atendimento
- Arquivos enviados (imagem, PDF) como evidência de ações realizadas
NÃO avaliar critérios de forma isolada sem considerar o contexto completo.
Um atendimento curto e direto pode ser excelente — brevidade não é penalização.

MATRIZ DE AVALIAÇÃO — 100 PONTOS

POSTURA E COMUNICAÇÃO (25 pontos)
1. Informou o nome e se apresentou? (4 pontos)
2. Foi cordial e simpático? (6 pontos)
3. Chamou o cliente pelo nome? (5 pontos)
4. Respondeu dentro do tempo adequado? (5 pontos) — Avaliar apenas após início do atendimento humano. Não considerar URA, fila, transferências. Até 1 min → SIM, 1-2 min → avaliar contexto, acima de 2 min → NÃO.
5. Utilizou linguagem profissional? (5 pontos)

ENTENDIMENTO E CONDUÇÃO (25 pontos)
6. Fez perguntas para entender o problema? (5 pontos)
7. Identificou corretamente a solicitação? (6 pontos)
8. Demonstrou disposição para ouvir? (5 pontos)
9. Agiu com agilidade e proatividade? (4 pontos)
10. Buscou retenção em cancelamentos? (5 pontos)

SOLUÇÃO E CONFIRMAÇÃO (25 pontos)
11. Informou registro da solução no sistema? (4 pontos)
    FORA DO ESCOPO para atendimentos financeiros (boleto, 2a via, fatura, pagamento, negociação de dívida) — não há solução técnica a registrar. Avaliar apenas em atendimentos de suporte técnico, instalação ou alterações cadastrais complexas.
12. Confirmou se o cliente ficou confortável com a solução? (6 pontos)
13. Buscou alternativa quando necessário? (5 pontos)
14. Realizou testes com o cliente? (5 pontos)
    FORA DO ESCOPO para atendimentos financeiros (boleto, fatura, pagamento) — não há serviço técnico a testar. Avaliar apenas em atendimentos de suporte técnico onde houve configuração, reinicialização de equipamento ou ajuste de sinal.
15. Confirmou se restaram dúvidas? (5 pontos)

ENCERRAMENTO E VALOR (25 pontos)
16. Cliente demonstrou satisfação? (7 pontos)
    Considerar SIM quando o cliente expressar:
    - agradecimento explícito: "obrigado", "obrigada", "tá obrigada", "valeu"
    - confirmação positiva acompanhada de encerramento: "era isso, obrigada"
    - satisfação direta: "ótimo", "perfeito", "que bom", "resolvido"
    FORA DO ESCOPO apenas se o cliente não enviar nenhuma mensagem após a solução ou encerrar sem qualquer retorno.
    Evidência parcial (agradecimento simples) → SIM.
17. Informou serviços ou benefícios disponíveis? (6 pontos) — Atendimento exclusivamente técnico → FORA DO ESCOPO.
18. Verificou possibilidade de upgrade ou melhoria? (6 pontos)
19. Atualizou dados do cliente no sistema? (6 pontos)
    Considerar SIM quando houver evidência de:
    - atendente mencionar que acessou ou atualizou o cadastro
    - cliente confirmar dados ("confirmei", "está correto", "sim")
    - atendente enviar imagem durante o atendimento (indicada como "image.png - Download" ou similar) — imagem no chat de atendimento frequentemente representa tela do sistema com dados cadastrais
    Evidência parcial (imagem enviada + cliente confirmou) → SIM.
    NÃO apenas se não houver nenhum indicativo de acesso ao cadastro.

REGRAS DE PONTUAÇÃO
SIM → pontuação total do critério
NÃO → zero ponto
FORA DO ESCOPO → não entra no cálculo (nem obtidos, nem possíveis)

ETAPA 11 — CALCULAR PONTOS E NOTA
notaFinal = (pontosObtidos ÷ pontosPossiveis) × 100, arredondada a 1 decimal

REGRAS OBRIGATÓRIAS DE NOTA:
- Se a auditoria foi realizada, pontosPossiveis DEVE ser maior que zero.
- Se pontosPossiveis > 0, notaFinal DEVE ser calculada.
- NUNCA retornar notaFinal = 0 com classificação positiva.
- NUNCA retornar "0/0 pontos" em auditoria válida.

ESCALA DE CLASSIFICAÇÃO (baseada na notaFinal):
90–100 → Excelente
70–89 → Bom atendimento
50–69 → Regular
0–49 → Abaixo do esperado

BÔNUS DE QUALIDADE:
0–49 → 0%
50–69 → 30%
70–89 → 70%
90–100 → 100%

BÔNUS OPERACIONAL:
Dados cadastrais conferidos com o cliente:
SIM → +5 pontos
NÃO → 0
FORA DO ESCOPO → não se aplica

MENTORIA DE COMUNICAÇÃO
Sugestões de melhoria: clareza, empatia, orientação ao cliente.
A mentoria não altera a pontuação.

CLASSIFICAÇÃO DO TIPO DE ATENDIMENTO
Identifique o tipo principal do atendimento pela demanda do cliente:
- Suporte Técnico: problemas de conexão, lentidão, configuração, equipamento, sinal
- Financeiro: faturas, boletos, cobranças, pagamentos, negociação de dívida
- Vendas: contratação de novos planos, produtos ou serviços
- Cancelamento: solicitação de cancelamento de serviço ou contrato
- Retenção: tentativa de reter cliente que deseja cancelar
- Mudança de Endereço: transferência de serviço para outro endereço
- Instalação: agendamento ou acompanhamento de instalação
- Upgrade/Downgrade: alteração de plano existente
- Informações Gerais: consultas sobre serviços, cobertura, disponibilidade
- Outro: casos que não se encaixam nas categorias acima
Se o atendimento envolver mais de um tema, classificar pelo MOTIVO PRINCIPAL que gerou o contato.

ETAPA 12 — CHECAGEM INTERNA FINAL (antes de retornar)
Gere internamente esta checagem e CORRIJA inconsistências antes de retornar:

□ protocolo encontrado: sim/não → se sim, protocolo NÃO pode ser "Não identificado"
□ cliente encontrado: sim/não
□ atendente encontrado: sim/não → se sim, atendente NÃO pode ser "Não identificado"
□ mensagens do cliente: quantidade → se > 0, motivo NÃO pode ser "sem_interacao_do_cliente"
□ houve interação do cliente: sim/não
□ houve atendimento humano: sim/não
□ houve áudio do atendente: sim/não
□ houve falha do bot: sim/não
□ auditoria realizada: sim/não → se sim, pontosPossiveis DEVE ser > 0 e notaFinal DEVE ser > 0
□ classificação coerente: a classificação textual DEVE corresponder à notaFinal conforme a escala

REGRA DE BLOQUEIO: Se qualquer inconsistência for detectada na checagem, CORRIJA antes de retornar. Não retorne resultado inconsistente.

═══════════════════════════════════════════════════
REGRAS FINAIS DE COERÊNCIA
═══════════════════════════════════════════════════

1. Se statusAtendimento = "apenas_bot" → NÃO calcular nota (notaFinal = 0)
2. Se statusAtendimento = "fora_de_avaliacao" → NÃO calcular nota (notaFinal = 0)
3. Se statusAuditoria = "auditoria_realizada" → nota e pontuação são OBRIGATÓRIAS e pontosPossiveis > 0
4. classificacao DEVE sempre corresponder à notaFinal conforme a escala
5. NUNCA "Bom atendimento" com notaFinal 0
6. NUNCA "sem_interacao_do_cliente" quando existem mensagens do cliente
7. Atendimentos com áudio do atendente DEVEM ser auditados normalmente (auditoria_realizada), NÃO impedimento_detectado.
8. NUNCA retornar impedimento_detectado por causa de áudio — áudio não bloqueia mais a auditoria.`;


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Texto do atendimento é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Pre-check: detect URA-only / no human content ──
    // If the text has zero human interaction indicators, return nonEvaluable immediately
    const lowerText = text.toLowerCase();
    const BOT_ONLY_SPEAKERS = /\b(marte|bot|sistema|rob[oô]|ura|autom[aá]tico|chatbot|assistente\s*virtual|especialista\s*virtual)\b/i;
    // Strip lines that are clearly bot/system messages or headers
    const lines = text.split(/\n/).filter((l: string) => l.trim().length > 0);
    // Check if there are ANY lines with human-like speaker patterns (not bot/system)
    const humanMessagePattern = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,40}?)[\s]*[\(:\[]/;
    let hasHumanSpeaker = false;
    for (const line of lines) {
      const speakerMatch = line.trim().match(humanMessagePattern);
      if (speakerMatch) {
        const speaker = speakerMatch[1].trim();
        if (!BOT_ONLY_SPEAKERS.test(speaker) && speaker.length > 1) {
          hasHumanSpeaker = true;
          break;
        }
      }
    }

    // Also check for minimal text content (very short text = likely empty/header-only)
    const textWithoutHeaders = text.replace(/^(protocolo|cliente|atendente|canal|data|hor[aá]rio|in[ií]cio|fim|status|tipo|setor)[^\n]*/gim, "").trim();
    const isEffectivelyEmpty = textWithoutHeaders.length < 50;

    if (!hasHumanSpeaker && isEffectivelyEmpty) {
      // URA-only or empty attendance — return valid nonEvaluable response
      return new Response(JSON.stringify({
        nonEvaluable: true,
        motivoNaoAvaliavel: "Atendimento encerrado na URA sem atendente humano",
        statusAtendimento: "fora_de_avaliacao",
        statusAuditoria: "auditoria_bloqueada",
        motivo: "atendimento_apenas_por_bot",
        statusBot: "bot_ok",
        observacaoBot: "Atendimento não teve participação de atendente humano",
        data: "",
        protocolo: "",
        cliente: "",
        tipo: "Outro",
        atendente: "",
        criterios: [],
        subtotais: {
          posturaEComunicacao: { obtidos: 0, possiveis: 0 },
          entendimentoEConducao: { obtidos: 0, possiveis: 0 },
          solucaoEConfirmacao: { obtidos: 0, possiveis: 0 },
          encerramentoEValor: { obtidos: 0, possiveis: 0 },
        },
        pontosObtidos: 0,
        pontosPossiveis: 0,
        notaFinal: 0,
        classificacao: "Fora de Avaliação",
        bonusQualidade: 0,
        bonusOperacional: { atualizacaoCadastral: "FORA DO ESCOPO", pontosExtras: 0 },
        mentoria: [],
        motivoResultado: "Atendimento sem interação humana — apenas URA/bot",
        impeditivo: false,
        motivoImpeditivo: "",
        promptVersion: PROMPT_VERSION,
        auditLog: {
          dataExecucao: new Date().toISOString(),
          promptVersion: PROMPT_VERSION,
          tempoExecucaoMs: Date.now() - startTime,
          resultadoValidado: true,
          erroDetectado: null,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
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
            content: `Analise o seguinte atendimento seguindo RIGOROSAMENTE as 12 etapas na ordem:
1) Extrair texto
2) Extrair protocolo
3) Extrair nome do cliente
4) Extrair bot e atendentes
5) Separar mensagens por participante
6) Detectar interação do cliente
7) Detectar atendimento humano
8) Detectar impedimentos
9) Detectar falha do bot
10) Aplicar matriz da mentoria
11) Calcular pontos e nota
12) Checagem interna final

NUNCA pule etapas. NUNCA classifique antes de completar todas as etapas anteriores.
Se a auditoria for realizada, pontosPossiveis DEVE ser > 0 e notaFinal DEVE ser > 0.

Texto do atendimento:

${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "retornar_auditoria",
              description: "Retorna o resultado completo da auditoria de atendimento Radar Insight. OBRIGATÓRIO: se statusAuditoria=auditoria_realizada, pontosPossiveis DEVE ser > 0 e notaFinal DEVE ser > 0.",
              parameters: {
                type: "object",
                properties: {
                  statusAtendimento: {
                    type: "string",
                    enum: ["auditado", "fora_de_avaliacao", "apenas_bot"],
                    description: "auditado (mentoria aplicada), fora_de_avaliacao (sem interação do cliente), apenas_bot (sem atendente humano)",
                  },
                  statusAuditoria: {
                    type: "string",
                    enum: ["auditoria_realizada", "auditoria_bloqueada", "impedimento_detectado"],
                    description: "auditoria_realizada (mentoria aplicada), auditoria_bloqueada (apenas bot ou sem interação), impedimento_detectado (áudio)",
                  },
                  motivo: {
                    type: "string",
                    enum: ["sem_interacao_do_cliente", "atendimento_apenas_por_bot", "envio_de_audio_pelo_atendente", ""],
                    description: "Motivo quando não auditado. Vazio se auditado.",
                  },
                  statusBot: {
                    type: "string",
                    enum: ["bot_ok", "bot_com_falha"],
                  },
                  observacaoBot: { type: "string" },
                  data: { type: "string", description: "DD/MM/AAAA" },
                  protocolo: { type: "string", description: "Protocolo do atendimento. NUNCA 'Não identificado' se existir no PDF." },
                  cliente: { type: "string", description: "Nome do cliente extraído do campo 'Cliente:' ou do histórico." },
                  tipo: { type: "string", enum: ["Suporte Técnico", "Financeiro", "Vendas", "Cancelamento", "Retenção", "Mudança de Endereço", "Instalação", "Upgrade/Downgrade", "Informações Gerais", "Outro"], description: "Tipo principal do atendimento, classificado com base no conteúdo da conversa. Identificar pela demanda principal do cliente." },
                  atendente: { type: "string", description: "Nome do atendente. NUNCA 'Não identificado' se existir no histórico." },
                  criterios: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        numero: { type: "number" },
                        nome: { type: "string" },
                        categoria: { type: "string", enum: ["Postura e Comunicação", "Entendimento e Condução", "Solução e Confirmação", "Encerramento e Valor"] },
                        pesoMaximo: { type: "number" },
                        resultado: { type: "string", enum: ["SIM", "NÃO", "FORA DO ESCOPO"] },
                        pontosObtidos: { type: "number" },
                        explicacao: { type: "string" },
                      },
                      required: ["numero", "nome", "categoria", "pesoMaximo", "resultado", "pontosObtidos", "explicacao"],
                      additionalProperties: false,
                    },
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
                  pontosPossiveis: { type: "number", description: "Total de pontos possíveis (excluindo FORA DO ESCOPO). DEVE ser > 0 se auditoria_realizada." },
                  notaFinal: { type: "number", description: "(obtidos/possiveis)*100. DEVE ser > 0 se auditoria_realizada e houver critérios avaliados." },
                  classificacao: { type: "string", enum: ["Excelente", "Bom atendimento", "Regular", "Abaixo do esperado", "Fora de Avaliação"], description: "90-100=Excelente, 70-89=Bom atendimento, 50-69=Regular, 0-49=Abaixo do esperado, Fora de Avaliação para não auditados" },
                  bonusQualidade: { type: "number", description: "0, 30, 70 ou 100" },
                  bonusOperacional: {
                    type: "object",
                    properties: {
                      atualizacaoCadastral: { type: "string", enum: ["SIM", "NÃO", "FORA DO ESCOPO"] },
                      pontosExtras: { type: "number" },
                    },
                    required: ["atualizacaoCadastral", "pontosExtras"],
                    additionalProperties: false,
                  },
                  mentoria: {
                    type: "array",
                    items: { type: "string" },
                  },
                  motivoResultado: { type: "string", description: "Explicação breve do motivo do resultado final (auditado, bloqueado, impedimento, etc.)" },
                  impeditivo: { type: "boolean", description: "true se há impedimento de auditoria" },
                  motivoImpeditivo: { type: "string", description: "Descrição do impedimento, se houver" },
                },
                required: [
                  "statusAtendimento", "statusAuditoria", "motivo", "statusBot", "observacaoBot",
                  "data", "protocolo", "cliente", "tipo", "atendente",
                  "criterios", "subtotais", "pontosObtidos", "pontosPossiveis", "notaFinal",
                  "classificacao", "bonusQualidade", "bonusOperacional", "mentoria",
                  "motivoResultado", "impeditivo", "motivoImpeditivo",
                ],
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
    const endTime = Date.now();

    // ═══════════════════════════════════════════════════
    // SERVER-SIDE CONSISTENCY VALIDATION
    // ═══════════════════════════════════════════════════
    const errors: string[] = [];

    const isAudited = result.statusAuditoria === "auditoria_realizada";
    const isBlocked = result.statusAtendimento === "apenas_bot" || result.statusAtendimento === "fora_de_avaliacao";
    const isImpediment = result.statusAuditoria === "impedimento_detectado";

    // Rule 1: If audited, pontosPossiveis must be > 0
    if (isAudited && (result.pontosPossiveis === 0 || result.pontosPossiveis == null)) {
      errors.push("Auditoria realizada mas pontosPossiveis = 0");
    }

    // Rule 2: If audited, notaFinal must be calculated
    if (isAudited && result.pontosPossiveis > 0 && result.notaFinal == null) {
      errors.push("Auditoria realizada mas notaFinal não calculada");
    }

    // Rule 3: Classification must match notaFinal
    if (isAudited && typeof result.notaFinal === "number" && result.notaFinal > 0) {
      const nota = result.notaFinal;
      let expectedClass = "";
      if (nota >= 90) expectedClass = "Excelente";
      else if (nota >= 70) expectedClass = "Bom atendimento";
      else if (nota >= 50) expectedClass = "Regular";
      else expectedClass = "Abaixo do esperado";

      if (result.classificacao !== expectedClass) {
        result.classificacao = expectedClass;
      }
    }

    // Rule 4: Never positive classification with notaFinal = 0
    if (result.notaFinal === 0 && ["Excelente", "Bom atendimento", "Regular"].includes(result.classificacao)) {
      if (isBlocked || isImpediment) {
        result.classificacao = "Fora de Avaliação";
      } else {
        errors.push(`Classificação "${result.classificacao}" com notaFinal = 0`);
      }
    }

    // Rule 5: If blocked/impediment, nota must be 0
    if ((isBlocked || isImpediment) && result.notaFinal > 0) {
      result.notaFinal = 0;
      result.pontosObtidos = 0;
      result.pontosPossiveis = 0;
      result.classificacao = "Fora de Avaliação";
    }

    // Rule 6: Auto-correct bonusQualidade based on notaFinal
    if (isAudited && typeof result.notaFinal === "number") {
      const nota = result.notaFinal;
      if (nota >= 90) result.bonusQualidade = 100;
      else if (nota >= 70) result.bonusQualidade = 70;
      else if (nota >= 50) result.bonusQualidade = 30;
      else result.bonusQualidade = 0;
    }

    const resultadoValidado = errors.length === 0;

    // Build audit log
    const auditLog = {
      dataExecucao: new Date().toISOString(),
      promptVersion: PROMPT_VERSION,
      tempoExecucaoMs: endTime - startTime,
      resultadoValidado,
      erroDetectado: errors.length > 0 ? errors : null,
    };

    // If there are unrecoverable errors, return error with fallback status
    if (!resultadoValidado) {
      console.error("Consistency validation errors:", errors);
      return new Response(
        JSON.stringify({
          error: "Erro de consistência da auditoria: resultado incompleto. Reprocessar atendimento.",
          details: errors,
          partialResult: result,
          auditLog,
          promptVersion: PROMPT_VERSION,
          // Fallback safe status
          statusAuditoria: "erro_processamento",
          motivoResultado: "erro_interno",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Attach versioning and audit log to successful result
    result.promptVersion = PROMPT_VERSION;
    result.auditLog = auditLog;

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
