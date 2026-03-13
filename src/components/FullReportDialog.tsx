import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

export interface CriterioAvaliacao {
  numero: number;
  nome: string;
  noEscopo: boolean;
  atendido: boolean;
  explicacao: string;
}

export interface FullReport {
  data?: string;
  protocolo?: string;
  tipo?: string;
  atendente?: string;
  atualizacaoCadastral?: string;
  nota?: number;
  classificacao?: string;
  bonus?: boolean;
  pontosMelhoria?: string[];
  criterios?: CriterioAvaliacao[];
  orientacaoFinal?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: FullReport | null;
  protocolo: string;
}

const classColor = (c: string) => {
  if (c === "Excelente" || c === "Ótimo") return "bg-accent text-accent-foreground";
  if (c === "Bom") return "bg-primary text-primary-foreground";
  return "bg-warning text-warning-foreground";
};

const exportReport = (report: FullReport, protocolo: string) => {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════════");
  lines.push("         RADAR INSIGHT — RELATÓRIO COMPLETO");
  lines.push("═══════════════════════════════════════════════");
  lines.push("");
  lines.push(`Protocolo: ${report.protocolo || protocolo}`);
  lines.push(`Data: ${report.data || "—"}`);
  lines.push(`Atendente: ${report.atendente || "—"}`);
  lines.push(`Tipo: ${report.tipo || "—"}`);
  lines.push(`Atualização Cadastral: ${report.atualizacaoCadastral || "—"}`);
  lines.push(`Nota Final: ${report.nota?.toFixed(1) || "—"}`);
  lines.push(`Classificação: ${report.classificacao || "—"}`);
  lines.push(`Bônus: ${report.bonus ? "Sim" : "Não"}`);
  lines.push("");
  lines.push("───────────────────────────────────────────────");
  lines.push("  CRITÉRIOS DE AVALIAÇÃO");
  lines.push("───────────────────────────────────────────────");

  if (report.criterios) {
    for (const c of report.criterios) {
      const status = !c.noEscopo ? "FORA DO ESCOPO" : c.atendido ? "✓ ATENDIDO" : "✗ NÃO ATENDIDO";
      lines.push("");
      lines.push(`${c.numero}. ${c.nome} — ${status}`);
      lines.push(`   ${c.explicacao}`);
    }
  }

  lines.push("");
  lines.push("───────────────────────────────────────────────");
  lines.push("  PONTOS DE MELHORIA");
  lines.push("───────────────────────────────────────────────");
  if (report.pontosMelhoria) {
    report.pontosMelhoria.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }

  lines.push("");
  lines.push("───────────────────────────────────────────────");
  lines.push("  ORIENTAÇÃO FINAL");
  lines.push("───────────────────────────────────────────────");
  lines.push(report.orientacaoFinal || "—");
  lines.push("");
  lines.push("═══════════════════════════════════════════════");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_${protocolo}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const FullReportDialog = ({ open, onOpenChange, report, protocolo }: Props) => {
  if (!report) return null;

  const criteriosNoEscopo = report.criterios?.filter(c => c.noEscopo) || [];
  const criteriosForaEscopo = report.criterios?.filter(c => !c.noEscopo) || [];
  const atendidos = criteriosNoEscopo.filter(c => c.atendido).length;
  const total = criteriosNoEscopo.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Avaliação Completa — {protocolo}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportReport(report, protocolo)}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Baixar relatório
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-6 pt-4 space-y-5">
            {/* Summary header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Atendente</p>
                <p className="text-sm font-medium">{report.atendente || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Tipo</p>
                <p className="text-sm font-medium">{report.tipo || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Nota</p>
                <p className="text-xl font-bold">{report.nota?.toFixed(1) || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Classificação</p>
                <Badge className={`mt-1 ${classColor(report.classificacao || "")}`}>
                  {report.classificacao || "—"}
                </Badge>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {atendidos}/{total} critérios atendidos no escopo
              {criteriosForaEscopo.length > 0 && ` · ${criteriosForaEscopo.length} fora do escopo`}
            </div>

            <Separator />

            {/* Criteria */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Critérios de Avaliação</h3>
              <div className="space-y-2">
                {report.criterios?.map((c) => (
                  <div key={c.numero} className="flex gap-2.5 p-2.5 rounded-lg bg-muted/50">
                    <div className="mt-0.5 shrink-0">
                      {!c.noEscopo ? (
                        <MinusCircle className="h-4 w-4 text-muted-foreground" />
                      ) : c.atendido ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.numero}. {c.nome}</span>
                        {!c.noEscopo && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Fora do escopo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.explicacao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Pontos de melhoria */}
            {report.pontosMelhoria && report.pontosMelhoria.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Pontos de Melhoria</h3>
                <ul className="space-y-1.5">
                  {report.pontosMelhoria.map((p, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Orientação final */}
            {report.orientacaoFinal && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-2">Orientação Final</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{report.orientacaoFinal}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FullReportDialog;
