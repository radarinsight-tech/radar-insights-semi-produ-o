import { Card } from "@/components/ui/card";
import { formatNota, notaToScale10 } from "@/lib/utils";
import { Users, BarChart3, Trophy, ClipboardCheck, Bot, ShieldAlert } from "lucide-react";
import type { HistoryEntry } from "@/lib/mockData";

interface Props {
  entries: HistoryEntry[];
}

const StatsWidgets = ({ entries }: Props) => {
  const total = entries.length;
  const media = total > 0 ? entries.reduce((s, e) => s + e.nota, 0) / total : 0;

  // Audit indicators from full_report
  const auditados = entries.filter((e) => {
    const report = e.full_report as Record<string, unknown> | null | undefined;
    return report?.statusAtendimento === "auditado";
  }).length;

  const falhasBot = entries.filter((e) => {
    const report = e.full_report as Record<string, unknown> | null | undefined;
    return report?.statusBot === "bot_com_falha";
  }).length;

  const bloqueadas = entries.filter((e) => {
    const report = e.full_report as Record<string, unknown> | null | undefined;
    return (
      report?.statusAuditoria === "auditoria_bloqueada" ||
      report?.statusAuditoria === "impedimento_detectado"
    );
  }).length;

  // Ranking
  const byAgent: Record<string, { sum: number; count: number }> = {};
  entries.forEach((e) => {
    if (!byAgent[e.atendente]) byAgent[e.atendente] = { sum: 0, count: 0 };
    byAgent[e.atendente].sum += e.nota;
    byAgent[e.atendente].count += 1;
  });
  const ranking = Object.entries(byAgent)
    .map(([name, { sum, count }]) => ({ name, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Audit Indicators */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary/80">Atendimentos Auditados</p>
        </div>
        <p className="text-3xl font-bold">{auditados}</p>
        <p className="text-xs text-muted-foreground mt-1">de {total} avaliações</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-destructive/10">
            <Bot className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-destructive/80">Falhas do BOT</p>
        </div>
        <p className="text-3xl font-bold">{falhasBot}</p>
        <p className="text-xs text-muted-foreground mt-1">atendimentos com erro de fluxo</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">Auditorias Bloqueadas</p>
        </div>
        <p className="text-3xl font-bold">{bloqueadas}</p>
        <p className="text-xs text-muted-foreground mt-1">impedimentos ou apenas bot</p>
      </Card>

      {/* Existing widgets */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary/80">Média da Equipe</p>
        </div>
        <p className="text-3xl font-bold">{media.toFixed(1)}</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary/80">Total Avaliados</p>
        </div>
        <p className="text-3xl font-bold">{total}</p>
      </Card>

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
              <span className="font-semibold">{r.avg.toFixed(1)}</span>
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
