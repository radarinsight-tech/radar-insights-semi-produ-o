import { Card } from "@/components/ui/card";
import { formatNota, notaToScale10 } from "@/lib/utils";
import { Users, BarChart3, Trophy, ClipboardCheck, Bot, ShieldAlert } from "lucide-react";
import type { HistoryEntry } from "@/lib/mockData";
import { resolveAuditStatus, AUDIT_STATUSES, type AuditStatus } from "@/lib/auditStatus";

export type StatusFilter = AuditStatus | null;

interface Props {
  entries: HistoryEntry[];
  activeStatusFilter?: StatusFilter;
  onStatusFilterChange?: (filter: StatusFilter) => void;
}

const StatsWidgets = ({ entries, activeStatusFilter, onStatusFilterChange }: Props) => {
  const total = entries.length;
  const media = total > 0 ? entries.reduce((s, e) => s + notaToScale10(e.nota), 0) / total : 0;

  // Derive counts using centralized status resolver
  const statusCounts = entries.reduce(
    (acc, e) => {
      const status = resolveAuditStatus(e.full_report as Record<string, unknown> | null | undefined);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<AuditStatus, number>
  );

  const auditados = statusCounts.auditado || 0;
  const errosBot = statusCounts.erro_fluxo_bot || 0;
  const naoAuditaveis = statusCounts.nao_auditavel || 0;

  // Ranking
  const byAgent: Record<string, { sum: number; count: number }> = {};
  entries.forEach((e) => {
    if (!byAgent[e.atendente]) byAgent[e.atendente] = { sum: 0, count: 0 };
    byAgent[e.atendente].sum += notaToScale10(e.nota);
    byAgent[e.atendente].count += 1;
  });
  const ranking = Object.entries(byAgent)
    .map(([name, { sum, count }]) => ({ name, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const toggleFilter = (status: AuditStatus) => {
    onStatusFilterChange?.(activeStatusFilter === status ? null : status);
  };

  return (
    <div className="space-y-4">
      {/* Auditados */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary/80">{AUDIT_STATUSES.auditado.label}</p>
        </div>
        <p className="text-3xl font-bold">{auditados}</p>
        <p className="text-xs text-muted-foreground mt-1">de {total} avaliações</p>
      </Card>

      {/* Erros no Fluxo do BOT */}
      <Card
        className={`p-5 cursor-pointer transition-all hover:ring-2 hover:ring-destructive/40 ${activeStatusFilter === "erro_fluxo_bot" ? "ring-2 ring-destructive" : ""}`}
        onClick={() => toggleFilter("erro_fluxo_bot")}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-destructive/10">
            <Bot className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-destructive/80">{AUDIT_STATUSES.erro_fluxo_bot.label}</p>
        </div>
        <p className="text-3xl font-bold">{errosBot}</p>
        <p className="text-xs text-muted-foreground mt-1">{AUDIT_STATUSES.erro_fluxo_bot.description}</p>
      </Card>

      {/* Atendimentos Não Auditáveis */}
      <Card
        className={`p-5 cursor-pointer transition-all hover:ring-2 hover:ring-orange-400/40 ${activeStatusFilter === "nao_auditavel" ? "ring-2 ring-orange-500" : ""}`}
        onClick={() => toggleFilter("nao_auditavel")}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">{AUDIT_STATUSES.nao_auditavel.label}</p>
        </div>
        <p className="text-3xl font-bold">{naoAuditaveis}</p>
        <p className="text-xs text-muted-foreground mt-1">{AUDIT_STATUSES.nao_auditavel.description}</p>
      </Card>

      {/* Média da Equipe */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary/80">Média da Equipe</p>
        </div>
        <p className="text-3xl font-bold">{media.toFixed(1).replace(".", ",")}</p>
      </Card>

      {/* Total */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary/80">Total Avaliados</p>
        </div>
        <p className="text-3xl font-bold">{total}</p>
      </Card>

      {/* Ranking */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-accent/10">
            <Trophy className="h-4 w-4 text-accent" />
          </div>
          <p className="text-sm font-semibold text-primary/80">Ranking de Atendentes</p>
        </div>
        <div className="space-y-2 mt-3">
          {ranking.map((r, i) => (
            <div key={r.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground w-5">{i + 1}.</span>
                <span className="font-medium">{r.name}</span>
              </span>
              <span className="font-semibold">{r.avg.toFixed(1).replace(".", ",")}</span>
            </div>
          ))}
          {ranking.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StatsWidgets;
