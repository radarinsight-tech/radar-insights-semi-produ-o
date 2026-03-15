import { useState, useRef } from "react";
import { Upload, FileText, X, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type UploadState = "empty" | "loaded" | "processing" | "no-interaction" | "completed";

interface UploadSectionProps {
  onAnalyze: (file: File) => void;
  isAnalyzing: boolean;
  analysisState?: UploadState;
  analyzedFileName?: string;
  onNewAnalysis?: () => void;
}

const UploadSection = ({
  onAnalyze,
  isAnalyzing,
  analysisState = "empty",
  analyzedFileName,
  onNewAnalysis,
}: UploadSectionProps) => {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentState: UploadState = isAnalyzing ? "processing" : analysisState === "empty" && file ? "loaded" : analysisState;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentState === "processing") return;
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") setFile(dropped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = () => {
    setFile(null);
    onNewAnalysis?.();
  };

  const handleSwap = () => {
    inputRef.current?.click();
  };

  const handleNewAnalysis = () => {
    setFile(null);
    onNewAnalysis?.();
  };

  // Hidden input always present
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".pdf"
      onChange={handleChange}
      className="hidden"
    />
  );

  // STATE: Processing
  if (currentState === "processing") {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Upload de Atendimento</h2>
        {fileInput}
        <div className="border-2 border-primary/30 rounded-lg p-8 text-center bg-primary/5">
          <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin mb-4" />
          <p className="text-sm font-semibold text-foreground mb-1">Processando auditoria com IA</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            O Radar Insight está analisando o atendimento e avaliando os critérios de qualidade.
          </p>
        </div>
        <Button className="mt-4 w-full" disabled>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Analisando...
        </Button>
      </Card>
    );
  }

  // STATE: No interaction detected
  if (currentState === "no-interaction") {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Upload de Atendimento</h2>
        {fileInput}
        <div className="border-2 border-warning/40 rounded-lg p-6 text-center bg-warning/5">
          <AlertCircle className="h-8 w-8 mx-auto text-warning mb-3" />
          <p className="text-sm font-bold text-foreground mb-1">Sem interação do cliente</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            O atendimento foi iniciado, porém não houve resposta do cliente durante o período registrado. Este caso foi classificado como <span className="font-medium text-foreground">Fora de Avaliação</span>.
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleNewAnalysis}>
            <RefreshCw className="h-4 w-4 mr-1" /> Nova análise
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleSwap}>
            <FileText className="h-4 w-4 mr-1" /> Trocar arquivo
          </Button>
        </div>
      </Card>
    );
  }

  // STATE: Completed
  if (currentState === "completed") {
    const displayName = analyzedFileName || file?.name || "arquivo.pdf";
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Upload de Atendimento</h2>
        {fileInput}
        <div className="border border-accent/40 rounded-lg p-4 bg-accent/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Arquivo analisado</p>
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleNewAnalysis}>
            <RefreshCw className="h-4 w-4 mr-1" /> Nova análise
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleSwap}>
            <FileText className="h-4 w-4 mr-1" /> Trocar arquivo
          </Button>
        </div>
      </Card>
    );
  }

  // STATE: File loaded
  if (currentState === "loaded" && file) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Upload de Atendimento</h2>
        {fileInput}
        <div className="border border-primary/30 rounded-lg p-4 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-accent">Arquivo carregado com sucesso</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSwap} title="Trocar arquivo">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRemove} title="Remover arquivo">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            O arquivo foi carregado. Clique em <span className="font-medium text-foreground">"Analisar atendimento"</span> para iniciar a auditoria.
          </p>
        </div>
        <Button className="mt-4 w-full" onClick={() => onAnalyze(file)}>
          Analisar atendimento
        </Button>
      </Card>
    );
  }

  // STATE: Empty (default)
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-primary mb-4">Upload de Atendimento</h2>
      {fileInput}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Arraste o PDF aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">Somente arquivos PDF.</p>
      </div>
      <Button className="mt-4 w-full" disabled>
        Analisar atendimento
      </Button>
    </Card>
  );
};

export default UploadSection;
