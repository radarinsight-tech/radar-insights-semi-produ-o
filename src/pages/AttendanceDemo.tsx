import { useState } from "react";
import logoSymbol from "@/assets/logo-symbol.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlaskConical, Upload, FileText, RefreshCw, AlertTriangle } from "lucide-react";
import QualityGauge from "@/components/QualityGauge";

const MOCK_RESULT = {
  protocolo: "DEMO-2025031567",
  atendente: "Ana Paula (Demo)",
  tipo: "Suporte Técnico",
  atualizacaoCadastral: "SIM",
  notaFinal: 92.1,
  classificacao: "Excelente",
  bonusQualidade: 100,
  pontosMelhoria: [
    "Reforçar confirmação de entendimento antes de propor solução.",
    "Oferecer alternativas de contato para acompanhamento.",
  ],
  pontosObtidos: 81,
  pontosPossiveis: 88,
};

type PageState = "empty" | "processing" | "completed";

const AttendanceDemo = () => {
  const [state, setState] = useState<PageState>("empty");
  const [fileName, setFileName] = useState("");

  const handleFile = (file: File) => {
    setFileName(file.name);
    setState("processing");
    // Simular processamento
    setTimeout(() => setState("completed"), 1500);
  };

  const handleNew = () => {
    setState("empty");
    setFileName("");
  };

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      {/* HEADER */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <h1 className="text-xl font-bold text-foreground">
            Radar Insight — <span className="text-primary">Sucesso do Cliente</span>
          </h1>
          <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1 ml-2">
            <FlaskConical className="h-3 w-3" />
            Modo Demo
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* UPLOAD CARD */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-primary mb-4">Upload de Atendimento</h2>

            {state === "processing" && (
              <div className="border-2 border-primary/30 rounded-lg p-8 text-center bg-primary/5">
                <div className="h-10 w-10 mx-auto text-primary animate-spin mb-4 border-4 border-primary/30 border-t-primary rounded-full" />
                <p className="text-sm font-semibold text-foreground mb-1">Processando auditoria com IA</p>
                <p className="text-xs text-muted-foreground">Modo Demo — resultado em instantes...</p>
              </div>
            )}

            {state === "completed" && (
              <>
                <div className="border border-accent/40 rounded-lg p-4 bg-accent/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <FileText className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Arquivo analisado</p>
                      <p className="text-sm font-medium text-foreground truncate">{fileName || "arquivo.pdf"}</p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full" onClick={handleNew}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Nova análise
                </Button>
              </>
            )}

            {state === "empty" && (
              <>
                <div
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf";
                    input.onchange = (e: any) => {
                      const f = e.target?.files?.[0];
                      if (f) handleFile(f);
                    };
                    input.click();
                  }}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Arraste o PDF aqui ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">Somente arquivos PDF.</p>
                </div>
                <Button className="mt-4 w-full" disabled>Analisar atendimento</Button>
              </>
            )}
          </Card>

          {/* RESULTADO DA AUDITORIA */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-primary mb-4">Resultado da Auditoria</h2>

            {state === "completed" ? (
              <div className="animate-in fade-in duration-300">
                <div className="mb-5">
                  <QualityGauge score={MOCK_RESULT.notaFinal} classification={MOCK_RESULT.classificacao} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Protocolo</p>
                    <p className="text-sm font-medium mt-0.5">{MOCK_RESULT.protocolo}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Atendente</p>
                    <p className="text-sm font-medium mt-0.5">{MOCK_RESULT.atendente}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de Atendimento</p>
                    <Badge variant="outline" className="mt-1">{MOCK_RESULT.tipo}</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pontuação</p>
                    <p className="text-sm font-medium mt-0.5">{MOCK_RESULT.pontosObtidos}/{MOCK_RESULT.pontosPossiveis} pontos</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Classificação</p>
                    <Badge className="mt-1 bg-accent text-accent-foreground">{MOCK_RESULT.classificacao}</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bônus Qualidade</p>
                    <Badge className="mt-1 bg-accent text-accent-foreground">{MOCK_RESULT.bonusQualidade}%</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Atualização Cadastral</p>
                    <Badge className="mt-1 bg-accent text-accent-foreground">{MOCK_RESULT.atualizacaoCadastral}</Badge>
                  </div>
                </div>
                {MOCK_RESULT.pontosMelhoria.length > 0 && (
                  <div className="mt-5 border-t border-border pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mentoria de Comunicação</p>
                    </div>
                    <ul className="space-y-1.5">
                      {MOCK_RESULT.pontosMelhoria.map((p, i) => (
                        <li key={i} className="text-sm text-foreground flex gap-2">
                          <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center min-h-[200px]">
                <div className="p-3 rounded-full bg-primary/10 mb-4">
                  <FileText className="h-8 w-8 text-primary/60" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {state === "processing" ? "Analisando..." : "Faça upload de um PDF para ver o resultado"}
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AttendanceDemo;
