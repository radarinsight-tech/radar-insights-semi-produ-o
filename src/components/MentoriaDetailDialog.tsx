import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, MinusCircle, ShieldAlert, TrendingUp, TrendingDown,
  MessageSquareQuote, Award, Target
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

const CATEGORY_ICONS: Record<string, typeof Target> = {
  "Postura e Comunicação": MessageSquareQuote,
  "Entendimento e Condução": Target,
  "Solução e Confirmação": CheckCircle2,
  "Encerramento e Valor": Award,
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
  if (c === "Necessita mentoria" || c === "Abaixo do esperado") return "bg-warning text-warning-foreground";
  return "bg-muted text-muted-foreground";
};

const resultIcon = (resultado: string) => {
  if (resultado === "FORA DO ESCOPO") return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  if (resultado === "SIM") return <CheckCircle2 className="h-4 w-4 text-accent" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
};

// Extract conversation excerpts that match criteria explanations
const findRelevantExcerpt = (rawText: string | undefined, explicacao: string): string | null => {
  if (!rawText || !explicacao) return null;

  // Try to find quoted text in the explanation
  const quoteMatch = explicacao.match(/[""]([^""]{15,120})[""]|"([^"]{15,120})"/);
  if (quoteMatch) {
    const quoted = quoteMatch[1] || quoteMatch[2];
    // Check if it exists in the raw text
    if (rawText.toLowerCase().includes(quoted.toLowerCase().substring(0, 30))) {
      return quoted;
    }
    return quoted; // Return anyway as it's from the AI analysis
  }

  return null;
};

const MentoriaDetailDialog = ({ open, onOpenChange, result, fileName, rawText, atendente }: MentoriaDetailDialogProps) => {
  if (!result) return null;

  const nota = result.notaFinal ?? result.nota;
  const classificacao = result.classificacao || "—";
  const criterios: CriterioAvaliacao[] = result.criterios || [];
  const subtotais: Subtotais | null = result.subtotais || null;
  const mentoriaItems: string[] = result.mentoria || result.pontosMelhoria || [];

  // Separate positive and negative criteria
  const pontosPositivos = criterios.filter(c => c.resultado === "SIM");
  const pontosMelhoria = criterios.filter(c => c.resultado === "NÃO");

  if (result.impeditivo) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mentoria Detalhada</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center text-center py-6">
            <ShieldAlert className="h-10 w-10 text-warning mb-3" />
            <p className="font-bold text-foreground">Auditoria não realizada</p>
            <p className="text-sm text-muted-foreground mt-2">{result.motivoImpeditivo || "Impeditivo identificado."}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const criteriosGrouped = CATEGORY_ORDER.map(cat => ({
    categoria: cat,
    items: criterios.filter(c => c.categoria === cat),
    subtotal: subtotais ? subtotais[subtotalKey(cat)] : null,
    Icon: CATEGORY_ICONS[cat] || Target,
  }));

  // Calculate score percentage for visual bar
  const scorePercent = nota != null ? Math.min(100, Math.max(0, (nota / 10) * 100)) : 0;
  const scoreColor = nota >= 8 ? "bg-accent" : nota >= 6 ? "bg-primary" : nota >= 4 ? "bg-warning" : "bg-destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-lg">
            Mentoria Detalhada
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 truncate">{fileName}</p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(92vh-90px)]">
          <div className="p-6 pt-4 space-y-6">

            {/* ── Score Overview ── */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Nota Final</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-black text-foreground tracking-tight">{nota?.toFixed(1) ?? "—"}</span>
                    <span className="text-sm text-muted-foreground">/10</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={`text-sm px-3 py-1 ${classColor(classificacao)}`}>{classificacao}</Badge>
                  {result.pontosObtidos != null && result.pontosPossiveis != null && (
                    <p className="text-xs text-muted-foreground mt-2">{result.pontosObtidos}/{result.pontosPossiveis} pontos</p>
                  )}
                </div>
              </div>
              {/* Score bar */}
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${scoreColor}`} style={{ width: `${scorePercent}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0</span>
                <span>5</span>
                <span>10</span>
              </div>

              {/* Summary metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Atendente</p>
                  <p className="text-xs font-semibold text-foreground">{result.atendente || atendente || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Tipo</p>
                  <p className="text-xs font-semibold text-foreground">{result.tipo || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Bônus Qualidade</p>
                  <p className="text-xs font-semibold text-foreground">{result.bonusQualidade ?? 0}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Atualização Cadastral</p>
                  <p className="text-xs font-semibold text-foreground">{result.bonusOperacional?.atualizacaoCadastral ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* ── Avaliação por Critérios ── */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Avaliação por Critérios
              </h3>

              <div className="space-y-5">
                {criteriosGrouped.map(({ categoria, items, subtotal, Icon }) => {
                  if (items.length === 0) return null;
                  const passed = items.filter(c => c.resultado === "SIM").length;
                  const total = items.filter(c => c.resultado !== "FORA DO ESCOPO").length;

                  return (
                    <div key={categoria} className="rounded-lg border border-border overflow-hidden">
                      {/* Category header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-semibold text-foreground">{categoria}</h4>
                        </div>
                        <div className="flex items-center gap-3">
                          {subtotal && (
                            <span className="text-xs text-muted-foreground font-medium">{subtotal.obtidos}/{subtotal.possiveis} pts</span>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {passed}/{total} critérios
                          </Badge>
                        </div>
                      </div>

                      {/* Criteria items */}
                      <div className="divide-y divide-border">
                        {items.map((c) => {
                          const excerpt = findRelevantExcerpt(rawText, c.explicacao);
                          return (
                            <div key={c.numero} className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 shrink-0">{resultIcon(c.resultado)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-foreground">{c.numero}. {c.nome}</span>
                                    <span className="text-xs text-muted-foreground">{c.pontosObtidos}/{c.pesoMaximo} pts</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.explicacao}</p>

                                  {/* Highlighted excerpt from conversation */}
                                  {excerpt && (
                                    <div className={`mt-2 rounded-md px-3 py-2 text-xs italic border-l-2 ${
                                      c.resultado === "SIM"
                                        ? "bg-accent/5 border-accent text-accent-foreground/80"
                                        : "bg-destructive/5 border-destructive text-destructive-foreground/80"
                                    }`}>
                                      <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-60" />
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
            </div>

            <Separator />

            {/* ── Pontos Positivos ── */}
            {pontosPositivos.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  Pontos Positivos
                  <Badge variant="outline" className="text-[10px] ml-auto">{pontosPositivos.length} identificados</Badge>
                </h3>
                <div className="space-y-2">
                  {pontosPositivos.map((c) => (
                    <div key={c.numero} className="flex gap-3 p-3 rounded-lg bg-accent/5 border border-accent/15">
                      <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.explicacao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Pontos de Melhoria ── */}
            {pontosMelhoria.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Pontos de Melhoria
                  <Badge variant="outline" className="text-[10px] ml-auto">{pontosMelhoria.length} identificados</Badge>
                </h3>
                <div className="space-y-2">
                  {pontosMelhoria.map((c) => {
                    const excerpt = findRelevantExcerpt(rawText, c.explicacao);
                    return (
                      <div key={c.numero} className="flex gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{c.nome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.explicacao}</p>
                          {excerpt && (
                            <div className="mt-2 rounded-md px-3 py-2 text-xs italic border-l-2 bg-destructive/5 border-destructive text-muted-foreground">
                              <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-60" />
                              "{excerpt}"
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Mentoria / Orientações ── */}
            {mentoriaItems.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    Orientações de Mentoria
                  </h3>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    {mentoriaItems.map((item, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-xs font-bold text-primary shrink-0 mt-0.5 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                          {i + 1}
                        </span>
                        <p className="text-sm text-foreground leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default MentoriaDetailDialog;
