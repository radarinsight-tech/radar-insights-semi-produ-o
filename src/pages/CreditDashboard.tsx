import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, LogOut, BarChart3, ShieldAlert, DollarSign, Users, Scale, FileText, PenLine, TrendingUp, Filter, Download } from "lucide-react";
import logoSymbol from "@/assets/logo-symbol.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { subDays, startOfMonth, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

// ── Types ──
interface CreditEntry {
  id: string;
  created_at: string;
  cpf_cnpj: string;
  doc_type: string;
  nome: string | null;
  user_name: string | null;
  decisao_final: string | null;
  regra_aplicada: string | null;
  observacoes: string | null;
  status: string;
  resultado: any;
  ajuste_manual: boolean;
  faixa_original: string | null;
  motivo_ajuste: string | null;
  observacao_ajuste: string | null;
  usuario_ajuste: string | null;
  data_ajuste: string | null;
}

// ── Helpers ──
const normalizeFaixa = (d: string | null): string => {
  if (!d) return "";
  const upper = d.toUpperCase().trim();
  if (upper === "ISENTAR" || upper === "ISENTA") return "ISENTAR";
  if (upper.includes("1000")) return "TAXA_R$1000";
  if (upper.includes("100")) return "TAXA_R$100";
  if (upper.includes("200")) return "TAXA_R$200";
  if (upper.includes("300") || upper.includes("400")) return "TAXA_R$300";
  return "";
};

const faixaLabel: Record<string, string> = {
  "ISENTAR": "Isenção",
  "TAXA_R$100": "R$ 100",
  "TAXA_R$200": "R$ 200",
  "TAXA_R$300": "R$ 300",
  "TAXA_R$1000": "R$ 1.000",
};

const faixaValue: Record<string, number> = {
  "ISENTAR": 0, "TAXA_R$100": 100, "TAXA_R$200": 200, "TAXA_R$300": 300, "TAXA_R$1000": 1000,
};

const faixaWeight: Record<string, number> = {
  "ISENTAR": 0, "TAXA_R$100": 1, "TAXA_R$200": 2, "TAXA_R$300": 3, "TAXA_R$1000": 4,
};

const faixaColors: Record<string, string> = {
  "ISENTAR": "hsl(160, 84%, 39%)",
  "TAXA_R$100": "hsl(38, 92%, 60%)",
  "TAXA_R$200": "hsl(38, 92%, 50%)",
  "TAXA_R$300": "hsl(0, 84%, 70%)",
  "TAXA_R$1000": "hsl(0, 84%, 60%)",
};

const faixaTailwind: Record<string, string> = {
  "ISENTAR": "bg-accent text-accent-foreground",
  "TAXA_R$100": "bg-warning/80 text-warning-foreground",
  "TAXA_R$200": "bg-warning text-warning-foreground",
  "TAXA_R$300": "bg-destructive/80 text-destructive-foreground",
  "TAXA_R$1000": "bg-destructive text-destructive-foreground",
};

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatCpfCnpj = (value: string, type: string) => {
  if (type === "CNPJ" && value.length === 14)
    return `${value.slice(0,2)}.${value.slice(2,5)}.${value.slice(5,8)}/${value.slice(8,12)}-${value.slice(12)}`;
  if (value.length === 11)
    return `${value.slice(0,3)}.${value.slice(3,6)}.${value.slice(6,9)}-${value.slice(9)}`;
  return value;
};

const getTaxaTotal = (entry: CreditEntry): number => {
  const r = entry.resultado;
  if (r?.taxa_total !== undefined && r.taxa_total !== null) return r.taxa_total;
  const faixa = normalizeFaixa(entry.decisao_final);
  return faixaValue[faixa] ?? 0;
};

// ── Period presets ──
type PeriodPreset = "hoje" | "7dias" | "30dias" | "mes" | "custom";

const getDateRange = (preset: PeriodPreset): { start: Date; end: Date } | null => {
  const now = new Date();
  switch (preset) {
    case "hoje": return { start: startOfDay(now), end: endOfDay(now) };
    case "7dias": return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case "30dias": return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case "mes": return { start: startOfMonth(now), end: endOfDay(now) };
    default: return null;
  }
};

// ── Component ──
const CreditDashboard = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState<PeriodPreset>("30dias");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterUsuario, setFilterUsuario] = useState("todos");
  const [filterFaixa, setFilterFaixa] = useState("todos");
  const [filterRegra, setFilterRegra] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [onlyAjustes, setOnlyAjustes] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("credit_analyses" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any;
      if (!error) setEntries(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    let dateFilter: { start: Date; end: Date } | null = null;
    if (period === "custom" && customRange?.from && customRange?.to) {
      dateFilter = { start: startOfDay(customRange.from), end: endOfDay(customRange.to) };
    } else if (period !== "custom") {
      dateFilter = getDateRange(period);
    }

    return entries.filter((e) => {
      if (dateFilter) {
        const d = new Date(e.created_at);
        if (!isWithinInterval(d, dateFilter)) return false;
      }
      if (filterUsuario !== "todos" && e.user_name !== filterUsuario) return false;
      if (filterFaixa !== "todos" && normalizeFaixa(e.decisao_final) !== filterFaixa) return false;
      if (filterRegra !== "todos" && e.regra_aplicada !== filterRegra) return false;
      if (filterStatus !== "todos" && e.status !== filterStatus) return false;
      if (onlyAjustes && !e.ajuste_manual) return false;
      return true;
    });
  }, [entries, period, customRange, filterUsuario, filterFaixa, filterRegra, filterStatus, onlyAjustes]);

  // Derived data
  const usuarios = useMemo(() => [...new Set(entries.map(e => e.user_name).filter(Boolean))] as string[], [entries]);
  const regras = useMemo(() => [...new Set(entries.map(e => e.regra_aplicada).filter(Boolean))] as string[], [entries]);

  // Stats
  const stats = useMemo(() => {
    const faixaCounts: Record<string, number> = { ISENTAR: 0, "TAXA_R$100": 0, "TAXA_R$200": 0, "TAXA_R$300": 0, "TAXA_R$1000": 0 };
    let totalTaxas = 0;
    let ajustes = 0;
    let totalWeight = 0;

    for (const e of filtered) {
      const f = normalizeFaixa(e.decisao_final);
      if (f in faixaCounts) faixaCounts[f]++;
      totalTaxas += getTaxaTotal(e);
      if (e.ajuste_manual) ajustes++;
      totalWeight += faixaWeight[f] ?? 0;
    }

    const total = filtered.length;
    const ticketMedio = total > 0 ? totalTaxas / total : 0;
    const avgWeight = total > 0 ? totalWeight / total : 0;

    let risco: { label: string; color: string; bg: string } = { label: "Baixo", color: "text-accent", bg: "bg-accent/10" };
    if (avgWeight >= 3) risco = { label: "Crítico", color: "text-destructive", bg: "bg-destructive/10" };
    else if (avgWeight >= 2) risco = { label: "Alto", color: "text-destructive/80", bg: "bg-destructive/5" };
    else if (avgWeight >= 1) risco = { label: "Moderado", color: "text-warning", bg: "bg-warning/10" };

    // Dominant faixa
    const faixaDominante = Object.entries(faixaCounts).reduce((a, b) => b[1] > a[1] ? b : a, ["", 0]);

    return { total, faixaCounts, totalTaxas, ajustes, ticketMedio, risco, faixaDominante: faixaDominante[0], comCobranca: total - faixaCounts.ISENTAR };
  }, [filtered]);

  // Chart data
  const chartData = useMemo(() => {
    const ordered = ["ISENTAR", "TAXA_R$100", "TAXA_R$200", "TAXA_R$300", "TAXA_R$1000"];
    return ordered.map(f => ({
      name: faixaLabel[f] || f,
      quantidade: stats.faixaCounts[f] || 0,
      valor: (stats.faixaCounts[f] || 0) * (faixaValue[f] || 0),
      fill: faixaColors[f],
    }));
  }, [stats]);

  // Audit data
  const auditData = useMemo(() => {
    const ajustes = filtered.filter(e => e.ajuste_manual);
    const motivoCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    for (const a of ajustes) {
      if (a.motivo_ajuste) motivoCounts[a.motivo_ajuste] = (motivoCounts[a.motivo_ajuste] || 0) + 1;
      if (a.usuario_ajuste) userCounts[a.usuario_ajuste] = (userCounts[a.usuario_ajuste] || 0) + 1;
    }

    const topMotivo = Object.entries(motivoCounts).sort((a, b) => b[1] - a[1])[0];
    const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      total: ajustes.length,
      pct: filtered.length > 0 ? ((ajustes.length / filtered.length) * 100).toFixed(1) : "0",
      ultimos: ajustes.slice(0, 5),
      topMotivo: topMotivo ? topMotivo[0] : "—",
      topUser: topUser ? topUser[0] : "—",
    };
  }, [filtered]);

  // User performance
  const userPerf = useMemo(() => {
    const map: Record<string, { total: number; faixas: Record<string, number>; ajustes: number; valor: number }> = {};
    for (const e of filtered) {
      const u = e.user_name || "Desconhecido";
      if (!map[u]) map[u] = { total: 0, faixas: { ISENTAR: 0, "TAXA_R$100": 0, "TAXA_R$200": 0, "TAXA_R$300": 0, "TAXA_R$1000": 0 }, ajustes: 0, valor: 0 };
      map[u].total++;
      const f = normalizeFaixa(e.decisao_final);
      if (f in map[u].faixas) map[u].faixas[f]++;
      map[u].valor += getTaxaTotal(e);
      if (e.ajuste_manual) map[u].ajustes++;
    }
    return Object.entries(map).map(([name, d]) => ({
      name, ...d, ticketMedio: d.total > 0 ? d.valor / d.total : 0,
    })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Rules breakdown
  const regraStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filtered) {
      const r = e.regra_aplicada || "Não definida";
      map[r] = (map[r] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background" data-module="credit">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Radar Insight — <span className="text-primary">Painel de Gestão de Crédito</span>
              </h1>
              <p className="text-xs text-muted-foreground">Visão consolidada da operação de análise de crédito</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/credit")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Análise
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Hub
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* ── Filters ── */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Filtros</span>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
                <SelectTrigger className="w-[160px] bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7dias">7 dias</SelectItem>
                  <SelectItem value="30dias">30 dias</SelectItem>
                  <SelectItem value="mes">Mês atual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === "custom" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Intervalo</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal bg-card", !customRange?.from && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customRange?.from ? (customRange.to ? `${format(customRange.from, "dd/MM/yy")} — ${format(customRange.to, "dd/MM/yy")}` : `${format(customRange.from, "dd/MM/yy")} — ...`) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" selected={customRange} onSelect={(r) => { setCustomRange(r); if (r?.from && r?.to) setCalendarOpen(false); }} locale={ptBR} numberOfMonths={2} className={cn("p-3 pointer-events-auto")} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Usuário</Label>
              <Select value={filterUsuario} onValueChange={setFilterUsuario}>
                <SelectTrigger className="w-[160px] bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {usuarios.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Faixa final</Label>
              <Select value={filterFaixa} onValueChange={setFilterFaixa}>
                <SelectTrigger className="w-[140px] bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="ISENTAR">Isenção</SelectItem>
                  <SelectItem value="TAXA_R$100">R$ 100</SelectItem>
                  <SelectItem value="TAXA_R$200">R$ 200</SelectItem>
                  <SelectItem value="TAXA_R$300">R$ 300</SelectItem>
                  <SelectItem value="TAXA_R$1000">R$ 1.000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Regra</Label>
              <Select value={filterRegra} onValueChange={setFilterRegra}>
                <SelectTrigger className="w-[200px] bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {regras.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="nova_consulta">Nova</SelectItem>
                  <SelectItem value="reanalise">Reanálise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              <Switch checked={onlyAjustes} onCheckedChange={setOnlyAjustes} id="ajustes" />
              <Label htmlFor="ajustes" className="text-xs font-medium text-muted-foreground cursor-pointer">Somente ajustes</Label>
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className="p-12 text-center text-muted-foreground">Carregando dados...</Card>
        ) : (
          <>
            {/* ── Main KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiCard label="Total de Análises" value={stats.total} icon={<BarChart3 className="h-4 w-4" />} />
              <KpiCard label="Isenções" value={stats.faixaCounts.ISENTAR} icon={<ShieldAlert className="h-4 w-4" />} accent="accent" />
              <KpiCard label="Ajustes Manuais" value={stats.ajustes} icon={<PenLine className="h-4 w-4" />} />
              <KpiCard label="Valor Total Taxas" value={formatCurrency(stats.totalTaxas)} icon={<DollarSign className="h-4 w-4" />} accent="primary" />
              <KpiCard label="Ticket Médio" value={formatCurrency(stats.ticketMedio)} icon={<TrendingUp className="h-4 w-4" />} />
            </div>

            {/* Faixa cards row */}
            <div className="grid grid-cols-5 gap-3">
              {(["ISENTAR", "TAXA_R$100", "TAXA_R$200", "TAXA_R$300", "TAXA_R$1000"] as const).map(f => (
                <Card key={f} className="p-3 text-center">
                  <p className="text-xs text-muted-foreground font-medium">{faixaLabel[f]}</p>
                  <p className="text-2xl font-bold text-foreground">{stats.faixaCounts[f]}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(stats.faixaCounts[f] * faixaValue[f])}</p>
                </Card>
              ))}
            </div>

            {/* ── Risk + Dominant + Distribution ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Risk indicator */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Risco Operacional
                </h3>
                <div className={`rounded-lg p-4 text-center ${stats.risco.bg}`}>
                  <p className={`text-3xl font-bold ${stats.risco.color}`}>{stats.risco.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">Índice ponderado: {filtered.length > 0 ? (filtered.reduce((s, e) => s + (faixaWeight[normalizeFaixa(e.decisao_final)] ?? 0), 0) / filtered.length).toFixed(2) : "0.00"}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Faixa dominante</p>
                  <Badge className={cn("mt-1", faixaTailwind[stats.faixaDominante] || "bg-secondary")}>
                    {faixaLabel[stats.faixaDominante] || "—"}
                  </Badge>
                </div>
              </Card>

              {/* Distribution chart */}
              <Card className="p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Distribuição por Faixa
                </h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, name: string) => [name === "valor" ? formatCurrency(v) : v, name === "valor" ? "Valor" : "Quantidade"]}
                      />
                      <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                        {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* ── Revenue + Audit ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Arrecadação
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valor total do período</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(stats.totalTaxas)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Análises com cobrança</span>
                    <span className="text-sm font-semibold">{stats.comCobranca}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Isenções</span>
                    <span className="text-sm font-semibold">{stats.faixaCounts.ISENTAR}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ticket médio</span>
                    <span className="text-sm font-semibold">{formatCurrency(stats.ticketMedio)}</span>
                  </div>
                  <div className="border-t border-border pt-3 space-y-1.5">
                    {(["TAXA_R$100", "TAXA_R$200", "TAXA_R$300", "TAXA_R$1000"] as const).map(f => (
                      <div key={f} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{faixaLabel[f]}</span>
                        <span className="font-medium">{formatCurrency(stats.faixaCounts[f] * faixaValue[f])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Audit */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-primary" />
                  Auditoria Manual
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg bg-secondary p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total ajustes</p>
                    <p className="text-2xl font-bold text-foreground">{auditData.total}</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3 text-center">
                    <p className="text-xs text-muted-foreground">% das análises</p>
                    <p className="text-2xl font-bold text-foreground">{auditData.pct}%</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quem mais ajustou</span>
                    <span className="font-medium">{auditData.topUser}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Motivo mais frequente</span>
                    <span className="font-medium">{auditData.topMotivo}</span>
                  </div>
                </div>
                {auditData.ultimos.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Últimos ajustes</p>
                    <div className="space-y-1.5">
                      {auditData.ultimos.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1.5">
                          <span className="font-medium truncate max-w-[140px]">{a.nome || a.cpf_cnpj}</span>
                          <Badge variant="outline" className="text-[10px]">{a.faixa_original} → {normalizeFaixa(a.decisao_final) ? faixaLabel[normalizeFaixa(a.decisao_final)] : a.decisao_final}</Badge>
                          <span className="text-muted-foreground">{a.usuario_ajuste}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* ── User Performance ── */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Desempenho por Usuário
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Isenção</TableHead>
                      <TableHead className="text-center">R$100</TableHead>
                      <TableHead className="text-center">R$200</TableHead>
                      <TableHead className="text-center">R$300</TableHead>
                      <TableHead className="text-center">R$1.000</TableHead>
                      <TableHead className="text-center">Ajustes</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userPerf.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhum dado</TableCell></TableRow>
                    ) : userPerf.map((u) => (
                      <TableRow key={u.name}>
                        <TableCell className="font-medium text-sm">{u.name}</TableCell>
                        <TableCell className="text-center text-sm">{u.total}</TableCell>
                        <TableCell className="text-center text-sm">{u.faixas.ISENTAR}</TableCell>
                        <TableCell className="text-center text-sm">{u.faixas["TAXA_R$100"]}</TableCell>
                        <TableCell className="text-center text-sm">{u.faixas["TAXA_R$200"]}</TableCell>
                        <TableCell className="text-center text-sm">{u.faixas["TAXA_R$300"]}</TableCell>
                        <TableCell className="text-center text-sm">{u.faixas["TAXA_R$1000"]}</TableCell>
                        <TableCell className="text-center text-sm">{u.ajustes}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{formatCurrency(u.valor)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(u.ticketMedio)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* ── Rules Breakdown ── */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                Regras Aplicadas
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {regraStats.map(([regra, count]) => (
                  <div key={regra} className="rounded-lg bg-secondary p-3 text-center">
                    <p className="text-xs text-muted-foreground font-medium truncate" title={regra}>{regra}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{count}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Detailed Table ── */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Tabela Detalhada ({filtered.length} registros)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Faixa Final</TableHead>
                      <TableHead>Regra</TableHead>
                      <TableHead className="text-right">Taxa Análise</TableHead>
                      <TableHead className="text-right">Taxa Instalação</TableHead>
                      <TableHead className="text-right">Taxa Total</TableHead>
                      <TableHead>Ajuste</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
                    ) : filtered.map((e) => {
                      const r = e.resultado || {};
                      const hasProtesto = r.possui_protesto;
                      const noDoc = r.documento_em_nome_do_contratante === false;
                      const is1000 = normalizeFaixa(e.decisao_final) === "TAXA_R$1000";
                      const rowHighlight = e.ajuste_manual ? "bg-primary/5" : is1000 ? "bg-destructive/5" : hasProtesto ? "bg-warning/5" : "";

                      return (
                        <TableRow key={e.id} className={rowHighlight}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-xs font-medium max-w-[150px] truncate">
                            {e.nome || "—"}
                            {hasProtesto && <Badge variant="outline" className="ml-1 text-[9px] border-warning text-warning">Protesto</Badge>}
                            {noDoc && <Badge variant="outline" className="ml-1 text-[9px] border-muted-foreground">S/ doc</Badge>}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{formatCpfCnpj(e.cpf_cnpj, e.doc_type)}</TableCell>
                          <TableCell className="text-xs">{e.user_name || "—"}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px]", faixaTailwind[normalizeFaixa(e.decisao_final)] || "bg-secondary")}>
                              {faixaLabel[normalizeFaixa(e.decisao_final)] || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{e.regra_aplicada || "—"}</TableCell>
                          <TableCell className="text-xs text-right">{r.taxa_analise_credito !== undefined ? formatCurrency(r.taxa_analise_credito) : "—"}</TableCell>
                          <TableCell className="text-xs text-right">{r.taxa_instalacao !== undefined ? formatCurrency(r.taxa_instalacao) : "—"}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{formatCurrency(getTaxaTotal(e))}</TableCell>
                          <TableCell className="text-xs">
                            {e.ajuste_manual ? <Badge className="bg-primary/20 text-primary text-[9px]">Sim</Badge> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{e.motivo_ajuste || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary" className="text-[10px]">{e.status === "reanalise" ? "Reanálise" : "Nova"}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

// ── Sub-components ──
const KpiCard = ({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent?: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 mb-1">
      <span className={accent ? `text-${accent}` : "text-muted-foreground"}>{icon}</span>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
    </div>
    <p className={`text-2xl font-bold ${accent ? `text-${accent}` : "text-foreground"}`}>{value}</p>
  </Card>
);

export default CreditDashboard;
