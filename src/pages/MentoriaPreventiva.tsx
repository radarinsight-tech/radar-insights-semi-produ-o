import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ShieldCheck, Upload, Loader2, FileText,
  CheckCircle2, AlertTriangle, ThumbsUp, Lightbulb, ChevronDown, ChevronUp,
  Hash, User, Calendar, Tag, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import logoSymbol from "@/assets/logo-symbol.png";

interface Oportunidade {
  criterio: string;
  sugestao: string;
  exemplo: string;
  impacto: string;
}

interface PreventiveResult {
  viavel: boolean;
  motivoInviavel: string;
  data: string;
  protocolo: string;
  cliente: string;
  tipo: string;
  atendente: string;
  criterios: Array<{
    numero: number;
    nome: string;
    categoria: string;
    pesoMaximo: number;
    resultado: string;
    pontosObtidos: number;
    explicacao: string;
  }>;
  pontosObtidos: number;
  pontosPossiveis: number;
  notaInterna: number;
  classificacaoInterna: string;
  pontosFortes: string[];
  oportunidadesMelhoria: Oportunidade[];
  resumoGeral: string;
}

interface HistoryEntry {
  id: string;
  atendente: string | null;
  protocolo: string | null;
  data_atendimento: string | null;
  tipo: string | null;
  nota_interna: number | null;
  classificacao_interna: string | null;
  status: string;
  created_at: string;
  resultado: PreventiveResult | null;
}

const MentoriaPreventiva = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PreventiveResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showCriterios, setShowCriterios] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryEntry | null>(null);

  const loadHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("preventive_mentorings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setHistory(data as unknown as HistoryEntry[]);
    setLoadingHistory(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setResult(null);
      setSelectedHistory(null);
    } else {
      toast.error("Selecione um arquivo PDF");
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setResult(null);

    try {
      const text = await extractTextFromPdf(file);
      if (!text || text.trim().length < 50) {
        toast.error("Não foi possível extrair texto suficiente do PDF.");
        setAnalyzing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: fnData, error: fnError } = await supabase.functions.invoke("analyze-preventive", {
        body: { text },
      });

      if (fnError) throw fnError;
      const res = fnData as PreventiveResult;
      setResult(res);

      // Save to database (separate table, no impact on official)
      await supabase.from("preventive_mentorings").insert({
        user_id: user.id,
        atendente: res.atendente || null,
        protocolo: res.protocolo || null,
        data_atendimento: res.data || null,
        tipo: res.tipo || null,
        cliente: res.cliente || null,
        nota_interna: res.viavel ? res.notaInterna : null,
        classificacao_interna: res.viavel ? res.classificacaoInterna : null,
        pontos_obtidos: res.pontosObtidos || 0,
        pontos_possiveis: res.pontosPossiveis || 0,
        resultado: res as unknown as Record<string, unknown>,
        pontos_melhoria: res.oportunidadesMelhoria?.map((o) => o.criterio) || [],
        status: res.viavel ? "analisado" : "inviavel",
      } as any);

      loadHistory();
      toast.success("Mentoria preventiva concluída!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao analisar");
    } finally {
      setAnalyzing(false);
    }
  };

  const activeResult = selectedHistory?.resultado || result;

  const classColor = (c: string) => {
    if (c === "Excelente") return "text-emerald-500";
    if (c === "Bom atendimento") return "text-blue-500";
    if (c === "Regular") return "text-amber-500";
    return "text-destructive";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-7 w-7 rounded-lg object-contain" />
            <h1 className="text-lg font-bold text-primary">Mentoria Preventiva</h1>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="flex-1 px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <Info className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Ambiente de desenvolvimento</p>
              <p className="text-xs text-muted-foreground">
                As análises realizadas aqui são exclusivamente para mentoria e desenvolvimento. Não geram nota oficial, não impactam bônus e não entram no ranking mensal.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Upload + History */}
            <div className="space-y-4">
              {/* Upload */}
              <Card className="p-5 space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  Upload de Atendimento
                </h3>
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {file ? file.name : "Clique ou arraste um PDF"}
                    </p>
                  </div>
                  <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                </label>
                <Button
                  className="w-full"
                  onClick={handleAnalyze}
                  disabled={!file || analyzing}
                >
                  {analyzing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Analisando...</>
                  ) : (
                    "Analisar para Mentoria"
                  )}
                </Button>
              </Card>

              {/* History */}
              <Card className="p-5 space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Histórico
                </h3>
                {loadingHistory ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mentoria preventiva ainda.</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {history.map((h) => (
                      <div
                        key={h.id}
                        className={`p-3 rounded-md border cursor-pointer transition-colors text-left ${
                          selectedHistory?.id === h.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}
                        onClick={() => {
                          setSelectedHistory(h);
                          setResult(null);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground truncate">
                            {h.atendente || "—"}
                          </span>
                          {h.nota_interna != null && (
                            <Badge variant="secondary" className="text-xs">
                              {Number(h.nota_interna).toFixed(1)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {h.protocolo || "Sem protocolo"} · {new Date(h.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Right: Result */}
            <div className="lg:col-span-2">
              {!activeResult ? (
                <Card className="p-12 text-center space-y-4">
                  <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto" />
                  <h3 className="text-lg font-bold text-foreground">Mentoria Preventiva</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Envie um PDF de atendimento ou selecione um item do histórico para visualizar o feedback de desenvolvimento.
                  </p>
                </Card>
              ) : !activeResult.viavel ? (
                <Card className="p-8 text-center space-y-4">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                  <h3 className="text-base font-bold text-foreground">Análise Inviável</h3>
                  <p className="text-sm text-muted-foreground">{activeResult.motivoInviavel}</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Header info */}
                  <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 flex-1">
                        {[
                          { icon: Hash, label: "Protocolo", value: activeResult.protocolo || "—" },
                          { icon: User, label: "Atendente", value: activeResult.atendente || "—" },
                          { icon: Calendar, label: "Data", value: activeResult.data || "—" },
                          { icon: Tag, label: "Tipo", value: activeResult.tipo || "—" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <item.icon className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">{item.label}</p>
                              <p className="text-xs font-medium text-foreground">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-center shrink-0 p-4 rounded-xl bg-muted/50 border border-border min-w-[120px]">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ref. Interna</p>
                        <p className={`text-3xl font-black ${classColor(activeResult.classificacaoInterna)}`}>
                          {activeResult.notaInterna?.toFixed(1)}
                        </p>
                        <p className={`text-xs font-medium ${classColor(activeResult.classificacaoInterna)}`}>
                          {activeResult.classificacaoInterna}
                        </p>
                        <Badge variant="outline" className="mt-2 text-[10px]">Não oficial</Badge>
                      </div>
                    </div>
                  </Card>

                  {/* Resumo */}
                  <Card className="p-5 space-y-2">
                    <h3 className="text-sm font-bold text-foreground">Resumo Geral</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{activeResult.resumoGeral}</p>
                  </Card>

                  {/* Pontos Fortes */}
                  {activeResult.pontosFortes?.length > 0 && (
                    <Card className="p-5 space-y-3">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4 text-emerald-500" />
                        Pontos Fortes
                      </h3>
                      <div className="space-y-2">
                        {activeResult.pontosFortes.map((p, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-foreground">{p}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Oportunidades de Melhoria */}
                  {activeResult.oportunidadesMelhoria?.length > 0 && (
                    <Card className="p-5 space-y-3">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        Oportunidades de Melhoria
                      </h3>
                      <div className="space-y-3">
                        {activeResult.oportunidadesMelhoria.map((o, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border space-y-1.5">
                            <p className="text-xs font-bold text-foreground">{o.criterio}</p>
                            <p className="text-xs text-muted-foreground"><strong>Sugestão:</strong> {o.sugestao}</p>
                            <p className="text-xs text-muted-foreground"><strong>Exemplo:</strong> {o.exemplo}</p>
                            <p className="text-xs text-emerald-600"><strong>Impacto:</strong> {o.impacto}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Critérios (collapsible) */}
                  <Card className="p-5 space-y-3">
                    <button
                      className="flex items-center justify-between w-full text-left"
                      onClick={() => setShowCriterios(!showCriterios)}
                    >
                      <h3 className="text-sm font-bold text-foreground">Detalhamento dos Critérios</h3>
                      {showCriterios ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {showCriterios && (
                      <div className="space-y-2">
                        {activeResult.criterios?.map((c) => (
                          <div key={c.numero} className="flex items-start gap-3 p-2 rounded border border-border">
                            <Badge
                              variant={c.resultado === "SIM" ? "default" : c.resultado === "NÃO" ? "destructive" : "secondary"}
                              className="text-[10px] shrink-0 mt-0.5"
                            >
                              {c.resultado}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">
                                {c.numero}. {c.nome} <span className="text-muted-foreground">({c.pontosObtidos}/{c.pesoMaximo})</span>
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{c.explicacao}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MentoriaPreventiva;
