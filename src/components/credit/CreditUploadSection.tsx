import { useState, useRef } from "react";
import { Upload, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { extractTextFromPdf, renderPdfPagesToImages } from "@/lib/pdfExtractor";
import { extractTextFromImage } from "@/lib/imageExtractor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreditUploadSectionProps {
  onAnalyze: (text: string) => void;
  isAnalyzing: boolean;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const CreditUploadSection = ({ onAnalyze, isAnalyzing }: CreditUploadSectionProps) => {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValidFile = (f: File) => ACCEPTED_TYPES.includes(f.type);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && isValidFile(dropped)) {
      setFile(dropped);
    } else {
      toast.error("Formato não suportado. Envie um PDF ou imagem (PNG, JPG, WEBP).");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && isValidFile(selected)) {
      setFile(selected);
    } else if (selected) {
      toast.error("Formato não suportado. Envie um PDF ou imagem (PNG, JPG, WEBP).");
    }
  };

  const ocrFromDataUrl = async (dataUrl: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("ocr-image", {
      body: { imageDataUrl: dataUrl },
    });
    if (error) {
      console.error("OCR error:", error);
      throw new Error("Erro ao extrair texto via OCR");
    }
    return data?.text || "";
  };

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      let text = "";

      if (file.type === "application/pdf") {
        // Step 1: Try native text extraction
        text = await extractTextFromPdf(file);

        // Step 2: If no meaningful text found, fallback to OCR via page rendering
        if (!text.trim() || text.trim().length < 30) {
          console.log("PDF has no selectable text, falling back to OCR...");
          toast.info("PDF escaneado detectado. Aplicando OCR...");
          
          const pageImages = await renderPdfPagesToImages(file);
          const ocrResults: string[] = [];
          
          for (const dataUrl of pageImages) {
            const pageText = await ocrFromDataUrl(dataUrl);
            if (pageText.trim()) {
              ocrResults.push(pageText);
            }
          }
          
          text = ocrResults.join("\n\n");
        }
      } else {
        // Image file — always use OCR
        text = await extractTextFromImage(file);
      }

      if (!text.trim()) {
        toast.error("Não foi possível extrair texto do arquivo. Verifique se o documento é legível.");
        return;
      }

      onAnalyze(text);
    } catch (err) {
      console.error("Extraction error:", err);
      toast.error("Erro ao processar o arquivo.");
    }
  };

  const isImage = file && file.type.startsWith("image/");

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-primary mb-4">Upload da Consulta</h2>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleChange}
          className="hidden"
        />
        {file ? (
          <div className="flex items-center justify-center gap-2 text-foreground">
            {isImage ? (
              <Image className="h-5 w-5 text-primary" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
            <span className="font-medium">{file.name}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Arraste um PDF ou imagem, ou clique para selecionar
            </p>
            <p className="text-muted-foreground text-xs">
              Formatos aceitos: PDF, PNG, JPG, WEBP
            </p>
          </div>
        )}
      </div>
      <Button
        className="mt-4 w-full"
        disabled={!file || isAnalyzing}
        onClick={handleAnalyze}
      >
        {isAnalyzing ? "Analisando..." : "Analisar consulta"}
      </Button>
    </Card>
  );
};

export default CreditUploadSection;
