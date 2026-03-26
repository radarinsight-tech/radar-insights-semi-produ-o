import { useMemo, useState, useRef } from "react";
import { format } from "date-fns";
import { notaToScale10 } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { TrendingUp, Users, BarChart3, CalendarIcon, Printer, Eye } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from "recharts";

interface ChartFile {
  name: string;
  atendente?: string;
  data?: string;
  analyzedAt?: Date;
  nonEvaluable?: boolean;
  ineligible?: boolean;
  result?: {
    notaFinal?: number;
    classificacao?: string;
    atendente?: string;
    data?: string;
  };
}

interface MentoriaChartsProps {
  files: ChartFile[];
  excludedAttendants?: Set<string>;
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

type PeriodMode = "dia" | "mes" | "personalizado";

const MentoriaCharts = ({ files, excludedAttendants }: MentoriaChartsProps) => {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("dia");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [appliedRange, setAppliedRange] = useState<{ from?: Date; to?: Date }>({});
  const [appliedPeriod, setAppliedPeriod] = useState<PeriodMode>("dia");
  const chartsRef = useRef<HTMLDivElement>(null);

  const allAnalyzed = useMemo(() => files.filter(f => {
    if (!f.result || typeof f.result.notaFinal !== "number" || f.nonEvaluable || f.ineligible) return false;
    if (excludedAttendants?.size) {
      const name = (f.result?.atendente || f.atendente || "").trim();
      if (excludedAttendants.has(name)) return false;
    }
    return true;
  }), [files, excludedAttendants]);

  // Apply date filter
  const analyzed = useMemo(() => {
    if (appliedPeriod !== "personalizado" || !appliedRange.from) return allAnalyzed;
    return allAnalyzed.filter(f => {
      const date = f.analyzedAt || parseDate(f.result?.data || f.data);
      if (!date) return false;
      if (appliedRange.from && date < appliedRange.from) return false;
      if (appliedRange.to) {
        const end = new Date(appliedRange.to);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
      return true;
    });
  }, [allAnalyzed, appliedRange, appliedPeriod]);

  // Use appliedPeriod for grouping (dia/mes); custom always uses "dia"
  const groupBy = appliedPeriod === "mes" ? "mes" : "dia";

  // ── 1. Score evolution over time ──
  const scoreEvolution = useMemo(() => {
    const items = analyzed.map(f => {
      const date = f.analyzedAt || parseDate(f.result?.data || f.data);
      return { date, nota: notaToScale10(f.result!.notaFinal!) };
    }).filter(i => i.date !== null) as { date: Date; nota: number }[];

    items.sort((a, b) => a.date.getTime() - b.date.getTime());

    const fmt = groupBy === "dia" ? formatDayMonth : formatMonthYear;
    const grouped = new Map<string, number[]>();
    items.forEach(i => {
      const key = fmt(i.date);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(i.nota);
    });
    return [...grouped.entries()].map(([label, notas]) => ({
      label,
      media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
      total: notas.length,
    }));
  }, [analyzed, groupBy]);

  // ── 2. Performance by atendente ──
  const atendentePerformance = useMemo(() => {
    const map = new Map<string, number[]>();
    analyzed.forEach(f => {
      const name = f.result?.atendente || f.atendente || "Não identificado";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(notaToScale10(f.result!.notaFinal!));
    });
    return [...map.entries()].map(([name, notas]) => ({
      name: name.length > 15 ? name.slice(0, 14) + "…" : name,
      fullName: name,
      media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
      total: notas.length,
      insuficiente: notas.length < 6,
    })).sort((a, b) => b.media - a.media);
  }, [analyzed]);

  // ── 3. Audit volume over time ──
  const auditVolume = useMemo(() => {
    const items = analyzed.map(f => {
      const date = f.analyzedAt || parseDate(f.result?.data || f.data);
      return date;
    }).filter(Boolean) as Date[];

    items.sort((a, b) => a.getTime() - b.getTime());

    const fmt = groupBy === "dia" ? formatDayMonth : formatMonthYear;
    const grouped = new Map<string, number>();
    items.forEach(d => {
      const key = fmt(d);
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return [...grouped.entries()].map(([label, count]) => ({ label, count }));
  }, [analyzed, groupBy]);

  const handleApply = () => {
    setAppliedPeriod(periodMode);
    setAppliedRange(periodMode === "personalizado" ? customRange : {});
  };

  const handlePrint = () => {
    if (!chartsRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Clone SVGs as inline
    const clone = chartsRef.current.cloneNode(true) as HTMLElement;

    const rangeLabel = appliedPeriod === "personalizado" && appliedRange.from
      ? `${format(appliedRange.from, "dd/MM/yyyy")}${appliedRange.to ? ` — ${format(appliedRange.to, "dd/MM/yyyy")}` : ""}`
      : appliedPeriod === "mes" ? "Agrupado por mês" : "Agrupado por dia";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Gráficos de Evolução — Mentoria Lab</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a1a; padding: 0; }
        .print-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 2px solid #111; margin-bottom: 16px; }
        .print-title { font-size: 14px; font-weight: 800; }
        .print-meta { font-size: 9px; color: #6b7280; text-align: right; }
        .chart-section { page-break-inside: avoid; margin-bottom: 20px; }
        .chart-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; margin-bottom: 8px; }
        svg { max-width: 100%; height: auto; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>
        <div class="print-header">
          <div>
            <p class="print-title">Radar Insight — Gráficos de Evolução</p>
            <p style="font-size:9px;color:#9ca3af;margin-top:2px;">Período: ${rangeLabel} · ${analyzed.length} auditorias</p>
          </div>
          <div class="print-meta">
            <p>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
        ${clone.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  if (allAnalyzed.length < 2) {
    return null;
  }

  const globalMedia = analyzed.length > 0
    ? Math.round(analyzed.reduce((s, f) => s + notaToScale10(f.result!.notaFinal!), 0) / analyzed.length * 10) / 10
    : 0;

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  };

  return (
    <div className="space-y-4">
      {/* ═══ TOOLBAR: Period filter + actions ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mr-auto">
          <BarChart3 className="h-4 w-4 text-primary" />
          Gráficos de Evolução
          {analyzed.length !== allAnalyzed.length && (
            <Badge variant="outline" className="text-[10px] ml-1">{analyzed.length} de {allAnalyzed.length}</Badge>
          )}
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as PeriodMode)}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Por dia</SelectItem>
              <SelectItem value="mes">Por mês</SelectItem>
              <SelectItem value="personalizado">Período personalizado</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom date range picker */}
          {periodMode === "personalizado" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5 w-[210px] justify-start", !customRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customRange.from
                    ? customRange.to
                      ? `${format(customRange.from, "dd/MM/yy")} — ${format(customRange.to, "dd/MM/yy")}`
                      : `${format(customRange.from, "dd/MM/yy")} — ...`
                    : "Selecione o período"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customRange.from ? { from: customRange.from, to: customRange.to } : undefined}
                  onSelect={(range) => setCustomRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Visualizar */}
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleApply}
          >
            <Eye className="h-3.5 w-3.5" />
            Visualizar
          </Button>

          {/* Imprimir */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Active filter indicator */}
      {appliedPeriod === "personalizado" && appliedRange.from && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-1.5 border border-border">
          <CalendarIcon className="h-3 w-3" />
          <span>Filtro ativo: {format(appliedRange.from, "dd/MM/yyyy")}{appliedRange.to ? ` — ${format(appliedRange.to, "dd/MM/yyyy")}` : ""}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] ml-auto"
            onClick={() => { setAppliedRange({}); setAppliedPeriod("dia"); setPeriodMode("dia"); }}
          >
            Limpar
          </Button>
        </div>
      )}

      {analyzed.length === 0 && appliedPeriod === "personalizado" ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="text-sm">Nenhuma auditoria encontrada no período selecionado.</p>
          <p className="text-xs mt-1">Ajuste o filtro de datas ou selecione outro período.</p>
        </Card>
      ) : (
        <div ref={chartsRef} className="space-y-4">
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value.toFixed(1).replace(".", ","), "Nota média"]} />
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
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, _name: string, props: any) => [
                        `${value.toFixed(1).replace(".", ",")} (${props.payload.total} atend.)${props.payload.insuficiente ? " · Amostragem insuficiente" : ""}`,
                        "Nota média",
                      ]}
                    />
                    <ReferenceLine x={7} stroke="hsl(var(--accent))" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Bar dataKey="media" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {atendentePerformance.map((entry) => (
                        <Cell
                          key={entry.fullName}
                          fill={entry.insuficiente ? "hsl(var(--muted-foreground))" : entry.media >= 7 ? "hsl(var(--accent))" : entry.media >= 5 ? "hsl(var(--warning))" : "hsl(var(--destructive))"}
                          opacity={entry.insuficiente ? 0.4 : 1}
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Auditorias"]} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MentoriaCharts;
