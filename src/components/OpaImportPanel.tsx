import { useState, useCallback, useMemo } from "react";
import { Radio, Loader2, RefreshCw, AlertCircle, MessageSquareQuote, Search, CalendarIcon, X } from "lucide-react";
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

  const buildParams = useCallback((): OpaListParams => {
    const params: OpaListParams = { limite: 100 };
    // Always fetch finalized by default
    params.status = "F";
    if (dateFrom) params.dataInicio = format(dateFrom, "yyyy-MM-dd");
    if (dateTo) params.dataFim = format(dateTo, "yyyy-MM-dd");
    return params;
  }, [dateFrom, dateTo]);

  const fetchList = useCallback(async () => {
    setState("loading-list");
    setErrorMsg("");
    try {
      const res = await listOpaAttendances(buildParams());
      setAttendances(res.attendances || []);
      setTotal(res.total ?? res.attendances?.length ?? 0);
      setState("list");
    } catch (err: any) {
      console.error("[OpaImport] list error:", err);
      setErrorMsg(err?.message || "Erro ao buscar atendimentos");
      setState("error");
      toast.error("Erro ao buscar atendimentos da Opa Suite");
    }
  }, [buildParams]);

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

    // Atendente filter
    if (filterAtendente === "sem_atendente") {
      result = result.filter((a) => !a.atendente?.trim());
    } else if (filterAtendente !== "todos") {
      result = result.filter((a) => a.atendente?.trim() === filterAtendente);
    }

    // Search
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

  // ── Idle state — prompt to fetch ──
  if (effectiveState === "idle") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Radio className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Importar da Opa Suite</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Busque atendimentos finalizados da Opa Suite para analisar no Radar Insight.
            </p>
          </div>
          <Button onClick={fetchList} className="gap-2">
            <Search className="h-4 w-4" />
            Buscar atendimentos
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading list ──
  if (effectiveState === "loading-list") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Buscando atendimentos...</p>
        </div>
      </div>
    );
  }

  // ── Loading messages ──
  if (effectiveState === "loading-messages") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Carregando mensagens do atendimento...</p>
          <p className="text-xs text-muted-foreground">Preparando texto para análise</p>
        </div>
      </div>
    );
  }

  // ── Analyzing ──
  if (effectiveState === "analyzing") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-base font-semibold text-foreground">Analisando atendimento...</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            O Radar Insight está processando o atendimento importado.
          </p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (effectiveState === "error") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="p-3 rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-foreground">Erro ao conectar com a Opa Suite</p>
          <p className="text-xs text-muted-foreground text-center max-w-sm">{errorMsg}</p>
          <div className="flex gap-2">
            <Button onClick={fetchList} variant="outline" size="sm" className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
            <Button onClick={() => setState("idle")} variant="ghost" size="sm" className="text-xs">
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── List state — with filters matching MentoriaLab pattern ──
  return (
    <div className="space-y-4">
      {/* ── Filter bar — same pattern as MentoriaLab main filters ── */}
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar protocolo, canal ou atendente..."
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
            <TooltipContent side="bottom"><p>Filtre por protocolo, canal ou nome do atendente</p></TooltipContent>
          </Tooltip>

          {/* Atendente selector */}
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

          {/* Period — range calendar */}
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
            <TooltipContent side="bottom"><p>Filtrar atendimentos por período</p></TooltipContent>
          </Tooltip>

          {/* Counter */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-auto text-xs text-muted-foreground cursor-default">
                {filteredAttendances.length} de {attendances.length}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Total exibido / total carregado</p></TooltipContent>
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
        </div>
      </TooltipProvider>

      {/* ── Table ── */}
      {filteredAttendances.length === 0 ? (
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
      ) : (
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
      )}
    </div>
  );
};

export default OpaImportPanel;
