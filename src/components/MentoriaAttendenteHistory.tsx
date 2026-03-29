import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Search } from "lucide-react";

interface HistoryRecord {
  id: string;
  protocolo: string | null;
  created_at: string;
  nota_interna: number | null;
  resultado: any;
  pontos_melhoria: string[] | null;
}

interface Props {
  userId: string;
}

const MentoriaAttendenteHistory = ({ userId }: Props) => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [detailRecord, setDetailRecord] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("preventive_mentorings")
        .select("id, protocolo, created_at, nota_interna, resultado, pontos_melhoria")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setRecords(data ?? []);
      setLoading(false);
    };
    load();
  }, [userId]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    records.forEach((r) => {
      const d = new Date(r.created_at);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(months).sort().reverse();
  }, [records]);

  const filtered = useMemo(() => {
    let list = records;
    if (selectedMonth !== "all") {
      list = list.filter((r) => {
        const d = new Date(r.created_at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === selectedMonth;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.protocolo?.toLowerCase().includes(q));
    }
    return list;
  }, [records, selectedMonth, search]);

  const noteColor = (n: number | null) => {
    if (n == null) return "text-muted-foreground";
    if (n >= 9) return "text-emerald-600";
    if (n >= 7) return "text-blue-600";
    if (n >= 5) return "text-amber-600";
    return "text-destructive";
  };

  const getStrengths = (r: HistoryRecord) => {
    const res = r.resultado as any;
    return (res?.pontosFortes ?? []).slice(0, 2).join(", ").slice(0, 60) || "—";
  };

  const getImprovements = (r: HistoryRecord) => {
    return (r.pontos_melhoria ?? []).slice(0, 2).join(", ").slice(0, 60) || "—";
  };

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  if (loading) return null;

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-bold text-foreground">📋 Meu Histórico</h3>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por protocolo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Todos os meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mentoria encontrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-2 text-left font-medium text-muted-foreground">Protocolo</th>
                <th className="p-2 text-left font-medium text-muted-foreground">Data</th>
                <th className="p-2 text-center font-medium text-muted-foreground">Nota</th>
                <th className="p-2 text-left font-medium text-muted-foreground">Pontos Fortes</th>
                <th className="p-2 text-left font-medium text-muted-foreground">Oportunidades</th>
                <th className="p-2 text-center font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-2 font-mono">{r.protocolo || "—"}</td>
                  <td className="p-2">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-2 text-center">
                    <span className={`font-bold ${noteColor(r.nota_interna)}`}>
                      {r.nota_interna != null ? r.nota_interna.toFixed(1) : "—"}
                    </span>
                  </td>
                  <td className="p-2 max-w-[180px] truncate text-muted-foreground">{getStrengths(r)}</td>
                  <td className="p-2 max-w-[180px] truncate text-muted-foreground">{getImprovements(r)}</td>
                  <td className="p-2 text-center">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setDetailRecord(r)}>
                      <Eye className="h-3 w-3 mr-0.5" /> Ver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailRecord} onOpenChange={(open) => !open && setDetailRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Mentoria</DialogTitle>
          </DialogHeader>
          {detailRecord?.resultado && (() => {
            const res = detailRecord.resultado as any;
            return (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Protocolo: {res.protocolo || "—"}</p>
                    <p className="text-xs text-muted-foreground">Atendente: {res.atendente || "—"}</p>
                    <p className="text-xs text-muted-foreground">Tipo: {res.tipo || "—"}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase">Ref. Interna</p>
                    <p className={`text-2xl font-black ${noteColor(res.notaInterna)}`}>
                      {res.notaInterna?.toFixed(1)}
                    </p>
                    <Badge variant="outline" className="text-[10px] mt-1">Não oficial</Badge>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <p className="text-xs text-amber-700">
                    📌 Esta nota é para sua mentoria pessoal e não tem caráter oficial.
                    Ela não afeta seu bônus nem sua avaliação formal.
                  </p>
                </div>

                {res.resumoGeral && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">Resumo Geral</h4>
                    <p className="text-xs text-muted-foreground">{res.resumoGeral}</p>
                  </div>
                )}

                {res.pontosFortes?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">✅ Pontos Fortes</h4>
                    <ul className="space-y-1">
                      {res.pontosFortes.map((p: string, i: number) => (
                        <li key={i} className="text-xs text-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {res.oportunidadesMelhoria?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">💡 Oportunidades de Melhoria</h4>
                    {res.oportunidadesMelhoria.map((o: any, i: number) => (
                      <div key={i} className="p-2 rounded bg-muted/40 border border-border mb-2">
                        <p className="text-xs font-medium">{o.criterio}</p>
                        <p className="text-[11px] text-muted-foreground">{o.sugestao}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MentoriaAttendenteHistory;
