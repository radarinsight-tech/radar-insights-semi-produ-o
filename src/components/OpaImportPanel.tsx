import { useState, useCallback, useMemo } from "react";
import { Radio, Loader2, RefreshCw, AlertCircle, MessageSquareQuote, Search, CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [statusFilter, setStatusFilter] = useState("F");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const effectiveState: PanelState = isAnalyzing ? "analyzing" : state;

  const buildParams = useCallback((): OpaListParams => {
    const params: OpaListParams = { limite: 100 };
    if (statusFilter && statusFilter !== "todos") params.status = statusFilter;
    if (dateFrom) params.dataInicio = format(dateFrom, "yyyy-MM-dd");
    if (dateTo) params.dataFim = format(dateTo, "yyyy-MM-dd");
    return params;
  }, [statusFilter, dateFrom, dateTo]);

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
    if (!searchTerm.trim()) return attendances;
    const q = searchTerm.toLowerCase();
    return attendances.filter((a) =>
      (a.protocolo || "").toLowerCase().includes(q) ||
      (a.canal || "").toLowerCase().includes(q) ||
      (a.atendente || "").toLowerCase().includes(q) ||
      (a.cliente || "").toLowerCase().includes(q)
    );
  }, [attendances, searchTerm]);

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d;
    }
  };

  const clearDates = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // ── Filter bar (reused across states) ──
  const FilterBar = () => (
    <div className="flex flex-wrap items-end gap-3 px-5 py-4 border-b border-border bg-muted/30">
      {/* Search */}
      <div className="space-y-1 flex-1 min-w-[180px] max-w-[280px]">
        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Busca</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Protocolo, canal ou atendente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-xs bg-background"
          />
        </div>
      </div>

      {/* Status */}
      <div className="space-y-1 min-w-[130px]">
        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-xs bg-background w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="F">Finalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date From */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">De</Label>
        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-9 w-[140px] justify-start text-left text-xs bg-background", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(d) => { setDateFrom(d); setDateFromOpen(false); }}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Date To */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Até</Label>
        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-9 w-[140px] justify-start text-left text-xs bg-background", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(d) => { setDateTo(d); setDateToOpen(false); }}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {(dateFrom || dateTo) && (
        <Button variant="ghost" size="icon" className="h-9 w-9 mt-auto" onClick={clearDates} aria-label="Limpar datas">
          <X className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Fetch / Refresh */}
      <Button size="sm" className="h-9 gap-1.5 text-xs mt-auto" onClick={fetchList} disabled={effectiveState === "loading-list"}>
        {effectiveState === "loading-list" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {state === "idle" ? "Buscar" : "Atualizar"}
      </Button>
    </div>
  );

  // ── Idle state ──
  if (effectiveState === "idle") {
    return (
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Importar da Opa Suite</h3>
        </div>
        <FilterBar />
        <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center px-6">
          <div className="p-3 rounded-full bg-primary/10">
            <Radio className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Configure os filtros acima e clique em <strong>Buscar</strong> para listar atendimentos da Opa Suite.
          </p>
        </div>
      </Card>
    );
  }

  // ── Loading list ──
  if (effectiveState === "loading-list") {
    return (
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Importar da Opa Suite</h3>
        </div>
        <FilterBar />
        <div className="flex flex-col items-center justify-center py-14 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Buscando atendimentos...</p>
        </div>
      </Card>
    );
  }

  // ── Loading messages ──
  if (effectiveState === "loading-messages") {
    return (
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Importar da Opa Suite</h3>
        </div>
        <FilterBar />
        <div className="flex flex-col items-center justify-center py-14 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Carregando mensagens do atendimento...</p>
          <p className="text-xs text-muted-foreground">Preparando texto para análise</p>
        </div>
      </Card>
    );
  }

  // ── Analyzing ──
  if (effectiveState === "analyzing") {
    return (
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Importar da Opa Suite</h3>
        </div>
        <FilterBar />
        <div className="flex flex-col items-center justify-center py-14 space-y-3">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-base font-semibold text-foreground">Analisando atendimento...</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            O Radar Insight está processando o atendimento importado.
          </p>
        </div>
      </Card>
    );
  }

  // ── Error state ──
  if (effectiveState === "error") {
    return (
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Importar da Opa Suite</h3>
        </div>
        <FilterBar />
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
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
      </Card>
    );
  }

  // ── List state ──
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Atendimentos Opa Suite</h3>
          <Badge variant="outline" className="text-[10px]">{total} encontrados</Badge>
        </div>
      </div>
      <FilterBar />

      {filteredAttendances.length === 0 ? (
        <div className="py-12 text-center px-6">
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
        <div className="overflow-y-auto max-h-[480px]">
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

      {filteredAttendances.length > 0 && searchTerm && (
        <div className="px-5 py-2 border-t border-border text-[10px] text-muted-foreground">
          Mostrando {filteredAttendances.length} de {attendances.length} atendimentos
        </div>
      )}
    </Card>
  );
};

export default OpaImportPanel;
