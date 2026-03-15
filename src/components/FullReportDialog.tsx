import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, CheckCircle2, XCircle, MinusCircle, ShieldAlert } from "lucide-react";
import jsPDF from "jspdf";

export interface CriterioAvaliacao {
  numero: number;
  nome: string;
  categoria: string;
  pesoMaximo: number;
  resultado: "SIM" | "NÃO" | "FORA DO ESCOPO";
  pontosObtidos: number;
  explicacao: string;
}

export interface Subtotais {
  posturaEComunicacao: { obtidos: number; possiveis: number };
  entendimentoEConducao: { obtidos: number; possiveis: number };
  solucaoEConfirmacao: { obtidos: number; possiveis: number };
  encerramentoEValor: { obtidos: number; possiveis: number };
}

export interface FullReport {
  impeditivo?: boolean;
  motivoImpeditivo?: string;
  data?: string;
  protocolo?: string;
  tipo?: string;
  atendente?: string;
  criterios?: CriterioAvaliacao[];
  subtotais?: Subtotais;
  pontosObtidos?: number;
  pontosPossiveis?: number;
  notaFinal?: number;
  classificacao?: string;
  bonusQualidade?: number;
  bonusOperacional?: { atualizacaoCadastral: string; pontosExtras: number };
  mentoria?: string[];
  // Legacy fields for backward compatibility
  atualizacaoCadastral?: string;
  nota?: number;
  bonus?: boolean;
  pontosMelhoria?: string[];
  orientacaoFinal?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: FullReport | null;
  protocolo: string;
}

const classColor = (c: string) => {
  if (c === "Excelente" || c === "Muito bom") return "bg-accent text-accent-foreground";
  if (c === "Bom atendimento") return "bg-primary text-primary-foreground";
  return "bg-warning text-warning-foreground";
};

const resultIcon = (resultado: string) => {
  if (resultado === "FORA DO ESCOPO") return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  if (resultado === "SIM") return <CheckCircle2 className="h-4 w-4 text-accent" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
};

const resultBadge = (resultado: string) => {
  if (resultado === "FORA DO ESCOPO") return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Fora do escopo</Badge>;
  if (resultado === "SIM") return <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">SIM</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-destructive text-destructive-foreground">NÃO</Badge>;
};

const CATEGORY_ORDER = [
  "Postura e Comunicação",
  "Entendimento e Condução",
  "Solução e Confirmação",
  "Encerramento e Valor",
];

const subtotalKey = (cat: string): keyof Subtotais => {
  const map: Record<string, keyof Subtotais> = {
    "Postura e Comunicação": "posturaEComunicacao",
    "Entendimento e Condução": "entendimentoEConducao",
    "Solução e Confirmação": "solucaoEConfirmacao",
    "Encerramento e Valor": "encerramentoEValor",
  };
  return map[cat] || "posturaEComunicacao";
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

  addText("RADAR INSIGHT — AUDITORIA DE ATENDIMENTO", 14, true);
  addGap(6);

  if (report.impeditivo) {
    addText("AUDITORIA NÃO REALIZADA", 12, true);
    addText(report.motivoImpeditivo || "Impeditivo identificado.", 10);
    doc.save(`auditoria_${protocolo}.pdf`);
    return;
  }

  addText(`Protocolo: ${report.protocolo || protocolo}`, 10);
  addText(`Data: ${report.data || "—"}`, 10);
  addText(`Atendente: ${report.atendente || "—"}`, 10);
  addText(`Tipo: ${report.tipo || "—"}`, 10);
  addText(`Nota Final: ${report.notaFinal?.toFixed(1) ?? report.nota?.toFixed(1) ?? "—"}`, 10);
  addText(`Classificação: ${report.classificacao || "—"}`, 10);
  addText(`Bônus Qualidade: ${report.bonusQualidade ?? 0}%`, 10);
  addText(`Atualização Cadastral: ${report.bonusOperacional?.atualizacaoCadastral ?? report.atualizacaoCadastral ?? "—"} (${report.bonusOperacional?.pontosExtras ?? 0} pts extras)`, 10);
  addGap(6);

  addText("CRITÉRIOS DE AVALIAÇÃO", 12, true);
  addGap(3);

  if (report.criterios) {
    for (const cat of CATEGORY_ORDER) {
      const items = report.criterios.filter(c => c.categoria === cat);
      if (items.length === 0) continue;
      addGap(2);
      addText(cat.toUpperCase(), 10, true);
      addGap(2);
      for (const c of items) {
        addText(`${c.numero}. ${c.nome} — ${c.resultado} (${c.pontosObtidos}/${c.pesoMaximo} pts)`, 10, true);
        addText(c.explicacao, 9);
        addGap(2);
      }
    }
  }

  addGap(4);
  addText("MENTORIA DE COMUNICAÇÃO", 12, true);
  addGap(3);
  const mentoriaItems = report.mentoria || report.pontosMelhoria || [];
  mentoriaItems.forEach((p, i) => addText(`${i + 1}. ${p}`, 9));

  doc.save(`auditoria_${protocolo}.pdf`);
};

const FullReportDialog = ({ open, onOpenChange, report, protocolo }: Props) => {
  if (!report) return null;

  const nota = report.notaFinal ?? report.nota;
  const classificacao = report.classificacao || "—";
  const mentoriaItems = report.mentoria || report.pontosMelhoria || [];

  if (report.impeditivo) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Auditoria — {protocolo}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center text-center py-6">
            <ShieldAlert className="h-10 w-10 text-warning mb-3" />
            <p className="font-bold text-foreground">Auditoria não realizada</p>
            <p className="text-sm text-muted-foreground mt-2">{report.motivoImpeditivo || "Impeditivo identificado."}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const criteriosGrouped = CATEGORY_ORDER.map(cat => ({
    categoria: cat,
    items: (report.criterios || []).filter(c => c.categoria === cat),
    subtotal: report.subtotais ? report.subtotais[subtotalKey(cat)] : null,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Auditoria Completa — {protocolo}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportReportPdf(report, protocolo)}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
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
                <p className="text-xs text-muted-foreground uppercase">Nota Final</p>
                <p className="text-xl font-bold">{nota?.toFixed(1) || "—"}</p>
                {report.pontosObtidos != null && report.pontosPossiveis != null && (
                  <p className="text-xs text-muted-foreground">{report.pontosObtidos}/{report.pontosPossiveis} pts</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Classificação</p>
                <Badge className={`mt-1 ${classColor(classificacao)}`}>{classificacao}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Bônus qualidade: <strong className="text-foreground">{report.bonusQualidade ?? 0}%</strong></span>
              <span>Atualização cadastral: <strong className="text-foreground">{report.bonusOperacional?.atualizacaoCadastral ?? report.atualizacaoCadastral ?? "—"}</strong>
                {report.bonusOperacional?.pontosExtras ? ` (+${report.bonusOperacional.pontosExtras} pts)` : ""}
              </span>
            </div>

            <Separator />

            {criteriosGrouped.map(({ categoria, items, subtotal }) => (
              <div key={categoria}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-primary/90">{categoria}</h3>
                  {subtotal && (
                    <span className="text-xs text-muted-foreground">{subtotal.obtidos}/{subtotal.possiveis} pts</span>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map((c) => (
                    <div key={c.numero} className="flex gap-2.5 p-2.5 rounded-lg bg-muted/50">
                      <div className="mt-0.5 shrink-0">{resultIcon(c.resultado)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{c.numero}. {c.nome}</span>
                          {resultBadge(c.resultado)}
                          <span className="text-xs text-muted-foreground">{c.pontosObtidos}/{c.pesoMaximo} pts</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.explicacao}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}

            {mentoriaItems.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-primary/90 mb-2">Mentoria de Comunicação</h3>
                <ul className="space-y-1.5">
                  {mentoriaItems.map((p, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FullReportDialog;
