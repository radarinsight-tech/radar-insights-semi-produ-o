import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts text from an image by converting it to base64 and sending
 * to the AI gateway for OCR via an edge function.
 */
export async function extractTextFromImage(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  const dataUrl = `data:${file.type};base64,${base64}`;

  const { data, error } = await supabase.functions.invoke("ocr-image", {
    body: { imageDataUrl: dataUrl },
  });

  if (error) {
    console.error("OCR error:", error);
    throw new Error("Erro ao extrair texto da imagem");
  }

  return data?.text || "";
}
