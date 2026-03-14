import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import jsPDF from "jspdf";

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

const exportReportPdf = (report: FullReport, protocolo: string) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxW = pageW - margin * 2;
  let y = 20;

  const addText = (text: string, size: number, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += size * 0.45;
    }
  };

  const addGap = (gap = 4) => { y += gap; };

  // Title
  addText("RADAR INSIGHT — RELATÓRIO COMPLETO", 14, true);
  addGap(6);

  // Summary
  addText(`Protocolo: ${report.protocolo || protocolo}`, 10);
  addText(`Data: ${report.data || "—"}`, 10);
  addText(`Atendente: ${report.atendente || "—"}`, 10);
  addText(`Tipo: ${report.tipo || "—"}`, 10);
  addText(`Atualização Cadastral: ${report.atualizacaoCadastral || "—"}`, 10);
  addText(`Nota Final: ${report.nota?.toFixed(1) || "—"}`, 10);
  addText(`Classificação: ${report.classificacao || "—"}`, 10);
  addText(`Bônus: ${report.bonus ? "Sim" : "Não"}`, 10);
  addGap(6);

  // Criteria
  addText("CRITÉRIOS DE AVALIAÇÃO", 12, true);
  addGap(3);

  if (report.criterios) {
    for (const c of report.criterios) {
      const status = !c.noEscopo ? "FORA DO ESCOPO" : c.atendido ? "✓ ATENDIDO" : "✗ NÃO ATENDIDO";
      addText(`${c.numero}. ${c.nome} — ${status}`, 10, true);
      addText(c.explicacao, 9);
      addGap(2);
    }
  }

  addGap(4);
  addText("PONTOS DE MELHORIA", 12, true);
  addGap(3);
  if (report.pontosMelhoria) {
    report.pontosMelhoria.forEach((p, i) => addText(`${i + 1}. ${p}`, 9));
  }

  addGap(4);
  addText("ORIENTAÇÃO FINAL", 12, true);
  addGap(3);
  addText(report.orientacaoFinal || "—", 9);

  doc.save(`relatorio_${protocolo}.pdf`);
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
              onClick={() => exportReportPdf(report, protocolo)}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Baixar avaliação em PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-6 pt-4 space-y-5">
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

            <div>
              <h3 className="text-sm font-bold text-primary/90 mb-3">Critérios de Avaliação</h3>
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
