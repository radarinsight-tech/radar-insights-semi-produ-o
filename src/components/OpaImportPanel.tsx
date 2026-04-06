import { useState, useCallback, useMemo } from "react";
import { Radio, Loader2, RefreshCw, AlertCircle, MessageSquareQuote, Search, CalendarIcon, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  listOpaAttendances,
  getOpaAttendanceMessages,
  type OpaAttendance,
  type OpaListParams,
} from "@/lib/opaProxyService";

interface OpaImportPanelProps {
  onTextReady: (text: string, meta: { protocolo: string; atendente: string; canal: string; attendanceId: string }) => void;
  isAnalyzing: boolean;
}

type PanelState = "idle" | "loading-list" | "list" | "loading-messages" | "analyzing" | "error";

const OpaImportPanel = ({ onTextReady, isAnalyzing }: OpaImportPanelProps) => {
  const [state, setState] = useState<PanelState>("idle");
  const [attendances, setAttendances] = useState<OpaAttendance[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAtendente, setFilterAtendente] = useState("todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const effectiveState: PanelState = isAnalyzing ? "analyzing" : state;

  // Extract unique atendentes from loaded data
  const atendentes = useMemo(() => {
    const names = new Set<string>();
    attendances.forEach((a) => {
      if (a.atendente?.trim()) names.add(a.atendente.trim());
    });
    return Array.from(names).sort();
  }, [attendances]);

  const buildParams = useCallback((offset = 0): OpaListParams => {
    const params: OpaListParams = { limite: 100, offset };
    params.status = "F";
    if (dateFrom) params.dataInicio = format(dateFrom, "yyyy-MM-dd");
    if (dateTo) params.dataFim = format(dateTo, "yyyy-MM-dd");
    return params;
  }, [dateFrom, dateTo]);

  const fetchList = useCallback(async () => {
    setState("loading-list");
    setErrorMsg("");
    setCurrentOffset(0);
    try {
      const res = await listOpaAttendances(buildParams(0));
      setAttendances(res.attendances || []);
      setTotal(res.total ?? res.attendances?.length ?? 0);
      setHasMore(res.hasMore ?? false);
      setLastFetch(new Date());
      setState("list");
    } catch (err: any) {
      console.error("[OpaImport] list error:", err);
      setErrorMsg(err?.message || "Erro ao buscar atendimentos");
      setState("error");
      toast.error("Erro ao buscar atendimentos da Opa Suite");
    }
  }, [buildParams]);

  const fetchMore = useCallback(async () => {
    const nextOffset = currentOffset + 100;
    setLoadingMore(true);
    try {
      const res = await listOpaAttendances(buildParams(nextOffset));
      const newItems = (res.attendances || []);
      // Deduplicate by id
      setAttendances(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const unique = newItems.filter(a => !existingIds.has(a.id));
        return [...prev, ...unique];
      });
      setCurrentOffset(nextOffset);
      setHasMore(res.hasMore ?? false);
      setLastFetch(new Date());
      toast.success(`+${newItems.length} atendimentos carregados`);
    } catch (err: any) {
      console.error("[OpaImport] load more error:", err);
      toast.error(err?.message || "Erro ao carregar mais atendimentos");
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, currentOffset]);

  const handleSelect = useCallback(async (att: OpaAttendance) => {
    setSelectedId(att.id);
    setState("loading-messages");
    setErrorMsg("");
    try {
      const res = await getOpaAttendanceMessages(att.id);
      if (!res.structuredText?.trim()) {
        toast.error("Atendimento sem mensagens disponíveis");
        setState("list");
        setSelectedId(null);
        return;
      }
      onTextReady(res.structuredText, {
        protocolo: att.protocolo,
        atendente: att.atendente,
        canal: att.canal,
        attendanceId: att.id,
      });
    } catch (err: any) {
      console.error("[OpaImport] messages error:", err);
      setErrorMsg(err?.message || "Erro ao carregar mensagens");
      setState("error");
      setSelectedId(null);
      toast.error("Erro ao carregar mensagens do atendimento");
    }
  }, [onTextReady]);

  const filteredAttendances = useMemo(() => {
    let result = attendances;
    if (filterAtendente === "sem_atendente") {
      result = result.filter((a) => !a.atendente?.trim());
    } else if (filterAtendente !== "todos") {
      result = result.filter((a) => a.atendente?.trim() === filterAtendente);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((a) =>
        (a.protocolo || "").toLowerCase().includes(q) ||
        (a.canal || "").toLowerCase().includes(q) ||
        (a.atendente || "").toLowerCase().includes(q) ||
        (a.cliente || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [attendances, searchTerm, filterAtendente]);

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d;
    }
  };

  const isLoading = effectiveState === "loading-list" || effectiveState === "loading-messages" || effectiveState === "analyzing";
  const hasData = attendances.length > 0;

  const activeFilters = [
    filterAtendente !== "todos" ? 1 : 0,
    dateFrom ? 1 : 0,
    searchTerm.trim() ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // ── Top grid: Import card (left) + Info card (right) — mirrors Operação ──
  const renderTopGrid = () => {
    // Idle / no data: full-width import card (mirrors Operação empty state)
    if (!hasData && effectiveState === "idle") {
      return (
        <Card
          className={cn(
            "p-8 transition-all group text-center cursor-pointer hover:shadow-md hover:border-primary/40"
          )}
          onClick={fetchList}
        >
          <Radio className="h-8 w-8 text-primary mx-auto mb-3" />
          <h3 className="text-sm font-bold text-foreground mb-1">Importar da Opa Suite</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Busque atendimentos finalizados da Opa Suite para analisar no Radar Insight.
          </p>
        </Card>
      );
    }

    // Loading list (no data yet)
    if (!hasData && effectiveState === "loading-list") {
      return (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Buscando atendimentos da Opa Suite...</p>
        </Card>
      );
    }

    // Error (no data)
    if (!hasData && effectiveState === "error") {
      return (
        <Card className="p-8 text-center">
          <div className="p-3 rounded-full bg-destructive/10 w-fit mx-auto mb-3">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">Erro ao conectar com a Opa Suite</p>
          <p className="text-xs text-muted-foreground mb-3 max-w-sm mx-auto">{errorMsg}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={fetchList} variant="outline" size="sm" className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
            <Button onClick={() => setState("idle")} variant="ghost" size="sm" className="text-xs">
              Voltar
            </Button>
          </div>
        </Card>
      );
    }

    // Has data: 2-column grid like Operação
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Import card — left (col-span-3), mirrors upload card */}
        <Card className="lg:col-span-3 p-4">
          <div
            onClick={fetchList}
            className={cn(
              "border-2 border-dashed rounded-lg h-[110px] flex flex-col items-center justify-center transition-colors",
              isLoading
                ? "border-primary/40 bg-primary/5 cursor-default"
                : "border-primary/30 cursor-pointer hover:border-primary/50 hover:bg-primary/5"
            )}
          >
            {effectiveState === "loading-list" ? (
              <>
                <Loader2 className="h-5 w-5 text-primary animate-spin mb-1.5" />
                <p className="text-sm font-semibold text-primary">Buscando atendimentos...</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Conectando com a Opa Suite</p>
              </>
            ) : effectiveState === "loading-messages" ? (
              <>
                <Loader2 className="h-5 w-5 text-primary animate-spin mb-1.5" />
                <p className="text-sm font-semibold text-primary">Carregando mensagens...</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Preparando texto para análise</p>
              </>
            ) : effectiveState === "analyzing" ? (
              <>
                <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-1.5" />
                <p className="text-sm font-semibold text-primary">Analisando atendimento...</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Processando via Radar Insight</p>
              </>
            ) : (
              <>
                <Radio className="h-5 w-5 text-primary/60 mb-1.5" />
                <p className="text-sm font-medium text-muted-foreground">Atualizar lista da Opa Suite</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">clique para buscar novos atendimentos</p>
              </>
            )}
          </div>
        </Card>

        {/* Info card — right (col-span-2), mirrors "Último Lote" */}
        <Card className="lg:col-span-2 p-4 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Opa Suite</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{attendances.length} atendimentos</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-auto shrink-0 text-accent">
                  Finalizados
                </Badge>
              </div>
              {lastFetch && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Atualizado em {lastFetch.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Summary counters */}
          <>
            <div className="border-t border-border/50 my-2.5" />
            <div className="flex items-center gap-3 flex-wrap text-[11px]">
              <span className="font-semibold text-foreground">{filteredAttendances.length} Exibidos</span>
              {atendentes.length > 0 && (
                <span className="text-primary font-medium">👤 {atendentes.length} Atendentes</span>
              )}
              {activeFilters > 0 && (
                <span className="text-warning font-medium">🔍 {activeFilters} Filtro(s)</span>
              )}
            </div>
          </>
        </Card>
      </div>
    );
  };

  // ── Filters bar — mirrors Operação exactly ──
  const renderFilters = () => {
    if (!hasData) return null;

    return (
      <div className="flex flex-wrap items-center gap-3">
        <TooltipProvider delayDuration={300}>
          {/* Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar atendente ou protocolo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Digite o nome do atendente ou número do protocolo para filtrar</p></TooltipContent>
          </Tooltip>

          {/* Atendente */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select value={filterAtendente} onValueChange={setFilterAtendente}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos atendentes</SelectItem>
                    <SelectItem value="sem_atendente">Sem atendente</SelectItem>
                    {atendentes.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Filtrar por atendente específico</p></TooltipContent>
          </Tooltip>

          {/* Period */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[180px] justify-start text-left text-xs font-normal h-10",
                        !dateFrom && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {dateFrom
                        ? dateTo
                          ? `${format(dateFrom, "dd/MM")} – ${format(dateTo, "dd/MM/yy")}`
                          : `A partir de ${format(dateFrom, "dd/MM/yy")}`
                        : "Período"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={
                        dateFrom && dateTo
                          ? { from: dateFrom, to: dateTo }
                          : dateFrom
                            ? { from: dateFrom, to: undefined }
                            : undefined
                      }
                      onSelect={(range) => {
                        setDateFrom(range?.from);
                        setDateTo(range?.to);
                      }}
                      locale={ptBR}
                      numberOfMonths={2}
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {(dateFrom || dateTo) && (
                      <div className="px-3 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => {
                            setDateFrom(undefined);
                            setDateTo(undefined);
                          }}
                        >
                          Limpar período
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Filtrar atendimentos por período de data</p></TooltipContent>
          </Tooltip>

          {/* Counter */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-auto text-xs text-muted-foreground cursor-default">
                {filteredAttendances.length} de {attendances.length}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Total de atendimentos exibidos / total carregado</p></TooltipContent>
          </Tooltip>

          {/* Refresh */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={fetchList}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Atualizar lista de atendimentos</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  // ── Table ──
  const renderTable = () => {
    if (!hasData) return null;

    if (filteredAttendances.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {attendances.length === 0
              ? "Nenhum atendimento encontrado com os filtros aplicados."
              : `Nenhum resultado para "${searchTerm}".`}
          </p>
          <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={fetchList}>
            Atualizar lista
          </Button>
        </div>
      );
    }

    return (
      <div className="overflow-y-auto max-h-[480px] rounded-lg border border-border">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[18%]">Protocolo</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[12%]">Canal</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[12%]">Status</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[20%]">Início</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[20%]">Fim</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right w-[18%] pr-5">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAttendances.map((att) => (
              <TableRow
                key={att.id}
                className={cn(
                  "transition-colors",
                  selectedId === att.id ? "bg-primary/5" : "hover:bg-muted/50"
                )}
              >
                <TableCell className="text-xs font-medium truncate">{att.protocolo || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] capitalize">{att.canal || "—"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      att.status === "F"
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {att.status === "F" ? "Finalizado" : att.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground truncate">{formatDate(att.data_inicio)}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate">{formatDate(att.data_fim)}</TableCell>
                <TableCell className="text-right pr-5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5"
                    onClick={() => handleSelect(att)}
                    disabled={selectedId === att.id}
                  >
                    <MessageSquareQuote className="h-3 w-3" />
                    Analisar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderTopGrid()}
      {renderFilters()}
      {renderTable()}
    </div>
  );
};

export default OpaImportPanel;
