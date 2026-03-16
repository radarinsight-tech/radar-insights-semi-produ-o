import { useState } from "react";
import logoSymbol from "@/assets/logo-symbol.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FlaskConical, Upload, FileText, RefreshCw, AlertTriangle,
  CheckCircle2, UserCheck, Shield, TrendingUp, BarChart3,
  ChevronDown, Bot, Ban, Users, Trophy, Search
} from "lucide-react";
import QualityGauge from "@/components/QualityGauge";

/* ── Shared card style ── */
const cardClass = "rounded-xl border border-border/60 bg-card shadow-sm";

/* ── MOCK DATA ── */
const MOCK_RESULT = {
  protocolo: "DEMO-2025031567",
  atendente: "Ana Paula (Demo)",
  tipo: "Suporte Técnico",
  atualizacaoCadastral: "SIM",
  notaFinal: 92.1,
  classificacao: "Excelente",
  bonusQualidade: 100,
  versaoPrompt: "auditor_v3",
  validade: "Verdadeiro",
  statusInteracao: "Sim",
  resumo: "Atendimento conduzido de forma adequada, com boa condução e direcionamento correto ao cliente.",
  indicadores: [
    { label: "Abertura", valor: 10.0 },
    { label: "Condução", valor: 9.2 },
    { label: "Direcionamento", valor: 9.4 },
    { label: "Encerramento", valor: 8.8 },
  ],
  pontosMelhoria: [
    "Reforçar confirmação de entendimento antes de propor solução.",
    "Oferecer alternativas de contato para acompanhamento.",
  ],
  pontosObtidos: 81,
  pontosPossiveis: 88,
};

const MOCK_HISTORY = [
  { id: "1", data: "15/03/2025", protocolo: "ATD-1001", atendente: "Ana Paula", nota: 92.1, classificacao: "Excelente", tipo: "Suporte Técnico", bonus: true },
  { id: "2", data: "15/03/2025", protocolo: "ATD-1002", atendente: "Carlos Lima", nota: 78.5, classificacao: "Bom", tipo: "Financeiro", bonus: false },
  { id: "3", data: "14/03/2025", protocolo: "ATD-1003", atendente: "Maria Souza", nota: 88.0, classificacao: "Ótimo", tipo: "Cancelamento", bonus: false },
  { id: "4", data: "14/03/2025", protocolo: "ATD-1004", atendente: "João Santos", nota: 95.2, classificacao: "Excelente", tipo: "Informação", bonus: true },
  { id: "5", data: "13/03/2025", protocolo: "ATD-1005", atendente: "Bruna Costa", nota: 67.3, classificacao: "Regular", tipo: "Reclamação", bonus: false },
];

const MOCK_RANKING = [
  { nome: "Ana Paula", media: 92.1 },
  { nome: "João Santos", media: 91.4 },
  { nome: "Maria Souza", media: 85.7 },
  { nome: "Carlos Lima", media: 79.2 },
  { nome: "Bruna Costa", media: 72.8 },
];

function classifBadge(c: string) {
  const map: Record<string, string> = {
    "Excelente": "border-accent/40 bg-accent/10 text-accent",
    "Ótimo": "border-primary/40 bg-primary/10 text-primary",
    "Bom": "border-primary/40 bg-primary/10 text-primary",
    "Regular": "border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    "Abaixo do esperado": "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return map[c] ?? "border-border";
}

type PageState = "empty" | "processing" | "completed";

const AttendanceDemo = () => {
  const [state, setState] = useState<PageState>("empty");

  const handleAnalyze = () => {
    setState("processing");
    setTimeout(() => setState("completed"), 1500);
  };

  const handleNew = () => {
    setState("empty");
  };

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      {/* HEADER */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Radar Insight <span className="text-muted-foreground font-normal">—</span> <span className="text-primary">Sucesso do Cliente</span>
          </h1>
          <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 gap-1 ml-auto text-[10px]">
            <FlaskConical className="h-3 w-3" />
            Modo Demo
          </Badge>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        <div className="flex gap-5">
          {/* ══════ COLUNA PRINCIPAL ══════ */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* LINHA 1: Upload + Resultado lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* UPLOAD */}
              <div className={`${cardClass} p-5`}>
                <h2 className="text-sm font-semibold text-primary mb-3 tracking-tight">Upload de Atendimento</h2>
                {state === "processing" && (
                  <div className="border border-primary/20 rounded-lg p-6 text-center bg-primary/5">
                    <div className="h-8 w-8 mx-auto animate-spin mb-3 border-[3px] border-primary/20 border-t-primary rounded-full" />
                    <p className="text-sm font-medium text-foreground mb-0.5">Processando auditoria com IA</p>
                    <p className="text-xs text-muted-foreground">Modo Demo — resultado em instantes...</p>
                  </div>
                )}
                {state === "completed" && (
                  <>
                    <div className="border border-accent/30 rounded-lg p-4 bg-accent/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent/10">
                          <CheckCircle2 className="h-5 w-5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Análise concluída</p>
                          <p className="text-sm font-medium text-foreground">atendimento-demo.pdf</p>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={handleNew}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Nova análise
                    </Button>
                  </>
                )}
                {state === "empty" && (
                  <>
                    <div className="border-2 border-dashed border-border/80 rounded-lg p-6 text-center hover:border-primary/40 transition-colors cursor-pointer">
                      <Upload className="h-7 w-7 mx-auto text-muted-foreground/60 mb-2" />
                      <p className="text-sm text-muted-foreground">Arraste o PDF aqui ou clique para selecionar</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Somente arquivos PDF</p>
                    </div>
                    <Button size="sm" className="mt-3 w-full" onClick={handleAnalyze}>Analisar atendimento</Button>
                  </>
                )}
              </div>

              {/* RESULTADO DA AUDITORIA */}
              <div className={`${cardClass} p-5`}>
                <h2 className="text-sm font-semibold text-primary mb-3 tracking-tight">Resultado da Auditoria</h2>
                {state === "completed" ? (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex gap-4 items-start">
                      <div className="shrink-0">
                        <QualityGauge score={MOCK_RESULT.notaFinal} classification={MOCK_RESULT.classificacao} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1 min-w-0">
                        <Field label="Protocolo" value={MOCK_RESULT.protocolo} />
                        <Field label="Atendente" value={MOCK_RESULT.atendente} />
                        <Field label="Tipo"><Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">{MOCK_RESULT.tipo}</Badge></Field>
                        <Field label="Classificação"><Badge className={`text-[10px] px-1.5 py-0 font-semibold border ${classifBadge(MOCK_RESULT.classificacao)}`}>{MOCK_RESULT.classificacao}</Badge></Field>
                        <Field label="Bônus"><Badge className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent border border-accent/30 font-semibold">{MOCK_RESULT.bonusQualidade}%</Badge></Field>
                        <Field label="Versão" value={MOCK_RESULT.versaoPrompt} />
                        <Field label="Validade" value={MOCK_RESULT.validade} />
                        <Field label="Interação">
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-accent" /><span className="text-xs font-medium">{MOCK_RESULT.statusInteracao}</span></span>
                        </Field>
                      </div>
                    </div>
                    {/* Indicadores */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Indicadores por Dimensão</p>
                      <div className="grid grid-cols-4 gap-2">
                        {MOCK_RESULT.indicadores.map((ind) => (
                          <div key={ind.label} className="rounded-lg border border-border/50 bg-muted/20 px-2 py-2 text-center transition-colors hover:bg-muted/40">
                            <p className="text-base font-bold text-foreground leading-none">{ind.valor.toFixed(1)}</p>
                            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wide">{ind.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Resumo */}
                    <div className="mt-2.5 rounded-lg bg-muted/30 border border-border/40 px-3 py-2">
                      <p className="text-xs text-foreground/80 italic leading-relaxed">"{MOCK_RESULT.resumo}"</p>
                    </div>
                    {/* Mentoria colapsável */}
                    {MOCK_RESULT.pontosMelhoria.length > 0 && (
                      <Collapsible className="mt-2.5">
                        <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left group py-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex-1">Mentoria de Comunicação</p>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1.5">
                          <ul className="space-y-1">
                            {MOCK_RESULT.pontosMelhoria.map((p, i) => (
                              <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                                <span className="text-muted-foreground shrink-0">{i + 1}.</span>{p}
                              </li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center min-h-[180px]">
                    <div className="p-3 rounded-full bg-primary/5 mb-3">
                      <FileText className="h-7 w-7 text-primary/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {state === "processing" ? "Analisando..." : "Clique em \"Analisar atendimento\" para ver o resultado"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* LINHA 2: Evolução da Nota Média */}
            <div className={`${cardClass} p-5`}>
              <h2 className="text-sm font-semibold text-primary mb-3 tracking-tight">Evolução da Nota Média</h2>
              <div className="h-40 flex items-end gap-1.5 px-1">
                {[78, 82, 80, 85, 88, 84, 87, 90, 86, 89, 92, 91].map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[9px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{v}</span>
                    <div
                      className="w-full rounded-t-md bg-primary/70 group-hover:bg-primary transition-colors"
                      style={{ height: `${(v / 100) * 110}px` }}
                    />
                    <span className="text-[9px] text-muted-foreground">{["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LINHA 3: Média por Atendente */}
            <div className={`${cardClass} p-5`}>
              <h2 className="text-sm font-semibold text-primary mb-3 tracking-tight">Média por Atendente</h2>
              <div className="space-y-2.5">
                {MOCK_RANKING.map((a) => (
                  <div key={a.nome} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-foreground w-28 truncate">{a.nome}</span>
                    <div className="flex-1 h-4 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all" style={{ width: `${a.media}%` }} />
                    </div>
                    <span className="text-xs font-bold text-foreground tabular-nums w-10 text-right">{a.media}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LINHA 4: Filtros */}
            <div className={`${cardClass} p-4`}>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Atendente</label>
                  <Select><SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {MOCK_RANKING.map((a) => <SelectItem key={a.nome} value={a.nome}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Tipo</label>
                  <Select><SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      {["Todos","Suporte Técnico","Financeiro","Cancelamento","Informação","Reclamação"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Período</label>
                  <Select><SelectTrigger className="h-9"><SelectValue placeholder="Últimos 30 dias" /></SelectTrigger>
                    <SelectContent>
                      {["Últimos 7 dias","Últimos 30 dias","Últimos 90 dias"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Busca</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
                    <Input placeholder="Protocolo ou atendente..." className="h-9 pl-8" />
                  </div>
                </div>
              </div>
            </div>

            {/* LINHA 5: Histórico */}
            <div className={`${cardClass} p-5`}>
              <h2 className="text-sm font-semibold text-primary mb-3 tracking-tight">Histórico de Avaliações</h2>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Data</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Protocolo</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Atendente</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Tipo</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground text-right">Nota</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Classificação</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground text-center">Bônus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_HISTORY.map((h, idx) => (
                      <TableRow key={h.id} className={`border-border/30 transition-colors hover:bg-muted/40 ${idx % 2 === 1 ? "bg-muted/15" : ""}`}>
                        <TableCell className="text-xs text-muted-foreground">{h.data}</TableCell>
                        <TableCell className="text-xs font-medium">{h.protocolo}</TableCell>
                        <TableCell className="text-xs">{h.atendente}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{h.tipo}</TableCell>
                        <TableCell className="text-xs text-right font-bold tabular-nums">{h.nota}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] px-1.5 py-0 border font-medium ${classifBadge(h.classificacao)}`}>
                            {h.classificacao}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {h.bonus
                            ? <CheckCircle2 className="h-4 w-4 text-accent mx-auto" />
                            : <span className="text-muted-foreground/40 text-xs">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* ══════ COLUNA LATERAL (métricas) ══════ */}
          <aside className="hidden xl:flex flex-col gap-3.5 w-60 shrink-0">
            <SideMetric icon={BarChart3} label="Atendimentos Auditados" value="14" color="text-primary" />
            <SideMetric icon={Bot} label="Falhas do BOT" value="2" color="text-destructive" />
            <SideMetric icon={Ban} label="Auditorias Bloqueadas" value="1" color="text-amber-500" />
            <SideMetric icon={TrendingUp} label="Média da Equipe" value="84.2" color="text-primary" />
            <SideMetric icon={Users} label="Total Avaliados" value="6" color="text-accent" />

            {/* Ranking */}
            <div className={`${cardClass} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Ranking de Atendentes</h3>
              </div>
              <ol className="space-y-2.5">
                {MOCK_RANKING.map((a, i) => (
                  <li key={a.nome} className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-muted-foreground/70" : "text-muted-foreground/50"}`}>
                      {i + 1}º
                    </span>
                    <span className="text-xs text-foreground flex-1 truncate">{a.nome}</span>
                    <span className="text-xs font-bold text-foreground tabular-nums">{a.media}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

/* ── Helpers ── */
function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      {children ?? <p className="text-xs font-medium text-foreground">{value}</p>}
    </div>
  );
}

function SideMetric({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className={cardClass + " p-4"}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted/50">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div>
          <p className="text-xl font-bold text-foreground leading-tight tabular-nums">{value}</p>
          <p className="text-[10px] text-muted-foreground/70">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default AttendanceDemo;
