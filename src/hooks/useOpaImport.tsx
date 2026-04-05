import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  listOpaAttendances,
  getOpaAttendanceMessages,
  type OpaAttendance,
  type OpaListParams,
} from "@/lib/opaProxyService";

export type OpaPanelState = "idle" | "loading-list" | "list" | "loading-messages" | "analyzing" | "error";

export interface UseOpaImportOptions {
  onTextReady: (text: string, meta: { protocolo: string; atendente: string; canal: string; attendanceId: string }) => void;
  isAnalyzing: boolean;
}

export function useOpaImport({ onTextReady, isAnalyzing }: UseOpaImportOptions) {
  const [state, setState] = useState<OpaPanelState>("idle");
  const [attendances, setAttendances] = useState<OpaAttendance[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAtendente, setFilterAtendente] = useState("todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const effectiveState: OpaPanelState = isAnalyzing ? "analyzing" : state;

  const atendentes = useMemo(() => {
    const names = new Set<string>();
    attendances.forEach((a) => {
      if (a.atendente?.trim()) names.add(a.atendente.trim());
    });
    return Array.from(names).sort();
  }, [attendances]);

  const buildParams = useCallback((): OpaListParams => {
    const params: OpaListParams = { limite: 100 };
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
      setLastFetch(new Date());
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

  return {
    // State
    state: effectiveState,
    attendances,
    filteredAttendances,
    total,
    selectedId,
    errorMsg,
    lastFetch,
    isLoading,
    hasData,
    activeFilters,
    atendentes,

    // Filters
    searchTerm,
    setSearchTerm,
    filterAtendente,
    setFilterAtendente,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,

    // Actions
    fetchList,
    handleSelect,
    resetToIdle: () => setState("idle"),
    formatDate,
  };
}
