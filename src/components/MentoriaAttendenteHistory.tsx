import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Eye, Search, FileText, Lock, ChevronDown, ChevronRight } from "lucide-react";

/* ── Evaluation guide tips for the 19 criteria ─────────────────────── */
const EVALUATION_TIPS: Record<number, string> = {
  1: "Como atendente, você deve cumprimentar o cliente pelo nome e se identificar claramente. Tente sempre iniciar com 'Olá [nome], aqui é [seu nome] da [empresa]. Como posso ajudá-lo?'",
  2: "Como atendente, você deve ouvir ativamente e confirmar o que o cliente precisa antes de oferecer solução. Tente reformular: 'Entendi, você está com dificuldade em X, correto?'",
  3: "Como atendente, você deve usar linguagem simples e direta. Evite termos técnicos sem explicação. Confirme se o cliente entendeu.",
  4: "Como atendente, responda em no máximo 2 minutos. Se precisar de tempo, avise: 'Vou verificar e já retorno!'",
  5: "Como atendente, apresente a solução de forma clara e confirme se resolve o problema antes de encerrar.",
  6: "Como atendente, demonstre que entende o sentimento do cliente. Use frases como 'Entendo sua situação' ou 'Vou fazer o possível para resolver.'",
  7: "Como atendente, guie a conversa com direção clara, sem deixar o cliente sem resposta ou em silêncio prolongado.",
  8: "Como atendente, use o nome do cliente ao menos 2 vezes durante o atendimento para personalizar a experiência.",
  9: "Como atendente, encerre confirmando a resolução: 'Fico feliz em ter ajudado! Qualquer dúvida, pode chamar.'",
  10: "Como atendente, revise as mensagens antes de enviar. Use o corretor do celular como apoio.",
  11: "Como atendente, se a solução principal não estiver disponível, sempre ofereça uma alternativa viável.",
  12: "Como atendente, registre o atendimento corretamente no sistema durante ou logo após a conversa.",
  13: "Como atendente, verifique se o problema foi resolvido após a solução, com uma mensagem de confirmação.",
  14: "Como atendente, mantenha tom cordial e profissional. Evite gírias em excesso com clientes que não deram esse tom.",
  15: "Como atendente, deixe o cliente terminar antes de responder. Nunca suponha a necessidade antes de ouvir.",
  16: "Como atendente, antecipe necessidades. Se perceber outra dúvida relacionada, ofereça a informação antes de o cliente perguntar.",
  17: "Como atendente, o objetivo é resolver na primeira interação. Evite transferências desnecessárias.",
  18: "Como atendente, mantenha a calma, peça desculpas pelo inconveniente e foque na solução, não na justificativa.",
  19: "Como atendente, a nota final reflete sua evolução contínua. Foque nos critérios com pontuação mais baixa — são suas maiores oportunidades de crescimento.",
};

interface HistoryRecord {
  id: string;
  protocolo: string | null;
  created_at: string;
  nota_interna: number | null;
  resultado: any;
  pontos_melhoria: string[] | null;
  nota_liberada: boolean;
  atendente: string | null;
  status: string | null;
}

interface Props {
  userId: string;
  isAdmin?: boolean;
}

const MentoriaAttendenteHistory = ({ userId, isAdmin = false }: Props) => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [detailRecord, setDetailRecord] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("preventive_mentorings")
        .select("id, protocolo, created_at, nota_interna, resultado, pontos_melhoria, nota_liberada, atendente, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setRecords((data as any[]) ?? []);
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
    return (res?.pontosFortes ?? []).slice(0, 2);
  };

  const getImprovements = (r: HistoryRecord) => {
    return (r.pontos_melhoria ?? []).slice(0, 2);
  };

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  const toggleNotaLiberada = async (record: HistoryRecord) => {
    const newVal = !record.nota_liberada;
    await supabase
      .from("preventive_mentorings")
      .update({ nota_liberada: newVal } as any)
      .eq("id", record.id);
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, nota_liberada: newVal } : r))
    );
  };

  const renderNota = (r: HistoryRecord) => {
    const canSeeNote = isAdmin || r.nota_liberada;
    if (!canSeeNote) {
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-muted-foreground cursor-default">
                <Lock className="h-3 w-3" /> 🔒
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-foreground text-background text-xs">
              <p>Nota em análise pelo gestor</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <span className={`font-bold ${noteColor(r.nota_interna)}`}>
        {r.nota_interna != null ? (r.nota_interna > 10 ? (r.nota_interna / 10).toFixed(1) : r.nota_interna.toFixed(1)) : "—"}
      </span>
    );
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
                {isAdmin && (
                  <th className="p-2 text-center font-medium text-muted-foreground">Liberar Nota</th>
                )}
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
                  <td className="p-2 text-center">{renderNota(r)}</td>
                  {isAdmin && (
                    <td className="p-2 text-center">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex">
                              <Switch
                                checked={r.nota_liberada}
                                onCheckedChange={() => toggleNotaLiberada(r)}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-foreground text-background text-xs">
                            <p>{r.nota_liberada ? "Ocultar nota" : "Liberar nota para o atendente"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  )}
                  <td className="p-2 max-w-[180px] truncate text-muted-foreground">
                    {getStrengths(r).join(", ").slice(0, 60) || "—"}
                  </td>
                  <td className="p-2 max-w-[180px] truncate text-muted-foreground">
                    {getImprovements(r).join(", ").slice(0, 60) || "—"}
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Quick preview popover */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 space-y-2" align="end">
                          <p className="text-xs font-bold text-foreground">Resumo Rápido</p>
                          <div className="space-y-1 text-[11px]">
                            <p><span className="text-muted-foreground">Protocolo:</span> {r.protocolo || "—"}</p>
                            <p><span className="text-muted-foreground">Data:</span> {new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                            <p><span className="text-muted-foreground">Atendente:</span> {r.atendente || "—"}</p>
                            <p><span className="text-muted-foreground">Status:</span> {r.status || "—"}</p>
                            <p><span className="text-muted-foreground">Nota:</span>{" "}
                              {(isAdmin || r.nota_liberada) && r.nota_interna != null
                                ? (r.nota_interna > 10 ? (r.nota_interna / 10).toFixed(1) : r.nota_interna.toFixed(1))
                                : "🔒"}
                            </p>
                          </div>
                          {(() => {
                            const strengths = getStrengths(r);
                            const improvements = getImprovements(r);
                            return (
                              <>
                                {strengths.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-emerald-600 mb-0.5">✅ Pontos Fortes</p>
                                    {strengths.map((s, i) => (
                                      <p key={i} className="text-[10px] text-muted-foreground">• {s}</p>
                                    ))}
                                  </div>
                                )}
                                {improvements.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-amber-600 mb-0.5">💡 Oportunidades</p>
                                    {improvements.map((s, i) => (
                                      <p key={i} className="text-[10px] text-muted-foreground">• {s}</p>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-[11px]"
                            onClick={() => setDetailRecord(r)}
                          >
                            Ver análise completa →
                          </Button>
                        </PopoverContent>
                      </Popover>

                      {/* Full detail button */}
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setDetailRecord(r)}>
                        <FileText className="h-3 w-3 mr-0.5" /> Ver
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal with evaluation guide */}
      <Dialog open={!!detailRecord} onOpenChange={(open) => !open && setDetailRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Mentoria</DialogTitle>
          </DialogHeader>
          {detailRecord?.resultado && (() => {
            const res = detailRecord.resultado as any;
            const canSeeNote = isAdmin || detailRecord.nota_liberada;
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
                    {canSeeNote ? (
                      <p className={`text-2xl font-black ${noteColor(res.notaInterna != null && res.notaInterna > 10 ? res.notaInterna / 10 : res.notaInterna)}`}>
                        {res.notaInterna != null ? (res.notaInterna > 10 ? (res.notaInterna / 10).toFixed(1) : res.notaInterna.toFixed(1)) : "—"}
                      </p>
                    ) : (
                      <p className="text-2xl font-black text-muted-foreground">🔒</p>
                    )}
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

                {/* 19 Criteria with evaluation guide tips */}
                {res.criterios?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-2">📊 Critérios de Avaliação</h4>
                    <div className="space-y-1.5">
                      {res.criterios.map((c: any) => (
                        <div key={c.numero} className="rounded border border-border overflow-hidden">
                          <div className="flex items-start gap-2 p-2">
                            <Badge
                              variant={c.resultado === "SIM" ? "default" : c.resultado === "NÃO" ? "destructive" : "secondary"}
                              className="text-[10px] shrink-0 mt-0.5"
                            >
                              {c.resultado}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">
                                {c.numero}. {c.nome}{" "}
                                <span className="text-muted-foreground">
                                  ({canSeeNote ? `${c.pontosObtidos}/${c.pesoMaximo}` : "🔒"})
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{c.explicacao}</p>
                            </div>
                          </div>
                          {/* Collapsible evaluation tip */}
                          {EVALUATION_TIPS[c.numero] && (
                            <Collapsible>
                              <CollapsibleTrigger className="w-full px-2 py-1.5 text-[10px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                                <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
                                💡 Ver dica
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mx-2 mb-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-400">
                                  <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">
                                    💡 {EVALUATION_TIPS[c.numero]}
                                  </p>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      ))}
                    </div>
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
