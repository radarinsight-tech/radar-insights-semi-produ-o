import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Award, AlertTriangle, Users,
  Target, BookOpen, Star, BarChart3, MessageSquare, Lightbulb,
  ChevronRight, DollarSign
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { calcularBonus, formatBRL, notaToScale10 } from "@/lib/utils";

interface AnalyzedFile {
  name: string;
  atendente?: string;
  data?: string;
  canal?: string;
  ineligible?: boolean;
  ineligibleReason?: string;
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
    _ineligibleReason?: string;
  };
}

interface MentoriaInsightsProps {
  files: AnalyzedFile[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatNota(n: number): string {
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

function classColor(cls: string): string {
  switch (cls) {
    case "Excelente": return "text-accent";
    case "Bom": return "text-blue-600";
    case "Regular": return "text-warning";
    case "Ruim": return "text-orange-600";
    case "Crítico": return "text-destructive";
    default: return "text-muted-foreground";
  }
}

interface AtendenteStats {
  name: string;
  notas: number[];
  media: number;
  classificacao: string;
  pontosFortes: string[];
  pontosFracos: string[];
  files: AnalyzedFile[];
  amostragemInsuficiente: boolean;
}

const MIN_MENTORIAS = 6;

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

const MentoriaInsights = ({ files }: MentoriaInsightsProps) => {
  const analyzed = useMemo(() => files.filter((f) => f.result && typeof f.result.notaFinal === "number" && !f.ineligible && !f.result._ineligible), [files]);
  const ineligibleFiles = useMemo(() => files.filter((f) => f.result && (f.ineligible || f.result._ineligible)), [files]);

  const insights = useMemo(() => {
    if (analyzed.length === 0) return null;

    const notas = analyzed.map((f) => notaToScale10(f.result!.notaFinal!));
    const media = round1(notas.reduce((a, b) => a + b, 0) / notas.length);

    // Aggregate by atendente
    const atendenteMap = new Map<string, AnalyzedFile[]>();
    analyzed.forEach((f) => {
      const name = f.result?.atendente || f.atendente || "Não identificado";
      if (!atendenteMap.has(name)) atendenteMap.set(name, []);
      atendenteMap.get(name)!.push(f);
    });

    const atendenteStats: AtendenteStats[] = [...atendenteMap.entries()].map(([name, aFiles]) => {
      const notasAt = aFiles.map((f) => notaToScale10(f.result!.notaFinal!));
      const mediaAt = round1(notasAt.reduce((a, b) => a + b, 0) / notasAt.length);
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
        files: aFiles,
        amostragemInsuficiente: notasAt.length < MIN_MENTORIAS,
      };
    }).sort((a, b) => b.media - a.media);

    const elegiveisStats = atendenteStats.filter((a) => !a.amostragemInsuficiente);

    const melhor = elegiveisStats[0] || atendenteStats[0];
    const pior = elegiveisStats.length > 0 ? elegiveisStats[elegiveisStats.length - 1] : atendenteStats[atendenteStats.length - 1];

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

    // Build mentoria script
    const temaPrincipal = topCriticos[0]?.text || "Qualidade do atendimento";
    const exemploNegativo = piores[0];
    const exemploPositivo = melhores[0];

    const roteiro = {
      abertura: `Hoje vamos conversar sobre a qualidade dos atendimentos do período. Analisamos ${analyzed.length} atendimento(s) com nota média de ${formatNota(media)}.`,
      tema: temaPrincipal,
      contexto: topCriticos.length > 0
        ? `Os principais pontos de melhoria identificados foram: ${topCriticos.slice(0, 3).map((p) => p.text).join("; ")}.`
        : "Não foram identificados pontos críticos recorrentes.",
      exemploNegativo: exemploNegativo
        ? `Vamos analisar o atendimento "${exemploNegativo.result?.protocolo || exemploNegativo.name}" (${exemploNegativo.result?.atendente || "—"}) com nota ${formatNota(exemploNegativo.result!.notaFinal!)} como caso de atenção.`
        : null,
      exemploPositivo: exemploPositivo
        ? `Como exemplo positivo, temos "${exemploPositivo.result?.protocolo || exemploPositivo.name}" (${exemploPositivo.result?.atendente || "—"}) com nota ${formatNota(exemploPositivo.result!.notaFinal!)} — um bom modelo a seguir.`
        : null,
      fechamento: `Próximos passos: ${atendenteStats.filter((a) => notaToScale10(a.media) < 7).length > 0 ? `acompanhamento individual para ${atendenteStats.filter((a) => notaToScale10(a.media) < 7).map((a) => a.name).join(", ")}` : "manter o padrão de qualidade"}.`,
    };

    return {
      media,
      classificacaoMedia: classificacao(media),
      total: analyzed.length,
      melhor,
      pior,
      atendenteStats,
      topCriticos,
      topFortes,
      piores,
      medianos,
      melhores,
      roteiro,
    };
  }, [analyzed]);

  if (!insights) {
    return (
      <Card className="p-8 text-center">
        <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">Analise os atendimentos para gerar os insights de mentoria.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-primary/20">
        <div className="p-2 rounded-xl bg-primary/10">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Insights da Mentoria</h2>
          <p className="text-xs text-muted-foreground">{insights.total} atendimentos analisados • {insights.atendenteStats.length} atendente{insights.atendenteStats.length > 1 ? "s" : ""}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground leading-none">{formatNota(insights.media)}</p>
            <Badge className={`text-[10px] ${classColor(insights.classificacaoMedia)} bg-transparent border-0 p-0 font-semibold`}>
              {insights.classificacaoMedia}
            </Badge>
          </div>
        </div>
      </div>

      {/* 1. Resumo Geral */}
      <Card className="p-5 space-y-4 rounded-xl border-border/60 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span>1. Resumo Geral</span>
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-center">
            <Award className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">{insights.melhor.name}</p>
            <p className="text-xs text-muted-foreground">Melhor — {formatNota(insights.melhor.media)}</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">{insights.pior.name}</p>
            <p className="text-xs text-muted-foreground">Atenção — {formatNota(insights.pior.media)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">{insights.atendenteStats.length}</p>
            <p className="text-xs text-muted-foreground">Atendentes avaliados</p>
          </div>
        </div>

        {/* Top pontos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <p className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Pontos críticos mais recorrentes
            </p>
            {insights.topCriticos.length > 0 ? (
              <ul className="space-y-1">
                {insights.topCriticos.map((p, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0 px-1.5">{p.count}x</Badge>
                    {p.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum ponto crítico recorrente.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Pontos fortes mais recorrentes
            </p>
            {insights.topFortes.length > 0 ? (
              <ul className="space-y-1">
                {insights.topFortes.map((p, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0 px-1.5">{p.count}x</Badge>
                    {p.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum ponto forte recorrente.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Performance & Bônus Cards */}
      <Card className="p-5 rounded-xl border-border/60 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <DollarSign className="h-4 w-4 text-primary" /> 2. Performance & Bônus por Atendente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.atendenteStats.map((at) => {
            const bonus = calcularBonus(at.media);
            const isInsuficiente = at.amostragemInsuficiente;
            const media10 = notaToScale10(at.media);
            const borderColor = isInsuficiente
              ? "border-l-muted-foreground"
              : media10 >= 7 ? "border-l-accent" : media10 >= 5 ? "border-l-warning" : "border-l-destructive";
            const bgColor = isInsuficiente
              ? "bg-muted/30"
              : media10 >= 7 ? "bg-accent/5" : media10 >= 5 ? "bg-warning/5" : "bg-destructive/5";

            return (
              <div
                key={at.name}
                className={`rounded-xl border border-border/60 border-l-4 ${borderColor} ${bgColor} p-4 space-y-3 transition-colors`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{at.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {at.notas.length} mentoria{at.notas.length > 1 ? "s" : ""} realizada{at.notas.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  {isInsuficiente && (
                    <Badge className="bg-muted text-muted-foreground text-[9px] shrink-0">Amostragem insuficiente</Badge>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded-lg bg-background/60">
                    <p className={`text-lg font-black leading-none ${isInsuficiente ? "text-muted-foreground" : media10 >= 7 ? "text-accent" : media10 >= 5 ? "text-warning" : "text-destructive"}`}>
                      {formatNota(at.media)}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">Nota Média</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/60">
                    <p className={`text-lg font-black leading-none ${isInsuficiente ? "text-muted-foreground" : "text-foreground"}`}>
                      {isInsuficiente ? "—" : `${bonus.percentual}%`}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">Bônus</p>
                  </div>
                </div>

                {/* Classification + Value */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${isInsuficiente ? "text-muted-foreground" : ""}`}
                  >
                    {isInsuficiente ? "Pendente" : bonus.classificacao}
                  </Badge>
                  <span className={`text-sm font-bold ${isInsuficiente ? "text-muted-foreground" : media10 >= 7 ? "text-accent" : media10 >= 5 ? "text-warning" : "text-destructive"}`}>
                    {isInsuficiente ? "—" : formatBRL(bonus.valor)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Performance detalhada por Atendente */}
      <Card className="p-5 rounded-xl border-border/60 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" /> 3. Performance Detalhada
        </h3>
        <Accordion type="multiple" className="space-y-2">
          {insights.atendenteStats.map((at) => (
            <AccordionItem key={at.name} value={at.name} className="border border-border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 w-full pr-4">
                  <div className="flex-1 text-left">
                    <span className="font-medium text-foreground text-sm">{at.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({at.notas.length} atendimento{at.notas.length > 1 ? "s" : ""})</span>
                  </div>
                  {at.amostragemInsuficiente ? (
                    <>
                      <Badge className={`text-xs ${classColor(at.classificacao)} bg-transparent border-0 p-0 font-bold opacity-50`}>
                        {formatNota(at.media)}
                      </Badge>
                      <Badge className="bg-muted text-muted-foreground text-[10px]">Amostragem insuficiente</Badge>
                      <span className="text-[10px] text-muted-foreground">mín. {MIN_MENTORIAS}</span>
                    </>
                  ) : (
                    <>
                      <Badge className={`text-xs ${classColor(at.classificacao)} bg-transparent border-0 p-0 font-bold`}>
                        {formatNota(at.media)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{at.classificacao}</Badge>
                      {(() => {
                        const bonus = calcularBonus(at.media);
                        return (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            {bonus.percentual}% · {formatBRL(bonus.valor)}
                          </Badge>
                        );
                      })()}
                      {notaToScale10(at.media) < 7 && (
                        <Badge className="bg-warning/15 text-warning text-[10px]">Necessita mentoria</Badge>
                      )}
                    </>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                  <div>
                    <p className="text-xs font-semibold text-accent mb-1">Pontos fortes</p>
                    {at.pontosFortes.length > 0 ? (
                      <ul className="space-y-0.5">
                        {at.pontosFortes.map((p, i) => (
                          <li key={i} className="text-xs text-foreground">✓ {p}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhum identificado</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-destructive mb-1">Pontos de melhoria</p>
                    {at.pontosFracos.length > 0 ? (
                      <ul className="space-y-0.5">
                        {at.pontosFracos.map((p, i) => (
                          <li key={i} className="text-xs text-foreground">• {p}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhum identificado</p>
                    )}
                  </div>
                </div>
                {/* Individual notas */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {at.notas.map((n, i) => (
                    <Badge key={i} variant="outline" className={`text-xs ${classColor(classificacao(n))}`}>
                      {formatNota(n)}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      {/* 4. Atendimentos Recomendados */}
      <Card className="p-5 rounded-xl border-border/60 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" /> 4. Atendimentos Recomendados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RecommendedList
            title="Casos críticos"
            subtitle="Nota < 5,0"
            items={insights.piores}
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            emptyText="Nenhum atendimento crítico"
            borderColor="border-destructive/20"
          />
          <RecommendedList
            title="Medianos"
            subtitle="Nota 5,0 – 6,9"
            items={insights.medianos}
            icon={<MessageSquare className="h-4 w-4 text-warning" />}
            emptyText="Nenhum atendimento mediano"
            borderColor="border-warning/20"
          />
          <RecommendedList
            title="Exemplos positivos"
            subtitle="Nota ≥ 7,0"
            items={insights.melhores}
            icon={<Star className="h-4 w-4 text-accent" />}
            emptyText="Nenhum atendimento positivo"
            borderColor="border-accent/20"
          />
        </div>
      </Card>

      {/* 5. Padrões de Comportamento */}
      {insights.atendenteStats.some((a) => a.pontosFracos.length > 0) && (
        <Card className="p-5 rounded-xl border-border/60 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-primary" /> 5. Padrões de Comportamento
          </h3>
          <div className="space-y-3">
            {insights.atendenteStats.filter((a) => a.pontosFracos.length > 0).map((at) => (
              <div key={at.name} className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm font-medium text-foreground">{at.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {at.pontosFracos.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-[11px] text-muted-foreground">{p}</Badge>
                  ))}
                </div>
                {notaToScale10(at.media) < 5 && (
                  <p className="text-xs text-destructive mt-2 font-medium">
                    ⚠ Padrão recorrente — necessita acompanhamento próximo
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6. Roteiro de Mentoria */}
      <Card className="p-5 rounded-xl border-primary/20 bg-primary/[0.02] shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <BookOpen className="h-4 w-4 text-primary" /> 6. Roteiro de Mentoria
        </h3>
        <div className="space-y-4">
          <RoteiroStep step="1" title="Abertura" text={insights.roteiro.abertura} />
          <RoteiroStep step="2" title={`Tema principal: ${insights.roteiro.tema}`} text={insights.roteiro.contexto} />
          {insights.roteiro.exemploNegativo && (
            <RoteiroStep step="3" title="Exemplo de atenção" text={insights.roteiro.exemploNegativo} variant="warning" />
          )}
          {insights.roteiro.exemploPositivo && (
            <RoteiroStep step="4" title="Exemplo positivo" text={insights.roteiro.exemploPositivo} variant="success" />
          )}
          <RoteiroStep step="5" title="Fechamento e próximos passos" text={insights.roteiro.fechamento} />
        </div>
      </Card>
    </div>
  );
};

/* ─── Sub-components ─── */

function RecommendedList({
  title, subtitle, items, icon, emptyText, borderColor,
}: {
  title: string;
  subtitle: string;
  items: AnalyzedFile[];
  icon: React.ReactNode;
  emptyText: string;
  borderColor: string;
}) {
  return (
    <div className={`p-3 rounded-lg border ${borderColor} bg-card`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div>
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate text-foreground flex-1">{f.result?.protocolo || f.name}</span>
              <span className="text-muted-foreground">{f.result?.atendente || f.atendente || "—"}</span>
              <Badge variant="outline" className={`text-[10px] ${classColor(classificacao(f.result!.notaFinal!))}`}>
                {formatNota(f.result!.notaFinal!)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground italic">{emptyText}</p>
      )}
    </div>
  );
}

function RoteiroStep({
  step, title, text, variant,
}: {
  step: string;
  title: string;
  text: string;
  variant?: "warning" | "success";
}) {
  const bg = variant === "warning"
    ? "bg-warning/5 border-warning/20"
    : variant === "success"
      ? "bg-accent/5 border-accent/20"
      : "bg-muted/30 border-border";

  return (
    <div className={`p-3 rounded-lg border ${bg}`}>
      <div className="flex items-start gap-2">
        <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{step}</Badge>
        <div>
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}

export default MentoriaInsights;
