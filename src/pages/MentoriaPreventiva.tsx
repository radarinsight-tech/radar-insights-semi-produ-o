import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logoSymbol from "@/assets/logo-symbol.png";

const MentoriaPreventiva = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-7 w-7 rounded-lg object-contain" />
            <h1 className="text-lg font-bold text-primary">Mentoria Preventiva</h1>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Mentoria Preventiva</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
              Ambiente de desenvolvimento e feedback para atendentes — sem impacto em notas oficiais ou bônus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <Card className="p-6 text-center space-y-3 border-dashed border-2 border-border">
              <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium text-foreground">Upload de Atendimento</p>
                <p className="text-xs text-muted-foreground mt-1">Envie um PDF para análise preventiva</p>
              </div>
            </Card>
            <Card className="p-6 text-center space-y-3 border-dashed border-2 border-border">
              <FileText className="h-6 w-6 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium text-foreground">Relatório de Desenvolvimento</p>
                <p className="text-xs text-muted-foreground mt-1">Feedback construtivo sem nota oficial</p>
              </div>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            Em breve: upload, análise e histórico de mentorias preventivas.
          </p>
        </div>
      </main>
    </div>
  );
};

export default MentoriaPreventiva;
