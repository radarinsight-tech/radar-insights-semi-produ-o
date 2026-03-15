import { useState, useRef } from "react";
import { Upload, FileText, Image, Loader2, CheckCircle2, AlertCircle, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { extractTextFromPdf, renderPdfPagesToImages } from "@/lib/pdfExtractor";
import { extractTextFromImage } from "@/lib/imageExtractor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CreditUploadState = "empty" | "loaded" | "processing" | "completed" | "error";

interface CreditUploadSectionProps {
  onAnalyze: (text: string) => void;
  isAnalyzing: boolean;
  uploadState: CreditUploadState;
  onStateChange: (state: CreditUploadState) => void;
  analyzedFileName: string;
  onNewAnalysis: () => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const CreditUploadSection = ({ onAnalyze, isAnalyzing, uploadState, onStateChange, analyzedFileName, onNewAnalysis }: CreditUploadSectionProps) => {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValidFile = (f: File) => ACCEPTED_TYPES.includes(f.type);
  const isProcessing = uploadState === "processing" || isAnalyzing;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped && isValidFile(dropped)) {
      setFile(dropped);
      onStateChange("loaded");
    } else {
      toast.error("Formato não suportado. Envie um PDF ou imagem (PNG, JPG, WEBP).");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return;
    const selected = e.target.files?.[0];
    if (selected && isValidFile(selected)) {
      setFile(selected);
      onStateChange("loaded");
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
    if (!file || isProcessing) return;
    onStateChange("processing");

    try {
      let text = "";

      if (file.type === "application/pdf") {
        text = await extractTextFromPdf(file);
        if (!text.trim() || text.trim().length < 30) {
          console.log("PDF has no selectable text, falling back to OCR...");
          toast.info("PDF escaneado detectado. Aplicando OCR...");
          const pageImages = await renderPdfPagesToImages(file);
          const ocrResults: string[] = [];
          for (const dataUrl of pageImages) {
            const pageText = await ocrFromDataUrl(dataUrl);
            if (pageText.trim()) ocrResults.push(pageText);
          }
          text = ocrResults.join("\n\n");
        }
      } else {
        text = await extractTextFromImage(file);
      }

      if (!text.trim()) {
        toast.error("Não foi possível extrair texto do arquivo. Verifique se o documento é legível.");
        onStateChange("error");
        return;
      }

      onAnalyze(text);
    } catch (err) {
      console.error("Extraction error:", err);
      toast.error("Erro ao processar o arquivo.");
      onStateChange("error");
    }
  };

  const handleRemoveFile = () => {
    if (isProcessing) return;
    setFile(null);
    onStateChange("empty");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSwapFile = () => {
    if (isProcessing) return;
    inputRef.current?.click();
  };

  const handleNewAnalysis = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    onNewAnalysis();
  };

  const isImage = file && file.type.startsWith("image/");

  // Processing state
  if (uploadState === "processing" || (isAnalyzing && uploadState !== "completed")) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Análise de Crédito</h2>
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
          <p className="text-lg font-semibold text-foreground">Processando análise...</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            O Radar Insight está analisando a consulta, classificando credores e aplicando as regras de decisão.
          </p>
          {file && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
              <FileText className="h-4 w-4" />
              <span>{file.name}</span>
            </div>
          )}
        </div>
        <Button className="mt-4 w-full" disabled>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Processando análise...
        </Button>
      </Card>
    );
  }

  // Completed state
  if (uploadState === "completed") {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Análise de Crédito</h2>
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-accent" />
          </div>
          <p className="text-lg font-semibold text-foreground">Análise concluída</p>
          <p className="text-sm text-muted-foreground text-center">
            O resultado está disponível ao lado. Você pode iniciar uma nova análise.
          </p>
          {analyzedFileName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
              <FileText className="h-4 w-4" />
              <span>{analyzedFileName}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="flex-1" onClick={handleNewAnalysis}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Nova análise
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleSwapFile}>
            Trocar arquivo
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleChange}
          className="hidden"
        />
      </Card>
    );
  }

  // Error state
  if (uploadState === "error") {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Análise de Crédito</h2>
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-lg font-semibold text-foreground">Erro ao processar a análise</p>
          <p className="text-sm text-muted-foreground text-center">
            Tente novamente ou selecione outro arquivo.
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="flex-1" onClick={handleNewAnalysis}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Nova análise
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => { if (file) { onStateChange("loaded"); } else { onStateChange("empty"); } }}>
            Tentar novamente
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleChange}
          className="hidden"
        />
      </Card>
    );
  }

  // Loaded state (file selected)
  if (uploadState === "loaded" && file) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Upload da Consulta</h2>
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {isImage ? <Image className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-accent">Arquivo carregado com sucesso</p>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={handleRemoveFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={handleSwapFile}>Trocar arquivo</Button>
            <Button variant="ghost" size="sm" onClick={handleRemoveFile}>Remover</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          O arquivo foi carregado. Clique em "Analisar consulta" para iniciar a análise de crédito.
        </p>
        <Button className="mt-4 w-full" onClick={handleAnalyze}>
          Analisar consulta
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleChange}
          className="hidden"
        />
      </Card>
    );
  }

  // Empty state (default)
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
        <div className="space-y-2">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            Arraste um PDF ou imagem, ou clique para selecionar
          </p>
          <p className="text-muted-foreground text-xs">
            Formatos aceitos: PDF, PNG, JPG, WEBP
          </p>
        </div>
      </div>
      <Button className="mt-4 w-full" disabled>
        Analisar consulta
      </Button>
    </Card>
  );
};

export default CreditUploadSection;
