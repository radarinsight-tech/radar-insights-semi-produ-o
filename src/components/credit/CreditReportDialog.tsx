import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";
import CreditAnalysisResult, { type CreditAnalysisData } from "./CreditAnalysisResult";
import jsPDF from "jspdf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CreditAnalysisData | null;
  cpfCnpj: string;
}

const exportCreditPdf = (data: CreditAnalysisData, cpfCnpj: string) => {
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

  addText("RADAR INSIGHT — ANÁLISE DE CRÉDITO", 14, true);
  addGap(6);

  addText(`Nome: ${data.nome}`, 10);
  addText(`CPF/CNPJ: ${data.cpf}`, 10);
  addText(`Idade: ${data.idade}`, 10);
  addText(`Registros Negativos: ${data.quantidadeRegistrosNegativos}`, 10);
  addText(`Valor Total das Dívidas: ${data.valorTotalDividas}`, 10);
  addText(`Decisão Final: ${data.decisaoFinal}`, 10, true);
  addGap(6);

  addText("CREDORES IDENTIFICADOS", 12, true);
  addGap(3);
  if (data.credores?.length) {
    for (const c of data.credores) {
      addText(`• ${c.nome} (${c.tipo}) — ${c.valor}`, 9);
    }
  } else {
    addText("Nenhum credor identificado.", 9);
  }
  addGap(6);

  addText("REGRA APLICADA", 12, true);
  addGap(3);
  addText(data.regraAplicada || "—", 9);
  addGap(6);

  addText("ORIENTAÇÃO OPERACIONAL", 12, true);
  addGap(3);
  addText(data.orientacaoOperacional || "—", 9);
  addGap(6);

  addText("OBSERVAÇÕES", 12, true);
  addGap(3);
  addText(data.observacoes || "—", 9);

  doc.save(`analise_credito_${cpfCnpj}.pdf`);
};

const CreditReportDialog = ({ open, onOpenChange, data, cpfCnpj }: Props) => {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Análise de Crédito — {data.cpf || cpfCnpj}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCreditPdf(data, cpfCnpj)}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </Button>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-6 pt-2">
            <CreditAnalysisResult data={data} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CreditReportDialog;
