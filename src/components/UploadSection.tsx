import { useState, useRef } from "react";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface UploadSectionProps {
  onAnalyze: (file: File) => void;
  isAnalyzing: boolean;
}

const UploadSection = ({ onAnalyze, isAnalyzing }: UploadSectionProps) => {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") setFile(dropped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-primary mb-4">Upload de Atendimento</h2>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />
        {file ? (
          <div className="flex items-center justify-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-medium">{file.name}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Arraste um PDF ou clique para selecionar
            </p>
          </div>
        )}
      </div>
      <Button
        className="mt-4 w-full"
        disabled={!file || isAnalyzing}
        onClick={() => file && onAnalyze(file)}
      >
        {isAnalyzing ? "Analisando..." : "Analisar atendimento"}
      </Button>
    </Card>
  );
};

export default UploadSection;
