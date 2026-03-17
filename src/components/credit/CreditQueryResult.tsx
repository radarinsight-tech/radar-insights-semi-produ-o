import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User, CreditCard, DollarSign, Shield, FileText, Download, Copy, Clock,
  AlertTriangle, CheckCircle2, XCircle, FileSearch, Hash
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
  const { registroSpc, pendenciasSerasa, protestos, chequesSemFundo, valorTotalPendencias, totalOcorrencias } = r;

  if (registroSpc === 0 && pendenciasSerasa === 0 && protestos === 0 && chequesSemFundo === 0) {
    return {
      faixa: "Isento",
      valor: 0,
      justificativa: "Cliente sem restrições em nenhum bureau de crédito. Enquadrado na Regra 01 — Isenção.",
      documentacao: null,
    };
  }

  if (totalOcorrencias <= 2 && valorTotalPendencias <= 1000 && protestos === 0) {
    return {
      faixa: "R$ 100,00",
      valor: 100,
      justificativa: `Enquadrado na Regra 02 — Taxa R$100. ${totalOcorrencias} ocorrência(s) com valor total de R$ ${valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Sem protesto.`,
      documentacao: "Comprovante de residência atualizado (últimos 90 dias).",
    };
  }

  if (totalOcorrencias <= 4 && valorTotalPendencias <= 3000) {
    return {
      faixa: "R$ 200,00",
      valor: 200,
      justificativa: `Enquadrado na Regra 03 — Taxa R$200. ${totalOcorrencias} ocorrência(s), valor total R$ ${valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.${protestos > 0 ? ` ${protestos} protesto(s) identificado(s).` : ""}`,
      documentacao: "Comprovante de residência atualizado e documento de identidade com foto.",
    };
  }

  if (totalOcorrencias > 4 || valorTotalPendencias > 3000) {
    return {
      faixa: "R$ 300,00",
      valor: 300,
      justificativa: `Enquadrado na Regra 04 — Taxa R$300. ${totalOcorrencias} ocorrência(s), valor total R$ ${valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.${protestos > 0 ? ` ${protestos} protesto(s).` : ""}`,
      documentacao: "Comprovante de residência atualizado, documento de identidade com foto e comprovante de renda.",
    };
  }

  return {
    faixa: "R$ 200,00",
    valor: 200,
    justificativa: "Enquadramento por análise complementar.",
    documentacao: "Comprovante de residência atualizado e documento de identidade com foto.",
  };
}

function faixaColors(faixa: string) {
  if (faixa === "Isento") return { bg: "bg-accent/10", border: "border-accent", text: "text-accent", label: "ISENTO" };
  if (faixa === "R$ 100,00") return { bg: "bg-warning/10", border: "border-warning", text: "text-warning", label: "R$ 100,00" };
  if (faixa === "R$ 200,00") return { bg: "bg-primary/10", border: "border-primary", text: "text-primary", label: "R$ 200,00" };
  if (faixa === "R$ 300,00") return { bg: "bg-destructive/10", border: "border-destructive", text: "text-destructive", label: "R$ 300,00" };
  if (faixa === "R$ 1.000,00") return { bg: "bg-destructive/10", border: "border-destructive", text: "text-destructive", label: "R$ 1.000,00" };
  return { bg: "bg-secondary", border: "border-border", text: "text-foreground", label: faixa };
}

function riscoIcon(risco: string) {
  if (risco === "Baixo risco") return <CheckCircle2 className="h-5 w-5 text-accent" />;
  if (risco === "Médio risco") return <AlertTriangle className="h-5 w-5 text-warning" />;
  return <XCircle className="h-5 w-5 text-destructive" />;
}

function riscoBadgeVariant(risco: string): "default" | "secondary" | "destructive" {
  if (risco === "Baixo risco") return "default";
  if (risco === "Médio risco") return "secondary";
  return "destructive";
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
  addText("Parecer de Análise de Crédito — Banda Turbo", 12, true); gap(8);

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
    `⚡ Risco: ${r.classificacaoRisco}`,
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
        <p className="text-sm font-semibold text-foreground mb-2">Parecer de Crédito</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Informe o CPF ou CNPJ do cliente e clique em "Consultar SPC" para gerar o parecer com o enquadramento pela política Banda Turbo.
        </p>
      </Card>
    );
  }

  const policy = aplicarPoliticaBandaTurbo(data);
  const colors = faixaColors(policy.faixa);

  return (
    <Card className="p-0 animate-in fade-in duration-300 overflow-hidden">
      {/* ── 1. Enquadramento Banda Turbo (hero) ── */}
      <div className={`${colors.bg} border-b-2 ${colors.border} px-5 py-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Enquadramento — Política Banda Turbo
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={`h-8 w-8 ${colors.text}`} />
            <span className={`text-2xl font-extrabold tracking-tight ${colors.text}`}>{policy.faixa}</span>
          </div>
          <div className="flex items-center gap-2">
            {riscoIcon(data.classificacaoRisco)}
            <Badge variant={riscoBadgeVariant(data.classificacaoRisco)} className="text-xs">
              {data.classificacaoRisco}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 py-4 space-y-4">
        {/* ── 2. Dados do cliente ── */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <InfoRow icon={<User className="h-4 w-4 text-primary" />} label="Nome" value={data.nome} />
          <InfoRow icon={<CreditCard className="h-4 w-4 text-primary" />} label={data.tipo} value={data.formatted} mono />
          <InfoRow icon={<Clock className="h-4 w-4 text-primary" />} label="Data / hora" value={data.dataConsulta} />
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Situação</p>
            <Badge variant={data.situacaoCpf === "Regular" ? "default" : "destructive"} className="mt-0.5 text-xs">
              {data.situacaoCpf}
            </Badge>
          </div>
        </div>

        {/* ── 3. Situação de crédito ── */}
        <div>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Ocorrências</p>
          <div className="grid grid-cols-4 gap-2">
            {([
              { label: "SPC", value: data.registroSpc },
              { label: "Serasa", value: data.pendenciasSerasa },
              { label: "Protestos", value: data.protestos },
              { label: "Cheques", value: data.chequesSemFundo },
            ] as const).map((item) => (
              <div key={item.label} className="text-center p-2 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                <p className={`text-lg font-bold ${item.value > 0 ? "text-destructive" : "text-foreground"}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 4. Resumo financeiro ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-[10px] text-muted-foreground font-medium uppercase">Total ocorrências</p>
            <p className="text-xl font-bold text-foreground">{data.totalOcorrencias}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-[10px] text-muted-foreground font-medium uppercase">Valor total</p>
            <p className={`text-xl font-bold ${data.valorTotalPendencias > 0 ? "text-destructive" : "text-foreground"}`}>
              R$ {data.valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* ── 5. Justificativa ── */}
        <Section icon={<FileText className="h-4 w-4 text-primary" />} label="Justificativa">
          <p className="text-sm text-foreground leading-relaxed">{policy.justificativa}</p>
        </Section>

        {/* ── 6. Documentação obrigatória ── */}
        {policy.documentacao && (
          <Section icon={<AlertTriangle className="h-4 w-4 text-warning" />} label="Documentação obrigatória">
            <p className="text-sm text-foreground leading-relaxed">{policy.documentacao}</p>
          </Section>
        )}

        {/* ── 7. Botões ── */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => gerarParecerPdf(data, policy)}>
            <Download className="h-4 w-4 mr-1" />
            Baixar parecer
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => copiarResumo(data, policy)}>
            <Copy className="h-4 w-4 mr-1" />
            Copiar resumo
          </Button>
        </div>
      </div>
    </Card>
  );
};

// ── Helper sub-components ──

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold truncate ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      {children}
    </div>
  );
}

export { aplicarPoliticaBandaTurbo };
export default CreditQueryResult;
