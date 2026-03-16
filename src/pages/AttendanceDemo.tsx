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
      <header className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <h1 className="text-xl font-bold text-foreground">
            Radar Insight — <span className="text-primary">Sucesso do Cliente</span>
          </h1>
          <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1 ml-2">
            <FlaskConical className="h-3 w-3" />
            Modo Demo
          </Badge>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        <div className="flex gap-6">
          {/* ══════ COLUNA PRINCIPAL ══════ */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* LINHA 1: Upload + Resultado lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* UPLOAD */}
              <Card className="p-5">
                <h2 className="text-base font-bold text-primary mb-3">Upload de Atendimento</h2>
                {state === "processing" && (
                  <div className="border-2 border-primary/30 rounded-lg p-6 text-center bg-primary/5">
                    <div className="h-8 w-8 mx-auto animate-spin mb-3 border-4 border-primary/30 border-t-primary rounded-full" />
                    <p className="text-sm font-semibold text-foreground mb-1">Processando auditoria com IA</p>
                    <p className="text-xs text-muted-foreground">Modo Demo — resultado em instantes...</p>
                  </div>
                )}
                {state === "completed" && (
                  <>
                    <div className="border border-accent/40 rounded-lg p-4 bg-accent/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent/10">
                          <CheckCircle2 className="h-5 w-5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Análise concluída</p>
                          <p className="text-sm font-medium text-foreground">atendimento-demo.pdf</p>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-3 w-full" onClick={handleNew}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Nova análise
                    </Button>
                  </>
                )}
                {state === "empty" && (
                  <>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Arraste o PDF aqui ou clique para selecionar</p>
                      <p className="text-xs text-muted-foreground mt-1">Somente arquivos PDF.</p>
                    </div>
                    <Button className="mt-3 w-full" onClick={handleAnalyze}>Analisar atendimento</Button>
                  </>
                )}
              </Card>

              {/* RESULTADO DA AUDITORIA */}
              <Card className="p-5">
                <h2 className="text-base font-bold text-primary mb-3">Resultado da Auditoria</h2>
                {state === "completed" ? (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex gap-4 items-start">
                      <div className="shrink-0">
                        <QualityGauge score={MOCK_RESULT.notaFinal} classification={MOCK_RESULT.classificacao} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1 min-w-0">
                        <Field label="Protocolo" value={MOCK_RESULT.protocolo} />
                        <Field label="Atendente" value={MOCK_RESULT.atendente} />
                        <Field label="Tipo"><Badge variant="outline" className="text-[10px] px-1.5 py-0">{MOCK_RESULT.tipo}</Badge></Field>
                        <Field label="Classificação"><Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">{MOCK_RESULT.classificacao}</Badge></Field>
                        <Field label="Bônus"><Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">{MOCK_RESULT.bonusQualidade}%</Badge></Field>
                        <Field label="Versão" value={MOCK_RESULT.versaoPrompt} />
                        <Field label="Validade" value={MOCK_RESULT.validade} />
                        <Field label="Interação">
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-accent" /><span className="text-xs font-medium">{MOCK_RESULT.statusInteracao}</span></span>
                        </Field>
                      </div>
                    </div>
                    {/* Indicadores */}
                    <div className="mt-3 pt-2 border-t border-border">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Indicadores por Dimensão</p>
                      <div className="grid grid-cols-4 gap-2">
                        {MOCK_RESULT.indicadores.map((ind) => (
                          <div key={ind.label} className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-center">
                            <p className="text-sm font-bold text-foreground leading-none">{ind.valor.toFixed(1)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{ind.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Resumo */}
                    <div className="mt-2 rounded-md bg-muted/40 border border-border px-3 py-2">
                      <p className="text-xs text-foreground italic leading-snug">"{MOCK_RESULT.resumo}"</p>
                    </div>
                    {/* Mentoria colapsável */}
                    {MOCK_RESULT.pontosMelhoria.length > 0 && (
                      <Collapsible className="mt-2">
                        <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left group">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex-1">Mentoria de Comunicação</p>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1.5">
                          <ul className="space-y-1">
                            {MOCK_RESULT.pontosMelhoria.map((p, i) => (
                              <li key={i} className="text-xs text-foreground flex gap-1.5">
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
                    <div className="p-3 rounded-full bg-primary/10 mb-3">
                      <FileText className="h-7 w-7 text-primary/60" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {state === "processing" ? "Analisando..." : "Clique em \"Analisar atendimento\" para ver o resultado"}
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* LINHA 2: Evolução da Nota Média */}
            <Card className="p-5">
              <h2 className="text-base font-bold text-primary mb-3">Evolução da Nota Média</h2>
              <div className="h-40 flex items-end gap-2 px-2">
                {[78, 82, 80, 85, 88, 84, 87, 90, 86, 89, 92, 91].map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary/80" style={{ height: `${(v / 100) * 120}px` }} />
                    <span className="text-[9px] text-muted-foreground">{["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i]}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* LINHA 3: Média por Atendente */}
            <Card className="p-5">
              <h2 className="text-base font-bold text-primary mb-3">Média por Atendente</h2>
              <div className="space-y-2">
                {MOCK_RANKING.map((a) => (
                  <div key={a.nome} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-foreground w-28 truncate">{a.nome}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${a.media}%` }} />
                    </div>
                    <span className="text-xs font-bold text-foreground w-10 text-right">{a.media}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* LINHA 4: Filtros */}
            <Card className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Atendente</label>
                  <Select><SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {MOCK_RANKING.map((a) => <SelectItem key={a.nome} value={a.nome}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                  <Select><SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      {["Todos","Suporte Técnico","Financeiro","Cancelamento","Informação","Reclamação"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
                  <Select><SelectTrigger className="h-9"><SelectValue placeholder="Últimos 30 dias" /></SelectTrigger>
                    <SelectContent>
                      {["Últimos 7 dias","Últimos 30 dias","Últimos 90 dias"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Busca</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Protocolo ou atendente..." className="h-9 pl-8" />
                  </div>
                </div>
              </div>
            </Card>

            {/* LINHA 5: Histórico */}
            <Card className="p-5">
              <h2 className="text-base font-bold text-primary mb-3">Histórico de Avaliações</h2>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Protocolo</TableHead>
                      <TableHead className="text-xs">Atendente</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs text-right">Nota</TableHead>
                      <TableHead className="text-xs">Classificação</TableHead>
                      <TableHead className="text-xs text-center">Bônus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_HISTORY.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs">{h.data}</TableCell>
                        <TableCell className="text-xs font-medium">{h.protocolo}</TableCell>
                        <TableCell className="text-xs">{h.atendente}</TableCell>
                        <TableCell className="text-xs">{h.tipo}</TableCell>
                        <TableCell className="text-xs text-right font-bold">{h.nota}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{h.classificacao}</Badge></TableCell>
                        <TableCell className="text-center">{h.bonus ? <CheckCircle2 className="h-4 w-4 text-accent mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* ══════ COLUNA LATERAL (métricas) ══════ */}
          <aside className="hidden xl:flex flex-col gap-4 w-64 shrink-0">
            <SideMetric icon={BarChart3} label="Atendimentos Auditados" value="14" color="text-primary" />
            <SideMetric icon={Bot} label="Falhas do BOT" value="2" color="text-destructive" />
            <SideMetric icon={Ban} label="Auditorias Bloqueadas" value="1" color="text-amber-500" />
            <SideMetric icon={TrendingUp} label="Média da Equipe" value="84.2" color="text-primary" />
            <SideMetric icon={Users} label="Total Avaliados" value="6" color="text-accent" />

            {/* Ranking */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Ranking</h3>
              </div>
              <ol className="space-y-2">
                {MOCK_RANKING.map((a, i) => (
                  <li key={a.nome} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <span className="text-xs text-foreground flex-1 truncate">{a.nome}</span>
                    <span className="text-xs font-bold text-foreground">{a.media}</span>
                  </li>
                ))}
              </ol>
            </Card>
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
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {children ?? <p className="text-xs font-medium">{value}</p>}
    </div>
  );
}

function SideMetric({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

export default AttendanceDemo;
