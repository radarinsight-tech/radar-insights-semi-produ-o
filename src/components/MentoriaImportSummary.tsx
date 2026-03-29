import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Zap,
  Copy,
  AlertTriangle,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
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
  errorCount?: number;
  onStartAutoAnalysis: () => void;
  onViewAll: () => void;
  isProcessing: boolean;
  batchProcessing: boolean;
}

const MentoriaImportSummary = ({
  files,
  duplicateCount,
  errorCount = 0,
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

    const eligibleForAuto = files.filter((f) => {
      const ev = resolvePersistedMentoriaEvaluability(f.result);
      const isNonEval = ev?.nonEvaluable === true;
      return !isNonEval && (f.status === "lido" || f.status === "pendente") && !f.result;
    }).length;

    return { total, eligibleForAuto, nonEvaluable, analyzed, duplicates: duplicateCount, errors: errorCount };
  }, [files, duplicateCount, errorCount]);

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
      color: "text-warning",
      bg: "bg-warning/10",
      badgeColor: "bg-orange-500 text-white",
      hide: stats.duplicates === 0,
    },
    {
      icon: XCircle,
      label: "Erros",
      value: stats.errors,
      color: "text-destructive",
      bg: "bg-destructive/10",
      badgeColor: "bg-destructive text-destructive-foreground",
      hide: stats.errors === 0,
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        {items.filter((i) => !i.hide).map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 rounded-xl p-3 ${item.bg}`}
            >
              <Icon className={`h-4 w-4 ${item.color} shrink-0`} />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-lg font-bold leading-none ${item.color}`}>
                    {item.value}
                  </p>
                  {item.badgeColor && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                      {item.value}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {stats.duplicates > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 mb-4">
          <Copy className="h-4 w-4 text-warning shrink-0" />
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
