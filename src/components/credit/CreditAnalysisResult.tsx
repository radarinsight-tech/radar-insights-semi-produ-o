import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSearch, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, User, CreditCard, Building2, MessageSquare, Lightbulb } from "lucide-react";

export interface CreditCredor {
  nome: string;
  tipo: "Financeiro" | "Comércio" | "Serviços" | "Outros";
  valor: string;
}

export interface CreditAnalysisData {
  nome: string;
  cpf: string;
  idade: string;
  quantidadeRegistrosNegativos: number;
  valorTotalDividas: string;
  credores: CreditCredor[];
  regraAplicada: string;
  decisaoFinal: "APROVADO" | "APROVADO COM RESSALVA" | "REPROVADO";
  orientacaoOperacional: string;
  observacoes: string;
  resultadoRapido: string;
}

interface Props {
  data: CreditAnalysisData | null;
}

const decisionConfig = {
  "APROVADO": {
    icon: ShieldCheck,
    bg: "bg-accent/10",
    border: "border-accent",
    text: "text-accent",
    badge: "bg-accent text-accent-foreground",
  },
  "APROVADO COM RESSALVA": {
    icon: ShieldAlert,
    bg: "bg-warning/10",
    border: "border-warning",
    text: "text-warning",
    badge: "bg-warning text-warning-foreground",
  },
  "REPROVADO": {
    icon: ShieldX,
    bg: "bg-destructive/10",
    border: "border-destructive",
    text: "text-destructive",
    badge: "bg-destructive text-destructive-foreground",
  },
};

const credorTypeIcon = (tipo: string) => {
  switch (tipo) {
    case "Financeiro": return "🏦";
    case "Comércio": return "🏪";
    case "Serviços": return "📡";
    default: return "📋";
  }
};

const CreditAnalysisResult = ({ data }: Props) => {
  if (!data) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center text-center min-h-[320px]">
        <h2 className="text-lg font-bold text-primary mb-5">Resultado da Análise de Crédito</h2>
        <div className="p-3 rounded-full bg-primary/10 mb-4">
          <FileSearch className="h-8 w-8 text-primary/60" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-3">Radar Insight — Análise de Crédito</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Envie uma consulta de CPF em PDF ou imagem para realizar a análise.
        </p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mt-2">
          O sistema irá ler o documento, aplicar o prompt de análise e exibir aqui o parecer técnico com a decisão final.
        </p>
      </Card>
    );
  }

  const config = decisionConfig[data.decisaoFinal] || decisionConfig["REPROVADO"];
  const DecisionIcon = config.icon;

  return (
    <Card className="p-6 animate-in fade-in duration-300">
      <h2 className="text-lg font-bold text-primary mb-4">Resultado da Análise de Crédito</h2>

      {/* Decision highlight */}
      <div className={`rounded-lg border-2 ${config.border} ${config.bg} p-4 mb-5`}>
        <div className="flex items-center gap-3 mb-2">
          <DecisionIcon className={`h-7 w-7 ${config.text}`} />
          <Badge className={`text-sm px-3 py-1 ${config.badge}`}>
            {data.decisaoFinal}
          </Badge>
        </div>
        <p className={`text-sm font-semibold ${config.text}`}>{data.resultadoRapido}</p>
      </div>

      {/* Personal info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome</p>
            <p className="text-sm font-medium mt-0.5">{data.nome}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CreditCard className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF</p>
            <p className="text-sm font-medium mt-0.5">{data.cpf}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Idade</p>
          <p className="text-sm font-medium mt-0.5">{data.idade}</p>
        </div>
      </div>

      {/* Negative records summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Registros Negativos</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{data.quantidadeRegistrosNegativos}</p>
        </div>
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Total das Dívidas</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{data.valorTotalDividas}</p>
        </div>
      </div>

      {/* Credores */}
      {data.credores && data.credores.length > 0 && (
        <div className="mb-5 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credores Identificados</p>
          </div>
          <div className="space-y-2">
            {data.credores.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>{credorTypeIcon(c.tipo)}</span>
                  <span className="text-sm font-medium text-foreground">{c.nome}</span>
                  <Badge variant="outline" className="text-xs">{c.tipo}</Badge>
                </div>
                <span className="text-sm font-semibold text-foreground">{c.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regra aplicada */}
      <div className="mb-5 border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Regra Aplicada</p>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{data.regraAplicada}</p>
      </div>

      {/* Orientação operacional */}
      <div className="mb-5 border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Orientação Operacional</p>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{data.orientacaoOperacional}</p>
      </div>

      {/* Observações */}
      {data.observacoes && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações</p>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{data.observacoes}</p>
        </div>
      )}
    </Card>
  );
};

export default CreditAnalysisResult;
