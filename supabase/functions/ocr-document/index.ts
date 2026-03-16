import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPTS: Record<string, string> = {
  rg_cnh: `Analise esta imagem de documento de identificação (RG ou CNH).
Extraia os seguintes campos em JSON:
{
  "nome": "nome completo",
  "cpf": "número do CPF (apenas dígitos)",
  "data_nascimento": "DD/MM/AAAA",
  "numero_documento": "número do RG ou CNH",
  "tipo_documento_detectado": "RG" ou "CNH"
}
Se algum campo não for legível, use null. Retorne APENAS o JSON, sem explicação.`,

  comprovante_endereco: `Analise esta imagem de comprovante de endereço (conta de luz, água, gás, telefone, etc).
Extraia os seguintes campos em JSON:
{
  "nome": "nome do titular",
  "endereco": "endereço completo",
  "data_emissao": "DD/MM/AAAA",
  "empresa_emissora": "nome da empresa"
}
Se algum campo não for legível, use null. Retorne APENAS o JSON, sem explicação.`,

  contrato_aluguel: `Analise esta imagem de contrato de aluguel.
Extraia os seguintes campos em JSON:
{
  "nome_locatario": "nome do locatário/inquilino",
  "endereco_imovel": "endereço do imóvel",
  "data_inicio": "DD/MM/AAAA",
  "data_termino": "DD/MM/AAAA",
  "periodo_locacao_meses": número em meses ou null
}
Se algum campo não for legível, use null. Retorne APENAS o JSON, sem explicação.`,

  escritura: `Analise esta imagem de escritura de imóvel.
Extraia os seguintes campos em JSON:
{
  "nome": "nome do proprietário",
  "endereco": "endereço do imóvel"
}
Se algum campo não for legível, use null. Retorne APENAS o JSON, sem explicação.`,

  boleto_provedor: `Analise esta imagem de boleto de provedor de internet/telecomunicações.
Extraia os seguintes campos em JSON:
{
  "nome": "nome do titular/contratante",
  "endereco": "endereço",
  "data": "DD/MM/AAAA (vencimento ou emissão)",
  "valor": "valor numérico (ex: 99.90)",
  "empresa_emissora": "nome da empresa/provedor"
}
Se algum campo não for legível, use null. Retorne APENAS o JSON, sem explicação.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageDataUrl, tipoDocumento } = await req.json();

    if (!imageDataUrl) {
      return new Response(JSON.stringify({ error: "imageDataUrl é obrigatório" }), {
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

    const prompt = PROMPTS[tipoDocumento] || `Extraia todo o texto visível desta imagem de documento. Retorne em JSON com os campos que identificar: { "texto_completo": "...", "campos_identificados": {} }. Retorne APENAS o JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("AI gateway OCR error:", response.status, body);
      return new Response(JSON.stringify({ error: "Erro ao processar OCR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON from response
    let campos = {};
    let confianca = 0.8;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      const jsonStr = (jsonMatch[1] || rawText).trim();
      campos = JSON.parse(jsonStr);
      
      // Calculate confidence based on null fields
      const values = Object.values(campos);
      const nonNull = values.filter((v) => v !== null && v !== "" && v !== undefined);
      confianca = values.length > 0 ? nonNull.length / values.length : 0;
    } catch {
      confianca = 0.3;
      campos = { texto_completo: rawText };
    }

    return new Response(
      JSON.stringify({ campos, texto_extraido: rawText, confianca }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ocr-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
