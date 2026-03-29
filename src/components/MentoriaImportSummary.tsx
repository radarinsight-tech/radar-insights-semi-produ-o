import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Copy,
  XCircle,
  ArrowRight,
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
  onViewAll: () => void;
}

const MentoriaImportSummary = ({
  files,
  duplicateCount,
  errorCount = 0,
  onViewAll,
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

  const items = [
    { icon: FileText, label: "Total", value: stats.total, color: "text-foreground" },
    { icon: Zap, label: "Aptos IA", value: stats.eligibleForAuto, color: "text-primary" },
    { icon: CheckCircle2, label: "Analisados", value: stats.analyzed, color: "text-accent" },
    { icon: AlertTriangle, label: "Não avaliáveis", value: stats.nonEvaluable, color: "text-warning", hide: stats.nonEvaluable === 0 },
    { icon: Copy, label: "Duplicatas", value: stats.duplicates, color: "text-warning", hide: stats.duplicates === 0 },
    { icon: XCircle, label: "Erros", value: stats.errors, color: "text-destructive", hide: stats.errors === 0 },
  ];

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 flex-wrap">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Resumo</span>
      <div className="h-4 w-px bg-border shrink-0" />
      {items.filter((i) => !i.hide).map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${item.color}`} />
            <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto gap-1 text-xs font-medium text-primary"
        onClick={onViewAll}
      >
        Ver todos <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default MentoriaImportSummary;
