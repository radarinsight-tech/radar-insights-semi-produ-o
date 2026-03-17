import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Users, BarChart3 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from "recharts";

interface ChartFile {
  name: string;
  atendente?: string;
  data?: string;
  analyzedAt?: Date;
  result?: {
    notaFinal?: number;
    classificacao?: string;
    atendente?: string;
    data?: string;
  };
}

interface MentoriaChartsProps {
  files: ChartFile[];
}

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  }
  return null;
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function formatDayMonth(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
];

const MentoriaCharts = ({ files }: MentoriaChartsProps) => {
  const [period, setPeriod] = useState<"dia" | "mes">("dia");
  const analyzed = useMemo(() => files.filter(f => f.result && typeof f.result.notaFinal === "number"), [files]);

  // ── 1. Score evolution over time ──
  const scoreEvolution = useMemo(() => {
    const items = analyzed.map(f => {
      const date = f.analyzedAt || parseDate(f.result?.data || f.data);
      return { date, nota: f.result!.notaFinal! };
    }).filter(i => i.date !== null) as { date: Date; nota: number }[];

    items.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (period === "dia") {
      const grouped = new Map<string, number[]>();
      items.forEach(i => {
        const key = formatDayMonth(i.date);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(i.nota);
      });
      return [...grouped.entries()].map(([label, notas]) => ({
        label,
        media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
        total: notas.length,
      }));
    } else {
      const grouped = new Map<string, number[]>();
      items.forEach(i => {
        const key = formatMonthYear(i.date);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(i.nota);
      });
      return [...grouped.entries()].map(([label, notas]) => ({
        label,
        media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
        total: notas.length,
      }));
    }
  }, [analyzed, period]);

  // ── 2. Performance by atendente ──
  const atendentePerformance = useMemo(() => {
    const map = new Map<string, number[]>();
    analyzed.forEach(f => {
      const name = f.result?.atendente || f.atendente || "Não identificado";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(f.result!.notaFinal!);
    });
    return [...map.entries()].map(([name, notas]) => ({
      name: name.length > 15 ? name.slice(0, 14) + "…" : name,
      fullName: name,
      media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
      total: notas.length,
    })).sort((a, b) => b.media - a.media);
  }, [analyzed]);

  // ── 3. Audit volume over time ──
  const auditVolume = useMemo(() => {
    const items = analyzed.map(f => {
      const date = f.analyzedAt || parseDate(f.result?.data || f.data);
      return date;
    }).filter(Boolean) as Date[];

    items.sort((a, b) => a.getTime() - b.getTime());

    if (period === "dia") {
      const grouped = new Map<string, number>();
      items.forEach(d => {
        const key = formatDayMonth(d);
        grouped.set(key, (grouped.get(key) || 0) + 1);
      });
      return [...grouped.entries()].map(([label, count]) => ({ label, count }));
    } else {
      const grouped = new Map<string, number>();
      items.forEach(d => {
        const key = formatMonthYear(d);
        grouped.set(key, (grouped.get(key) || 0) + 1);
      });
      return [...grouped.entries()].map(([label, count]) => ({ label, count }));
    }
  }, [analyzed, period]);

  if (analyzed.length < 2) {
    return null; // Need at least 2 analyses for charts
  }

  const globalMedia = Math.round((analyzed.reduce((s, f) => s + f.result!.notaFinal!, 0) / analyzed.length) * 10) / 10;

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Gráficos de Evolução
        </h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as "dia" | "mes")}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Por dia</SelectItem>
            <SelectItem value="mes">Por mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chart 1: Score evolution */}
      <Card className="p-5 rounded-xl border-border/60 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Evolução da Nota Média</h4>
          <Badge variant="outline" className="ml-auto text-[10px]">Média: {globalMedia.toFixed(1).replace(".", ",")}</Badge>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [value.toFixed(1).replace(".", ","), "Nota média"]}
              />
              <ReferenceLine y={7} stroke="hsl(var(--accent))" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line
                type="monotone"
                dataKey="media"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Chart 2: Performance by atendente */}
      {atendentePerformance.length > 1 && (
        <Card className="p-5 rounded-xl border-border/60 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Performance por Atendente</h4>
            <Badge variant="outline" className="ml-auto text-[10px]">{atendentePerformance.length} atendentes</Badge>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={atendentePerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value.toFixed(1).replace(".", ",")} (${props.payload.total} atend.)`,
                    "Nota média",
                  ]}
                />
                <ReferenceLine x={7} stroke="hsl(var(--accent))" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Bar dataKey="media" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {atendentePerformance.map((entry, i) => (
                    <Cell
                      key={entry.fullName}
                      fill={entry.media >= 7 ? "hsl(var(--accent))" : entry.media >= 5 ? "hsl(var(--warning))" : "hsl(var(--destructive))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Chart 3: Audit volume */}
      <Card className="p-5 rounded-xl border-border/60 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Volume de Auditorias</h4>
          <Badge variant="outline" className="ml-auto text-[10px]">{analyzed.length} total</Badge>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={auditVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [value, "Auditorias"]}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default MentoriaCharts;
