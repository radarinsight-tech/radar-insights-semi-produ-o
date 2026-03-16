import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User, CreditCard, DollarSign, Shield, FileText, Download, Copy, Clock,
  AlertTriangle, CheckCircle2, XCircle, FileSearch
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import type { SpcQueryResult } from "./CreditQuerySection";

// ---------- Banda Turbo policy ----------
interface PolicyResult {
  faixa: string;
  valor: number;
  justificativa: string;
  documentacao: string | null;
}

function aplicarPoliticaBandaTurbo(r: SpcQueryResult): PolicyResult {
  // Regra especial — débito com provedor de internet
  // In simulation we check if there's a naming pattern or SPC category hinting at "provedor"
  // For now, this would be triggered by real data; skip in simulation unless explicitly flagged.

  const { registroSpc, pendenciasSerasa, protestos, chequesSemFundo, valorTotalPendencias, totalOcorrencias } = r;

  // Regra 01 — Isenção: sem negativação
  if (registroSpc === 0 && pendenciasSerasa === 0 && protestos === 0 && chequesSemFundo === 0) {
    return {
      faixa: "Isento",
      valor: 0,
      justificativa: "Cliente sem restrições em nenhum bureau de crédito. Enquadrado na Regra 01 — Isenção.",
      documentacao: null,
    };
  }

  // Regra 02 — R$100: até 2 registros, valor ≤ R$1.000, sem protesto
  if (totalOcorrencias <= 2 && valorTotalPendencias <= 1000 && protestos === 0) {
    return {
      faixa: "R$ 100,00",
      valor: 100,
      justificativa: `Enquadrado na Regra 02 — Taxa R$100. ${totalOcorrencias} ocorrência(s) com valor total de R$ ${valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Sem protesto.`,
      documentacao: "Comprovante de residência atualizado (últimos 90 dias).",
    };
  }

  // Regra 03 — R$200: até 4 registros, valor ≤ R$3.000
  if (totalOcorrencias <= 4 && valorTotalPendencias <= 3000) {
    return {
      faixa: "R$ 200,00",
      valor: 200,
      justificativa: `Enquadrado na Regra 03 — Taxa R$200. ${totalOcorrencias} ocorrência(s), valor total R$ ${valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.${protestos > 0 ? ` ${protestos} protesto(s) identificado(s).` : ""}`,
      documentacao: "Comprovante de residência atualizado e documento de identidade com foto.",
    };
  }

  // Regra 04 — R$300: acima de 4 registros ou valor > R$3.000
  if (totalOcorrencias > 4 || valorTotalPendencias > 3000) {
    return {
      faixa: "R$ 300,00",
      valor: 300,
      justificativa: `Enquadrado na Regra 04 — Taxa R$300. ${totalOcorrencias} ocorrência(s), valor total R$ ${valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.${protestos > 0 ? ` ${protestos} protesto(s).` : ""}`,
      documentacao: "Comprovante de residência atualizado, documento de identidade com foto e comprovante de renda.",
    };
  }

  // Fallback
  return {
    faixa: "R$ 200,00",
    valor: 200,
    justificativa: "Enquadramento por análise complementar.",
    documentacao: "Comprovante de residência atualizado e documento de identidade com foto.",
  };
}

function faixaColors(faixa: string) {
  if (faixa === "Isento") return { bg: "bg-accent/10", border: "border-accent", text: "text-accent" };
  if (faixa === "R$ 100,00") return { bg: "bg-warning/10", border: "border-warning", text: "text-warning" };
  if (faixa === "R$ 200,00") return { bg: "bg-primary/10", border: "border-primary", text: "text-primary" };
  if (faixa === "R$ 300,00") return { bg: "bg-destructive/10", border: "border-destructive", text: "text-destructive" };
  if (faixa === "R$ 1.000,00") return { bg: "bg-destructive/10", border: "border-destructive", text: "text-destructive" };
  return { bg: "bg-secondary", border: "border-border", text: "text-foreground" };
}

function riscoIcon(risco: string) {
  if (risco === "Baixo risco") return <CheckCircle2 className="h-5 w-5 text-accent" />;
  if (risco === "Médio risco") return <AlertTriangle className="h-5 w-5 text-warning" />;
  return <XCircle className="h-5 w-5 text-destructive" />;
}

// ---------- PDF generation ----------
function gerarParecerPdf(r: SpcQueryResult, policy: PolicyResult) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 15;
  const maxW = doc.internal.pageSize.getWidth() - margin * 2;
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
  const gap = (g = 4) => { y += g; };

  addText("RADAR INSIGHT", 16, true); gap(2);
  addText("Parecer de Análise de Crédito", 12, true); gap(8);

  addText("DADOS DO CLIENTE", 11, true); gap(3);
  addText(`Nome: ${r.nome}`, 10);
  addText(`${r.tipo}: ${r.formatted}`, 10);
  addText(`Situação: ${r.situacaoCpf}`, 10);
  addText(`Data da consulta: ${r.dataConsulta}`, 10);
  gap(6);

  addText("RESUMO DAS OCORRÊNCIAS", 11, true); gap(3);
  addText(`Registros SPC: ${r.registroSpc}`, 10);
  addText(`Pendências Serasa: ${r.pendenciasSerasa}`, 10);
  addText(`Protestos: ${r.protestos}`, 10);
  addText(`Cheques sem fundo: ${r.chequesSemFundo}`, 10);
  addText(`Total de ocorrências: ${r.totalOcorrencias}`, 10);
  addText(`Valor total: R$ ${r.valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 10);
  gap(6);

  addText("CLASSIFICAÇÃO DE RISCO", 11, true); gap(3);
  addText(r.classificacaoRisco, 10, true);
  gap(6);

  addText("ENQUADRAMENTO — POLÍTICA BANDA TURBO", 11, true); gap(3);
  addText(`Faixa: ${policy.faixa}`, 10, true);
  gap(3);
  addText("Justificativa:", 10, true);
  addText(policy.justificativa, 10);
  gap(4);

  if (policy.documentacao) {
    addText("Documentação obrigatória:", 10, true);
    addText(policy.documentacao, 10);
    gap(6);
  }

  addText("---", 8);
  addText("Documento gerado automaticamente pelo Radar Insight.", 8);
  addText(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 8);

  doc.save(`parecer_credito_${r.cpfCnpj}.pdf`);
}

// ---------- Copy summary ----------
function copiarResumo(r: SpcQueryResult, policy: PolicyResult) {
  const text = [
    `📋 Parecer de Crédito — Radar Insight`,
    ``,
    `👤 ${r.nome}`,
    `📄 ${r.tipo}: ${r.formatted}`,
    `📅 Consulta: ${r.dataConsulta}`,
    ``,
    `📊 SPC: ${r.registroSpc} | Serasa: ${r.pendenciasSerasa} | Protestos: ${r.protestos} | Cheques: ${r.chequesSemFundo}`,
    `💰 Valor total: R$ ${r.valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ``,
    `🏷️ Enquadramento: ${policy.faixa}`,
    `${policy.justificativa}`,
    policy.documentacao ? `📎 Docs: ${policy.documentacao}` : "",
  ].filter(Boolean).join("\n");

  navigator.clipboard.writeText(text);
  toast.success("Resumo copiado para a área de transferência");
}

// ---------- Component ----------
interface Props {
  data: SpcQueryResult | null;
}

const CreditQueryResult = ({ data }: Props) => {
  if (!data) {
    return (
      <Card className="flex flex-col items-center justify-center text-center min-h-[420px] p-6">
        <div className="p-3 rounded-full bg-primary/10 mb-4">
          <FileSearch className="h-8 w-8 text-primary/60" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-2">Resultado da Análise de Crédito</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Informe o CPF ou CNPJ do cliente e clique em "Consultar SPC" para gerar o parecer com o enquadramento pela política Banda Turbo.
        </p>
      </Card>
    );
  }

  const policy = aplicarPoliticaBandaTurbo(data);
  const colors = faixaColors(policy.faixa);

  return (
    <Card className="p-6 animate-in fade-in duration-300">
      <h2 className="text-lg font-bold text-primary mb-4">Resultado da Análise de Crédito</h2>

      {/* Policy decision highlight */}
      <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-4 mb-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={`h-7 w-7 ${colors.text}`} />
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Enquadramento Banda Turbo</p>
              <p className={`text-xl font-bold ${colors.text}`}>{policy.faixa}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {riscoIcon(data.classificacaoRisco)}
            <Badge variant={data.classificacaoRisco === "Baixo risco" ? "default" : data.classificacaoRisco === "Médio risco" ? "secondary" : "destructive"}>
              {data.classificacaoRisco}
            </Badge>
          </div>
        </div>
      </div>

      {/* Client data */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Nome</p>
            <p className="text-sm font-semibold">{data.nome}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CreditCard className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{data.tipo}</p>
            <p className="text-sm font-mono font-semibold">{data.formatted}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Consulta</p>
            <p className="text-xs font-medium">{data.dataConsulta}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Situação</p>
          <Badge variant={data.situacaoCpf === "Regular" ? "default" : "destructive"} className="mt-0.5 text-xs">
            {data.situacaoCpf}
          </Badge>
        </div>
      </div>

      {/* Credit situation */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "SPC", value: data.registroSpc },
          { label: "Serasa", value: data.pendenciasSerasa },
          { label: "Protestos", value: data.protestos },
          { label: "Cheques", value: data.chequesSemFundo },
        ].map((item) => (
          <div key={item.label} className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
            <p className={`text-lg font-bold ${item.value > 0 ? "text-destructive" : "text-foreground"}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Total ocorrências</p>
          <p className="text-xl font-bold text-foreground">{data.totalOcorrencias}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Valor total</p>
          <p className={`text-xl font-bold ${data.valorTotalPendencias > 0 ? "text-destructive" : "text-foreground"}`}>
            R$ {data.valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Justificativa */}
      <div className="border-t border-border pt-3 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Justificativa</p>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{policy.justificativa}</p>
      </div>

      {/* Documentação */}
      {policy.documentacao && (
        <div className="border-t border-border pt-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documentação obrigatória</p>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{policy.documentacao}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => gerarParecerPdf(data, policy)}>
          <Download className="h-4 w-4 mr-1" />
          Baixar parecer
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => copiarResumo(data, policy)}>
          <Copy className="h-4 w-4 mr-1" />
          Copiar resumo
        </Button>
      </div>
    </Card>
  );
};

export { aplicarPoliticaBandaTurbo };
export default CreditQueryResult;
