import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Zap,
  Hand,
  Copy,
  AlertTriangle,
  Loader2,
  Eye,
  CheckCircle2,
} from "lucide-react";
import {
  resolvePersistedMentoriaEvaluability,
} from "@/lib/mentoriaEvaluability";

interface ImportSummaryFile {
  id: string;
  status: string;
  result?: any;
  nonEvaluable?: boolean;
  isDuplicate?: boolean;
}

interface MentoriaImportSummaryProps {
  files: ImportSummaryFile[];
  duplicateCount: number;
  onStartAutoAnalysis: () => void;
  onViewAll: () => void;
  isProcessing: boolean;
  batchProcessing: boolean;
}

const MentoriaImportSummary = ({
  files,
  duplicateCount,
  onStartAutoAnalysis,
  onViewAll,
  isProcessing,
  batchProcessing,
}: MentoriaImportSummaryProps) => {
  const stats = useMemo(() => {
    const total = files.length;

    const nonEvaluable = files.filter((f) => {
      const ev = resolvePersistedMentoriaEvaluability(f.result);
      return ev?.nonEvaluable === true;
    }).length;

    const analyzed = files.filter((f) => f.status === "analisado").length;

    // Eligible for auto IA: read or pending, not non-evaluable, not already analyzed
    const eligibleForAuto = files.filter((f) => {
      const ev = resolvePersistedMentoriaEvaluability(f.result);
      const isNonEval = ev?.nonEvaluable === true;
      return !isNonEval && (f.status === "lido" || f.status === "pendente") && !f.result;
    }).length;

    // Manual = has result but needs human review (analyzed but not yet validated)
    const manualReview = files.filter((f) => {
      return f.status === "analisado" && f.result && !f.result?.resultado_validado;
    }).length;

    return { total, eligibleForAuto, manualReview, nonEvaluable, analyzed, duplicates: duplicateCount };
  }, [files, duplicateCount]);

  if (stats.total === 0) return null;

  const isBusy = isProcessing || batchProcessing;

  const items = [
    {
      icon: FileText,
      label: "Total recebidos",
      value: stats.total,
      color: "text-foreground",
      bg: "bg-muted/60",
    },
    {
      icon: Zap,
      label: "Aptos para IA",
      value: stats.eligibleForAuto,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: CheckCircle2,
      label: "Já analisados",
      value: stats.analyzed,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: AlertTriangle,
      label: "Não avaliáveis",
      value: stats.nonEvaluable,
      color: "text-warning",
      bg: "bg-warning/10",
      hide: stats.nonEvaluable === 0,
    },
    {
      icon: Copy,
      label: "Duplicatas",
      value: stats.duplicates,
      color: "text-orange-600",
      bg: "bg-orange-100",
      hide: stats.duplicates === 0,
    },
  ];

  return (
    <Card className="p-5 border-l-4 border-l-primary">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground">Resumo da importação</h3>
        <Badge variant="outline" className="text-xs font-semibold">
          {stats.total} atendimento{stats.total !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {items.filter((i) => !i.hide).map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 rounded-xl p-3 ${item.bg}`}
            >
              <Icon className={`h-4 w-4 ${item.color} shrink-0`} />
              <div>
                <p className={`text-lg font-bold leading-none ${item.color}`}>
                  {item.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {stats.duplicates > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-orange-300/50 bg-orange-50 px-4 py-2.5 mb-4">
          <Copy className="h-4 w-4 text-orange-600 shrink-0" />
          <span className="text-xs text-foreground">
            <strong className="font-semibold">{stats.duplicates}</strong> arquivo(s) já importado(s) anteriormente foram detectados como duplicata(s).
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        {stats.eligibleForAuto > 0 && (
          <Button
            size="lg"
            className="gap-2 font-semibold"
            onClick={onStartAutoAnalysis}
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {isBusy
              ? "Processando..."
              : `Iniciar análise automática (${stats.eligibleForAuto})`}
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          className="gap-2 font-semibold"
          onClick={onViewAll}
        >
          <Eye className="h-4 w-4" />
          Ver todos
        </Button>
      </div>
    </Card>
  );
};

export default MentoriaImportSummary;
