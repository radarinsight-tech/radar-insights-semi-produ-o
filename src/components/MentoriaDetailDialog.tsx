import { useRef, useState, useMemo } from "react";
import { calcularBonus, formatBRL, notaToScale10, formatDateBR } from "@/lib/utils";
import type { StructuredConversation } from "@/lib/conversationParser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, MinusCircle, ShieldAlert,
  MessageSquareQuote, Printer, X, Award, TrendingUp, AlertTriangle, Lightbulb,
  User, Calendar, FileText, Hash, Radio, Sparkles, Zap, ChevronRight, ChevronLeft, List, CheckSquare
} from "lucide-react";
import UraContextDialog from "@/components/UraContextDialog";
import PreAnalysisPanel from "@/components/PreAnalysisPanel";
import SemiAutoPanel, { type SemiAutoResult } from "@/components/SemiAutoPanel";
import MentoriaStepBar, { type MentoriaStep, STEPS } from "@/components/MentoriaStepBar";
import { runPreAnalysis, type PreAnalysisResult } from "@/lib/mentoriaPreAnalysis";
import type { UraContext } from "@/lib/uraContextSummarizer";
import { extractUraContext } from "@/lib/conversationParser";

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

export type WorkflowStatus = "nao_iniciado" | "em_analise" | "finalizado";

interface MentoriaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: any;
  fileName: string;
  rawText?: string;
  atendente?: string;
  structuredConversation?: StructuredConversation;
  workflowStatus?: WorkflowStatus;
  onMarkFinished?: () => void;
  onNextFile?: () => void;
  hasNextFile?: boolean;
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
  if (r === "SIM") return { text: "SIM", cls: "bg-green-600 text-white border-green-700 font-extrabold" };
  if (r === "NÃO") return { text: "NÃO", cls: "bg-red-600 text-white border-red-700 font-extrabold" };
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

const MentoriaDetailDialog = ({ open, onOpenChange, result, fileName, rawText, atendente, structuredConversation, workflowStatus, onMarkFinished, onNextFile, hasNextFile }: MentoriaDetailDialogProps) => {
  const [uraOpen, setUraOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<MentoriaStep>("pre-analise");
  const [completedSteps, setCompletedSteps] = useState<Set<MentoriaStep>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  // Pre-analysis: run once when conversation is available
  const preAnalysis: PreAnalysisResult | null = useMemo(() => {
    if (!structuredConversation || structuredConversation.messages.length < 2) return null;
    try {
      let uraCtx: UraContext | undefined;
      if (rawText) {
        try { uraCtx = extractUraContext(rawText, atendente); } catch { /* non-blocking */ }
      }
      return runPreAnalysis(structuredConversation, uraCtx);
    } catch { return null; }
  }, [structuredConversation, rawText, atendente]);

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

    // Clone the actual rendered content (WYSIWYG)
    const content = printRef.current.cloneNode(true) as HTMLElement;

    // Collect all stylesheets from the current page
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join("\n");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>Mentoria — ${result.protocolo || "Atendimento"}</title>
        ${styles}
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 14mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            overflow-x: hidden !important;
            font-size: 10px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .print-wrapper {
            width: 100% !important;
            max-width: 190mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .print-wrapper * {
            max-width: 100% !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            box-sizing: border-box !important;
          }
          /* Scale down text slightly for A4 fit */
          .print-wrapper {
            font-size: 9.5px !important;
          }
          .print-wrapper h1 { font-size: 14px !important; }
          .print-wrapper h2 { font-size: 11px !important; }
          .print-wrapper h3 { font-size: 10.5px !important; }
          .print-wrapper p, .print-wrapper span, .print-wrapper div {
            line-height: 1.45 !important;
          }
          /* Ensure backgrounds print */
          .print-wrapper [class*="bg-"] {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Prevent page breaks inside key sections */
          .print-wrapper > div { page-break-inside: avoid; }
          /* Remove scroll containers */
          [data-radix-scroll-area-viewport] {
            overflow: visible !important;
            max-height: none !important;
          }
          /* Hide scrollbars */
          ::-webkit-scrollbar { display: none !important; }
          /* Ensure grid doesn't overflow */
          .grid { gap: 8px !important; }
          @media print {
            body { padding: 0 !important; margin: 0 !important; }
            .print-wrapper > div { page-break-inside: avoid; }
          }
        </style>
      </head><body>
        <div class="print-wrapper"></div>
      </body></html>
    `);

    const wrapper = printWindow.document.querySelector('.print-wrapper');
    if (wrapper) {
      wrapper.appendChild(printWindow.document.adoptNode(content));
    }

    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
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
              <Button variant="outline" size="sm" onClick={() => setUraOpen(true)} className="gap-1.5 text-xs h-8 font-semibold">
                <Radio className="h-3.5 w-3.5" /> Contexto URA
              </Button>
              {currentStep === "relatorio" && (
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8 font-semibold">
                  <Printer className="h-3.5 w-3.5" /> Imprimir Relatório
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ═══ STEP BAR ═══ */}
        <MentoriaStepBar
          currentStep={preAnalysis ? currentStep : "relatorio"}
          completedSteps={completedSteps}
          onStepClick={(step) => setCurrentStep(step)}
          hasPreAnalysis={!!preAnalysis}
        />

        {/* ═══ STEP CONTENT ═══ */}
        <div className="flex-1 min-h-0">
          {/* STEP: PRÉ-ANÁLISE */}
          {currentStep === "pre-analise" && preAnalysis && (
            <ScrollArea className="max-h-[calc(96vh-200px)]">
              <div className="px-8 py-8">
                <PreAnalysisPanel analysis={preAnalysis} />
              </div>
            </ScrollArea>
          )}

          {/* STEP: SEMI-AUTOMÁTICO */}
          {currentStep === "semi-auto" && preAnalysis && (
            <ScrollArea className="max-h-[calc(96vh-200px)]">
              <div className="px-8 py-8">
                <SemiAutoPanel
                  analysis={preAnalysis}
                  onConfirm={(semiResult: SemiAutoResult) => {
                    console.log("Semi-auto confirmed:", semiResult);
                  }}
                />
              </div>
            </ScrollArea>
          )}

          {/* STEP: RELATÓRIO */}
          {currentStep === "relatorio" && (
            <ScrollArea className="max-h-[calc(96vh-200px)]">
          <div ref={printRef} className="px-8 py-8 space-y-0">

            {/* ═══ 1. HERO — Nota + Classificação + Bônus ═══ */}
            <div className="rounded-2xl bg-gradient-to-br from-muted/50 via-muted/30 to-background border border-border/60 p-5 mb-8 shadow-sm">
              <div className="flex items-stretch gap-5">
                {/* Left: metadata */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-extrabold text-foreground tracking-tight mb-3">
                    Auditoria de Atendimento
                  </h1>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      { icon: Hash, label: "Protocolo", value: result.protocolo || "—", mono: true },
                      { icon: User, label: "Atendente", value: result.atendente || atendente || "—" },
                      { icon: Calendar, label: "Data", value: formatDateBR(result.data) },
                      { icon: FileText, label: "Tipo", value: result.tipo || "—" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <item.icon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] text-muted-foreground uppercase tracking-[0.1em] font-semibold leading-none mb-0.5">{item.label}</p>
                          <p className={`text-[13px] font-bold text-foreground truncate leading-tight ${item.mono ? "font-mono" : ""}`}>{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: score hero card */}
                <div className="shrink-0 w-44 flex flex-col items-center justify-center text-center rounded-2xl bg-background border-2 border-border/80 p-4 shadow-md">
                  <p className="text-[8px] text-muted-foreground uppercase tracking-[0.15em] font-bold mb-1">Nota Final</p>
                  <p className={`text-4xl font-black tracking-tighter leading-none ${notaColor(nota)}`}>
                    {nota != null ? notaToScale10(nota).toFixed(1).replace(".", ",") : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium tabular-nums">
                    {result.pontosObtidos ?? totalObtidos}/{result.pontosPossiveis ?? totalPossiveis} pontos
                  </p>
                  <Badge className={`mt-2 text-[10px] px-2.5 py-0.5 font-bold shadow-sm ${classColor(classificacao)}`}>
                    {classificacao}
                  </Badge>
                  {nota != null && (() => {
                    const bonus = calcularBonus(nota);
                    return (
                      <div className="mt-2.5 pt-2.5 border-t border-border/60 w-full">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Award className="h-3 w-3 text-primary" />
                          <p className="text-[8px] text-muted-foreground uppercase tracking-[0.1em] font-bold">Bônus</p>
                        </div>
                        <p className="text-sm font-extrabold text-foreground">{bonus.percentual}%</p>
                        <p className="text-[11px] font-semibold text-primary mt-0.5">{formatBRL(bonus.valor)}</p>
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
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${catPct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                              {subtotal.obtidos}/{subtotal.possiveis} pts
                            </span>
                          </div>
                        )}
                      </div>

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
                              <div className={`absolute ${rowBg ? "left-[13px]" : "left-[-5px]"} top-[20px] w-2.5 h-2.5 rounded-full ring-2 ring-background ${
                                c.resultado === "SIM" ? "bg-accent" :
                                c.resultado === "NÃO" ? "bg-destructive" : "bg-muted-foreground/40"
                              }`} />
                              <div className="flex items-baseline gap-2.5 flex-wrap">
                                <span className="text-[13px] font-semibold leading-snug text-foreground">
                                  {c.numero}. {c.nome}
                                </span>
                                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border font-extrabold ${badge.cls}`}>
                                  {badge.text}
                                </Badge>
                                {isCritical && c.resultado !== "FORA DO ESCOPO" && (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0 font-bold">CRÍTICO</Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground font-semibold ml-auto shrink-0 tabular-nums">
                                  {c.pontosObtidos}/{c.pesoMaximo} pts
                                </span>
                              </div>
                              <p className={`text-xs mt-2 leading-relaxed pl-0.5 ${
                                c.resultado === "NÃO" ? "text-destructive font-medium" : "text-muted-foreground"
                              }`}>
                                {c.explicacao}
                              </p>
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
                        <span className="text-[10px] font-bold text-primary-foreground shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-0.5">
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
          )}

          {/* Fallback: no pre-analysis, show report directly */}
          {!preAnalysis && currentStep !== "relatorio" && (() => { setCurrentStep("relatorio"); return null; })()}
        </div>
        {/* ═══ WORKFLOW CONTROL BAR ═══ */}
        <div className="px-8 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {workflowStatus && (
              <Badge variant="outline" className={`text-[10px] font-bold ${
                workflowStatus === "finalizado" ? "bg-accent/15 text-accent border-accent/30" :
                workflowStatus === "em_analise" ? "bg-primary/15 text-primary border-primary/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {workflowStatus === "finalizado" ? "Finalizado" : workflowStatus === "em_analise" ? "Em análise" : "Não iniciado"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {workflowStatus !== "finalizado" && onMarkFinished && (
              <Button variant="outline" size="sm" onClick={onMarkFinished} className="gap-1.5 text-xs h-8 font-semibold text-accent border-accent/30 hover:bg-accent/10">
                <CheckSquare className="h-3.5 w-3.5" /> Marcar como finalizado
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5 text-xs h-8 font-semibold">
              <List className="h-3.5 w-3.5" /> Voltar para lista
            </Button>
            {hasNextFile && onNextFile && (
              <Button size="sm" onClick={onNextFile} className="gap-1.5 text-xs h-8 font-semibold">
                Próximo atendimento <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      <UraContextDialog open={uraOpen} onOpenChange={setUraOpen} rawText={rawText} atendente={atendente} structuredConversation={structuredConversation} />
    </Dialog>
  );
};

export default MentoriaDetailDialog;
