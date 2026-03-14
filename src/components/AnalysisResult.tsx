import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export interface AnalysisData {
  protocolo: string;
  atendente: string;
  tipo: string;
  atualizacaoCadastral: string;
  notaFinal: number;
  classificacao: string;
  bonus: boolean;
  pontosMelhoria: string[];
}

interface Props {
  data: AnalysisData | null;
}

const classColor = (c: string) => {
  if (c === "Excelente" || c === "Ótimo") return "bg-accent text-accent-foreground";
  if (c === "Bom") return "bg-primary text-primary-foreground";
  return "bg-warning text-warning-foreground";
};

const AnalysisResult = ({ data }: Props) => {
  if (!data) return null;

  const rows = [
    { label: "Protocolo", value: data.protocolo },
    { label: "Atendente", value: data.atendente },
    { label: "Tipo de atendimento", value: data.tipo },
    { label: "Atualização cadastral", value: data.atualizacaoCadastral },
  ];

  return (
    <Card className="p-6 animate-in fade-in duration-300">
      <h2 className="text-lg font-bold text-primary mb-4">Resultado da Análise</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{r.label}</p>
            <p className="text-sm font-medium mt-0.5">{r.value}</p>
          </div>
        ))}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nota Final</p>
          <p className="text-2xl font-bold mt-0.5">{data.notaFinal.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Classificação</p>
          <Badge className={`mt-1 ${classColor(data.classificacao)}`}>{data.classificacao}</Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bônus</p>
          <Badge className={`mt-1 ${data.bonus ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
            {data.bonus ? "Sim" : "Não"}
          </Badge>
        </div>
      </div>

      {data.pontosMelhoria && data.pontosMelhoria.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pontos de Melhoria</p>
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
