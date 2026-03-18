import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, LogOut, Trophy, Medal, TrendingUp, Users2,
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, DollarSign,
  CheckCircle2, XCircle, Crown, Award, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { calcularBonus, formatBRL, notaToScale10, formatNota } from "@/lib/utils";
import logoSymbol from "@/assets/logo-symbol.png";

/* ─── Constants ─── */
const MIN_ATENDIMENTOS = 400;
const MIN_MENTORIAS = 6;

/* ─── Types ─── */
interface EvalRow {
  id: string;
  atendente: string;
  nota: number;
  data: string;
  classificacao: string;
  tipo: string;
  bonus: boolean;
  full_report: any;
}

interface AttendantRanking {
  name: string;
  totalMentorias: number;
  notaMedia: number;
  notaMedia10: number;
  classificacao: string;
  elegivel: boolean;
  motivoInelegivel?: string;
  percentualBonus: number;
  valorBonus: number;
  notas: number[];
}

/* ─── Helpers ─── */
function getMonthLabel(year: number, month: number): string {
  const d = new Date(year, month);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase());
}

function parseEvalDate(data: string): Date | null {
  // Try DD/MM/YYYY
  const br = data.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  // Try YYYY-MM-DD
  const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(data);
  return isNaN(d.getTime()) ? null : d;
}

function isIneligibleEval(row: EvalRow): boolean {
  // Check full_report for ineligibility markers
  const fr = row.full_report;
  if (fr && typeof fr === "object") {
    if (fr._ineligible) return true;
    if (fr.statusAtendimento === "audio" || fr.statusAtendimento === "sem_interacao") return true;
  }
  return false;
}

function getRankIcon(pos: number) {
  if (pos === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (pos === 1) return <Medal className="h-5 w-5 text-gray-400" />;
  if (pos === 2) return <Award className="h-5 w-5 text-amber-700" />;
  return <span className="text-xs text-muted-foreground font-bold w-5 text-center">{pos + 1}º</span>;
}

/* ─── Component ─── */
const RankingBonus = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  // Fetch evaluations
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("evaluations")
        .select("id, atendente, nota, data, classificacao, tipo, bonus, full_report")
        .order("data", { ascending: false });

      if (error) {
        console.error("Error fetching evaluations:", error);
      }
      setEvals((data as EvalRow[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter by selected month
  const monthEvals = useMemo(() => {
    return evals.filter((e) => {
      const d = parseEvalDate(e.data);
      if (!d) return false;
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [evals, year, month]);

  // Build ranking
  const ranking = useMemo((): AttendantRanking[] => {
    // Filter out ineligible evals (audio, no interaction)
    const validEvals = monthEvals.filter((e) => !isIneligibleEval(e));

    // Group by atendente
    const grouped = new Map<string, EvalRow[]>();
    validEvals.forEach((e) => {
      const name = e.atendente || "Não identificado";
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(e);
    });

    return [...grouped.entries()].map(([name, evs]) => {
      const notas = evs.map((e) => e.nota);
      const media = notas.reduce((a, b) => a + b, 0) / notas.length;
      const media10 = notaToScale10(media);
      const bonus = calcularBonus(media);

      const mentoriasValidas = evs.length;
      const elegivel = mentoriasValidas >= MIN_MENTORIAS;
      let motivoInelegivel: string | undefined;
      if (!elegivel) {
        motivoInelegivel = `Mínimo de ${MIN_MENTORIAS} mentorias não atingido (${mentoriasValidas})`;
      }

      return {
        name,
        totalMentorias: mentoriasValidas,
        notaMedia: media,
        notaMedia10: media10,
        classificacao: elegivel ? bonus.classificacao : "Pendente",
        elegivel,
        motivoInelegivel,
        percentualBonus: elegivel ? bonus.percentual : 0,
        valorBonus: elegivel ? bonus.valor : 0,
        notas,
      };
    }).sort((a, b) => {
      // Eligible first, then by nota
      if (a.elegivel !== b.elegivel) return a.elegivel ? -1 : 1;
      return b.notaMedia - a.notaMedia;
    });
  }, [monthEvals]);

  // Summary stats
  const stats = useMemo(() => {
    const elegiveis = ranking.filter((r) => r.elegivel);
    const totalBonus = elegiveis.reduce((s, r) => s + r.valorBonus, 0);
    const mediaGeral = elegiveis.length > 0
      ? elegiveis.reduce((s, r) => s + r.notaMedia10, 0) / elegiveis.length
      : 0;
    return {
      totalAtendentes: ranking.length,
      elegiveis: elegiveis.length,
      inelegiveis: ranking.length - elegiveis.length,
      mediaGeral: Math.round(mediaGeral * 10) / 10,
      totalBonus,
      totalMentorias: monthEvals.filter((e) => !isIneligibleEval(e)).length,
    };
  }, [ranking, monthEvals]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  function bonusColor(cls: string): string {
    switch (cls) {
      case "Excelente": return "text-accent";
      case "Muito bom": return "text-blue-600";
      case "Bom atendimento": return "text-primary";
      case "Em desenvolvimento": return "text-warning";
      case "Abaixo do esperado": return "text-destructive";
      default: return "text-muted-foreground";
    }
  }

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" /> Ranking & Bônus
            </h1>
            <p className="text-xs text-muted-foreground">Desempenho mensal da equipe</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Início
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Month Selector */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-bold text-foreground">{getMonthLabel(year, month)}</h2>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Carregando dados...</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="p-4 text-center">
                <Users2 className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold text-foreground">{stats.totalAtendentes}</p>
                <p className="text-[10px] text-muted-foreground">Atendentes</p>
              </Card>
              <Card className="p-4 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-accent mb-1" />
                <p className="text-2xl font-bold text-accent">{stats.elegiveis}</p>
                <p className="text-[10px] text-muted-foreground">Elegíveis</p>
              </Card>
              <Card className="p-4 text-center">
                <XCircle className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold text-muted-foreground">{stats.inelegiveis}</p>
                <p className="text-[10px] text-muted-foreground">Inelegíveis</p>
              </Card>
              <Card className="p-4 text-center">
                <Star className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold text-foreground">{stats.mediaGeral.toFixed(1).replace(".", ",")}</p>
                <p className="text-[10px] text-muted-foreground">Média geral</p>
              </Card>
              <Card className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold text-foreground">{stats.totalMentorias}</p>
                <p className="text-[10px] text-muted-foreground">Mentorias válidas</p>
              </Card>
              <Card className="p-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-accent mb-1" />
                <p className="text-2xl font-bold text-accent">{formatBRL(stats.totalBonus)}</p>
                <p className="text-[10px] text-muted-foreground">Total bônus</p>
              </Card>
            </div>

            {/* Eligibility rules info */}
            <Card className="p-4 bg-muted/30 border-border/60">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Regras de elegibilidade:</strong> mínimo de <strong>{MIN_MENTORIAS} mentorias válidas</strong> no mês.</p>
                  <p><strong>Exclusões automáticas:</strong> atendimentos com áudio, sem interação do cliente e mentorias preventivas não entram no cálculo.</p>
                  <p><strong>Régua:</strong> 95–100 Excelente (100% / R$ 1.200) · 85–94 Muito bom (90% / R$ 1.080) · 70–84 Bom (70% / R$ 840) · 50–69 Em desenvolvimento (30% / R$ 360) · 0–49 Abaixo do esperado (0% / R$ 0)</p>
                </div>
              </div>
            </Card>

            {/* Ranking Table */}
            {ranking.length === 0 ? (
              <Card className="p-12 text-center">
                <Trophy className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhuma avaliação encontrada para {getMonthLabel(year, month)}.</p>
                <p className="text-xs text-muted-foreground mt-1">As avaliações realizadas no módulo de Sucesso do Cliente e Mentoria Lab aparecerão aqui.</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="p-3 text-center font-medium text-muted-foreground w-12">#</th>
                        <th className="p-3 text-left font-medium text-muted-foreground">Atendente</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">Mentorias</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">Nota Média</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">Classificação</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">Elegível</th>
                        <th className="p-3 text-center font-medium text-muted-foreground">Bônus %</th>
                        <th className="p-3 text-right font-medium text-muted-foreground">Valor Estimado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((r, idx) => {
                        const bgRow = r.elegivel
                          ? idx === 0 ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""
                          : "bg-muted/20 opacity-70";

                        return (
                          <tr key={r.name} className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${bgRow}`}>
                            <td className="p-3 text-center">
                              {r.elegivel ? getRankIcon(idx) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-foreground">{r.name}</p>
                              {r.motivoInelegivel && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{r.motivoInelegivel}</p>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`font-bold ${r.totalMentorias >= MIN_MENTORIAS ? "text-foreground" : "text-destructive"}`}>
                                {r.totalMentorias}
                              </span>
                              <span className="text-muted-foreground text-xs">/{MIN_MENTORIAS}</span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`text-lg font-black ${r.elegivel ? (r.notaMedia10 >= 7 ? "text-accent" : r.notaMedia10 >= 5 ? "text-warning" : "text-destructive") : "text-muted-foreground"}`}>
                                {formatNota(r.notaMedia)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                variant="outline"
                                className={`text-xs ${r.elegivel ? bonusColor(r.classificacao) : "text-muted-foreground"}`}
                              >
                                {r.classificacao}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              {r.elegivel ? (
                                <Badge className="bg-accent/15 text-accent text-xs gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Sim
                                </Badge>
                              ) : (
                                <Badge className="bg-muted text-muted-foreground text-xs gap-1">
                                  <XCircle className="h-3 w-3" /> Não
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`font-bold ${r.elegivel ? bonusColor(r.classificacao) : "text-muted-foreground"}`}>
                                {r.elegivel ? `${r.percentualBonus}%` : "—"}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <span className={`font-bold text-base ${r.elegivel ? (r.valorBonus > 0 ? "text-accent" : "text-destructive") : "text-muted-foreground"}`}>
                                {r.elegivel ? formatBRL(r.valorBonus) : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer summary */}
                <div className="border-t border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {stats.elegiveis} atendente{stats.elegiveis !== 1 ? "s" : ""} elegível{stats.elegiveis !== 1 ? "is" : ""} de {stats.totalAtendentes}
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    Total: <span className="text-accent">{formatBRL(stats.totalBonus)}</span>
                  </p>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default RankingBonus;
