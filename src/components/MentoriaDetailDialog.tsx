import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, MinusCircle, ShieldAlert,
  MessageSquareQuote, Printer, X
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
  if (c === "Necessita mentoria" || c === "Abaixo do esperado") return "bg-warning text-warning-foreground";
  return "bg-muted text-muted-foreground";
};

const resultLabel = (r: string) => {
  if (r === "SIM") return { text: "SIM", cls: "bg-accent/15 text-accent border-accent/25" };
  if (r === "NÃO") return { text: "NÃO", cls: "bg-destructive/15 text-destructive border-destructive/25" };
  return { text: "FORA DO ESCOPO", cls: "bg-muted text-muted-foreground border-border" };
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

  // Find best positive and worst negative for the mentoria summary
  const melhorAcerto = pontosPositivos.length > 0
    ? pontosPositivos.reduce((a, b) => a.pesoMaximo >= b.pesoMaximo ? a : b)
    : null;
  const principalMelhoria = pontosMelhoria.length > 0
    ? pontosMelhoria.reduce((a, b) => a.pesoMaximo >= b.pesoMaximo ? a : b)
    : null;

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Mentoria — ${result.protocolo || "Atendimento"}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; line-height: 1.5; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        h2 { font-size: 13px; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e5e5; }
        h3 { font-size: 11px; margin: 12px 0 6px; text-transform: uppercase; color: #666; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin: 12px 0; }
        .header-grid dt { font-size: 9px; text-transform: uppercase; color: #888; }
        .header-grid dd { font-size: 11px; font-weight: 600; margin: 0; }
        .criterio { padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
        .criterio:last-child { border-bottom: none; }
        .criterio-header { display: flex; align-items: center; gap: 6px; }
        .badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
        .badge-sim { background: #dcfce7; color: #166534; }
        .badge-nao { background: #fde2e2; color: #991b1b; }
        .badge-fora { background: #f3f4f6; color: #6b7280; }
        .explicacao { color: #555; margin-top: 2px; }
        .trecho { margin-top: 4px; padding: 4px 8px; border-left: 2px solid #d1d5db; color: #666; font-style: italic; background: #fafafa; }
        .mentoria-item { padding: 4px 0; }
        .mentoria-num { display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: #eff6ff; color: #2563eb; text-align: center; line-height: 18px; font-size: 10px; font-weight: 700; margin-right: 6px; }
        .section-positivos { background: #f0fdf4; padding: 8px 12px; border-radius: 6px; margin: 6px 0; }
        .section-melhoria { background: #fef2f2; padding: 8px 12px; border-radius: 6px; margin: 6px 0; }
        .nota-box { text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px; margin: 8px 0; }
        .nota-valor { font-size: 32px; font-weight: 900; }
        @media print { body { padding: 12px; } }
      </style>
      </head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
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
      <DialogContent className="max-w-3xl max-h-[94vh] p-0">
        <DialogHeader className="p-6 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold">
                Mentoria — Auditoria de Atendimento
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">{fileName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
                <Printer className="h-3.5 w-3.5" /> Imprimir mentoria
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5 text-xs">
                <X className="h-3.5 w-3.5" /> Fechar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(94vh-80px)]">
          <div ref={printRef} className="p-6 space-y-6">

            {/* ═══ 1. CABEÇALHO ═══ */}
            <div>
              <h1 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1 hidden print:block">
                Radar Insight — Auditoria de Atendimento
              </h1>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Protocolo</p>
                  <p className="text-sm font-semibold text-foreground font-mono">{result.protocolo || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Data</p>
                  <p className="text-sm font-semibold text-foreground">{result.data || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atendente</p>
                  <p className="text-sm font-semibold text-foreground">{result.atendente || atendente || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</p>
                  <p className="text-sm font-semibold text-foreground">{result.tipo || "—"}</p>
                </div>
              </div>

              {/* Score row */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nota Final</p>
                  <p className="text-3xl font-black text-foreground tracking-tight leading-none mt-0.5">
                    {nota?.toFixed(1) ?? "—"}
                  </p>
                  {result.pontosObtidos != null && result.pontosPossiveis != null && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{result.pontosObtidos}/{result.pontosPossiveis} pts</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Classificação</p>
                  <Badge className={`mt-1 ${classColor(classificacao)}`}>{classificacao}</Badge>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bônus Qualidade</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{result.bonusQualidade ?? 0}%</p>
                </div>
                {(result.bonusOperacional?.atualizacaoCadastral || result.atualizacaoCadastral) && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atualização Cadastral</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {result.bonusOperacional?.atualizacaoCadastral ?? result.atualizacaoCadastral ?? "—"}
                      {result.bonusOperacional?.pontosExtras ? ` (+${result.bonusOperacional.pontosExtras} pts)` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* ═══ 2. CRITÉRIOS DE AVALIAÇÃO ═══ */}
            <div>
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">
                Critérios de Avaliação
              </h2>

              {criteriosGrouped.map(({ categoria, items, subtotal }) => {
                if (items.length === 0) return null;
                return (
                  <div key={categoria} className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{categoria}</h3>
                      {subtotal && (
                        <span className="text-xs text-muted-foreground font-medium">{subtotal.obtidos}/{subtotal.possiveis} pts</span>
                      )}
                    </div>

                    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                      {items.map((c) => {
                        const badge = resultLabel(c.resultado);
                        const excerpt = findRelevantExcerpt(rawText, c.explicacao);
                        return (
                          <div key={c.numero} className="px-4 py-3">
                            {/* Question line */}
                            <div className="flex items-start gap-2.5">
                              <div className="mt-0.5 shrink-0">{resultIcon(c.resultado)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-foreground">
                                    {c.numero}. {c.nome}
                                  </span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${badge.cls}`}>
                                    {badge.text}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                                    {c.pontosObtidos}/{c.pesoMaximo} pts
                                  </span>
                                </div>
                                {/* Justification */}
                                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                  {c.explicacao}
                                </p>
                                {/* Conversation excerpt */}
                                {excerpt && (
                                  <div className={`mt-2 rounded px-3 py-2 text-xs italic border-l-2 ${
                                    c.resultado === "SIM"
                                      ? "bg-accent/5 border-accent/40 text-foreground/70"
                                      : "bg-destructive/5 border-destructive/40 text-foreground/70"
                                  }`}>
                                    <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-50" />
                                    "{excerpt}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* ═══ 3. MENTORIA DE COMUNICAÇÃO ═══ */}
            <div>
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">
                Mentoria de Comunicação
              </h2>

              {/* Principal acerto */}
              {melhorAcerto && (
                <div className="rounded-lg bg-accent/5 border border-accent/20 p-4 mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">Principal Acerto</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{melhorAcerto.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">{melhorAcerto.explicacao}</p>
                </div>
              )}

              {/* Principal ponto de melhoria */}
              {principalMelhoria && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">Principal Ponto de Melhoria</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{principalMelhoria.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">{principalMelhoria.explicacao}</p>
                  {(() => {
                    const ex = findRelevantExcerpt(rawText, principalMelhoria.explicacao);
                    if (!ex) return null;
                    return (
                      <div className="mt-2 rounded px-3 py-2 text-xs italic border-l-2 border-destructive/40 bg-destructive/5 text-foreground/70">
                        <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-50" />
                        "{ex}"
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Orientações práticas */}
              {mentoriaItems.length > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-4">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                    Orientações Práticas
                  </p>
                  <div className="space-y-2.5">
                    {mentoriaItems.map((item, i) => (
                      <div key={i} className="flex gap-2.5">
                        <span className="text-[10px] font-bold text-primary-foreground shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm text-foreground leading-relaxed">{item}</p>
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
