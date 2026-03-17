import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, AlertTriangle, Users,
  Target, BookOpen, Star, BarChart3, MessageSquare, Lightbulb,
  ChevronRight, ShieldCheck, Award
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

// ── Types ──────────────────────────────────────────────────────────────

interface PreventiveResult {
  viavel: boolean;
  notaInterna: number;
  classificacaoInterna: string;
  pontosFortes: string[];
  oportunidadesMelhoria: Array<{
    criterio: string;
    sugestao: string;
    exemplo: string;
    impacto: string;
  }>;
  resumoGeral: string;
  atendente: string;
  protocolo: string;
  data: string;
  tipo: string;
}

interface AnalyzedFile {
  id: string;
  name: string;
  atendente?: string;
  result?: PreventiveResult;
}

interface PreventiveInsightsProps {
  files: AnalyzedFile[];
}

// ── Helpers ────────────────────────────────────────────────────────────

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

function classColor(nota: number): string {
  if (nota >= 90) return "text-emerald-500";
  if (nota >= 70) return "text-blue-500";
  if (nota >= 50) return "text-amber-500";
  return "text-destructive";
}

function classLabel(nota: number): string {
  if (nota >= 90) return "Excelente";
  if (nota >= 70) return "Bom";
  if (nota >= 50) return "Regular";
  return "Atenção";
}

// ── Component ──────────────────────────────────────────────────────────

const PreventiveInsights = ({ files }: PreventiveInsightsProps) => {
  const analyzed = useMemo(
    () => files.filter((f) => f.result?.viavel && typeof f.result.notaInterna === "number"),
    [files]
  );

  const insights = useMemo(() => {
    if (analyzed.length === 0) return null;

    const notas = analyzed.map((f) => f.result!.notaInterna);
    const media = Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;

    // Group by atendente
    const atendenteMap = new Map<string, typeof analyzed>();
    analyzed.forEach((f) => {
      const name = f.result?.atendente || f.atendente || "Não identificado";
      if (!atendenteMap.has(name)) atendenteMap.set(name, []);
      atendenteMap.get(name)!.push(f);
    });

    const atendenteStats = [...atendenteMap.entries()].map(([name, aFiles]) => {
      const notasAt = aFiles.map((f) => f.result!.notaInterna);
      const mediaAt = Math.round((notasAt.reduce((a, b) => a + b, 0) / notasAt.length) * 10) / 10;

      const fortes: string[] = [];
      const melhorias: Array<{ criterio: string; sugestao: string; exemplo: string; impacto: string }> = [];
      aFiles.forEach((f) => {
        if (f.result?.pontosFortes) fortes.push(...f.result.pontosFortes);
        if (f.result?.oportunidadesMelhoria) melhorias.push(...f.result.oportunidadesMelhoria);
      });

      return {
        name,
        notas: notasAt,
        media: mediaAt,
        count: aFiles.length,
        pontosFortes: countOccurrences(fortes).slice(0, 5).map((o) => o.text),
        melhorias: countOccurrences(melhorias.map((m) => m.criterio)).slice(0, 5),
        detalheMelhorias: melhorias,
        files: aFiles,
      };
    }).sort((a, b) => b.media - a.media);

    // Global patterns
    const allFortes: string[] = [];
    const allMelhorias: string[] = [];
    const allDetalhes: Array<{ criterio: string; sugestao: string; exemplo: string; impacto: string }> = [];
    analyzed.forEach((f) => {
      if (f.result?.pontosFortes) allFortes.push(...f.result.pontosFortes);
      if (f.result?.oportunidadesMelhoria) {
        allMelhorias.push(...f.result.oportunidadesMelhoria.map((o) => o.criterio));
        allDetalhes.push(...f.result.oportunidadesMelhoria);
      }
    });
    const topFortes = countOccurrences(allFortes).slice(0, 6);
    const topMelhorias = countOccurrences(allMelhorias).slice(0, 6);

    // Recommended files for review
    const sorted = [...analyzed].sort((a, b) => a.result!.notaInterna - b.result!.notaInterna);
    const atencao = sorted.filter((f) => f.result!.notaInterna < 50).slice(0, 5);
    const emDesenvolvimento = sorted.filter((f) => f.result!.notaInterna >= 50 && f.result!.notaInterna < 70).slice(0, 5);
    const destaques = [...sorted].reverse().filter((f) => f.result!.notaInterna >= 70).slice(0, 5);

    // Build development script
    const temaPrincipal = topMelhorias[0]?.text || "Qualidade do atendimento";
    const exemploAtencao = atencao[0];
    const exemploDestaque = destaques[0];

    // Actionable orientations (deduplicate by criterio)
    const orientacoes = new Map<string, { criterio: string; sugestao: string; exemplo: string; impacto: string }>();
    for (const d of allDetalhes) {
      if (!orientacoes.has(d.criterio.toLowerCase())) {
        orientacoes.set(d.criterio.toLowerCase(), d);
      }
    }

    return {
      media,
      total: analyzed.length,
      atendenteStats,
      topFortes,
      topMelhorias,
      atencao,
      emDesenvolvimento,
      destaques,
      temaPrincipal,
      exemploAtencao,
      exemploDestaque,
      orientacoes: [...orientacoes.values()].slice(0, 8),
    };
  }, [analyzed]);

  if (!insights) {
    return (
      <Card className="p-8 text-center">
        <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">Analise os atendimentos selecionados para gerar os insights de desenvolvimento.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-emerald-500/20">
        <div className="p-2 rounded-xl bg-emerald-500/10">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Insights Preventivos</h2>
          <p className="text-xs text-muted-foreground">
            {insights.total} atendimento(s) • {insights.atendenteStats.length} atendente(s) • Apenas desenvolvimento
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-right">
            <p className={`text-2xl font-bold leading-none ${classColor(insights.media)}`}>
              {insights.media.toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">Ref. interna</p>
          </div>
        </div>
      </div>

      {/* 1. Resumo Geral */}
      <Card className="p-5 space-y-4 rounded-xl border-border/60 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          1. Visão Geral da Amostra
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
            <Award className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">{insights.atendenteStats[0]?.name || "—"}</p>
            <p className="text-xs text-muted-foreground">Melhor ref. — {insights.atendenteStats[0]?.media.toFixed(1) || "—"}</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">
              {insights.atendenteStats[insights.atendenteStats.length - 1]?.name || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Maior atenção — {insights.atendenteStats[insights.atendenteStats.length - 1]?.media.toFixed(1) || "—"}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">{insights.atendenteStats.length}</p>
            <p className="text-xs text-muted-foreground">Atendentes na amostra</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <p className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Pontos de atenção mais recorrentes
            </p>
            {insights.topMelhorias.length > 0 ? (
              <ul className="space-y-1">
                {insights.topMelhorias.map((p, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0 px-1.5">{p.count}x</Badge>
                    {p.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum padrão recorrente.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-500 mb-2 flex items-center gap-1">
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

      {/* 2. Atendentes na Amostra */}
      <Card className="p-5 rounded-xl border-border/60 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" /> 2. Atendentes na Amostra
        </h3>
        <Accordion type="multiple" className="space-y-2">
          {insights.atendenteStats.map((at) => {
            const borderColor = at.media >= 70 ? "border-l-emerald-500" : at.media >= 50 ? "border-l-amber-500" : "border-l-destructive";
            return (
              <AccordionItem key={at.name} value={at.name} className="border border-border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 w-full pr-4">
                    <div className={`w-1 h-8 rounded-full ${borderColor.replace("border-l-", "bg-")}`} />
                    <div className="flex-1 text-left">
                      <span className="font-medium text-foreground text-sm">{at.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({at.count} atendimento{at.count > 1 ? "s" : ""})</span>
                    </div>
                    <span className={`text-sm font-bold ${classColor(at.media)}`}>
                      {at.media.toFixed(1)}
                    </span>
                    <Badge variant="outline" className="text-xs">{classLabel(at.media)}</Badge>
                    {at.media < 70 && (
                      <Badge className="bg-amber-500/15 text-amber-600 text-[10px]">Foco de desenvolvimento</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                    <div>
                      <p className="text-xs font-semibold text-emerald-500 mb-1">Pontos fortes</p>
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
                      <p className="text-xs font-semibold text-amber-600 mb-1">Oportunidades de melhoria</p>
                      {at.melhorias.length > 0 ? (
                        <ul className="space-y-0.5">
                          {at.melhorias.map((p, i) => (
                            <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                              <Badge variant="outline" className="text-[9px] shrink-0 px-1">{p.count}x</Badge>
                              {p.text}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Nenhum identificado</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {at.notas.map((n, i) => (
                      <Badge key={i} variant="outline" className={`text-xs ${classColor(n)}`}>
                        {n.toFixed(1)}
                      </Badge>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Card>

      {/* 3. Atendimentos para Revisão */}
      <Card className="p-5 rounded-xl border-border/60 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" /> 3. Atendimentos para Revisão
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ReviewList
            title="Precisam de atenção"
            subtitle="Ref. < 50"
            items={insights.atencao}
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            emptyText="Nenhum atendimento nesta faixa"
            borderColor="border-destructive/20"
          />
          <ReviewList
            title="Em desenvolvimento"
            subtitle="Ref. 50 – 69"
            items={insights.emDesenvolvimento}
            icon={<MessageSquare className="h-4 w-4 text-amber-500" />}
            emptyText="Nenhum atendimento nesta faixa"
            borderColor="border-amber-500/20"
          />
          <ReviewList
            title="Boas práticas"
            subtitle="Ref. ≥ 70"
            items={insights.destaques}
            icon={<Star className="h-4 w-4 text-emerald-500" />}
            emptyText="Nenhum atendimento nesta faixa"
            borderColor="border-emerald-500/20"
          />
        </div>
      </Card>

      {/* 4. Padrões Observados */}
      {insights.atendenteStats.some((a) => a.melhorias.length > 0) && (
        <Card className="p-5 rounded-xl border-border/60 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-primary" /> 4. Padrões Observados
          </h3>
          <div className="space-y-3">
            {insights.atendenteStats.filter((a) => a.melhorias.length > 0).map((at) => (
              <div key={at.name} className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm font-medium text-foreground">{at.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {at.melhorias.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-[11px] text-muted-foreground">{p.text}</Badge>
                  ))}
                </div>
                {at.media < 50 && (
                  <p className="text-xs text-destructive mt-2 font-medium">
                    ⚠ Padrão recorrente — priorizar acompanhamento
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5. Orientações de Melhoria */}
      {insights.orientacoes.length > 0 && (
        <Card className="p-5 rounded-xl border-border/60 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" /> 5. Orientações de Melhoria
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.orientacoes.map((o, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border space-y-1.5">
                <p className="text-xs font-bold text-foreground">{o.criterio}</p>
                <p className="text-xs text-muted-foreground"><strong>Sugestão:</strong> {o.sugestao}</p>
                <p className="text-xs text-muted-foreground"><strong>Exemplo prático:</strong> {o.exemplo}</p>
                <p className="text-xs text-emerald-600"><strong>Impacto esperado:</strong> {o.impacto}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6. Roteiro de Desenvolvimento */}
      <Card className="p-5 rounded-xl border-emerald-500/20 bg-emerald-500/[0.02] shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <BookOpen className="h-4 w-4 text-emerald-500" /> 6. Roteiro de Desenvolvimento
        </h3>
        <div className="space-y-4">
          <StepCard
            step="1"
            title="Abertura"
            text={`Analisamos ${insights.total} atendimento(s) de ${insights.atendenteStats.length} atendente(s) com referência interna média de ${insights.media.toFixed(1)}.`}
          />
          <StepCard
            step="2"
            title={`Foco principal: ${insights.temaPrincipal}`}
            text={insights.topMelhorias.length > 0
              ? `Os pontos de atenção mais frequentes foram: ${insights.topMelhorias.slice(0, 3).map((p) => p.text).join("; ")}.`
              : "Não foram identificados padrões de atenção recorrentes."}
          />
          {insights.exemploAtencao && (
            <StepCard
              step="3"
              title="Caso para discussão"
              text={`Atendimento "${insights.exemploAtencao.result?.protocolo || insights.exemploAtencao.name}" (${insights.exemploAtencao.result?.atendente || "—"}) com ref. ${insights.exemploAtencao.result!.notaInterna.toFixed(1)} — analisar oportunidades de melhoria.`}
              variant="warning"
            />
          )}
          {insights.exemploDestaque && (
            <StepCard
              step="4"
              title="Exemplo de boa prática"
              text={`Atendimento "${insights.exemploDestaque.result?.protocolo || insights.exemploDestaque.name}" (${insights.exemploDestaque.result?.atendente || "—"}) com ref. ${insights.exemploDestaque.result!.notaInterna.toFixed(1)} — modelo a ser replicado.`}
              variant="success"
            />
          )}
          <StepCard
            step="5"
            title="Próximos passos"
            text={insights.atendenteStats.filter((a) => a.media < 70).length > 0
              ? `Foco de desenvolvimento para: ${insights.atendenteStats.filter((a) => a.media < 70).map((a) => a.name).join(", ")}.`
              : "Manter boas práticas e reforçar pontos fortes da equipe."}
          />
        </div>
      </Card>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────

function ReviewList({
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
              <Badge variant="outline" className={`text-[10px] ${classColor(f.result!.notaInterna)}`}>
                {f.result!.notaInterna.toFixed(1)}
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

function StepCard({
  step, title, text, variant,
}: {
  step: string;
  title: string;
  text: string;
  variant?: "warning" | "success";
}) {
  const bg = variant === "warning"
    ? "bg-amber-500/5 border-amber-500/20"
    : variant === "success"
      ? "bg-emerald-500/5 border-emerald-500/20"
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

export default PreventiveInsights;
