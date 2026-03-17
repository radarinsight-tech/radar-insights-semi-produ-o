import { useRef } from "react";
import { calcularBonus, formatBRL, notaToScale10, formatDateBR } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, MinusCircle, ShieldAlert,
  MessageSquareQuote, Printer, X, Award, TrendingUp, AlertTriangle, Lightbulb,
  User, Calendar, FileText, Hash
} from "lucide-react";

interface CriterioAvaliacao {
  numero: number;
  nome: string;
  categoria: string;
  pesoMaximo: number;
  resultado: "SIM" | "NÃO" | "FORA DO ESCOPO";
  pontosObtidos: number;
  explicacao: string;
}

interface Subtotais {
  posturaEComunicacao: { obtidos: number; possiveis: number };
  entendimentoEConducao: { obtidos: number; possiveis: number };
  solucaoEConfirmacao: { obtidos: number; possiveis: number };
  encerramentoEValor: { obtidos: number; possiveis: number };
}

interface MentoriaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: any;
  fileName: string;
  rawText?: string;
  atendente?: string;
}

const CATEGORY_ORDER = [
  "Postura e Comunicação",
  "Entendimento e Condução",
  "Solução e Confirmação",
  "Encerramento e Valor",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Postura e Comunicação": "💬",
  "Entendimento e Condução": "🎯",
  "Solução e Confirmação": "✅",
  "Encerramento e Valor": "⭐",
};

const subtotalKey = (cat: string): keyof Subtotais => {
  const map: Record<string, keyof Subtotais> = {
    "Postura e Comunicação": "posturaEComunicacao",
    "Entendimento e Condução": "entendimentoEConducao",
    "Solução e Confirmação": "solucaoEConfirmacao",
    "Encerramento e Valor": "encerramentoEValor",
  };
  return map[cat] || "posturaEComunicacao";
};

const classColor = (c: string) => {
  if (c === "Excelente" || c === "Muito bom") return "bg-accent text-accent-foreground";
  if (c === "Bom atendimento") return "bg-primary text-primary-foreground";
  if (c === "Necessita mentoria" || c === "Abaixo do esperado") return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
};

const notaColor = (nota: number | null | undefined) => {
  if (nota == null) return "text-muted-foreground";
  const n10 = notaToScale10(nota);
  if (n10 >= 9) return "text-accent";
  if (n10 >= 7) return "text-primary";
  if (n10 >= 5) return "text-warning";
  return "text-destructive";
};

const resultLabel = (r: string) => {
  if (r === "SIM") return { text: "SIM", cls: "bg-accent/15 text-accent border-accent/30 font-bold" };
  if (r === "NÃO") return { text: "NÃO", cls: "bg-destructive/15 text-destructive border-destructive/30 font-bold" };
  return { text: "N/A", cls: "bg-muted text-muted-foreground border-border" };
};

const resultIcon = (r: string) => {
  if (r === "FORA DO ESCOPO") return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  if (r === "SIM") return <CheckCircle2 className="h-4 w-4 text-accent" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
};

const findRelevantExcerpt = (rawText: string | undefined, explicacao: string): string | null => {
  if (!rawText || !explicacao) return null;
  const quoteMatch = explicacao.match(/[""\u201C\u201D]([^""\u201C\u201D]{10,150})[""\u201C\u201D]|"([^"]{10,150})"/);
  if (quoteMatch) return quoteMatch[1] || quoteMatch[2];
  return null;
};

const MentoriaDetailDialog = ({ open, onOpenChange, result, fileName, rawText, atendente }: MentoriaDetailDialogProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!result) return null;

  const nota = result.notaFinal ?? result.nota;
  const classificacao = result.classificacao || "—";
  const criterios: CriterioAvaliacao[] = result.criterios || [];
  const subtotais: Subtotais | null = result.subtotais || null;
  const mentoriaItems: string[] = result.mentoria || result.pontosMelhoria || [];

  const pontosPositivos = criterios.filter(c => c.resultado === "SIM");
  const pontosMelhoria = criterios.filter(c => c.resultado === "NÃO");

  const melhorAcerto = pontosPositivos.length > 0
    ? pontosPositivos.reduce((a, b) => a.pesoMaximo >= b.pesoMaximo ? a : b)
    : null;
  const principalMelhoria = pontosMelhoria.length > 0
    ? pontosMelhoria.reduce((a, b) => a.pesoMaximo >= b.pesoMaximo ? a : b)
    : null;

  const totalObtidos = criterios.reduce((s, c) => s + c.pontosObtidos, 0);
  const totalPossiveis = criterios.reduce((s, c) => s + c.pesoMaximo, 0);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Build criteria HTML for print
    const criteriaHtml = criteriosGrouped.map(({ categoria, items, subtotal }, catIdx) => {
      if (items.length === 0) return "";
      const catPct = subtotal ? Math.round((subtotal.obtidos / subtotal.possiveis) * 100) : 0;
      const itemsHtml = items.map(c => {
        const badgeCls = c.resultado === "SIM" ? "badge-sim" : c.resultado === "NÃO" ? "badge-nao" : "badge-fora";
        const isCritical = c.pesoMaximo >= 10;
        const rowCls = c.resultado === "SIM"
          ? (isCritical ? "criterio criterio-sim-critico" : "criterio criterio-sim")
          : c.resultado === "NÃO"
          ? (isCritical ? "criterio criterio-nao-critico" : "criterio criterio-nao")
          : "criterio";
        const excerpt = findRelevantExcerpt(rawText, c.explicacao);
        return `
          <div class="${rowCls}">
            <div class="criterio-row">
              <span class="criterio-num">${c.numero}.</span>
              <span class="criterio-nome">${c.nome}</span>
              <span class="criterio-badge ${badgeCls}">${c.resultado === "FORA DO ESCOPO" ? "N/A" : c.resultado}</span>
              ${isCritical && c.resultado !== "FORA DO ESCOPO" ? '<span class="criterio-badge badge-critico">CRÍTICO</span>' : ""}
              <span class="criterio-pts">${c.pontosObtidos}/${c.pesoMaximo} pts</span>
            </div>
            <p class="criterio-explicacao ${c.resultado === "NÃO" ? "explicacao-nao" : ""}">${c.explicacao}</p>
            ${excerpt ? `<div class="criterio-trecho ${c.resultado === "SIM" ? "trecho-sim" : "trecho-nao"}">"${excerpt}"</div>` : ""}
          </div>`;
      }).join("");
      return `
        <div class="secao-cat">
          <div class="cat-header">
            <span class="cat-title">${catIdx + 1}. ${categoria}</span>
            <span class="cat-score">${subtotal ? `${subtotal.obtidos}/${subtotal.possiveis} pts` : ""}</span>
          </div>
          <div class="cat-bar-wrapper"><div class="cat-bar" style="width:${catPct}%"></div></div>
          ${itemsHtml}
        </div>`;
    }).join("");

    // Mentoria section
    const acertoHtml = melhorAcerto ? `
      <div class="mentoria-card mentoria-positivo">
        <p class="mentoria-label label-positivo">✓ Principal Acerto</p>
        <p class="mentoria-nome">${melhorAcerto.nome}</p>
        <p class="mentoria-desc">${melhorAcerto.explicacao}</p>
      </div>` : "";

    const melhoriaHtml = principalMelhoria ? `
      <div class="mentoria-card mentoria-negativo">
        <p class="mentoria-label label-negativo">✗ Principal Melhoria</p>
        <p class="mentoria-nome">${principalMelhoria.nome}</p>
        <p class="mentoria-desc">${principalMelhoria.explicacao}</p>
      </div>` : "";

    const orientacoesHtml = mentoriaItems.length > 0 ? `
      <div class="orientacoes">
        <p class="section-title">Orientações Práticas</p>
        ${mentoriaItems.map((item, i) => `
          <div class="orientacao-item">
            <span class="orientacao-num">${i + 1}</span>
            <span class="orientacao-text">${item}</span>
          </div>`).join("")}
      </div>` : "";

    const badgeClass = notaToScale10(nota) >= 9 ? "class-excelente" : notaToScale10(nota) >= 7 ? "class-bom" : notaToScale10(nota) >= 5 ? "class-medio" : "class-critico";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Mentoria — ${result.protocolo || "Atendimento"}</title>
      <style>
        @page { size: A4; margin: 15mm 12mm 18mm 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          font-size: 10px; color: #1a1a1a; line-height: 1.5;
          padding: 0; margin: 0;
          max-width: 100%; overflow-x: hidden;
          width: 100%;
        }

        /* ── HEADER ── */
        .report-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding-bottom: 12px; border-bottom: 3px solid #111; margin-bottom: 14px;
          gap: 12px;
        }
        .header-brand { font-size: 7px; text-transform: uppercase; letter-spacing: 0.15em; color: #9ca3af; margin-bottom: 8px; }
        .header-title { font-size: 14px; font-weight: 800; color: #111; letter-spacing: -0.02em; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 20px; margin-top: 8px; }
        .header-grid dt { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
        .header-grid dd { font-size: 10px; font-weight: 600; color: #1a1a1a; margin-bottom: 2px; word-break: break-word; }

        .score-block { text-align: right; min-width: 90px; flex-shrink: 0; }
        .score-label { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
        .score-value { font-size: 34px; font-weight: 900; line-height: 1; letter-spacing: -0.03em; margin: 2px 0 3px; }
        .score-pts { font-size: 8.5px; color: #6b7280; }
        .score-class { display: inline-block; font-size: 8.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 5px; }
        .class-excelente { background: #dcfce7; color: #166534; }
        .class-bom { background: #dbeafe; color: #1e40af; }
        .class-medio { background: #fef3c7; color: #92400e; }
        .class-critico { background: #fde2e2; color: #991b1b; }

        .score-green { color: #16a34a; }
        .score-blue { color: #2563eb; }
        .score-yellow { color: #d97706; }
        .score-red { color: #dc2626; }

        /* ── SECTION TITLES ── */
        .section-title {
          font-size: 9.5px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.08em; color: #374151;
          padding-bottom: 5px; border-bottom: 2px solid #e5e7eb;
          margin: 16px 0 10px;
        }

        /* ── CRITERIA ── */
        .secao-cat { margin-bottom: 12px; page-break-inside: avoid; }
        .cat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
        .cat-title { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; }
        .cat-score { font-size: 8.5px; font-weight: 700; color: #6b7280; }
        .cat-bar-wrapper { height: 3px; background: #f3f4f6; border-radius: 2px; margin-bottom: 6px; overflow: hidden; }
        .cat-bar { height: 100%; background: #2563eb; border-radius: 2px; max-width: 100%; }

        .criterio { padding: 5px 0; border-bottom: 1px solid #f3f4f6; word-wrap: break-word; overflow-wrap: break-word; }
        .criterio-sim { background: #f0fdf4; border-radius: 5px; padding: 6px 8px; margin: 3px 0; border-bottom: none; }
        .criterio-sim-critico { background: #dcfce7; border: 1px solid #86efac; border-radius: 5px; padding: 6px 8px; margin: 3px 0; border-bottom: none; }
        .criterio-nao { background: #fef2f2; border-radius: 5px; padding: 6px 8px; margin: 3px 0; border-bottom: none; }
        .criterio-nao-critico { background: #fde2e2; border: 1px solid #fca5a5; border-radius: 5px; padding: 6px 8px; margin: 3px 0; border-bottom: none; }
        .criterio:last-child { border-bottom: none; }
        .criterio-row { display: flex; align-items: baseline; gap: 3px; flex-wrap: wrap; }
        .criterio-num { font-weight: 700; color: #6b7280; font-size: 9.5px; min-width: 16px; flex-shrink: 0; }
        .criterio-nome { font-weight: 600; font-size: 9.5px; color: #1a1a1a; flex: 1; min-width: 0; word-break: break-word; }
        .criterio-badge { display: inline-block; font-size: 7.5px; font-weight: 800; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .badge-critico { background: #eff6ff; color: #1e40af; }
        .explicacao-nao { color: #991b1b; font-weight: 500; }
        .trecho-sim { border-left-color: #16a34a; background: #f0fdf4; }
        .trecho-nao { border-left-color: #dc2626; background: #fef2f2; }
        .badge-sim { background: #dcfce7; color: #166534; }
        .badge-nao { background: #fde2e2; color: #991b1b; }
        .badge-fora { background: #f3f4f6; color: #9ca3af; }
        .criterio-pts { font-size: 8.5px; color: #9ca3af; font-weight: 600; margin-left: auto; white-space: nowrap; flex-shrink: 0; }
        .criterio-explicacao { color: #6b7280; font-size: 9px; margin-top: 2px; padding-left: 20px; word-break: break-word; overflow-wrap: break-word; }
        .criterio-trecho { margin: 3px 0 2px 20px; padding: 3px 8px; border-left: 2px solid #d1d5db; color: #6b7280; font-style: italic; background: #fafafa; font-size: 8.5px; word-break: break-word; }

        /* ── MENTORIA ── */
        .mentoria-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        .mentoria-card { padding: 8px 10px; border-radius: 5px; page-break-inside: avoid; word-break: break-word; }
        .mentoria-positivo { background: #f0fdf4; border: 1px solid #bbf7d0; }
        .mentoria-negativo { background: #fef2f2; border: 1px solid #fecaca; }
        .mentoria-label { font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
        .label-positivo { color: #166534; }
        .label-negativo { color: #991b1b; }
        .mentoria-nome { font-size: 9.5px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
        .mentoria-desc { font-size: 9px; color: #6b7280; line-height: 1.45; word-break: break-word; }

        .orientacoes { margin-top: 10px; padding: 10px 12px; border-radius: 5px; background: #eff6ff; border: 1px solid #bfdbfe; page-break-inside: avoid; }
        .orientacao-item { display: flex; gap: 6px; align-items: flex-start; padding: 2px 0; }
        .orientacao-num { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: #2563eb; color: #fff; font-size: 7.5px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .orientacao-text { font-size: 9px; color: #1a1a1a; line-height: 1.45; word-break: break-word; }

        /* ── FOOTER ── */
        .report-footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 7.5px; color: #9ca3af; display: flex; justify-content: space-between; }

        @media print {
          body { padding: 0; margin: 0; max-width: 100%; overflow: hidden; }
          .secao-cat { page-break-inside: avoid; }
          .criterio { page-break-inside: avoid; }
          .mentoria-card { page-break-inside: avoid; }
          .orientacoes { page-break-inside: avoid; }
          .report-header { page-break-after: avoid; }
        }
      </style>
      </head><body>

      <div class="report-header">
        <div>
          <p class="header-brand">Radar Insight</p>
          <p class="header-title">Relatório de Mentoria</p>
          <dl class="header-grid">
            <dt>Protocolo</dt><dd>${result.protocolo || "—"}</dd>
            <dt>Atendente</dt><dd>${result.atendente || atendente || "—"}</dd>
            <dt>Data do Atendimento</dt><dd>${formatDateBR(result.data)}</dd>
            <dt>Tipo</dt><dd>${result.tipo || "—"}</dd>
          </dl>
        </div>
        <div class="score-block">
          <p class="score-label">Nota Final</p>
          <p class="score-value ${notaToScale10(nota) >= 9 ? "score-green" : notaToScale10(nota) >= 7 ? "score-blue" : notaToScale10(nota) >= 5 ? "score-yellow" : "score-red"}">${nota != null ? notaToScale10(nota).toFixed(1).replace(".", ",") : "—"}</p>
          <p class="score-pts">${result.pontosObtidos ?? totalObtidos}/${result.pontosPossiveis ?? totalPossiveis} pontos</p>
          <span class="score-class ${badgeClass}">${classificacao}</span>
          ${nota != null ? (() => { const b = calcularBonus(nota); return `<div style="margin-top:8px;padding:4px 10px;background:#f3f4f6;border-radius:4px;font-size:9px;color:#374151"><strong>${b.percentual}%</strong> · ${formatBRL(b.valor)} <span style="color:#6b7280">— ${b.classificacao}</span></div>`; })() : ""}
        </div>
      </div>

      <p class="section-title">Critérios de Avaliação</p>
      ${criteriaHtml}

      <p class="section-title">Mentoria de Comunicação</p>
      <div class="mentoria-grid">
        ${acertoHtml}
        ${melhoriaHtml}
      </div>
      ${orientacoesHtml}

      <div class="report-footer">
        <span>Radar Insight · Relatório gerado automaticamente</span>
        <span>${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  if (result.impeditivo) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mentoria — Auditoria de Atendimento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center text-center py-6">
            <ShieldAlert className="h-10 w-10 text-warning mb-3" />
            <p className="font-bold text-foreground">Auditoria não realizada</p>
            <p className="text-sm text-muted-foreground mt-2">{result.motivoImpeditivo || "Impeditivo identificado."}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5">
              <X className="h-4 w-4" /> Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const criteriosGrouped = CATEGORY_ORDER.map(cat => ({
    categoria: cat,
    items: criterios.filter(c => c.categoria === cat),
    subtotal: subtotais ? subtotais[subtotalKey(cat)] : null,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[96vh] p-0 gap-0 overflow-hidden">
        {/* ═══ TOOLBAR ═══ */}
        <DialogHeader className="px-8 py-5 border-b border-border/60 bg-gradient-to-r from-muted/40 to-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xs font-extrabold text-primary uppercase tracking-[0.15em]">
                Relatório de Mentoria
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-1 truncate max-w-lg font-medium">{fileName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8 font-semibold">
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(96vh-72px)]">
          <div ref={printRef} className="px-8 py-8 space-y-0">

            {/* ═══ 1. HERO — Nota + Classificação + Bônus ═══ */}
            <div className="rounded-2xl bg-gradient-to-br from-muted/50 via-muted/30 to-background border border-border/60 p-6 mb-8 shadow-sm">
              <div className="flex items-stretch gap-8">
                {/* Left: metadata */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-extrabold text-foreground tracking-tight mb-4">
                    Auditoria de Atendimento
                  </h1>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] font-semibold">Protocolo</p>
                        <p className="text-sm font-bold text-foreground font-mono truncate">{result.protocolo || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] font-semibold">Atendente</p>
                        <p className="text-sm font-bold text-foreground truncate">{result.atendente || atendente || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] font-semibold">Data</p>
                        <p className="text-sm font-semibold text-foreground">{formatDateBR(result.data)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] font-semibold">Tipo</p>
                        <p className="text-sm font-semibold text-foreground truncate">{result.tipo || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: score hero card */}
                <div className="shrink-0 w-48 flex flex-col items-center justify-center text-center rounded-2xl bg-background border-2 border-border/80 p-5 shadow-md">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-bold mb-1.5">Nota Final</p>
                  <p className={`text-5xl font-black tracking-tighter leading-none ${notaColor(nota)}`}>
                    {nota != null ? notaToScale10(nota).toFixed(1).replace(".", ",") : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 font-medium tabular-nums">
                    {result.pontosObtidos ?? totalObtidos}/{result.pontosPossiveis ?? totalPossiveis} pontos
                  </p>
                  <Badge className={`mt-2.5 text-xs px-3 py-1 font-bold shadow-sm ${classColor(classificacao)}`}>
                    {classificacao}
                  </Badge>
                  {nota != null && (() => {
                    const bonus = calcularBonus(nota);
                    return (
                      <div className="mt-3 pt-3 border-t border-border/60 w-full">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <Award className="h-3.5 w-3.5 text-primary" />
                          <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] font-bold">Bônus</p>
                        </div>
                        <p className="text-sm font-extrabold text-foreground">{bonus.percentual}%</p>
                        <p className="text-xs font-semibold text-primary mt-0.5">{formatBRL(bonus.valor)}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Bonus operacional row */}
            {(result.bonusOperacional?.atualizacaoCadastral || result.atualizacaoCadastral) && (
              <div className="flex items-center gap-2.5 mb-8 px-4 py-3 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium">Atualização Cadastral: <span className="font-bold text-foreground">{result.bonusOperacional?.atualizacaoCadastral ?? result.atualizacaoCadastral ?? "—"}</span></span>
                {result.bonusOperacional?.pontosExtras && (
                  <Badge variant="outline" className="ml-auto text-accent border-accent/30 font-bold text-[10px]">+{result.bonusOperacional.pontosExtras} pts</Badge>
                )}
              </div>
            )}

            {/* ═══ 2. CRITÉRIOS DE AVALIAÇÃO ═══ */}
            <div>
              <div className="flex items-center gap-3 pb-4 border-b-2 border-foreground/10 mb-8">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-extrabold text-foreground uppercase tracking-[0.1em]">
                  Critérios de Avaliação
                </h2>
              </div>

              <div className="space-y-10">
                {criteriosGrouped.map(({ categoria, items, subtotal }, catIdx) => {
                  if (items.length === 0) return null;
                  const catPct = subtotal ? Math.round((subtotal.obtidos / subtotal.possiveis) * 100) : null;
                  return (
                    <div key={categoria}>
                      {/* Category header */}
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/40">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{CATEGORY_ICONS[categoria] || "📋"}</span>
                          <h3 className="text-[13px] font-extrabold text-primary uppercase tracking-widest">
                            {catIdx + 1}. {categoria}
                          </h3>
                        </div>
                        {subtotal && (
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${catPct}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                              {subtotal.obtidos}/{subtotal.possiveis} pts
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Criteria list */}
                      <div className="space-y-1 border-l-2 border-border/60 ml-4">
                        {items.map((c) => {
                          const badge = resultLabel(c.resultado);
                          const excerpt = findRelevantExcerpt(rawText, c.explicacao);
                          const isCritical = c.pesoMaximo >= 10;
                          const rowBg =
                            c.resultado === "SIM"
                              ? isCritical ? "bg-accent/10 border border-accent/25 rounded-xl" : "bg-accent/5 rounded-xl"
                              : c.resultado === "NÃO"
                              ? isCritical ? "bg-destructive/10 border border-destructive/25 rounded-xl" : "bg-destructive/5 rounded-xl"
                              : "";
                          return (
                            <div key={c.numero} className={`relative pl-7 py-3.5 group ${rowBg} ${rowBg ? "px-5 my-1.5" : ""}`}>
                              {/* Dot on timeline */}
                              <div className={`absolute ${rowBg ? "left-[13px]" : "left-[-5px]"} top-[20px] w-2.5 h-2.5 rounded-full ring-2 ring-background ${
                                c.resultado === "SIM" ? "bg-accent" :
                                c.resultado === "NÃO" ? "bg-destructive" : "bg-muted-foreground/40"
                              }`} />

                              {/* Question + badge + pts */}
                              <div className="flex items-baseline gap-2.5 flex-wrap">
                                <span className={`text-[13px] font-semibold leading-snug ${
                                  c.resultado === "SIM" ? "text-foreground" :
                                  c.resultado === "NÃO" ? "text-foreground" : "text-foreground"
                                }`}>
                                  {c.numero}. {c.nome}
                                </span>
                                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border font-extrabold ${badge.cls}`}>
                                  {badge.text}
                                </Badge>
                                {isCritical && c.resultado !== "FORA DO ESCOPO" && (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0 font-bold">
                                    CRÍTICO
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground font-semibold ml-auto shrink-0 tabular-nums">
                                  {c.pontosObtidos}/{c.pesoMaximo} pts
                                </span>
                              </div>

                              {/* Justification */}
                              <p className={`text-xs mt-2 leading-relaxed pl-0.5 ${
                                c.resultado === "NÃO" ? "text-destructive font-medium" : "text-muted-foreground"
                              }`}>
                                {c.explicacao}
                              </p>

                              {/* Conversation excerpt */}
                              {excerpt && (
                                <div className={`mt-2.5 rounded-lg px-3.5 py-2.5 text-[11px] italic border-l-[3px] ${
                                  c.resultado === "SIM"
                                    ? "bg-accent/10 border-accent/50 text-foreground/80"
                                    : "bg-destructive/8 border-destructive/50 text-foreground/80"
                                }`}>
                                  <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-50" />
                                  "{excerpt}"
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ 3. MENTORIA DE COMUNICAÇÃO ═══ */}
            <div className="mt-12">
              <div className="flex items-center gap-3 pb-4 border-b-2 border-foreground/10 mb-8">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Lightbulb className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-extrabold text-foreground uppercase tracking-[0.1em]">
                  Mentoria de Comunicação
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Principal acerto */}
                {melhorAcerto && (
                  <div className="rounded-2xl bg-accent/5 border border-accent/20 p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
                        <CheckCircle2 className="h-4.5 w-4.5 text-accent" />
                      </div>
                      <p className="text-[10px] font-extrabold text-accent uppercase tracking-[0.12em]">Principal Acerto</p>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-snug">{melhorAcerto.nome}</p>
                    <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">{melhorAcerto.explicacao}</p>
                  </div>
                )}

                {/* Principal ponto de melhoria */}
                {principalMelhoria && (
                  <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-full bg-destructive/15 flex items-center justify-center">
                        <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
                      </div>
                      <p className="text-[10px] font-extrabold text-destructive uppercase tracking-[0.12em]">Principal Melhoria</p>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-snug">{principalMelhoria.nome}</p>
                    <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">{principalMelhoria.explicacao}</p>
                    {(() => {
                      const ex = findRelevantExcerpt(rawText, principalMelhoria.explicacao);
                      if (!ex) return null;
                      return (
                        <div className="mt-3.5 rounded-lg px-3.5 py-2.5 text-[11px] italic border-l-[3px] border-destructive/40 bg-destructive/5 text-foreground/70">
                          <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-50" />
                          "{ex}"
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Orientações práticas */}
              {mentoriaItems.length > 0 && (
                <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                      <Lightbulb className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[10px] font-extrabold text-primary uppercase tracking-[0.12em]">
                      Orientações Práticas
                    </p>
                  </div>
                  <div className="space-y-3.5">
                    {mentoriaItems.map((item, i) => (
                      <div key={i} className="flex gap-3.5 items-start">
                        <span className="text-[10px] font-bold text-primary-foreground shrink-0 w-5.5 h-5.5 rounded-full bg-primary flex items-center justify-center mt-0.5 w-6 h-6">
                          {i + 1}
                        </span>
                        <p className="text-[13px] text-foreground leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ FOOTER ═══ */}
            <div className="mt-10 pt-4 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-medium">Radar Insight · Relatório gerado automaticamente</span>
              <span>{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default MentoriaDetailDialog;
