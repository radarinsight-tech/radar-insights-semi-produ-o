import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy, TrendingUp, Users, Search, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, XCircle, MinusCircle, Info,
} from "lucide-react";
import { cn, formatNota } from "@/lib/utils";
import {
  runAutoSelection,
  AMOSTRA_STATUS_CONFIG,
  type AutoSelectionFile,
  type AttendantAutoSelection,
  type AmostraStatus,
} from "@/lib/mentoriaAutoSelection";

// ─── formatBRL (local) ─────────────────────────────────────────────
function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Amostra Status Icon ───────────────────────────────────────────
function AmostraIcon({ status }: { status: AmostraStatus }) {
  switch (status) {
    case "amostra_fechada":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "base_minima":
      return <MinusCircle className="h-3.5 w-3.5" />;
    case "insuficiente":
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case "sem_base":
      return <XCircle className="h-3.5 w-3.5" />;
  }
}

// ─── Attendant Detail Row ───────────────────────────────────────────
function AttendantDetailRow({ att }: { att: AttendantAutoSelection }) {
  const [open, setOpen] = useState(false);
  const cfg = AMOSTRA_STATUS_CONFIG[att.amostraStatus];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <TableRow className="group">
        <TableCell className="font-semibold text-foreground">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-left hover:underline decoration-primary/40 underline-offset-2">
              {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              {att.nome}
            </button>
          </CollapsibleTrigger>
          {att.volumetria === "baixa_volumetria" && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold text-warning bg-warning/10 border-warning/20">
              <AlertTriangle className="h-2.5 w-2.5" /> Baixa volumetria
            </span>
          )}
        </TableCell>
        <TableCell className="text-center text-xs text-muted-foreground">{att.totalBruto}</TableCell>
        <TableCell className="text-center text-xs">{att.totalElegiveis}</TableCell>
        <TableCell className="text-center text-xs">{att.totalSelecionados}</TableCell>
        <TableCell className="text-center">
          <Badge className={cn("text-[10px] px-2 py-0.5 border gap-1", cfg.bg, cfg.color)}>
            <AmostraIcon status={att.amostraStatus} />
            {cfg.label}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          {att.media10 != null ? (
            <span className={cn("font-bold", att.faixaColor)}>
              {att.media10.toFixed(1).replace(".", ",")}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {att.faixa ? (
            <Badge className={cn("text-[10px] px-2 py-0.5 border", att.faixaBg, att.faixaColor)}>
              {att.faixa} {att.percentual != null ? `(${att.percentual}%)` : ""}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right font-bold">
          {att.valor != null ? (
            <span className={att.valor > 0 ? att.faixaColor : "text-muted-foreground"}>
              {formatBRL(att.valor)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>

      <CollapsibleContent asChild>
        <tr>
          <td colSpan={8} className="p-0">
            <div className="px-6 py-3 bg-muted/30 border-t border-b border-border space-y-2">
              {/* Notas das mentorias selecionadas */}
              {att.notas.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Notas das {att.notas.length} mentoria{att.notas.length !== 1 ? "s" : ""} selecionada{att.notas.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {att.notas.map((n, i) => (
                      <span key={i} className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-semibold bg-card text-foreground border-border">
                        {formatNota(n)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Atendimentos selecionados */}
              {att.selecionados.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Atendimentos na amostra
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {att.selecionados.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 rounded border px-2 py-1 bg-card text-xs border-accent/20">
                        <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />
                        <span className="truncate text-foreground">{(f as any).file_name || (f as any).name || f.id.slice(0, 8)}</span>
                        <span className="ml-auto font-mono font-semibold text-foreground">{f.result?.notaFinal != null ? formatNota(f.result.notaFinal) : "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Not selected */}
              {att.naoSelecionados.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Elegíveis fora da amostra ({att.naoSelecionados.length})
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Estes atendimentos são avaliáveis mas não entraram nos 6 selecionados por menor score de prioridade.
                  </p>
                </div>
              )}

              {att.totalElegiveis === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum atendimento elegível encontrado. É necessário analisar os atendimentos deste atendente primeiro.
                </p>
              )}
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Props ──────────────────────────────────────────────────────────

interface MentoriaBonusPanelProps {
  files: Array<{
    id: string;
    atendente?: string;
    status: string;
    result?: any;
    text?: string;
    data?: string;
    hasAudio?: boolean;
    nonEvaluable?: boolean;
    nonEvaluableReason?: string;
    structuredConversation?: any;
    name?: string;
    file_name?: string;
  }>;
}

// ─── Main Component ─────────────────────────────────────────────────

const MentoriaBonusPanel = ({ files }: MentoriaBonusPanelProps) => {
  const [autoMode, setAutoMode] = useState(false);

  // Classic ranking (existing behavior)
  const classicRanking = useMemo(() => {
    const eligible = files.filter((f) => {
      if (f.status !== "analisado" || !f.result) return false;
      if (f.result?.avaliavel === false || f.result?._nonEvaluable === true) return false;
      if (f.result?.inelegivel === true || f.result?._ineligible === true) return false;
      return f.result?.notaFinal != null;
    });

    const byAttendant = new Map<string, number[]>();
    for (const f of eligible) {
      const nome = (f.result?.atendente || f.atendente || "").trim() || "Não identificado";
      if (!byAttendant.has(nome)) byAttendant.set(nome, []);
      byAttendant.get(nome)!.push(f.result.notaFinal);
    }

    const result: Array<{ nome: string; qtdAvaliados: number; media100: number; media10: number; faixa: string; percentual: number; valor: number; faixaColor: string; faixaBg: string }> = [];
    for (const [nome, notas] of byAttendant) {
      const media100 = Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10;
      const media10 = Math.round((media100 / 10) * 10) / 10;
      const tier = calcularFaixaLegacy(media100);
      result.push({ nome, qtdAvaliados: notas.length, media100, media10, ...tier });
    }
    result.sort((a, b) => b.media100 - a.media100);
    return result;
  }, [files]);

  // Auto-selection ranking
  const autoRanking = useMemo(() => {
    if (!autoMode) return [];
    return runAutoSelection(files as AutoSelectionFile[]);
  }, [files, autoMode]);

  if (classicRanking.length === 0 && !autoMode) return null;

  const totalBonusClassic = classicRanking.reduce((s, r) => s + r.valor, 0);
  const totalBonusAuto = autoRanking.reduce((s, r) => s + (r.valor ?? 0), 0);
  const lowVolumeCount = autoRanking.filter(a => a.volumetria === "baixa_volumetria").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-warning" />
            Painel de Bônus
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={autoMode ? "default" : "outline"}
              size="sm"
              className="gap-2 text-xs"
              onClick={() => setAutoMode(!autoMode)}
            >
              <Search className="h-3.5 w-3.5" />
              {autoMode ? "Modo: 6 mentorias por atendente" : "Buscar 6 mentorias por atendente"}
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {autoMode ? autoRanking.length : classicRanking.length} atendente{(autoMode ? autoRanking.length : classicRanking.length) !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Total: {formatBRL(autoMode ? totalBonusAuto : totalBonusClassic)}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Low volume alert */}
        {autoMode && lowVolumeCount > 0 && (
          <Alert className="border-warning/30 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs">
              <strong>{lowVolumeCount} atendente{lowVolumeCount !== 1 ? "s" : ""}</strong> com 50 atendimentos ou menos no período (baixa volumetria).
              Este alerta é informativo — não impede participação na mentoria ou cálculo de bônus.
            </AlertDescription>
          </Alert>
        )}

        {/* Auto-selection info */}
        {autoMode && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              O sistema selecionou automaticamente até <strong>6 atendimentos mais representativos</strong> por atendente,
              priorizando interação humana real, densidade de diálogo e recência. O bônus só é calculado quando há 6 mentorias válidas.
              Clique no nome do atendente para ver os detalhes.
            </p>
          </div>
        )}

        {/* ─── AUTO MODE TABLE ─── */}
        {autoMode ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atendente</TableHead>
                <TableHead className="text-center w-16">Total</TableHead>
                <TableHead className="text-center w-16">Elegíveis</TableHead>
                <TableHead className="text-center w-16">Selec.</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center w-16">Média</TableHead>
                <TableHead className="text-center">Faixa</TableHead>
                <TableHead className="text-right w-24">Bônus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {autoRanking.map((att) => (
                <AttendantDetailRow key={att.nome} att={att} />
              ))}
            </TableBody>
          </Table>
        ) : (
          /* ─── CLASSIC MODE TABLE ─── */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Atendente</TableHead>
                <TableHead className="text-center">Avaliações</TableHead>
                <TableHead className="text-center">Média</TableHead>
                <TableHead className="text-center">Faixa</TableHead>
                <TableHead className="text-right">Bônus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classicRanking.map((r, idx) => (
                <TableRow key={r.nome}>
                  <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-semibold text-foreground">{r.nome}</TableCell>
                  <TableCell className="text-center">{r.qtdAvaliados}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn("font-bold", r.faixaColor)}>
                      {r.media10.toFixed(1).replace(".", ",")}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[10px] px-2 py-0.5 border", r.faixaBg, r.faixaColor)}>
                      {r.faixa} ({r.percentual}%)
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    <span className={r.valor > 0 ? r.faixaColor : "text-muted-foreground"}>
                      {formatBRL(r.valor)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Legend */}
        <div className="pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Régua progressiva (base R$ 1.200)</p>
          <div className="flex flex-wrap gap-2">
            {[
              { faixa: "95–100", label: "Excelente", valor: "R$ 1.200", color: "text-accent bg-accent/10 border-accent/20" },
              { faixa: "85–94", label: "Muito bom", valor: "R$ 1.080", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
              { faixa: "70–84", label: "Bom", valor: "R$ 840", color: "text-primary bg-primary/10 border-primary/20" },
              { faixa: "50–69", label: "Em desenv.", valor: "R$ 360", color: "text-warning bg-warning/10 border-warning/20" },
              { faixa: "0–49", label: "Abaixo", valor: "R$ 0", color: "text-destructive bg-destructive/10 border-destructive/20" },
            ].map((t) => (
              <span key={t.faixa} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", t.color)}>
                {t.faixa}: {t.label} ({t.valor})
              </span>
            ))}
          </div>
          {autoMode && (
            <div className="flex flex-wrap gap-2 mt-2">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-full">Status da amostra</p>
              {(Object.entries(AMOSTRA_STATUS_CONFIG) as [AmostraStatus, typeof AMOSTRA_STATUS_CONFIG[AmostraStatus]][]).map(([key, cfg]) => (
                <span key={key} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.color)}>
                  <AmostraIcon status={key} />
                  {cfg.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Legacy faixa calculation for classic mode
function calcularFaixaLegacy(media100: number) {
  if (media100 >= 95) return { faixa: "Excelente", percentual: 100, valor: 1200, faixaColor: "text-accent", faixaBg: "bg-accent/10 border-accent/20" };
  if (media100 >= 85) return { faixa: "Muito bom", percentual: 90, valor: 1080, faixaColor: "text-emerald-600", faixaBg: "bg-emerald-50 border-emerald-200" };
  if (media100 >= 70) return { faixa: "Bom atendimento", percentual: 70, valor: 840, faixaColor: "text-primary", faixaBg: "bg-primary/10 border-primary/20" };
  if (media100 >= 50) return { faixa: "Em desenvolvimento", percentual: 30, valor: 360, faixaColor: "text-warning", faixaBg: "bg-warning/10 border-warning/20" };
  return { faixa: "Abaixo do esperado", percentual: 0, valor: 0, faixaColor: "text-destructive", faixaBg: "bg-destructive/10 border-destructive/20" };
}

export default MentoriaBonusPanel;
