import { useRef } from "react";
import { calcularBonus, formatBRL, notaToScale10 } from "@/lib/utils";
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
        const excerpt = findRelevantExcerpt(rawText, c.explicacao);
        return `
          <div class="criterio">
            <div class="criterio-row">
              <span class="criterio-num">${c.numero}.</span>
              <span class="criterio-nome">${c.nome}</span>
              <span class="criterio-badge ${badgeCls}">${c.resultado === "FORA DO ESCOPO" ? "N/A" : c.resultado}</span>
              <span class="criterio-pts">${c.pontosObtidos}/${c.pesoMaximo} pts</span>
            </div>
            <p class="criterio-explicacao">${c.explicacao}</p>
            ${excerpt ? `<div class="criterio-trecho">"${excerpt}"</div>` : ""}
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

    const badgeClass = nota >= 90 ? "class-excelente" : nota >= 70 ? "class-bom" : nota >= 50 ? "class-medio" : "class-critico";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Mentoria — ${result.protocolo || "Atendimento"}</title>
      <style>
        @page { size: A4; margin: 20mm 18mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          font-size: 10.5px; color: #1a1a1a; line-height: 1.55;
          padding: 0;
        }

        /* ── HEADER ── */
        .report-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding-bottom: 14px; border-bottom: 3px solid #111; margin-bottom: 18px;
        }
        .header-brand { font-size: 7px; text-transform: uppercase; letter-spacing: 0.15em; color: #9ca3af; margin-bottom: 10px; }
        .header-title { font-size: 16px; font-weight: 800; color: #111; letter-spacing: -0.02em; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 28px; margin-top: 10px; }
        .header-grid dt { font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
        .header-grid dd { font-size: 11px; font-weight: 600; color: #1a1a1a; margin-bottom: 2px; }

        .score-block { text-align: right; min-width: 100px; }
        .score-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
        .score-value { font-size: 40px; font-weight: 900; line-height: 1; letter-spacing: -0.03em; margin: 2px 0 4px; }
        .score-pts { font-size: 9px; color: #6b7280; }
        .score-class { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 10px; border-radius: 4px; margin-top: 6px; }
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
          font-size: 10px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.08em; color: #374151;
          padding-bottom: 6px; border-bottom: 2px solid #e5e7eb;
          margin: 22px 0 12px;
        }

        /* ── CRITERIA ── */
        .secao-cat { margin-bottom: 16px; page-break-inside: avoid; }
        .cat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .cat-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; }
        .cat-score { font-size: 9px; font-weight: 700; color: #6b7280; }
        .cat-bar-wrapper { height: 3px; background: #f3f4f6; border-radius: 2px; margin-bottom: 8px; }
        .cat-bar { height: 100%; background: #2563eb; border-radius: 2px; }

        .criterio { padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
        .criterio:last-child { border-bottom: none; }
        .criterio-row { display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
        .criterio-num { font-weight: 700; color: #6b7280; font-size: 10px; min-width: 18px; }
        .criterio-nome { font-weight: 600; font-size: 10.5px; color: #1a1a1a; flex: 1; }
        .criterio-badge { display: inline-block; font-size: 8px; font-weight: 800; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em; }
        .badge-sim { background: #dcfce7; color: #166534; }
        .badge-nao { background: #fde2e2; color: #991b1b; }
        .badge-fora { background: #f3f4f6; color: #9ca3af; }
        .criterio-pts { font-size: 9px; color: #9ca3af; font-weight: 600; margin-left: auto; white-space: nowrap; }
        .criterio-explicacao { color: #6b7280; font-size: 9.5px; margin-top: 2px; padding-left: 22px; }
        .criterio-trecho { margin: 4px 0 2px 22px; padding: 4px 10px; border-left: 2px solid #d1d5db; color: #6b7280; font-style: italic; background: #fafafa; font-size: 9px; }

        /* ── MENTORIA ── */
        .mentoria-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
        .mentoria-card { padding: 10px 14px; border-radius: 6px; page-break-inside: avoid; }
        .mentoria-positivo { background: #f0fdf4; border: 1px solid #bbf7d0; }
        .mentoria-negativo { background: #fef2f2; border: 1px solid #fecaca; }
        .mentoria-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
        .label-positivo { color: #166534; }
        .label-negativo { color: #991b1b; }
        .mentoria-nome { font-size: 10.5px; font-weight: 700; color: #1a1a1a; margin-bottom: 3px; }
        .mentoria-desc { font-size: 9.5px; color: #6b7280; line-height: 1.5; }

        .orientacoes { margin-top: 12px; padding: 12px 14px; border-radius: 6px; background: #eff6ff; border: 1px solid #bfdbfe; page-break-inside: avoid; }
        .orientacao-item { display: flex; gap: 8px; align-items: flex-start; padding: 3px 0; }
        .orientacao-num { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #2563eb; color: #fff; font-size: 8px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .orientacao-text { font-size: 10px; color: #1a1a1a; line-height: 1.5; }

        /* ── FOOTER ── */
        .report-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #9ca3af; display: flex; justify-content: space-between; }

        @media print {
          body { padding: 0; }
          .secao-cat { page-break-inside: avoid; }
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
            <dt>Data do Atendimento</dt><dd>${result.data || "—"}</dd>
            <dt>Tipo</dt><dd>${result.tipo || "—"}</dd>
          </dl>
        </div>
        <div class="score-block">
          <p class="score-label">Nota Final</p>
          <p class="score-value ${nota >= 90 ? "score-green" : nota >= 70 ? "score-blue" : nota >= 50 ? "score-yellow" : "score-red"}">${nota != null ? nota.toFixed(1).replace(".", ",") : "—"}</p>
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
      <DialogContent className="max-w-4xl max-h-[96vh] p-0 gap-0">
        {/* ═══ TOOLBAR ═══ */}
        <DialogHeader className="px-8 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-sm font-bold text-foreground tracking-wide uppercase">
                Relatório de Mentoria
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-lg">{fileName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8">
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(96vh-64px)]">
          <div ref={printRef} className="px-8 py-6">

            {/* ═══ 1. CABEÇALHO — layout relatório ═══ */}
            <div className="flex items-start justify-between pb-6 border-b-2 border-foreground/10">
              {/* Left: metadata */}
              <div className="space-y-4">
                <h1 className="text-lg font-extrabold text-foreground tracking-tight">
                  Auditoria de Atendimento
                </h1>
                <div className="grid grid-cols-2 gap-x-10 gap-y-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Protocolo</p>
                      <p className="text-sm font-bold text-foreground font-mono">{result.protocolo || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Atendente</p>
                      <p className="text-sm font-bold text-foreground">{result.atendente || atendente || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Data</p>
                      <p className="text-sm font-semibold text-foreground">{result.data || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Tipo</p>
                      <p className="text-sm font-semibold text-foreground">{result.tipo || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: score */}
              <div className="text-right pl-8 shrink-0">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Nota Final</p>
                <p className={`text-5xl font-black tracking-tighter leading-none ${notaColor(nota)}`}>
          {nota != null ? nota.toFixed(1).replace(".", ",") : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {result.pontosObtidos ?? totalObtidos}/{result.pontosPossiveis ?? totalPossiveis} pts
                </p>
                <Badge className={`mt-2 text-xs px-2.5 py-0.5 ${classColor(classificacao)}`}>
                  {classificacao}
                </Badge>
                {nota != null && (() => {
                  const bonus = calcularBonus(nota);
                  return (
                    <div className="mt-3 p-2.5 rounded-lg bg-muted/40 border border-border text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Bônus</p>
                      <p className="text-sm font-bold text-foreground">{bonus.percentual}% · {formatBRL(bonus.valor)}</p>
                      <p className="text-[10px] text-muted-foreground">{bonus.classificacao}</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Bonus row if applicable */}
            {(result.bonusOperacional?.atualizacaoCadastral || result.atualizacaoCadastral) && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Atualização Cadastral: <span className="font-semibold text-foreground">{result.bonusOperacional?.atualizacaoCadastral ?? result.atualizacaoCadastral ?? "—"}</span></span>
                {result.bonusOperacional?.pontosExtras && (
                  <span className="ml-1 font-semibold text-accent">(+{result.bonusOperacional.pontosExtras} pts)</span>
                )}
              </div>
            )}

            {/* ═══ 2. CRITÉRIOS DE AVALIAÇÃO ═══ */}
            <div className="mt-8">
              <h2 className="text-[11px] font-extrabold text-foreground uppercase tracking-widest pb-3 border-b-2 border-foreground/10 mb-6">
                Critérios de Avaliação
              </h2>

              <div className="space-y-8">
                {criteriosGrouped.map(({ categoria, items, subtotal }, catIdx) => {
                  if (items.length === 0) return null;
                  const catPct = subtotal ? Math.round((subtotal.obtidos / subtotal.possiveis) * 100) : null;
                  return (
                    <div key={categoria}>
                      {/* Category header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{CATEGORY_ICONS[categoria] || "📋"}</span>
                          <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest">
                            {catIdx + 1}. {categoria}
                          </h3>
                        </div>
                        {subtotal && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${catPct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                              {subtotal.obtidos}/{subtotal.possiveis}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Criteria list — clean vertical layout */}
                      <div className="space-y-0 border-l-2 border-border ml-3">
                        {items.map((c) => {
                          const badge = resultLabel(c.resultado);
                          const excerpt = findRelevantExcerpt(rawText, c.explicacao);
                          return (
                            <div key={c.numero} className="relative pl-6 py-3 group">
                              {/* Dot on timeline */}
                              <div className={`absolute left-[-5px] top-[18px] w-2 h-2 rounded-full ${
                                c.resultado === "SIM" ? "bg-accent" :
                                c.resultado === "NÃO" ? "bg-destructive" : "bg-muted-foreground/40"
                              }`} />

                              {/* Question + badge + pts */}
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-[13px] font-semibold text-foreground leading-snug">
                                  {c.numero}. {c.nome}
                                </span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${badge.cls}`}>
                                  {badge.text}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-semibold ml-auto shrink-0 tabular-nums">
                                  {c.pontosObtidos}/{c.pesoMaximo} pts
                                </span>
                              </div>

                              {/* Justification */}
                              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed pl-0.5">
                                {c.explicacao}
                              </p>

                              {/* Conversation excerpt */}
                              {excerpt && (
                                <div className={`mt-2 rounded-md px-3 py-2 text-[11px] italic border-l-[3px] ${
                                  c.resultado === "SIM"
                                    ? "bg-accent/5 border-accent/40 text-foreground/70"
                                    : "bg-destructive/5 border-destructive/40 text-foreground/70"
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
            <div className="mt-10">
              <h2 className="text-[11px] font-extrabold text-foreground uppercase tracking-widest pb-3 border-b-2 border-foreground/10 mb-6">
                Mentoria de Comunicação
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Principal acerto */}
                {melhorAcerto && (
                  <div className="rounded-xl bg-accent/5 border border-accent/20 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      </div>
                      <p className="text-[10px] font-extrabold text-accent uppercase tracking-widest">Principal Acerto</p>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-snug">{melhorAcerto.nome}</p>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{melhorAcerto.explicacao}</p>
                  </div>
                )}

                {/* Principal ponto de melhoria */}
                {principalMelhoria && (
                  <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-destructive/15 flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </div>
                      <p className="text-[10px] font-extrabold text-destructive uppercase tracking-widest">Principal Melhoria</p>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-snug">{principalMelhoria.nome}</p>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{principalMelhoria.explicacao}</p>
                    {(() => {
                      const ex = findRelevantExcerpt(rawText, principalMelhoria.explicacao);
                      if (!ex) return null;
                      return (
                        <div className="mt-3 rounded-md px-3 py-2 text-[11px] italic border-l-[3px] border-destructive/40 bg-destructive/5 text-foreground/70">
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
                <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <Lightbulb className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest">
                      Orientações Práticas
                    </p>
                  </div>
                  <div className="space-y-3">
                    {mentoriaItems.map((item, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="text-[10px] font-bold text-primary-foreground shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-[13px] text-foreground leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default MentoriaDetailDialog;
