import { useMemo } from "react";
import { notaToScale10 } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { TrendingUp } from "lucide-react";
import type { HistoryEntry } from "@/lib/mockData";

interface Props {
  entries: HistoryEntry[];
}

const chartConfig: ChartConfig = {
  media: { label: "Média", color: "hsl(var(--primary))" },
  count: { label: "Avaliações", color: "hsl(var(--accent))" },
};

const ScoreEvolutionChart = ({ entries }: Props) => {
  const monthlyData = useMemo(() => {
    const byMonth: Record<string, { sum: number; count: number }> = {};

    entries.forEach((e) => {
      const parts = e.data.split("/");
      if (parts.length < 3) return;
      const key = `${parts[1]}/${parts[2]}`;
      if (!byMonth[key]) byMonth[key] = { sum: 0, count: 0 };
      byMonth[key].sum += e.nota;
      byMonth[key].count += 1;
    });

    return Object.entries(byMonth)
      .map(([month, { sum, count }]) => ({
        month,
        media: +(sum / count).toFixed(1),
        count,
      }))
      .sort((a, b) => {
        const [mA, yA] = a.month.split("/").map(Number);
        const [mB, yB] = b.month.split("/").map(Number);
        return yA !== yB ? yA - yB : mA - mB;
      });
  }, [entries]);

  const agentData = useMemo(() => {
    const byAgent: Record<string, { sum: number; count: number }> = {};
    entries.forEach((e) => {
      if (!byAgent[e.atendente]) byAgent[e.atendente] = { sum: 0, count: 0 };
      byAgent[e.atendente].sum += e.nota;
      byAgent[e.atendente].count += 1;
    });
    return Object.entries(byAgent)
      .map(([name, { sum, count }]) => ({
        name,
        media: +(sum / count).toFixed(1),
      }))
      .sort((a, b) => b.media - a.media);
  }, [entries]);

  if (entries.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground text-center">Sem dados para exibir gráficos</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Line chart – score evolution over time */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary/80">Evolução da Nota Média</p>
        </div>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="media"
              stroke="var(--color-media)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </Card>

      {/* Bar chart – average by agent */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-accent/10">
            <TrendingUp className="h-4 w-4 text-accent" />
          </div>
          <p className="text-sm font-semibold text-primary/80">Média por Atendente</p>
        </div>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={agentData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="media" fill="var(--color-media)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </Card>
    </div>
  );
};

export default ScoreEvolutionChart;
