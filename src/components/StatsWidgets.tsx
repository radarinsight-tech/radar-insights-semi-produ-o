import { Card } from "@/components/ui/card";
import { Users, BarChart3, Trophy } from "lucide-react";
import type { HistoryEntry } from "@/lib/mockData";

interface Props {
  entries: HistoryEntry[];
}

const StatsWidgets = ({ entries }: Props) => {
  const total = entries.length;
  const media = total > 0 ? entries.reduce((s, e) => s + e.nota, 0) / total : 0;

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
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Média da Equipe</p>
        </div>
        <p className="text-3xl font-bold">{media.toFixed(1)}</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Total Avaliados</p>
        </div>
        <p className="text-3xl font-bold">{total}</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-accent/10">
            <Trophy className="h-4 w-4 text-accent" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Ranking de Atendentes</p>
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
