import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileSearch, ShieldAlert } from "lucide-react";
import QualityGauge from "@/components/QualityGauge";
import { formatNota } from "@/lib/utils";

export interface AnalysisData {
  protocolo: string;
  atendente: string;
  tipo: string;
  atualizacaoCadastral: string;
  notaFinal: number;
  classificacao: string;
  bonus: boolean;
  bonusQualidade: number;
  pontosMelhoria: string[];
  impeditivo?: boolean;
  motivoImpeditivo?: string;
  pontosObtidos?: number;
  pontosPossiveis?: number;
  noInteraction?: boolean;
}

interface Props {
  data: AnalysisData | null;
}

const classColor = (c: string) => {
  if (c === "Excelente" || c === "Muito bom") return "bg-accent text-accent-foreground";
  if (c === "Bom atendimento") return "bg-primary text-primary-foreground";
  return "bg-warning text-warning-foreground";
};

const AnalysisResult = ({ data }: Props) => {
  if (!data) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center text-center min-h-[260px]">
        <h2 className="text-lg font-bold text-primary mb-5">Resultado da Auditoria</h2>
        <div className="p-3 rounded-full bg-primary/10 mb-4">
          <FileSearch className="h-8 w-8 text-primary/60" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-3">Radar Insight</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Após inserir o atendimento em PDF e clicar em <span className="font-medium text-foreground">"Analisar atendimento"</span>, o sistema exibirá aqui:
        </p>
        <ul className="mt-3 text-xs text-muted-foreground space-y-1">
          <li>• Protocolo e atendente auditado</li>
          <li>• Nota final (0–100) e classificação</li>
          <li>• Bônus de qualidade e operacional</li>
          <li>• Mentoria de comunicação</li>
        </ul>
      </Card>
    );
  }

  // No interaction state
  if (data.noInteraction) {
    return (
      <Card className="p-6 animate-in fade-in duration-300">
        <h2 className="text-lg font-bold text-primary mb-4">Resultado da Auditoria</h2>
        <div className="flex flex-col items-center justify-center text-center py-6">
          <div className="p-3 rounded-full bg-warning/10 mb-4">
            <ShieldAlert className="h-8 w-8 text-warning" />
          </div>
          <Badge className="bg-warning text-warning-foreground mb-3">Fora de Avaliação</Badge>
          <p className="text-sm font-bold text-foreground mb-2">Sem interação do cliente</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            O atendimento foi iniciado, porém não houve resposta do cliente durante o período registrado.
          </p>
          {data.protocolo && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-left w-full max-w-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Protocolo</p>
                <p className="text-sm font-medium">{data.protocolo}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Atendente</p>
                <p className="text-sm font-medium">{data.atendente}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (data.impeditivo) {
    return (
      <Card className="p-6 animate-in fade-in duration-300">
        <h2 className="text-lg font-bold text-primary mb-4">Resultado da Auditoria</h2>
        <div className="flex flex-col items-center justify-center text-center py-6">
          <div className="p-3 rounded-full bg-warning/10 mb-4">
            <ShieldAlert className="h-8 w-8 text-warning" />
          </div>
          <p className="text-sm font-bold text-foreground mb-2">Auditoria não realizada</p>
          <p className="text-sm text-muted-foreground max-w-sm">{data.motivoImpeditivo || "Impeditivo identificado no atendimento."}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-left w-full max-w-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Protocolo</p>
              <p className="text-sm font-medium">{data.protocolo}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Atendente</p>
              <p className="text-sm font-medium">{data.atendente}</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 animate-in fade-in duration-300">
      <h2 className="text-lg font-bold text-primary mb-4">Resultado da Auditoria</h2>
      
      {/* Quality Gauge */}
      <div className="mb-5">
        <QualityGauge score={data.notaFinal} classification={data.classificacao} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Protocolo</p>
          <p className="text-sm font-medium mt-0.5">{data.protocolo}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Atendente</p>
          <p className="text-sm font-medium mt-0.5">{data.atendente}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de Atendimento Detectado</p>
          <Badge variant="outline" className="mt-1">{data.tipo}</Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pontuação</p>
          {data.pontosObtidos != null && data.pontosPossiveis != null && (
            <p className="text-sm font-medium mt-0.5">{data.pontosObtidos}/{data.pontosPossiveis} pontos</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Classificação</p>
          <Badge className={`mt-1 ${classColor(data.classificacao)}`}>{data.classificacao}</Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bônus Qualidade</p>
          <Badge className={`mt-1 ${data.bonusQualidade > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
            {data.bonusQualidade}%
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Atualização Cadastral</p>
          <Badge className={`mt-1 ${data.atualizacaoCadastral === "SIM" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
            {data.atualizacaoCadastral}
          </Badge>
        </div>
      </div>

      {data.pontosMelhoria && data.pontosMelhoria.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mentoria de Comunicação</p>
          </div>
          <ul className="space-y-1.5">
            {data.pontosMelhoria.map((ponto, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                {ponto}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};

export default AnalysisResult;
