import { useState, useCallback } from "react";
import { Radio, Loader2, RefreshCw, AlertCircle, CheckCircle2, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  listOpaAttendances,
  getOpaAttendanceMessages,
  type OpaAttendance,
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

  const effectiveState: PanelState = isAnalyzing ? "analyzing" : state;

  const fetchList = useCallback(async () => {
    setState("loading-list");
    setErrorMsg("");
    try {
      const res = await listOpaAttendances(100);
      setAttendances(res.attendances || []);
      setTotal(res.total ?? res.attendances?.length ?? 0);
      setState("list");
    } catch (err: any) {
      console.error("[OpaImport] list error:", err);
      setErrorMsg(err?.message || "Erro ao buscar atendimentos");
      setState("error");
      toast.error("Erro ao buscar atendimentos da Opa Suite");
    }
  }, []);

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

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d;
    }
  };

  // Idle state
  if (effectiveState === "idle") {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Radio className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-foreground mb-1">Importar da Opa Suite</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Busque atendimentos finalizados diretamente da Opa Suite e envie para análise do Radar Insight.
            </p>
          </div>
          <Button onClick={fetchList} className="gap-2">
            <Radio className="h-4 w-4" />
            Buscar atendimentos
          </Button>
        </div>
      </Card>
    );
  }

  // Loading list
  if (effectiveState === "loading-list") {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Buscando atendimentos na Opa Suite...</p>
        </div>
      </Card>
    );
  }

  // Loading messages
  if (effectiveState === "loading-messages") {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Carregando mensagens do atendimento...</p>
          <p className="text-xs text-muted-foreground">Preparando texto para análise</p>
        </div>
      </Card>
    );
  }

  // Analyzing
  if (effectiveState === "analyzing") {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-base font-semibold text-foreground">Analisando atendimento...</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            O Radar Insight está processando o atendimento importado da Opa Suite.
          </p>
        </div>
      </Card>
    );
  }

  // Error state
  if (effectiveState === "error") {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="p-3 rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-foreground">Erro ao conectar com a Opa Suite</p>
          <p className="text-xs text-muted-foreground text-center max-w-sm">{errorMsg}</p>
          <div className="flex gap-2">
            <Button onClick={fetchList} variant="outline" className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Button onClick={() => setState("idle")} variant="ghost">
              Voltar
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // List state
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Atendimentos Opa Suite</h3>
          <Badge variant="outline" className="text-[10px]">{total} encontrados</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchList} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {attendances.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum atendimento encontrado.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchList}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="overflow-auto max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Protocolo</TableHead>
                <TableHead className="text-xs">Canal</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Início</TableHead>
                <TableHead className="text-xs">Fim</TableHead>
                <TableHead className="text-xs text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendances.map((att) => (
                <TableRow
                  key={att.id}
                  className={`cursor-pointer transition-colors ${selectedId === att.id ? "bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  <TableCell className="text-xs font-medium">{att.protocolo || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{att.canal || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${att.status === "F" ? "bg-accent/10 text-accent border-accent/30" : "bg-muted text-muted-foreground"}`}
                    >
                      {att.status === "F" ? "Finalizado" : att.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(att.data_inicio)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(att.data_fim)}</TableCell>
                  <TableCell className="text-right">
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
    </Card>
  );
};

export default OpaImportPanel;
