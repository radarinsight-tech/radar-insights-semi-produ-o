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

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  addText(`CPF/CNPJ: ${data.cpf_cnpj || data.cpf || cpfCnpj}`, 10);
  if (data.tipo_pessoa) addText(`Tipo: ${data.tipo_pessoa}`, 10);
  if (data.score) addText(`Score: ${data.score}`, 10);
  addText(`Registros Negativos: ${data.quantidade_registros_negativos ?? data.quantidadeRegistrosNegativos ?? 0}`, 10);
  addText(`Valor Total: ${data.valor_total_negativado || data.valorTotalDividas || "—"}`, 10);
  addGap(4);

  if (data.regra_aplicada) {
    addText(`Regra Aplicada: ${data.regra_aplicada}`, 10, true);
    addText(`Classificação Final: ${data.classificacao_final}`, 10);
    addText(`Protesto: ${data.possui_protesto ? "SIM" : "NÃO"}`, 10);
    addText(`Débito Provedor: ${data.possui_debito_provedor ? "SIM" : "NÃO"}`, 10);
    addText(`Documento: ${data.documento_em_nome_do_contratante ? "Válido" : "Não apresentado"}`, 10);
    addGap(4);
    addText("COMPOSIÇÃO DE TAXAS", 12, true); addGap(3);
    addText(`Taxa de Instalação: ${formatCurrency(data.taxa_instalacao)}`, 10);
    addText(`Taxa de Análise de Crédito: ${formatCurrency(data.taxa_analise_credito)}`, 10);
    addText(`Taxa Total: ${formatCurrency(data.taxa_total)}`, 10, true);
    addGap(6);
  }

  addText("CREDORES IDENTIFICADOS", 12, true);
  addGap(3);
  if (data.credores?.length) {
    for (const c of data.credores) {
      const cat = (c as any).categoria || (c as any).tipo || "";
      const antMeses = (c as any).antiguidade_meses;
      const suffix = antMeses !== undefined ? ` [${antMeses}m]` : "";
      addText(`• ${c.nome} (${cat}) — ${c.valor}${suffix}`, 9);
    }
  } else {
    addText("Nenhum credor identificado.", 9);
  }
  addGap(6);

  addText("JUSTIFICATIVA DA DECISÃO", 12, true);
  addGap(3);
  addText(data.motivo_decisao || data.regraAplicada || "—", 9);
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
            <span>Análise de Crédito — {data.cpf_cnpj || data.cpf || cpfCnpj}</span>
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
