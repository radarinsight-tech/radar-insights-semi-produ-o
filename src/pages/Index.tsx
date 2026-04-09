import { useState, useMemo, useEffect, useCallback } from "react";
import { useRef } from "react";
import { formatDateTimeBR } from "@/lib/utils";
import { useUserSectors } from "@/hooks/useUserSectors";
import { useExcludedAttendants } from "@/hooks/useExcludedAttendants";
import ErrorBoundary from "@/components/ErrorBoundary";
import HistoryTable from "@/components/HistoryTable";
import Filters, { type FilterValues } from "@/components/Filters";
import StatsWidgets, { type StatusFilter } from "@/components/StatsWidgets";
import { matchesStatusFilter, getStatusLabel } from "@/lib/auditStatus";
import ScoreEvolutionChart from "@/components/ScoreEvolutionChart";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAttendantName } from "@/lib/officialEvaluations";
import { LogOut, Users, Search, ArrowLeft, X, BarChart3, Info, CheckCircle2, AlertTriangle, EyeOff, ListFilter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logoSymbol from "@/assets/logo-symbol.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import type { HistoryEntry } from "@/lib/mockData";

/** Parse dd/MM/yyyy to a Date object */
const parseDateBR = (str: string): Date | null => {
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Index = () => {
  const navigate = useNavigate();

  const { sectors, isAdmin: isSectorAdmin, loading: sectorsLoading } = useUserSectors();
  const { excludedSet, refreshExcludedAttendants } = useExcludedAttendants();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filters, setFilters] = useState<FilterValues>({
    atendentes: [],
    periodo: "",
  });
  const [protocolSearch, setProtocolSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [showCharts, setShowCharts] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "stale">("synced");
  const [tableVisible, setTableVisible] = useState(true);
  const lastLoadRef = useRef<number>(Date.now());

  const sectorIds = useMemo(() => sectors.map((s) => s.id), [sectors]);
  const normalizedExcludedAttendants = useMemo(
    () => new Set(Array.from(excludedSet, (name) => normalizeAttendantName(name))),
    [excludedSet],
  );

  const loadHistory = useCallback(
    async (excludedAttendants = normalizedExcludedAttendants) => {
      try {
        const { data, error } = await supabase
          .from("evaluations")
          .select("*")
          .eq("resultado_validado", true)
          .eq("excluded_from_ranking", false)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading history:", error);
          return;
        }

        const visibleRows = (data || [])
          .filter((row: any) => {
            if (isSectorAdmin) return true;
            if (!row.sector_id) return true;
            return sectorIds.includes(row.sector_id);
          })
          .filter((row: any) => {
            return !excludedAttendants.has(normalizeAttendantName(row.atendente));
          });

        const rows = Array.from(
          visibleRows
            .reduce((map: Map<string, any>, row: any) => {
              const protocolKey =
                typeof row.protocolo === "string" && row.protocolo.trim().length > 0 ? row.protocolo.trim() : row.id;

              if (!map.has(protocolKey)) {
                map.set(protocolKey, row);
              }

              return map;
            }, new Map<string, any>())
            .values(),
        );

        console.log("[Atualizar] Dados recarregados do backend:", rows.length, "registros oficiais");
        lastLoadRef.current = Date.now();
        setSyncStatus("synced");
        setHistory(
          rows.map((row: any) => ({
            id: row.id,
            data: row.data || "",
            data_avaliacao: row.data_avaliacao ? formatDateTimeBR(row.data_avaliacao) : "",
            protocolo: row.protocolo || "—",
            atendente: row.atendente || "—",
            nota: Number(row.nota) || 0,
            classificacao: row.classificacao || "—",
            bonus: row.bonus ?? false,
            tipo: row.tipo || "—",
            atualizacao_cadastral: row.atualizacao_cadastral || "Não",
            pontos_melhoria: Array.isArray(row.pontos_melhoria) ? row.pontos_melhoria : [],
            pdf_url: row.pdf_url || undefined,
            full_report: row.full_report || null,
            audit_log: row.audit_log || null,
          })),
        );
      } catch (err) {
        console.error("Error loading history (uncaught):", err);
      }
    },
    [isSectorAdmin, normalizedExcludedAttendants, sectorIds],
  );

  const refreshOfficialData = useCallback(async () => {
    const freshExcludedNames = await refreshExcludedAttendants();
    const freshNormalizedExcluded = new Set(
      Array.from(freshExcludedNames.values(), (entry) => normalizeAttendantName(entry.nome)),
    );
    await loadHistory(freshNormalizedExcluded);
  }, [loadHistory, refreshExcludedAttendants]);

  useEffect(() => {
    void refreshOfficialData();
  }, [refreshOfficialData]);

  // Mark stale after 5 minutes of inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastLoadRef.current > 5 * 60 * 1000) {
        setSyncStatus("stale");
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const atendentes = useMemo(() => [...new Set(history.map((e) => e.atendente))].sort(), [history]);

  const baseFiltered = useMemo(() => {
    return history.filter((e) => {
      if (protocolSearch && !e.protocolo.toLowerCase().includes(protocolSearch.toLowerCase())) return false;
      if (filters.atendentes.length > 0 && !filters.atendentes.includes(e.atendente)) return false;

      if (filters.periodoInicio && filters.periodoFim) {
        const entryDate = parseDateBR(e.data);
        const startDate = parseDateBR(filters.periodoInicio);
        const endDate = parseDateBR(filters.periodoFim);
        if (entryDate && startDate && endDate) {
          if (entryDate < startDate || entryDate > endDate) return false;
        }
      } else if (filters.periodoInicio && !filters.periodoFim) {
        const entryDate = parseDateBR(e.data);
        const startDate = parseDateBR(filters.periodoInicio);
        if (entryDate && startDate && entryDate < startDate) return false;
      } else if (filters.periodo) {
        const [year, month] = filters.periodo.split("-");
        const parts = e.data.split("/");
        if (parts.length >= 3 && (parts[1] !== month || parts[2] !== year)) return false;
      }

      return true;
    });
  }, [filters, history, protocolSearch]);

  const filtered = useMemo(() => {
    if (!statusFilter) return baseFiltered;
    return baseFiltered.filter((e) =>
      matchesStatusFilter(e.full_report as Record<string, unknown> | null | undefined, statusFilter),
    );
  }, [baseFiltered, statusFilter]);

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <h1 className="text-xl font-bold text-foreground">
            Radar Insight — <span className="text-primary">Avaliação Oficial</span>
          </h1>
          {/* Sync indicator */}
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full border ${
              syncStatus === "synced"
                ? "bg-accent/10 text-accent border-accent/20"
                : "bg-warning/10 text-warning border-warning/20"
            }`}
          >
            {syncStatus === "synced" ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Sincronizado
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" /> Desatualizado
              </>
            )}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navigate("/hub")}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/users")}>
              <Users className="h-4 w-4" />
              Usuários
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Info banner: no direct import */}
        <Card className="p-4 border-l-4 border-l-primary bg-primary/5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Avaliações Oficiais</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Este ambiente exibe apenas avaliações aprovadas no <strong>Mentoria Lab</strong>. Para importar e
                analisar novos atendimentos, acesse o Mentoria Lab.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs h-7"
                onClick={() => navigate("/mentoria-lab")}
              >
                Ir para o Mentoria Lab
              </Button>
            </div>
          </div>
        </Card>

        {/* Charts toggle card */}
        {filtered.length >= 2 && !showCharts && (
          <Card
            className="p-4 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
            onClick={() => setShowCharts(true)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">Ver Gráficos</h3>
                <p className="text-xs text-muted-foreground">Evolução de notas e ranking de atendentes</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {filtered.length} registros
              </Badge>
            </div>
          </Card>
        )}

        {showCharts && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Gráficos de Evolução
              </h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCharts(false)}>
                <X className="h-3.5 w-3.5" /> Fechar
              </Button>
            </div>
            <ErrorBoundary fallbackTitle="Erro nos gráficos">
              <ScoreEvolutionChart entries={filtered} />
            </ErrorBoundary>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <ErrorBoundary fallbackTitle="Erro nos filtros">
                <Filters
                  atendentes={atendentes}
                  filters={filters}
                  onChange={(f) => {
                    setFilters(f);
                    if (f.atendentes.length > 0 || f.periodo || f.periodoInicio) setTableVisible(true);
                  }}
                />
              </ErrorBoundary>
              <div className="relative w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar protocolo..."
                  value={protocolSearch}
                  onChange={(e) => {
                    setProtocolSearch(e.target.value);
                    if (e.target.value) setTableVisible(true);
                  }}
                  className="pl-8 bg-card"
                />
              </div>
              {/* Limpar Filtros button */}
              {(filters.atendentes.length > 0 || filters.periodo || filters.periodoInicio || protocolSearch || statusFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setFilters({ atendentes: [], periodo: "" });
                    setProtocolSearch("");
                    setStatusFilter(null);
                    setTableVisible(false);
                  }}
                >
                  <X className="h-3.5 w-3.5" /> Limpar Filtros
                </Button>
              )}
              {/* Esconder/Mostrar lista */}
              {tableVisible && !statusFilter && filters.atendentes.length === 0 && !protocolSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setTableVisible(false)}
                >
                  <EyeOff className="h-3.5 w-3.5" /> Recolher lista
                </Button>
              )}
            </div>
            {statusFilter && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-sm font-medium text-foreground">Filtrando: {getStatusLabel(statusFilter)}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setStatusFilter(null)}>
                  <X className="h-3 w-3 mr-1" /> Limpar filtro
                </Button>
              </div>
            )}
            {tableVisible ? (
              <ErrorBoundary fallbackTitle="Erro na tabela de histórico">
                <HistoryTable entries={filtered} onRefresh={refreshOfficialData} />
              </ErrorBoundary>
            ) : (
              <Card className="flex flex-col items-center justify-center py-16 px-6 text-center border-dashed border-2 border-muted-foreground/20 bg-muted/30">
                <ListFilter className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <h3 className="text-base font-semibold text-foreground mb-1">Selecione um filtro para visualizar</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Escolha um atendente, use a busca por protocolo ou clique em um dos cards laterais para exibir as avaliações.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setTableVisible(true)}
                >
                  Mostrar todos os registros
                </Button>
              </Card>
            )}
          </div>
          <ErrorBoundary fallbackTitle="Erro nos indicadores">
            <StatsWidgets
              entries={baseFiltered}
              activeStatusFilter={statusFilter}
              onStatusFilterChange={(s) => { setStatusFilter(s); if (s) setTableVisible(true); }}
            />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default Index;
