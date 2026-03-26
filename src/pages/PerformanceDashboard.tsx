import { useState, useEffect, useMemo, useCallback } from "react";
import { useExcludedAttendants } from "@/hooks/useExcludedAttendants";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, LogOut, BarChart3, Users2, TrendingUp, AlertTriangle,
  ChevronDown, ChevronUp, Crown, Medal, Award, Target, Zap,
  Loader2, Search, Trophy, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import logoSymbol from "@/assets/logo-symbol.png";
import {
  scoreFromFullReport, analyzeCriteriaFailures,
  type ScoringResult, type CriterionFailureRate,
} from "@/lib/mentoriaScoring";
import { calcularBonus, formatBRL, notaToScale10, formatNota } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie,
} from "recharts";

/* ─── Types ─── */
interface EvalRow {
  id: string;
  atendente: string;
  nota: number;
  data: string;
  protocolo: string;
  tipo: string;
  full_report: any;
  data_avaliacao: string;
  excluded_from_ranking: boolean;
}

/* ─── Official Bonus Tiers (0-10 scale, cap R$1.200) ─── */
const BONUS_TIERS = [
  { label: "Excelente / Referência", min: 9.5, max: 10.0, pct: 100, valor: 1200, color: "hsl(270 60% 55%)", textCls: "text-purple-600", bgCls: "bg-purple-500/10 border-purple-500/20", dotCls: "bg-purple-500" },
  { label: "Muito bom", min: 8.5, max: 9.4, pct: 90, valor: 1080, color: "hsl(var(--accent))", textCls: "text-accent", bgCls: "bg-accent/10 border-accent/20", dotCls: "bg-accent" },
  { label: "Bom atendimento", min: 7.0, max: 8.4, pct: 70, valor: 840, color: "hsl(var(--primary))", textCls: "text-primary", bgCls: "bg-primary/10 border-primary/20", dotCls: "bg-primary" },
  { label: "Em desenvolvimento", min: 5.0, max: 6.9, pct: 30, valor: 360, color: "hsl(var(--warning))", textCls: "text-warning", bgCls: "bg-warning/10 border-warning/20", dotCls: "bg-warning" },
  { label: "Abaixo do esperado", min: 0, max: 4.9, pct: 0, valor: 0, color: "hsl(var(--destructive))", textCls: "text-destructive", bgCls: "bg-destructive/10 border-destructive/20", dotCls: "bg-destructive" },
] as const;

function getTier(nota10: number) {
  for (const t of BONUS_TIERS) {
    if (nota10 >= t.min) return t;
  }
  return BONUS_TIERS[BONUS_TIERS.length - 1];
}

interface AttendantPerf {
  name: string;
  totalAvaliacoes: number;
  notaMedia100: number;
  notaMedia10: number;
  tier: typeof BONUS_TIERS[number];
  scores: ScoringResult[];
  evalDates: string[];
  percentExcelente: number;
  percentAbaixo: number;
  bonusValor: number;
  bonusPct: number;
}

/* ─── Helpers ─── */
function parseEvalDate(data: string): Date | null {
  const br = data.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}

function getRankIcon(pos: number) {
  if (pos === 0) return <Crown className="h-4 w-4 text-yellow-500" />;
  if (pos === 1) return <Medal className="h-4 w-4 text-gray-400" />;
  if (pos === 2) return <Award className="h-4 w-4 text-amber-700" />;
  return <span className="text-xs text-muted-foreground font-bold">{pos + 1}º</span>;
}

const PERIOD_OPTIONS = [
  { value: "current", label: "Mês atual" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "last90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
];

/* ─── Component ─── */
const PerformanceDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [period, setPeriod] = useState("current");
  const [searchAttendant, setSearchAttendant] = useState("");
  const [expandedAttendant, setExpandedAttendant] = useState<string | null>(null);
  const { excludedSet } = useExcludedAttendants();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("evaluations")
      .select("id, atendente, nota, data, protocolo, tipo, full_report, data_avaliacao, excluded_from_ranking")
      .eq("resultado_validado", true)
      .eq("excluded_from_ranking", false)
      .order("data_avaliacao", { ascending: false });

    if (error) console.error("Error:", error);
    setEvals((data as EvalRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Filter by period
  const filteredEvals = useMemo(() => {
    const now = new Date();
    return evals.filter(e => {
      const d = parseEvalDate(e.data);
      if (!d) return false;
      if (period === "current") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      if (period === "last30") return d >= new Date(now.getTime() - 30 * 86400000);
      if (period === "last90") return d >= new Date(now.getTime() - 90 * 86400000);
      return true;
    });
  }, [evals, period]);

  // Score all evaluations
  const scoredEvals = useMemo(() => {
    return filteredEvals.map(e => ({
      ...e,
      score: scoreFromFullReport(e.full_report),
    })).filter(e => e.score !== null) as Array<EvalRow & { score: ScoringResult }>;
  }, [filteredEvals]);

  // Build attendant performance
  const attendants = useMemo((): AttendantPerf[] => {
    const grouped = new Map<string, Array<EvalRow & { score: ScoringResult }>>();
    for (const e of scoredEvals) {
      const name = e.atendente || "Não identificado";
      if (excludedSet.has(name)) continue;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(e);
    }

    return [...grouped.entries()].map(([name, evs]) => {
      const scores = evs.map(e => e.score);
      const notas100 = scores.map(s => s.nota100);
      const media100 = notas100.length > 0 ? notas100.reduce((a, b) => a + b, 0) / notas100.length : 0;
      const media10 = notaToScale10(media100);
      const tier = getTier(media10);
      const bonus = calcularBonus(media100);
      const excelente = notas100.filter(n => notaToScale10(n) >= 9.5).length;
      const abaixo = notas100.filter(n => notaToScale10(n) < 5.0).length;

      return {
        name,
        totalAvaliacoes: evs.length,
        notaMedia100: Math.round(media100 * 10) / 10,
        notaMedia10: media10,
        tier,
        scores,
        evalDates: evs.map(e => e.data),
        percentExcelente: evs.length > 0 ? Math.round((excelente / evs.length) * 100) : 0,
        percentAbaixo: evs.length > 0 ? Math.round((abaixo / evs.length) * 100) : 0,
        bonusValor: bonus.valor,
        bonusPct: bonus.percentual,
      };
    }).sort((a, b) => b.notaMedia10 - a.notaMedia10);
  }, [scoredEvals, excludedSet]);

  const filteredAttendants = useMemo(() => {
    if (!searchAttendant) return attendants;
    const q = searchAttendant.toLowerCase();
    return attendants.filter(a => a.name.toLowerCase().includes(q));
  }, [attendants, searchAttendant]);

  // Criteria failure analysis
  const criteriaFailures = useMemo(() => {
    return analyzeCriteriaFailures(filteredEvals.map(e => ({ full_report: e.full_report })));
  }, [filteredEvals]);

  // General stats with tier distribution
  const stats = useMemo(() => {
    const totalBonus = attendants.reduce((s, a) => s + a.bonusValor, 0);
    const avgNota10 = attendants.length > 0
      ? attendants.reduce((s, a) => s + a.notaMedia10, 0) / attendants.length : 0;

    const tierCounts = BONUS_TIERS.map(t => ({
      ...t,
      count: attendants.filter(a => a.tier.label === t.label).length,
    }));

    const topFailures = criteriaFailures.filter(c => c.taxaFalha > 30).slice(0, 5);

    return {
      totalAvaliacoes: scoredEvals.length,
      totalAtendentes: attendants.length,
      notaMediaGeral10: Math.round(avgNota10 * 10) / 10,
      tierGeral: getTier(Math.round(avgNota10 * 10) / 10),
      totalBonus,
      tierCounts,
      topFailures,
    };
  }, [scoredEvals, attendants, criteriaFailures]);

  // Chart data: ranking
  const rankingChartData = useMemo(() => {
    return filteredAttendants.slice(0, 15).map(a => ({
      name: a.name.split(" ").slice(0, 2).join(" "),
      nota: a.notaMedia10,
      color: a.tier.color,
    }));
  }, [filteredAttendants]);

  // Chart data: evolution by month
  const evolutionData = useMemo(() => {
    const monthMap = new Map<string, number[]>();
    for (const e of scoredEvals) {
      const d = parseEvalDate(e.data);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(e.score.nota10);
    }
    return [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, notas]) => ({
        mes: key,
        media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
        volume: notas.length,
      }));
  }, [scoredEvals]);

  // Pie chart data for tier distribution
  const pieData = useMemo(() => {
    return stats.tierCounts.filter(t => t.count > 0).map(t => ({
      name: t.label,
      value: t.count,
      fill: t.color,
    }));
  }, [stats.tierCounts]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Performance & Insights
            </h1>
            <p className="text-xs text-muted-foreground">Gestão de desempenho • Régua progressiva de bônus</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Início
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ═══ Executive KPI Cards ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-4">
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Avaliações</div>
            <div className="text-2xl font-bold text-foreground">{stats.totalAvaliacoes}</div>
            <div className="text-[10px] text-muted-foreground">oficiais no período</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Atendentes</div>
            <div className="text-2xl font-bold text-foreground">{stats.totalAtendentes}</div>
            <div className="text-[10px] text-muted-foreground">avaliados</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Nota Média</div>
            <div className={`text-2xl font-bold ${stats.tierGeral.textCls}`}>
              {formatNota(stats.notaMediaGeral10 * 10)}
            </div>
            <div className="text-[10px] text-muted-foreground">escala 0-10</div>
          </Card>
          <Card className={`p-4 border ${stats.tierGeral.bgCls}`}>
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Classificação</div>
            <div className={`text-sm font-bold ${stats.tierGeral.textCls}`}>{stats.tierGeral.label}</div>
            <div className="text-[10px] text-muted-foreground">{stats.tierGeral.pct}% do bônus</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Total Bônus
            </div>
            <div className="text-2xl font-bold text-foreground">{formatBRL(stats.totalBonus)}</div>
            <div className="text-[10px] text-muted-foreground">estimado no período</div>
          </Card>
        </div>

        {/* ═══ Tier Distribution ═══ */}
        <Card className="p-4">
          <h3 className="text-xs font-bold text-foreground mb-3">Distribuição por Faixa de Desempenho</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {stats.tierCounts.map(t => (
              <div key={t.label} className={`rounded-xl border p-3 text-center ${t.bgCls}`}>
                <div className={`flex items-center justify-center gap-1.5 mb-1`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${t.dotCls}`} />
                  <span className="text-[10px] font-semibold text-foreground">{t.label}</span>
                </div>
                <div className={`text-2xl font-bold ${t.textCls}`}>{t.count}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatNota(t.min * 10)}–{formatNota(t.max * 10)} • {t.pct}% • {formatBRL(t.valor)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Tabs defaultValue="ranking" className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="ranking" className="text-xs gap-1.5">
              <Trophy className="h-3.5 w-3.5" /> Ranking
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs gap-1.5">
              <Target className="h-3.5 w-3.5" /> Insights
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Evolução
            </TabsTrigger>
          </TabsList>

          {/* ═══ RANKING TAB ═══ */}
          <TabsContent value="ranking" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar atendente..."
                  value={searchAttendant}
                  onChange={e => setSearchAttendant(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <Badge variant="outline" className="text-[10px]">
                {filteredAttendants.length} atendentes
              </Badge>
            </div>

            {/* Ranking chart */}
            {rankingChartData.length > 0 && (
              <Card className="p-4">
                <h3 className="text-xs font-bold text-foreground mb-3">Nota Média por Atendente (0-10)</h3>
                <ResponsiveContainer width="100%" height={Math.max(220, rankingChartData.length * 28)}>
                  <BarChart data={rankingChartData} layout="vertical" margin={{ left: 90, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <ReTooltip formatter={(v: number) => [formatNota(v * 10), "Nota"]} />
                    <Bar dataKey="nota" radius={[0, 4, 4, 0]}>
                      {rankingChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Ranking table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Atendente</TableHead>
                    <TableHead className="text-center">Avaliações</TableHead>
                    <TableHead className="text-center">Nota Média</TableHead>
                    <TableHead className="text-center">Classificação</TableHead>
                    <TableHead className="text-center">% Bônus</TableHead>
                    <TableHead className="text-right">Bônus (R$)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        Nenhuma avaliação oficial encontrada no período.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredAttendants.map((att, idx) => (
                    <>
                      <TableRow
                        key={att.name}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedAttendant(expandedAttendant === att.name ? null : att.name)}
                      >
                        <TableCell>{getRankIcon(idx)}</TableCell>
                        <TableCell className="font-medium text-sm">{att.name}</TableCell>
                        <TableCell className="text-center text-sm">{att.totalAvaliacoes}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${att.tier.textCls}`}>
                            {formatNota(att.notaMedia10 * 10)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[10px] ${att.tier.bgCls} ${att.tier.textCls}`}>
                            {att.tier.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {att.bonusPct}%
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold">
                          {formatBRL(att.bonusValor)}
                        </TableCell>
                        <TableCell>
                          {expandedAttendant === att.name ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                      </TableRow>
                      {expandedAttendant === att.name && (
                        <TableRow key={`${att.name}-detail`}>
                          <TableCell colSpan={8} className="bg-muted/30 p-4">
                            <AttendantDetail attendant={att} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ═══ INSIGHTS TAB ═══ */}
          <TabsContent value="insights" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tier pie chart */}
              {pieData.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-xs font-bold text-foreground mb-3">Distribuição por Faixa</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(v: number, name: string) => [v, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center gap-1 text-[10px]">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span>{d.name}: {d.value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Top failures */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Critérios que Mais Derrubam Nota
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {criteriaFailures.slice(0, 8).map(cf => (
                    <div key={cf.numero} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium truncate flex-1 mr-2">
                          {cf.numero}. {cf.nome}
                        </span>
                        <span className="text-destructive font-bold shrink-0">{cf.taxaFalha}%</span>
                      </div>
                      <div className="flex gap-0.5 h-2 rounded overflow-hidden">
                        <div className="bg-destructive/80" style={{ width: `${cf.taxaFalha}%` }} />
                        <div className="bg-warning/60" style={{ width: `${100 - cf.taxaFalha - cf.taxaAcerto}%` }} />
                        <div className="bg-accent/80" style={{ width: `${cf.taxaAcerto}%` }} />
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        <span>{cf.totalAvaliacoes} avaliações</span>
                        <span className="text-accent">✓ {cf.taxaAcerto}%</span>
                        <span className="text-destructive">✗ {cf.taxaFalha}%</span>
                      </div>
                    </div>
                  ))}
                  {criteriaFailures.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem dados suficientes.</p>
                  )}
                </CardContent>
              </Card>

              {/* Top successes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent" />
                    Critérios com Maior Acerto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...criteriaFailures].sort((a, b) => b.taxaAcerto - a.taxaAcerto).slice(0, 8).map(cf => (
                    <div key={cf.numero} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium truncate flex-1 mr-2">
                          {cf.numero}. {cf.nome}
                        </span>
                        <span className="text-accent font-bold shrink-0">{cf.taxaAcerto}%</span>
                      </div>
                      <Progress value={cf.taxaAcerto} className="h-2" />
                      <div className="text-[10px] text-muted-foreground">{cf.totalAvaliacoes} avaliações</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top 5 / Bottom 5 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    Top 5 Atendentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {attendants.slice(0, 5).map((a, i) => (
                    <div key={a.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      {getRankIcon(i)}
                      <span className="text-sm font-medium flex-1 truncate">{a.name}</span>
                      <span className={`text-sm font-bold ${a.tier.textCls}`}>
                        {formatNota(a.notaMedia10 * 10)}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatBRL(a.bonusValor)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Bottom 5 — Oportunidades de Melhoria
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[...attendants].reverse().slice(0, 5).map(a => (
                    <div key={a.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <span className="text-sm font-medium flex-1 truncate">{a.name}</span>
                      <span className={`text-sm font-bold ${a.tier.textCls}`}>
                        {formatNota(a.notaMedia10 * 10)}
                      </span>
                      <Badge variant="outline" className={`text-[9px] ${a.tier.bgCls} ${a.tier.textCls}`}>
                        {a.tier.label}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══ EVOLUTION TAB ═══ */}
          <TabsContent value="evolucao" className="space-y-4">
            {evolutionData.length > 0 ? (
              <Card className="p-4">
                <h3 className="text-xs font-bold text-foreground mb-3">Evolução da Nota Média Mensal (0-10)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <ReTooltip formatter={(v: number, name: string) => [name === "media" ? formatNota(v * 10) : v, name === "media" ? "Nota Média" : "Volume"]} />
                    <Line type="monotone" dataKey="media" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-foreground mb-2">Volume por Mês</h4>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={evolutionData}>
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Bar dataKey="volume" fill="hsl(var(--primary))" opacity={0.6} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Dados insuficientes para gerar gráfico de evolução.</p>
              </Card>
            )}

            {/* Bonus scale reference */}
            <Card className="p-4">
              <h3 className="text-xs font-bold text-foreground mb-3">Régua Progressiva de Bônus</h3>
              <p className="text-[10px] text-muted-foreground mb-3">Teto máximo: R$ 1.200,00</p>
              <div className="space-y-1.5">
                {BONUS_TIERS.map(t => (
                  <div key={t.label} className="flex items-center gap-3 text-xs">
                    <div className={`h-3 w-3 rounded-full ${t.dotCls}`} />
                    <span className="font-medium w-44">{t.label}</span>
                    <span className="text-muted-foreground w-20">{formatNota(t.min * 10)}–{formatNota(t.max * 10)}</span>
                    <span className="font-bold w-12 text-right">{t.pct}%</span>
                    <span className="font-bold w-20 text-right">{formatBRL(t.valor)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

/* ═══ Attendant Detail Subcomponent ═══ */
const AttendantDetail = ({ attendant }: { attendant: AttendantPerf }) => {
  const critPerf = useMemo(() => {
    const counters = new Map<number, { sim: number; nao: number; parcial: number; total: number }>();
    for (const score of attendant.scores) {
      for (const det of score.detalhesPorCriterio) {
        if (!counters.has(det.numero)) counters.set(det.numero, { sim: 0, nao: 0, parcial: 0, total: 0 });
        const c = counters.get(det.numero)!;
        c.total++;
        if (det.resposta === "SIM") c.sim++;
        else if (det.resposta === "NÃO") c.nao++;
        else c.parcial++;
      }
    }
    return [...counters.entries()]
      .map(([num, c]) => ({ numero: num, ...c, taxaAcerto: c.total > 0 ? Math.round((c.sim / c.total) * 100) : 0 }))
      .sort((a, b) => a.taxaAcerto - b.taxaAcerto);
  }, [attendant.scores]);

  const weakPoints = critPerf.filter(c => c.taxaAcerto < 50).slice(0, 5);
  const strongPoints = [...critPerf].sort((a, b) => b.taxaAcerto - a.taxaAcerto).filter(c => c.taxaAcerto >= 70).slice(0, 5);

  const catBreakdown = useMemo(() => {
    const cats = new Map<string, number[]>();
    for (const score of attendant.scores) {
      for (const [cat, vals] of Object.entries(score.porCategoria)) {
        if (!cats.has(cat)) cats.set(cat, []);
        cats.get(cat)!.push(vals.percentual);
      }
    }
    return [...cats.entries()].map(([cat, percents]) => ({
      cat,
      avg: Math.round(percents.reduce((a, b) => a + b, 0) / percents.length),
    }));
  }, [attendant.scores]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="text-center p-3 rounded-lg bg-card border">
          <div className="text-[10px] text-muted-foreground">Avaliações</div>
          <div className="text-lg font-bold">{attendant.totalAvaliacoes}</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-card border">
          <div className="text-[10px] text-muted-foreground">Nota Média</div>
          <div className={`text-lg font-bold ${attendant.tier.textCls}`}>{formatNota(attendant.notaMedia10 * 10)}</div>
        </div>
        <div className={`text-center p-3 rounded-lg border ${attendant.tier.bgCls}`}>
          <div className="text-[10px] text-muted-foreground">Classificação</div>
          <div className={`text-sm font-bold ${attendant.tier.textCls}`}>{attendant.tier.label}</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-card border">
          <div className="text-[10px] text-muted-foreground">% Bônus</div>
          <div className="text-lg font-bold">{attendant.bonusPct}%</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-card border">
          <div className="text-[10px] text-muted-foreground">Bônus</div>
          <div className="text-lg font-bold text-foreground">{formatBRL(attendant.bonusValor)}</div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-foreground">Performance por Categoria</h4>
        {catBreakdown.map(({ cat, avg }) => (
          <div key={cat} className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground w-44 shrink-0 truncate">{cat}</span>
            <Progress value={avg} className="h-2 flex-1" />
            <span className="text-xs font-bold w-10 text-right">{avg}%</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {weakPoints.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-destructive mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Pontos Fracos
            </h4>
            <div className="space-y-1">
              {weakPoints.map(c => (
                <div key={c.numero} className="text-[11px] flex items-center justify-between px-2 py-1 rounded bg-destructive/5">
                  <span className="truncate flex-1 mr-2">P{c.numero}</span>
                  <span className="text-destructive font-bold">{c.taxaAcerto}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {strongPoints.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-accent mb-2 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Pontos Fortes
            </h4>
            <div className="space-y-1">
              {strongPoints.map(c => (
                <div key={c.numero} className="text-[11px] flex items-center justify-between px-2 py-1 rounded bg-accent/5">
                  <span className="truncate flex-1 mr-2">P{c.numero}</span>
                  <span className="text-accent font-bold">{c.taxaAcerto}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceDashboard;
