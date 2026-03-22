import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, LogOut, BarChart3, Users2, TrendingUp, AlertTriangle,
  ChevronDown, ChevronUp, Crown, Medal, Award, Target, Zap,
  Loader2, Search, Trophy,
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
  classify, classificacaoColor, classificacaoBg,
  type ScoringResult, type CriterionFailureRate, type Classificacao,
} from "@/lib/mentoriaScoring";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LineChart, Line, Cell,
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

interface AttendantPerf {
  name: string;
  totalAvaliacoes: number;
  notaMedia: number;
  classificacao: Classificacao;
  scores: ScoringResult[];
  evalDates: string[];
  percentExcelente: number;
  percentAbaixo: number;
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
      if (period === "current") {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
      if (period === "last30") {
        const cutoff = new Date(now.getTime() - 30 * 86400000);
        return d >= cutoff;
      }
      if (period === "last90") {
        const cutoff = new Date(now.getTime() - 90 * 86400000);
        return d >= cutoff;
      }
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
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(e);
    }

    return [...grouped.entries()].map(([name, evs]) => {
      const scores = evs.map(e => e.score);
      const notas = scores.map(s => s.nota100);
      const media = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
      const excelente = scores.filter(s => s.classificacao === "Excelente").length;
      const abaixo = scores.filter(s => s.classificacao === "Abaixo do esperado" || s.classificacao === "Crítico").length;

      return {
        name,
        totalAvaliacoes: evs.length,
        notaMedia: Math.round(media * 10) / 10,
        classificacao: classify(media),
        scores,
        evalDates: evs.map(e => e.data),
        percentExcelente: evs.length > 0 ? Math.round((excelente / evs.length) * 100) : 0,
        percentAbaixo: evs.length > 0 ? Math.round((abaixo / evs.length) * 100) : 0,
      };
    }).sort((a, b) => b.notaMedia - a.notaMedia);
  }, [scoredEvals]);

  const filteredAttendants = useMemo(() => {
    if (!searchAttendant) return attendants;
    const q = searchAttendant.toLowerCase();
    return attendants.filter(a => a.name.toLowerCase().includes(q));
  }, [attendants, searchAttendant]);

  // Criteria failure analysis
  const criteriaFailures = useMemo(() => {
    return analyzeCriteriaFailures(filteredEvals.map(e => ({ full_report: e.full_report })));
  }, [filteredEvals]);

  // General stats
  const stats = useMemo(() => {
    const scored = scoredEvals;
    const avgNota = scored.length > 0
      ? scored.reduce((s, e) => s + e.score.nota100, 0) / scored.length
      : 0;
    const topFailures = criteriaFailures.filter(c => c.taxaFalha > 30).slice(0, 5);
    const topSuccesses = [...criteriaFailures].sort((a, b) => b.taxaAcerto - a.taxaAcerto).filter(c => c.taxaAcerto > 50).slice(0, 5);

    return {
      totalAvaliacoes: scored.length,
      totalAtendentes: attendants.length,
      notaMediaGeral: Math.round(avgNota * 10) / 10,
      classificacaoGeral: classify(avgNota),
      topFailures,
      topSuccesses,
    };
  }, [scoredEvals, attendants, criteriaFailures]);

  // Chart data: ranking
  const rankingChartData = useMemo(() => {
    return filteredAttendants.slice(0, 15).map(a => ({
      name: a.name.split(" ").slice(0, 2).join(" "),
      nota: a.notaMedia,
      cls: a.classificacao,
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
      monthMap.get(key)!.push(e.score.nota100);
    }
    return [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, notas]) => ({
        mes: key,
        media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
        volume: notas.length,
      }));
  }, [scoredEvals]);

  function barColor(cls: string): string {
    switch (cls) {
      case "Excelente": return "hsl(var(--accent))";
      case "Bom atendimento": return "hsl(var(--primary))";
      case "Abaixo do esperado": return "hsl(var(--warning))";
      case "Crítico": return "hsl(var(--destructive))";
      default: return "hsl(var(--muted-foreground))";
    }
  }

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
            <p className="text-xs text-muted-foreground">Visão gerencial da operação</p>
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
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Avaliações Oficiais</div>
            <div className="text-2xl font-bold text-foreground">{stats.totalAvaliacoes}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Atendentes</div>
            <div className="text-2xl font-bold text-foreground">{stats.totalAtendentes}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Nota Média</div>
            <div className={`text-2xl font-bold ${classificacaoColor(stats.classificacaoGeral)}`}>
              {stats.notaMediaGeral}
              <span className="text-xs font-normal text-muted-foreground">/100</span>
            </div>
          </Card>
          <Card className={`p-4 border ${classificacaoBg(stats.classificacaoGeral)}`}>
            <div className="text-xs text-muted-foreground mb-1">Classificação</div>
            <div className={`text-lg font-bold ${classificacaoColor(stats.classificacaoGeral)}`}>
              {stats.classificacaoGeral}
            </div>
          </Card>
        </div>

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
                <h3 className="text-xs font-bold text-foreground mb-3">Nota Média por Atendente</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={rankingChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <ReTooltip formatter={(v: number) => [`${v}/100`, "Nota"]} />
                    <Bar dataKey="nota" radius={[0, 4, 4, 0]}>
                      {rankingChartData.map((entry, i) => (
                        <Cell key={i} fill={barColor(entry.cls)} />
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
                    <TableHead className="text-center">Excelência</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
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
                          <span className={`font-bold ${classificacaoColor(att.classificacao)}`}>
                            {att.notaMedia}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[10px] ${classificacaoBg(att.classificacao)} ${classificacaoColor(att.classificacao)}`}>
                            {att.classificacao}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {att.percentExcelente}%
                        </TableCell>
                        <TableCell>
                          {expandedAttendant === att.name ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                      </TableRow>
                      {expandedAttendant === att.name && (
                        <TableRow key={`${att.name}-detail`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
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
              {/* Top failures */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Critérios com Maior Índice de Falha
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
                      <div className="flex gap-1 h-2">
                        <div
                          className="bg-destructive/80 rounded-l"
                          style={{ width: `${cf.taxaFalha}%` }}
                        />
                        <div
                          className="bg-warning/60"
                          style={{ width: `${100 - cf.taxaFalha - cf.taxaAcerto}%` }}
                        />
                        <div
                          className="bg-accent/80 rounded-r"
                          style={{ width: `${cf.taxaAcerto}%` }}
                        />
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
                    Critérios com Maior Índice de Acerto
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
                      <div className="text-[10px] text-muted-foreground">
                        {cf.totalAvaliacoes} avaliações
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top 5 attendants */}
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
                      <span className="text-sm font-medium flex-1">{a.name}</span>
                      <span className={`text-sm font-bold ${classificacaoColor(a.classificacao)}`}>
                        {a.notaMedia}
                      </span>
                      <Badge variant="outline" className="text-[9px]">{a.totalAvaliacoes} av.</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Bottom 5 attendants */}
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
                      <span className="text-sm font-medium flex-1">{a.name}</span>
                      <span className={`text-sm font-bold ${classificacaoColor(a.classificacao)}`}>
                        {a.notaMedia}
                      </span>
                      <Badge variant="outline" className="text-[9px]">{a.percentAbaixo}% abaixo</Badge>
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
                <h3 className="text-xs font-bold text-foreground mb-3">Evolução da Nota Média Mensal</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <ReTooltip formatter={(v: number, name: string) => [name === "media" ? `${v}/100` : v, name === "media" ? "Nota Média" : "Volume"]} />
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

/* ═══ Attendant Detail Subcomponent ═══ */
const AttendantDetail = ({ attendant }: { attendant: AttendantPerf }) => {
  // Aggregate criteria performance for this attendant
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

  // Category breakdown
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center p-3 rounded-lg bg-card border">
          <div className="text-[10px] text-muted-foreground">Avaliações</div>
          <div className="text-lg font-bold">{attendant.totalAvaliacoes}</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-card border">
          <div className="text-[10px] text-muted-foreground">Nota Média</div>
          <div className={`text-lg font-bold ${classificacaoColor(attendant.classificacao)}`}>{attendant.notaMedia}</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-card border">
          <div className="text-[10px] text-muted-foreground">% Excelência</div>
          <div className="text-lg font-bold text-accent">{attendant.percentExcelente}%</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-card border">
          <div className="text-[10px] text-muted-foreground">% Abaixo</div>
          <div className="text-lg font-bold text-destructive">{attendant.percentAbaixo}%</div>
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
        {/* Weak points */}
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
        {/* Strong points */}
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
