import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, LogOut, Trophy, Medal, TrendingUp, Users2,
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, DollarSign,
  CheckCircle2, XCircle, Crown, Award, Star, Ban, RotateCcw,
  Lock, Unlock, ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { calcularBonus, formatBRL, notaToScale10, formatNota, formatDateBR } from "@/lib/utils";
import logoSymbol from "@/assets/logo-symbol.png";
import { toast } from "sonner";

/* ─── Constants ─── */
const MIN_MENTORIAS = 6;

const EXCLUSION_REASONS = [
  "Áudio no atendimento",
  "Sem interação do cliente",
  "Atendimento transferido",
  "Duplicidade",
  "Amostra inválida",
  "Outro",
];

/* ─── Types ─── */
interface EvalRow {
  id: string;
  atendente: string;
  nota: number;
  data: string;
  protocolo: string;
  classificacao: string;
  tipo: string;
  bonus: boolean;
  full_report: any;
  excluded_from_ranking: boolean;
  exclusion_reason: string | null;
  excluded_at: string | null;
  excluded_by: string | null;
  data_avaliacao: string;
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
  evals: EvalRow[];
}

interface MonthlyClosing {
  id: string;
  year: number;
  month: number;
  status: string;
  total_mentorias: number;
  nota_media: number;
  total_bonus: number;
  snapshot: any;
  closed_by: string | null;
  closed_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
}

/* ─── Helpers ─── */
function getMonthLabel(year: number, month: number): string {
  const d = new Date(year, month);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase());
}

function parseEvalDate(data: string): Date | null {
  const br = data.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(data);
  return isNaN(d.getTime()) ? null : d;
}

function isIneligibleEval(row: EvalRow): boolean {
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
  const [expandedAttendant, setExpandedAttendant] = useState<string | null>(null);

  // Exclusion modal state
  const [excludeDialogOpen, setExcludeDialogOpen] = useState(false);
  const [excludeEvalId, setExcludeEvalId] = useState<string | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [excludeCustomReason, setExcludeCustomReason] = useState("");
  const [excludeSaving, setExcludeSaving] = useState(false);

  // Restore modal state
  const [restoreEvalId, setRestoreEvalId] = useState<string | null>(null);
  const [restoreSaving, setRestoreSaving] = useState(false);

  // Monthly closing state
  const [monthClosing, setMonthClosing] = useState<MonthlyClosing | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingSaving, setClosingSaving] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [allClosings, setAllClosings] = useState<MonthlyClosing[]>([]);

  const isClosed = monthClosing?.status === "fechado";

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("evaluations")
      .select("id, atendente, nota, data, protocolo, classificacao, tipo, bonus, full_report, excluded_from_ranking, exclusion_reason, excluded_at, excluded_by, data_avaliacao")
      .order("data", { ascending: false });

    if (error) console.error("Error fetching evaluations:", error);
    setEvals((data as EvalRow[]) || []);
    setLoading(false);
  };

  const fetchClosing = async () => {
    const { data } = await supabase
      .from("monthly_closings")
      .select("*")
      .eq("year", year)
      .eq("month", month + 1)
      .maybeSingle();
    setMonthClosing((data as MonthlyClosing | null) || null);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchClosing(); }, [year, month]);

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
    // Only count non-excluded, non-ineligible evals
    const validEvals = monthEvals.filter((e) => !e.excluded_from_ranking && !isIneligibleEval(e));

    const grouped = new Map<string, EvalRow[]>();
    validEvals.forEach((e) => {
      const name = e.atendente || "Não identificado";
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(e);
    });

    // Also include all evals (including excluded) for detail view
    const allGrouped = new Map<string, EvalRow[]>();
    monthEvals.forEach((e) => {
      const name = e.atendente || "Não identificado";
      if (!allGrouped.has(name)) allGrouped.set(name, []);
      allGrouped.get(name)!.push(e);
    });

    return [...allGrouped.keys()].map((name) => {
      const validEvs = grouped.get(name) || [];
      const allEvs = allGrouped.get(name) || [];
      const notas = validEvs.map((e) => e.nota);
      const media = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
      const media10 = notaToScale10(media);
      const bonus = calcularBonus(media);

      const elegivel = notas.length >= MIN_MENTORIAS;
      let motivoInelegivel: string | undefined;
      if (!elegivel) {
        motivoInelegivel = `Mínimo de ${MIN_MENTORIAS} mentorias não atingido (${notas.length})`;
      }

      return {
        name,
        totalMentorias: notas.length,
        notaMedia: media,
        notaMedia10: media10,
        classificacao: elegivel ? bonus.classificacao : "Pendente",
        elegivel,
        motivoInelegivel,
        percentualBonus: elegivel ? bonus.percentual : 0,
        valorBonus: elegivel ? bonus.valor : 0,
        notas,
        evals: allEvs.sort((a, b) => {
          const da = parseEvalDate(a.data);
          const db = parseEvalDate(b.data);
          return (db?.getTime() || 0) - (da?.getTime() || 0);
        }),
      };
    }).sort((a, b) => {
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
    const excludedCount = monthEvals.filter((e) => e.excluded_from_ranking).length;
    return {
      totalAtendentes: ranking.length,
      elegiveis: elegiveis.length,
      inelegiveis: ranking.length - elegiveis.length,
      mediaGeral: Math.round(mediaGeral * 10) / 10,
      totalBonus,
      totalMentorias: monthEvals.filter((e) => !e.excluded_from_ranking && !isIneligibleEval(e)).length,
      excludedCount,
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

  // Exclude evaluation
  const openExcludeDialog = (evalId: string) => {
    setExcludeEvalId(evalId);
    setExcludeReason("");
    setExcludeCustomReason("");
    setExcludeDialogOpen(true);
  };

  const handleExclude = async () => {
    if (!excludeEvalId) return;
    const finalReason = excludeReason === "Outro" ? excludeCustomReason.trim() : excludeReason;
    if (!finalReason) {
      toast.error("Selecione ou informe o motivo da exclusão.");
      return;
    }

    setExcludeSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id || "").single();

    const { error } = await supabase
      .from("evaluations")
      .update({
        excluded_from_ranking: true,
        exclusion_reason: finalReason,
        excluded_at: new Date().toISOString(),
        excluded_by: profile?.full_name || user?.email || "Desconhecido",
      } as any)
      .eq("id", excludeEvalId);

    if (error) {
      toast.error("Erro ao excluir mentoria da apuração.");
      console.error(error);
    } else {
      toast.success("Mentoria excluída da apuração.");
      setExcludeDialogOpen(false);
      // Update local state
      setEvals((prev) => prev.map((e) =>
        e.id === excludeEvalId
          ? { ...e, excluded_from_ranking: true, exclusion_reason: finalReason, excluded_at: new Date().toISOString(), excluded_by: profile?.full_name || user?.email || "" }
          : e
      ));
    }
    setExcludeSaving(false);
  };

  // Restore evaluation
  const handleRestore = async () => {
    if (!restoreEvalId) return;
    setRestoreSaving(true);

    const { error } = await supabase
      .from("evaluations")
      .update({
        excluded_from_ranking: false,
        exclusion_reason: null,
        excluded_at: null,
        excluded_by: null,
      } as any)
      .eq("id", restoreEvalId);

    if (error) {
      toast.error("Erro ao restaurar mentoria.");
    } else {
      toast.success("Mentoria restaurada à apuração.");
      setEvals((prev) => prev.map((e) =>
        e.id === restoreEvalId
          ? { ...e, excluded_from_ranking: false, exclusion_reason: null, excluded_at: null, excluded_by: null }
          : e
      ));
    }
    setRestoreEvalId(null);
    setRestoreSaving(false);
  };

  // Close month
  const handleCloseMonth = async () => {
    setClosingSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id || "").single();
    const { data: companyData } = await supabase.rpc("get_my_company_id");
    const closedByName = profile?.full_name || user?.email || "Desconhecido";

    const snapshot = ranking.map((r) => ({
      name: r.name,
      totalMentorias: r.totalMentorias,
      notaMedia: r.notaMedia10,
      classificacao: r.classificacao,
      elegivel: r.elegivel,
      percentualBonus: r.percentualBonus,
      valorBonus: r.valorBonus,
    }));

    if (monthClosing) {
      // Update existing
      const { error } = await supabase
        .from("monthly_closings")
        .update({
          status: "fechado",
          total_mentorias: stats.totalMentorias,
          nota_media: stats.mediaGeral,
          total_bonus: stats.totalBonus,
          snapshot,
          closed_by: closedByName,
          closed_at: new Date().toISOString(),
          reopened_by: null,
          reopened_at: null,
        } as any)
        .eq("id", monthClosing.id);
      if (error) { toast.error("Erro ao fechar o mês."); console.error(error); }
      else { toast.success(`Mentoria de ${getMonthLabel(year, month)} fechada com sucesso.`); }
    } else {
      // Insert new
      const { error } = await supabase
        .from("monthly_closings")
        .insert({
          year,
          month: month + 1,
          status: "fechado",
          total_mentorias: stats.totalMentorias,
          nota_media: stats.mediaGeral,
          total_bonus: stats.totalBonus,
          snapshot,
          closed_by: closedByName,
          closed_at: new Date().toISOString(),
          user_id: user?.id,
          company_id: companyData || null,
        } as any);
      if (error) { toast.error("Erro ao fechar o mês."); console.error(error); }
      else { toast.success(`Mentoria de ${getMonthLabel(year, month)} fechada com sucesso.`); }
    }

    setCloseDialogOpen(false);
    setClosingSaving(false);
    fetchClosing();
  };

  // Reopen month
  const handleReopenMonth = async () => {
    if (!monthClosing) return;
    setClosingSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id || "").single();

    const { error } = await supabase
      .from("monthly_closings")
      .update({
        status: "aberto",
        reopened_by: profile?.full_name || user?.email || "Desconhecido",
        reopened_at: new Date().toISOString(),
      } as any)
      .eq("id", monthClosing.id);

    if (error) { toast.error("Erro ao reabrir o mês."); }
    else { toast.success(`Mentoria de ${getMonthLabel(year, month)} reaberta.`); }

    setReopenDialogOpen(false);
    setClosingSaving(false);
    fetchClosing();
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
        {/* Month Selector + Status */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">{getMonthLabel(year, month)}</h2>
              {isClosed ? (
                <Badge className="bg-accent/15 text-accent text-xs gap-1">
                  <Lock className="h-3 w-3" /> Fechado
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground text-xs gap-1">
                  <Unlock className="h-3 w-3" /> Em aberto
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {isClosed && monthClosing && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Fechado por <strong className="text-foreground">{monthClosing.closed_by}</strong> em {formatDateBR(monthClosing.closed_at)}
              </span>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setReopenDialogOpen(true)}>
                <Unlock className="h-3 w-3" /> Reabrir mês
              </Button>
            </div>
          )}
        </Card>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Carregando dados...</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
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
                <Ban className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold text-muted-foreground">{stats.excludedCount}</p>
                <p className="text-[10px] text-muted-foreground">Excluídas</p>
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
                  <p><strong>Exclusões manuais:</strong> clique no ícone <Ban className="h-3 w-3 inline" /> para excluir uma mentoria da apuração com justificativa. Mentorias excluídas podem ser restauradas.</p>
                  <p><strong>Régua:</strong> 95–100 Excelente (100% / R$ 1.200) · 85–94 Muito bom (90% / R$ 1.080) · 70–84 Bom (70% / R$ 840) · 50–69 Em desenvolvimento (30% / R$ 360) · 0–49 Abaixo do esperado (0% / R$ 0)</p>
                </div>
              </div>
            </Card>

            {/* Close Month Action */}
            {!isClosed && ranking.length > 0 && (
              <Card className="p-4 border-primary/30 bg-primary/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Fechar mentoria do mês</p>
                      <p className="text-xs text-muted-foreground">
                        Consolida {stats.totalMentorias} mentorias válidas · Média {stats.mediaGeral.toFixed(1).replace(".", ",")} · Bônus total {formatBRL(stats.totalBonus)}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setCloseDialogOpen(true)} className="gap-2">
                    <Lock className="h-4 w-4" /> Fechar mentoria do mês
                  </Button>
                </div>
              </Card>
            )}

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
                        const isExpanded = expandedAttendant === r.name;
                        const excludedInThisAttendant = r.evals.filter((e) => e.excluded_from_ranking);

                        return (
                          <>
                            {/* Summary row */}
                            <tr
                              key={`summary-${r.name}`}
                              className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 cursor-pointer ${bgRow}`}
                              onClick={() => setExpandedAttendant(isExpanded ? null : r.name)}
                            >
                              <td className="p-3 text-center">
                                {r.elegivel ? getRankIcon(idx) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <p className="font-medium text-foreground">{r.name}</p>
                                    {r.motivoInelegivel && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{r.motivoInelegivel}</p>
                                    )}
                                  </div>
                                  {excludedInThisAttendant.length > 0 && (
                                    <Badge className="bg-muted text-muted-foreground text-[9px] shrink-0">
                                      {excludedInThisAttendant.length} excluída{excludedInThisAttendant.length > 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`font-bold ${r.totalMentorias >= MIN_MENTORIAS ? "text-foreground" : "text-destructive"}`}>
                                  {r.totalMentorias}
                                </span>
                                <span className="text-muted-foreground text-xs">/{MIN_MENTORIAS}</span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`text-lg font-black ${r.elegivel ? (r.notaMedia10 >= 7 ? "text-accent" : r.notaMedia10 >= 5 ? "text-warning" : "text-destructive") : "text-muted-foreground"}`}>
                                  {r.totalMentorias > 0 ? formatNota(r.notaMedia) : "—"}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" className={`text-xs ${r.elegivel ? bonusColor(r.classificacao) : "text-muted-foreground"}`}>
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

                            {/* Expanded detail rows */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <div className="bg-muted/20 border-y border-border">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border/50">
                                          <th className="p-2 pl-12 text-left font-medium text-muted-foreground">Protocolo</th>
                                          <th className="p-2 text-left font-medium text-muted-foreground">Data</th>
                                          <th className="p-2 text-center font-medium text-muted-foreground">Nota</th>
                                          <th className="p-2 text-center font-medium text-muted-foreground">Status</th>
                                          <th className="p-2 text-center font-medium text-muted-foreground">Ação</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.evals.map((ev) => {
                                          const isExcluded = ev.excluded_from_ranking;
                                          const isAutoIneligible = isIneligibleEval(ev);
                                          return (
                                            <tr key={ev.id} className={`border-b border-border/30 last:border-0 ${isExcluded ? "opacity-50 bg-muted/30" : ""}`}>
                                              <td className="p-2 pl-12 font-mono">{ev.protocolo || "—"}</td>
                                              <td className="p-2">{formatDateBR(ev.data)}</td>
                                              <td className="p-2 text-center font-bold">
                                                {isAutoIneligible ? "—" : formatNota(ev.nota)}
                                              </td>
                                              <td className="p-2 text-center">
                                                {isExcluded ? (
                                                  <TooltipProvider delayDuration={200}>
                                                    <Tooltip>
                                                      <TooltipTrigger>
                                                        <Badge className="bg-destructive/10 text-destructive text-[10px] gap-1">
                                                          <Ban className="h-2.5 w-2.5" /> Excluída
                                                        </Badge>
                                                      </TooltipTrigger>
                                                      <TooltipContent className="max-w-xs">
                                                        <p className="text-xs"><strong>Motivo:</strong> {ev.exclusion_reason}</p>
                                                        <p className="text-xs"><strong>Por:</strong> {ev.excluded_by}</p>
                                                        <p className="text-xs"><strong>Em:</strong> {formatDateBR(ev.excluded_at)}</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </TooltipProvider>
                                                ) : isAutoIneligible ? (
                                                  <Badge className="bg-muted text-muted-foreground text-[10px]">Inelegível (auto)</Badge>
                                                ) : (
                                                  <Badge className="bg-accent/15 text-accent text-[10px]">Válida</Badge>
                                                )}
                                              </td>
                                              <td className="p-2 text-center">
                                                {isClosed ? (
                                                  <span className="text-[10px] text-muted-foreground italic">Mês fechado</span>
                                                ) : isExcluded ? (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[10px] gap-1 text-primary"
                                                    onClick={(e) => { e.stopPropagation(); setRestoreEvalId(ev.id); }}
                                                  >
                                                    <RotateCcw className="h-3 w-3" /> Restaurar
                                                  </Button>
                                                ) : !isAutoIneligible ? (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[10px] gap-1 text-destructive"
                                                    onClick={(e) => { e.stopPropagation(); openExcludeDialog(ev.id); }}
                                                  >
                                                    <Ban className="h-3 w-3" /> Excluir
                                                  </Button>
                                                ) : null}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer summary */}
                <div className="border-t border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {stats.elegiveis} atendente{stats.elegiveis !== 1 ? "s" : ""} elegível{stats.elegiveis !== 1 ? "is" : ""} de {stats.totalAtendentes}
                    {stats.excludedCount > 0 && <span> · {stats.excludedCount} mentoria{stats.excludedCount !== 1 ? "s" : ""} excluída{stats.excludedCount !== 1 ? "s" : ""}</span>}
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

      {/* Exclude Dialog */}
      <Dialog open={excludeDialogOpen} onOpenChange={setExcludeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Excluir mentoria da apuração
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              A mentoria será marcada como "Excluída da apuração" e não entrará no cálculo de nota, classificação e bônus. O registro será mantido no histórico.
            </p>
            <div className="space-y-2">
              <Label>Motivo da exclusão *</Label>
              <Select value={excludeReason} onValueChange={setExcludeReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {EXCLUSION_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {excludeReason === "Outro" && (
              <div className="space-y-2">
                <Label>Especifique o motivo *</Label>
                <Input
                  placeholder="Descreva o motivo..."
                  value={excludeCustomReason}
                  onChange={(e) => setExcludeCustomReason(e.target.value)}
                  maxLength={200}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcludeDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleExclude}
              disabled={excludeSaving || (!excludeReason || (excludeReason === "Outro" && !excludeCustomReason.trim()))}
            >
              {excludeSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!restoreEvalId} onOpenChange={() => setRestoreEvalId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Restaurar mentoria
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja restaurar esta mentoria à apuração? Ela voltará a impactar a nota, classificação e bônus do atendente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreEvalId(null)}>Cancelar</Button>
            <Button onClick={handleRestore} disabled={restoreSaving}>
              {restoreSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Restaurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Month Confirmation Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Fechar mentoria do mês
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Deseja fechar a apuração de <strong>{getMonthLabel(year, month)}</strong>? Após o fechamento, não será possível excluir ou restaurar mentorias sem reabrir o mês.
            </p>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Mentorias válidas</span><strong>{stats.totalMentorias}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Nota média</span><strong>{stats.mediaGeral.toFixed(1).replace(".", ",")}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Atendentes elegíveis</span><strong>{stats.elegiveis}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total bônus</span><strong className="text-accent">{formatBRL(stats.totalBonus)}</strong></div>
              {stats.excludedCount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Mentorias excluídas</span><strong>{stats.excludedCount}</strong></div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCloseMonth} disabled={closingSaving} className="gap-2">
              {closingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Confirmar fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Month Confirmation Dialog */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-warning" />
              Reabrir mês
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja reabrir a apuração de <strong>{getMonthLabel(year, month)}</strong>? Será possível excluir e restaurar mentorias novamente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReopenMonth} disabled={closingSaving} className="gap-2">
              {closingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RankingBonus;
