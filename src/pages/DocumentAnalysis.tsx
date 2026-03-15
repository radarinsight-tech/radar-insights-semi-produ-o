import { useState, useEffect, useCallback } from "react";
import { LogOut, ArrowLeft, Search, Upload, FileCheck, FileX, CheckCircle2, XCircle, Clock, AlertTriangle, User, CreditCard, Scale, Receipt, Loader2 } from "lucide-react";
import logoSymbol from "@/assets/logo-symbol.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// ── Types ──
interface CreditAnalysisRef {
  id: string;
  cpf_cnpj: string;
  nome: string | null;
  decisao_final: string | null;
  regra_aplicada: string | null;
  created_at: string;
  status: string;
  resultado: any;
}

interface DocAnalysis {
  id: string;
  credit_analysis_id: string | null;
  cpf_cnpj: string;
  nome: string | null;
  user_name: string | null;
  decisao_documental: string;
  motivo: string | null;
  observacao: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DocItem {
  id: string;
  document_analysis_id: string;
  tipo: string;
  file_url: string | null;
  file_name: string | null;
  documento_recebido: boolean;
  nome_confere: boolean;
  cpf_confere: boolean;
  endereco_confere: boolean;
  legivel: boolean;
  valido: boolean;
  observacao: string | null;
}

// ── Constants ──
const DOC_TYPES = [
  { value: "rg_cnh", label: "RG ou CNH" },
  { value: "comprovante_endereco", label: "Comprovante de Endereço" },
  { value: "boleto_provedor", label: "Boleto do Provedor Atual" },
  { value: "contrato_aluguel", label: "Contrato de Aluguel" },
  { value: "escritura", label: "Escritura do Imóvel" },
  { value: "outro", label: "Outros Anexos" },
];

const STATUS_OPTIONS = [
  { value: "aguardando_documentos", label: "Aguardando Documentos", icon: Clock, color: "text-muted-foreground" },
  { value: "documentos_recebidos", label: "Documentos Recebidos", icon: FileCheck, color: "text-primary" },
  { value: "documentacao_em_analise", label: "Documentação em Análise", icon: Search, color: "text-warning" },
  { value: "documentacao_aprovada", label: "Documentação Aprovada", icon: CheckCircle2, color: "text-accent" },
  { value: "documentacao_pendente", label: "Documentação Pendente", icon: AlertTriangle, color: "text-warning" },
  { value: "documentacao_reprovada", label: "Documentação Reprovada", icon: XCircle, color: "text-destructive" },
];

const DECISAO_OPTIONS = [
  { value: "documentacao_aprovada", label: "Aprovada" },
  { value: "documentacao_pendente", label: "Pendente" },
  { value: "documentacao_reprovada", label: "Reprovada" },
];

const normalizeFaixa = (d: string | null): string => {
  if (!d) return "—";
  const upper = d.toUpperCase().trim();
  if (upper === "ISENTAR" || upper === "ISENTA") return "Isenção";
  if (upper.includes("1000")) return "R$ 1.000";
  if (upper.includes("100")) return "R$ 100";
  if (upper.includes("200")) return "R$ 200";
  if (upper.includes("300")) return "R$ 300";
  return d;
};

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatCpfCnpj = (value: string) => {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 14)
    return `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12)}`;
  if (clean.length === 11)
    return `${clean.slice(0,3)}.${clean.slice(3,6)}.${clean.slice(6,9)}-${clean.slice(9)}`;
  return value;
};

// ── Main Component ──
const DocumentAnalysis = () => {
  const navigate = useNavigate();

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [creditRef, setCreditRef] = useState<CreditAnalysisRef | null>(null);

  // Doc analysis
  const [docAnalysis, setDocAnalysis] = useState<DocAnalysis | null>(null);
  const [docItems, setDocItems] = useState<DocItem[]>([]);
  const [creating, setCreating] = useState(false);

  // Decision form
  const [decisao, setDecisao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

  // History
  const [history, setHistory] = useState<DocAnalysis[]>([]);
  const [historyFilter, setHistoryFilter] = useState("todos");
  const [tab, setTab] = useState("analise");

  // Load history
  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from("document_analyses" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any;
      if (data) setHistory(data);
    };
    fetchHistory();
  }, [docAnalysis]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setCreditRef(null);
    setDocAnalysis(null);
    setDocItems([]);

    const cleanQuery = searchQuery.replace(/\D/g, "");
    const isNumeric = cleanQuery.length >= 3;

    try {
      let query = supabase
        .from("credit_analyses" as any)
        .select("id, cpf_cnpj, nome, decisao_final, regra_aplicada, created_at, status, resultado")
        .order("created_at", { ascending: false })
        .limit(1);

      if (isNumeric) {
        query = query.eq("cpf_cnpj", cleanQuery);
      } else {
        query = query.ilike("nome", `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query as any;

      if (error || !data || data.length === 0) {
        toast.error("Cliente não encontrado. Verifique o CPF/CNPJ ou nome.");
        setSearching(false);
        return;
      }

      const ref = data[0] as CreditAnalysisRef;
      setCreditRef(ref);

      // Check for existing doc analysis
      const { data: existingDoc } = await supabase
        .from("document_analyses" as any)
        .select("*")
        .eq("cpf_cnpj", ref.cpf_cnpj)
        .order("created_at", { ascending: false })
        .limit(1) as any;

      if (existingDoc && existingDoc.length > 0) {
        setDocAnalysis(existingDoc[0]);
        await loadDocItems(existingDoc[0].id);
      }
    } catch {
      toast.error("Erro na busca.");
    } finally {
      setSearching(false);
    }
  };

  const loadDocItems = async (analysisId: string) => {
    const { data } = await supabase
      .from("document_items" as any)
      .select("*")
      .eq("document_analysis_id", analysisId) as any;
    if (data) setDocItems(data);
  };

  const handleCreateDocAnalysis = async () => {
    if (!creditRef) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

      const { data, error } = await supabase
        .from("document_analyses" as any)
        .insert({
          credit_analysis_id: creditRef.id,
          cpf_cnpj: creditRef.cpf_cnpj,
          nome: creditRef.nome,
          user_id: user.id,
          user_name: profile?.full_name || user.email,
          status: "aguardando_documentos",
          decisao_documental: "aguardando_documentos",
        } as any)
        .select()
        .single() as any;

      if (error) { toast.error("Erro ao criar análise documental."); console.error(error); return; }

      setDocAnalysis(data);
      // Create default doc items
      const defaultDocs = DOC_TYPES.map(dt => ({
        document_analysis_id: data.id,
        tipo: dt.value,
        documento_recebido: false,
        nome_confere: false,
        cpf_confere: false,
        endereco_confere: false,
        legivel: false,
        valido: false,
      }));

      await supabase.from("document_items" as any).insert(defaultDocs as any) as any;
      await loadDocItems(data.id);
      toast.success("Análise documental iniciada.");
    } catch { toast.error("Erro ao criar análise."); }
    finally { setCreating(false); }
  };

  const handleUploadFile = async (itemId: string, tipo: string, file: File) => {
    if (!docAnalysis) return;
    const path = `${docAnalysis.cpf_cnpj}/${docAnalysis.id}/${tipo}_${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("credit-documents").upload(path, file);
    if (uploadErr) { toast.error("Erro no upload."); console.error(uploadErr); return; }

    const { data: { publicUrl } } = supabase.storage.from("credit-documents").getPublicUrl(path);

    await supabase
      .from("document_items" as any)
      .update({ file_url: publicUrl, file_name: file.name, documento_recebido: true } as any)
      .eq("id", itemId) as any;

    await loadDocItems(docAnalysis.id);
    toast.success(`Arquivo "${file.name}" enviado.`);
  };

  const handleChecklistChange = async (itemId: string, field: string, value: boolean) => {
    await supabase
      .from("document_items" as any)
      .update({ [field]: value } as any)
      .eq("id", itemId) as any;

    setDocItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
  };

  const handleItemObservacao = async (itemId: string, obs: string) => {
    await supabase
      .from("document_items" as any)
      .update({ observacao: obs } as any)
      .eq("id", itemId) as any;

    setDocItems(prev => prev.map(i => i.id === itemId ? { ...i, observacao: obs } : i));
  };

  const handleSaveDecision = async () => {
    if (!docAnalysis) return;
    if (!decisao) { toast.error("Selecione a decisão documental."); return; }
    if ((decisao === "documentacao_pendente" || decisao === "documentacao_reprovada") && !motivo.trim()) {
      toast.error("Informe o motivo da pendência ou reprovação.");
      return;
    }

    setSavingDecision(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();

      const { error } = await supabase
        .from("document_analyses" as any)
        .update({
          decisao_documental: decisao,
          status: decisao,
          motivo: motivo || null,
          observacao: observacao || null,
          user_name: profile?.full_name || user!.email,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", docAnalysis.id) as any;

      if (error) { toast.error("Erro ao salvar decisão."); return; }

      setDocAnalysis({ ...docAnalysis, decisao_documental: decisao, status: decisao, motivo, observacao });
      toast.success("Decisão documental salva.");
    } catch { toast.error("Erro ao salvar decisão."); }
    finally { setSavingDecision(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredHistory = history.filter(h => historyFilter === "todos" || h.status === historyFilter);

  const statusInfo = (s: string) => STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0];

  return (
    <div className="min-h-screen bg-background" data-module="credit">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Radar Insight — <span className="text-primary">Análise de Documentação</span>
              </h1>
              <p className="text-xs text-muted-foreground">Validação documental vinculada à análise de crédito</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/credit")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Crédito
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Hub
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="analise">Análise Documental</TabsTrigger>
            <TabsTrigger value="historico">Monitoramento</TabsTrigger>
          </TabsList>

          {/* ═══ TAB: Análise Documental ═══ */}
          <TabsContent value="analise" className="space-y-6 mt-4">
            {/* Search */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                Localizar Cliente
              </h2>
              <div className="flex gap-3">
                <Input
                  placeholder="CPF, CNPJ ou nome do cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="max-w-md bg-card"
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  Buscar
                </Button>
              </div>
            </Card>

            {/* Credit Summary */}
            {creditRef && (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Resumo da Análise de Crédito
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <InfoField icon={<User className="h-3.5 w-3.5" />} label="Nome" value={creditRef.nome || "—"} />
                  <InfoField icon={<CreditCard className="h-3.5 w-3.5" />} label="CPF/CNPJ" value={formatCpfCnpj(creditRef.cpf_cnpj)} />
                  <InfoField icon={<Scale className="h-3.5 w-3.5" />} label="Faixa Final" value={normalizeFaixa(creditRef.decisao_final)} />
                  <InfoField icon={<Receipt className="h-3.5 w-3.5" />} label="Taxa Total" value={creditRef.resultado?.taxa_total !== undefined ? formatCurrency(creditRef.resultado.taxa_total) : "—"} />
                  <InfoField label="Regra" value={creditRef.regra_aplicada || "—"} />
                  <InfoField label="Data" value={new Date(creditRef.created_at).toLocaleDateString("pt-BR")} />
                </div>

                {/* Status */}
                {docAnalysis && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Status documental:</span>
                      {(() => {
                        const si = statusInfo(docAnalysis.status);
                        const Icon = si.icon;
                        return <Badge variant="outline" className={`${si.color} text-xs`}><Icon className="h-3 w-3 mr-1" />{si.label}</Badge>;
                      })()}
                    </div>
                  </div>
                )}

                {!docAnalysis && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <Button onClick={handleCreateDocAnalysis} disabled={creating}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileCheck className="h-4 w-4 mr-1" />}
                      Iniciar Análise Documental
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {/* Document Upload + Checklist */}
            {docAnalysis && docItems.length > 0 && (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  Documentos e Checklist de Validação
                </h2>
                <div className="space-y-4">
                  {docItems.map((item) => {
                    const docType = DOC_TYPES.find(d => d.value === item.tipo);
                    return (
                      <div key={item.id} className={`rounded-lg border p-4 ${item.valido ? "border-accent bg-accent/5" : item.documento_recebido ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {item.valido ? <CheckCircle2 className="h-4 w-4 text-accent" /> : item.documento_recebido ? <FileCheck className="h-4 w-4 text-primary" /> : <FileX className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm font-semibold">{docType?.label || item.tipo}</span>
                          </div>
                          {item.file_name && (
                            <a href={item.file_url || "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline truncate max-w-[200px]">
                              {item.file_name}
                            </a>
                          )}
                        </div>

                        {/* Upload */}
                        {!item.file_url && (
                          <div className="mb-3">
                            <label className="cursor-pointer">
                              <div className="border-2 border-dashed border-border rounded px-4 py-2 text-center hover:border-primary/40 transition-colors">
                                <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                                <p className="text-xs text-muted-foreground">Clique para anexar</p>
                              </div>
                              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadFile(item.id, item.tipo, f);
                              }} />
                            </label>
                          </div>
                        )}

                        {/* Checklist */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                          {[
                            { field: "documento_recebido", label: "Recebido" },
                            { field: "nome_confere", label: "Nome confere" },
                            { field: "cpf_confere", label: "CPF confere" },
                            { field: "endereco_confere", label: "Endereço confere" },
                            { field: "legivel", label: "Legível" },
                            { field: "valido", label: "Válido" },
                          ].map(({ field, label }) => (
                            <div key={field} className="flex items-center gap-2">
                              <Checkbox
                                id={`${item.id}-${field}`}
                                checked={(item as any)[field]}
                                onCheckedChange={(v) => handleChecklistChange(item.id, field, !!v)}
                              />
                              <Label htmlFor={`${item.id}-${field}`} className="text-xs cursor-pointer">{label}</Label>
                            </div>
                          ))}
                        </div>

                        {/* Observation */}
                        <Input
                          placeholder="Observação sobre este documento..."
                          value={item.observacao || ""}
                          onChange={(e) => handleItemObservacao(item.id, e.target.value)}
                          className="text-xs h-8 bg-card"
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Decision */}
            {docAnalysis && (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  Decisão Documental Final
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Decisão *</Label>
                    <Select value={decisao} onValueChange={setDecisao}>
                      <SelectTrigger className="bg-card"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {DECISAO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Motivo {(decisao === "documentacao_pendente" || decisao === "documentacao_reprovada") && "*"}
                    </Label>
                    <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da decisão..." className="bg-card" />
                  </div>
                </div>
                <div className="space-y-1.5 mb-4">
                  <Label className="text-xs font-semibold text-muted-foreground">Observação do analista</Label>
                  <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observações adicionais..." rows={3} />
                </div>
                <Button onClick={handleSaveDecision} disabled={savingDecision}>
                  {savingDecision ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Salvar Decisão
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* ═══ TAB: Monitoramento ═══ */}
          <TabsContent value="historico" className="space-y-6 mt-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" />
                  Monitoramento Documental
                </h2>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Status:</Label>
                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="w-[200px] bg-card h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decisão</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Atualização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro</TableCell></TableRow>
                    ) : filteredHistory.map((h) => {
                      const si = statusInfo(h.status);
                      const Icon = si.icon;
                      return (
                        <TableRow key={h.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => {
                          setSearchQuery(h.cpf_cnpj);
                          setTab("analise");
                          setTimeout(() => handleSearch(), 100);
                        }}>
                          <TableCell className="text-xs">{new Date(h.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-xs font-medium">{h.nome || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{formatCpfCnpj(h.cpf_cnpj)}</TableCell>
                          <TableCell className="text-xs">{h.user_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${si.color}`}>
                              <Icon className="h-3 w-3 mr-1" />{si.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{DECISAO_OPTIONS.find(d => d.value === h.decisao_documental)?.label || h.decisao_documental}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{h.motivo || "—"}</TableCell>
                          <TableCell className="text-xs">{new Date(h.updated_at).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// ── Sub-component ──
const InfoField = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-1 mb-0.5">
      {icon && <span className="text-primary">{icon}</span>}
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
    <p className="text-sm font-medium text-foreground">{value}</p>
  </div>
);

export default DocumentAnalysis;
