import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, Loader2, FileText, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { notaToScale10, calcularBonus, formatBRL } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────
interface AnalyzedFile {
  name: string;
  file_name?: string;
  atendente?: string;
  data?: string;
  canal?: string;
  ineligible?: boolean;
  nonEvaluable?: boolean;
  nonEvaluableReason?: string;
  result?: {
    notaFinal?: number;
    classificacao?: string;
    mentoria?: string[];
    atendente?: string;
    protocolo?: string;
    data?: string;
    tipo?: string;
    criterios?: Record<string, { nota?: number; observacao?: string }>;
    pontosFortes?: string[];
    pontosMelhoria?: string[];
    bonusQualidade?: number;
    _ineligible?: boolean;
  };
}

interface BatchInfo {
  batchCode: string;
  createdAt: Date;
  totalPdfs: number;
}

interface MentoriaReportExportProps {
  files: AnalyzedFile[];
  batchInfo?: BatchInfo | null;
}

// ─── Helpers ────────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const LINE_H = 5;

function fmtNota(n: number): string {
  return notaToScale10(n).toFixed(1).replace(".", ",");
}

function classificacao(nota: number): string {
  const n10 = notaToScale10(nota);
  if (n10 >= 9) return "Excelente";
  if (n10 >= 7) return "Bom";
  if (n10 >= 5) return "Regular";
  if (n10 >= 3) return "Ruim";
  return "Crítico";
}

function countOccurrences(items: string[]): { text: string; count: number }[] {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const key = item.trim().toLowerCase();
    if (key) map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()]
    .map(([text, count]) => ({ text: items.find((i) => i.trim().toLowerCase() === text) || text, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── PDF Builder ────────────────────────────────────────────────────
function buildReportPdf(files: AnalyzedFile[], batchInfo?: BatchInfo | null, summaryOnly = false): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN;

  const analyzed = files.filter(
    (f) => f.result && typeof f.result.notaFinal === "number" && !f.ineligible && !f.result._ineligible && !f.nonEvaluable
  );

  const notas = analyzed.map((f) => notaToScale10(f.result!.notaFinal!));
  const media = notas.length > 0 ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : 0;

  // Aggregate attendants
  const atendenteMap = new Map<string, AnalyzedFile[]>();
  analyzed.forEach((f) => {
    const name = f.result?.atendente || f.atendente || "Não identificado";
    if (!atendenteMap.has(name)) atendenteMap.set(name, []);
    atendenteMap.get(name)!.push(f);
  });

  const atendenteStats = [...atendenteMap.entries()].map(([name, aFiles]) => {
    const notasAt = aFiles.map((f) => notaToScale10(f.result!.notaFinal!));
    const mediaAt = Math.round((notasAt.reduce((a, b) => a + b, 0) / notasAt.length) * 10) / 10;
    const fortes: string[] = [];
    const fracos: string[] = [];
    aFiles.forEach((f) => {
      if (f.result?.pontosFortes) fortes.push(...f.result.pontosFortes);
      if (f.result?.pontosMelhoria) fracos.push(...f.result.pontosMelhoria);
      if (f.result?.mentoria) fracos.push(...f.result.mentoria);
    });
    return {
      name,
      notas: notasAt,
      media: mediaAt,
      classificacao: classificacao(mediaAt),
      pontosFortes: countOccurrences(fortes).slice(0, 5).map((o) => o.text),
      pontosFracos: countOccurrences(fracos).slice(0, 5).map((o) => o.text),
      bonus: calcularBonus(mediaAt * 10),
      amostragemInsuficiente: notasAt.length < 6,
    };
  }).sort((a, b) => b.media - a.media);

  // Global improvement points
  const allMelhoria: string[] = [];
  const allFortes: string[] = [];
  analyzed.forEach((f) => {
    if (f.result?.pontosMelhoria) allMelhoria.push(...f.result.pontosMelhoria);
    if (f.result?.mentoria) allMelhoria.push(...f.result.mentoria);
    if (f.result?.pontosFortes) allFortes.push(...f.result.pontosFortes);
  });
  const topCriticos = countOccurrences(allMelhoria).slice(0, 6);
  const topFortes = countOccurrences(allFortes).slice(0, 6);

  // Recommended files
  const sorted = [...analyzed].sort((a, b) => a.result!.notaFinal! - b.result!.notaFinal!);
  const piores = sorted.filter((f) => notaToScale10(f.result!.notaFinal!) < 5).slice(0, 5);
  const medianos = sorted.filter((f) => notaToScale10(f.result!.notaFinal!) >= 5 && notaToScale10(f.result!.notaFinal!) < 7).slice(0, 5);
  const melhores = [...sorted].reverse().filter((f) => notaToScale10(f.result!.notaFinal!) >= 7).slice(0, 5);

  // ─── Utility functions ───
  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
      addFooter();
    }
  };

  const addFooter = () => {
    const pageNum = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Radar Insight — Relatório de Mentoria`, MARGIN, PAGE_H - 10);
    doc.text(`Página ${pageNum}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(15);
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(title, MARGIN, y);
    y += 2;
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 6;
  };

  const addText = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number]; indent?: number }) => {
    const size = opts?.size ?? 9;
    const indent = opts?.indent ?? 0;
    doc.setFontSize(size);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setTextColor(...(opts?.color ?? [50, 50, 50]));
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    ensureSpace(lines.length * (size * 0.4) + 2);
    doc.text(lines, MARGIN + indent, y);
    y += lines.length * (size * 0.4) + 2;
  };

  // ═══════════════════════════════════════════════════════
  // PAGE 1: Cover / Header
  // ═══════════════════════════════════════════════════════
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text("Radar Insight", MARGIN, y + 5);
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246);
  doc.text("Relatório de Mentoria", MARGIN, y);
  y += 10;

  // Metadata
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  const now = new Date();
  doc.text(`Data: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, MARGIN, y);
  y += LINE_H;
  if (batchInfo) {
    doc.text(`Lote: ${batchInfo.batchCode} • ${batchInfo.totalPdfs} PDF(s) • Importado em ${batchInfo.createdAt.toLocaleDateString("pt-BR")}`, MARGIN, y);
    y += LINE_H;
  }
  doc.text(`Total analisados: ${analyzed.length} atendimentos • ${atendenteStats.length} atendente(s)`, MARGIN, y);
  y += LINE_H;
  doc.text(`Nota média geral: ${fmtNota(media)} — ${classificacao(media)}`, MARGIN, y);
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 8;

  // ═══════════════════════════════════════════════════════
  // SECTION 1: Resumo Geral
  // ═══════════════════════════════════════════════════════
  addSectionTitle("1. Resumo Geral");

  if (atendenteStats.length > 0) {
    const melhor = atendenteStats[0];
    const pior = atendenteStats[atendenteStats.length - 1];
    addText(`Melhor desempenho: ${melhor.name} — média ${fmtNota(melhor.media)}`, { bold: true, color: [34, 139, 34] });
    addText(`Atenção: ${pior.name} — média ${fmtNota(pior.media)}`, { bold: true, color: [200, 50, 50] });
  }

  y += 3;
  if (topCriticos.length > 0) {
    addText("Pontos críticos mais recorrentes:", { bold: true, size: 9 });
    topCriticos.forEach((p) => {
      addText(`• ${p.text} (${p.count}x)`, { indent: 4, size: 8.5 });
    });
  }

  y += 2;
  if (topFortes.length > 0) {
    addText("Pontos fortes mais recorrentes:", { bold: true, size: 9 });
    topFortes.forEach((p) => {
      addText(`• ${p.text} (${p.count}x)`, { indent: 4, size: 8.5 });
    });
  }

  if (summaryOnly) {
    addFooter();
    // Add footers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter();
    }
    return doc;
  }

  // ═══════════════════════════════════════════════════════
  // SECTION 2: Performance & Bônus por Atendente
  // ═══════════════════════════════════════════════════════
  doc.addPage();
  y = MARGIN;
  addSectionTitle("2. Performance & Bônus por Atendente");

  // Table header
  const cols = [MARGIN, MARGIN + 55, MARGIN + 75, MARGIN + 100, MARGIN + 130, MARGIN + 155];
  const headers = ["Atendente", "Mentorias", "Média", "Faixa", "Bônus %", "Valor"];

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.setFillColor(240, 240, 240);
  doc.rect(MARGIN, y - 3.5, CONTENT_W, 6, "F");
  headers.forEach((h, i) => doc.text(h, cols[i], y));
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  atendenteStats.forEach((at, idx) => {
    ensureSpace(6);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(MARGIN, y - 3.5, CONTENT_W, 5.5, "F");
    }
    doc.setFontSize(8);
    const nameText = at.name.length > 25 ? at.name.substring(0, 23) + "…" : at.name;
    doc.text(nameText, cols[0], y);
    doc.text(String(at.notas.length), cols[1], y);
    doc.text(fmtNota(at.media), cols[2], y);
    doc.text(at.amostragemInsuficiente ? "Pendente" : at.bonus.classificacao, cols[3], y);
    doc.text(at.amostragemInsuficiente ? "—" : `${at.bonus.percentual}%`, cols[4], y);
    doc.text(at.amostragemInsuficiente ? "—" : formatBRL(at.bonus.valor), cols[5], y);
    y += 5.5;
  });

  // Total
  y += 3;
  const totalBonus = atendenteStats.filter((a) => !a.amostragemInsuficiente).reduce((s, a) => s + a.bonus.valor, 0);
  addText(`Total de bônus: ${formatBRL(totalBonus)}`, { bold: true, size: 10 });

  // Legend
  y += 4;
  addText("Régua progressiva (base R$ 1.200):", { bold: true, size: 8 });
  addText("95–100: Excelente (100% = R$ 1.200) • 85–94: Muito bom (90% = R$ 1.080) • 70–84: Bom (70% = R$ 840) • 50–69: Em desenv. (30% = R$ 360) • 0–49: Abaixo (0%)", { size: 7.5, color: [120, 120, 120] });

  // ═══════════════════════════════════════════════════════
  // SECTION 3: Performance Detalhada
  // ═══════════════════════════════════════════════════════
  doc.addPage();
  y = MARGIN;
  addSectionTitle("3. Performance Detalhada por Atendente");

  atendenteStats.forEach((at) => {
    ensureSpace(30);
    addText(`${at.name} — Média: ${fmtNota(at.media)} (${at.classificacao})`, { bold: true, size: 10 });
    addText(`Mentorias: ${at.notas.length} • Notas: ${at.notas.map((n) => fmtNota(n)).join(", ")}`, { size: 8, indent: 2 });

    if (at.pontosFortes.length > 0) {
      addText("Pontos fortes:", { bold: true, size: 8, indent: 2, color: [34, 139, 34] });
      at.pontosFortes.forEach((p) => addText(`✓ ${p}`, { size: 8, indent: 6 }));
    }
    if (at.pontosFracos.length > 0) {
      addText("Pontos de melhoria:", { bold: true, size: 8, indent: 2, color: [200, 50, 50] });
      at.pontosFracos.forEach((p) => addText(`• ${p}`, { size: 8, indent: 6 }));
    }
    y += 4;
  });

  // ═══════════════════════════════════════════════════════
  // SECTION 4: Atendimentos Recomendados
  // ═══════════════════════════════════════════════════════
  doc.addPage();
  y = MARGIN;
  addSectionTitle("4. Atendimentos Recomendados");

  const renderFileList = (title: string, items: AnalyzedFile[], color: [number, number, number]) => {
    if (items.length === 0) return;
    addText(title, { bold: true, size: 9, color });
    items.forEach((f) => {
      const proto = f.result?.protocolo || f.name;
      const att = f.result?.atendente || f.atendente || "—";
      const nota = fmtNota(f.result!.notaFinal!);
      addText(`→ ${proto} (${att}) — Nota: ${nota}`, { size: 8, indent: 4 });
    });
    y += 3;
  };

  renderFileList("Casos críticos (nota < 5,0):", piores, [200, 50, 50]);
  renderFileList("Medianos (nota 5,0 – 6,9):", medianos, [180, 130, 20]);
  renderFileList("Exemplos positivos (nota ≥ 7,0):", melhores, [34, 139, 34]);

  // ═══════════════════════════════════════════════════════
  // SECTION 5: Padrões de Comportamento
  // ═══════════════════════════════════════════════════════
  const withPatterns = atendenteStats.filter((a) => a.pontosFracos.length > 0);
  if (withPatterns.length > 0) {
    ensureSpace(20);
    if (y > PAGE_H - 60) { doc.addPage(); y = MARGIN; }
    addSectionTitle("5. Padrões de Comportamento");

    withPatterns.forEach((at) => {
      ensureSpace(15);
      addText(at.name, { bold: true, size: 9 });
      at.pontosFracos.forEach((p) => addText(`• ${p}`, { size: 8, indent: 4 }));
      if (at.media < 5) {
        addText("⚠ Padrão recorrente — necessita acompanhamento próximo", { size: 8, indent: 4, color: [200, 50, 50] });
      }
      y += 3;
    });
  }

  // ═══════════════════════════════════════════════════════
  // SECTION 6: Roteiro de Mentoria
  // ═══════════════════════════════════════════════════════
  doc.addPage();
  y = MARGIN;
  addSectionTitle("6. Roteiro de Mentoria");

  const temaPrincipal = topCriticos[0]?.text || "Qualidade do atendimento";
  const exemploNegativo = piores[0];
  const exemploPositivo = melhores[0];

  const steps = [
    {
      step: "1", title: "Abertura",
      text: `Hoje vamos conversar sobre a qualidade dos atendimentos do período. Analisamos ${analyzed.length} atendimento(s) com nota média de ${fmtNota(media)}.`,
    },
    {
      step: "2", title: `Tema principal: ${temaPrincipal}`,
      text: topCriticos.length > 0
        ? `Os principais pontos de melhoria identificados foram: ${topCriticos.slice(0, 3).map((p) => p.text).join("; ")}.`
        : "Não foram identificados pontos críticos recorrentes.",
    },
    ...(exemploNegativo ? [{
      step: "3", title: "Exemplo de atenção",
      text: `Vamos analisar o atendimento "${exemploNegativo.result?.protocolo || exemploNegativo.name}" (${exemploNegativo.result?.atendente || "—"}) com nota ${fmtNota(exemploNegativo.result!.notaFinal!)} como caso de atenção.`,
    }] : []),
    ...(exemploPositivo ? [{
      step: "4", title: "Exemplo positivo",
      text: `Como exemplo positivo, temos "${exemploPositivo.result?.protocolo || exemploPositivo.name}" (${exemploPositivo.result?.atendente || "—"}) com nota ${fmtNota(exemploPositivo.result!.notaFinal!)} — um bom modelo a seguir.`,
    }] : []),
    {
      step: "5", title: "Fechamento e próximos passos",
      text: `Próximos passos: ${atendenteStats.filter((a) => a.media < 7).length > 0 ? `acompanhamento individual para ${atendenteStats.filter((a) => a.media < 7).map((a) => a.name).join(", ")}` : "manter o padrão de qualidade"}.`,
    },
  ];

  steps.forEach((s) => {
    ensureSpace(18);
    addText(`Etapa ${s.step}: ${s.title}`, { bold: true, size: 10 });
    addText(s.text, { size: 9, indent: 4 });
    y += 4;
  });

  // ─── Add footers to all pages ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Radar Insight — Relatório de Mentoria", MARGIN, PAGE_H - 10);
    doc.text(`Página ${i} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
  }

  return doc;
}

// ─── Component ──────────────────────────────────────────────────────
const MentoriaReportExport = ({ files, batchInfo }: MentoriaReportExportProps) => {
  const [generating, setGenerating] = useState(false);

  const hasAnalyzed = files.some(
    (f) => f.result && typeof f.result.notaFinal === "number" && !f.ineligible && !f.result?._ineligible && !f.nonEvaluable
  );

  const handleExport = useCallback(async (summaryOnly: boolean) => {
    setGenerating(true);
    toast.info("Gerando relatório...");

    try {
      // Use requestAnimationFrame to let the UI update
      await new Promise((r) => requestAnimationFrame(r));

      const doc = buildReportPdf(files, batchInfo, summaryOnly);
      const suffix = summaryOnly ? "resumo" : "completo";
      const code = batchInfo?.batchCode || "mentoria";
      doc.save(`relatorio_${suffix}_${code}.pdf`);

      toast.success("Download iniciado");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  }, [files, batchInfo]);

  if (!hasAnalyzed) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs" disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          Exportar relatório
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport(false)} className="gap-2">
          <FileText className="h-4 w-4" />
          Relatório completo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport(true)} className="gap-2">
          <ClipboardList className="h-4 w-4" />
          Apenas resumo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MentoriaReportExport;
