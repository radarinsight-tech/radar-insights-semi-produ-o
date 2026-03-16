import { useState, useEffect, useRef } from "react";
import {
  LogOut, ArrowLeft, Search, Upload, FileCheck, FileX, CheckCircle2, XCircle, Clock,
  AlertTriangle, User, CreditCard, Scale, Receipt, Loader2, Trash2, RefreshCw, Eye,
  ShieldAlert, ShieldCheck, Shield, FileWarning, Eraser, FileText, ScanLine, X
} from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  hash_arquivo: string | null;
  texto_extraido: string | null;
  confianca_ocr: number | null;
  campos_extraidos: any;
  divergencias: any[];
  alertas: any[];
  risco_documental: string;
  suspeita_fraude: boolean;
  status_ocr: string;
  status_documento: string;
  revisado_por: string | null;
  data_revisao: string | null;
  data_emissao: string | null;
  data_inicio_contrato: string | null;
  data_fim_contrato: string | null;
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
  decisao_sugerida: string | null;
  motivo_sugestao: string | null;
  justificativa_divergencia: string | null;
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

const STATUS_DOC_OPTIONS = [
  { value: "recebido", label: "Recebido", color: "text-primary" },
  { value: "validado", label: "Validado", color: "text-accent" },
  { value: "pendente", label: "Pendente", color: "text-warning" },
  { value: "rejeitado", label: "Rejeitado", color: "text-destructive" },
];

const STATUS_PROCESS = [
  { value: "aguardando_documentos", label: "Aguardando Documentos", icon: Clock, color: "text-muted-foreground" },
  { value: "documentos_recebidos", label: "Documentos Recebidos", icon: FileCheck, color: "text-primary" },
  { value: "documentacao_em_analise", label: "Documentação em Análise", icon: Search, color: "text-warning" },
  { value: "documentacao_aprovada", label: "Documentação Aprovada", icon: CheckCircle2, color: "text-accent" },
  { value: "documentacao_pendente", label: "Documentação Pendente", icon: AlertTriangle, color: "text-warning" },
  { value: "documentacao_reprovada", label: "Documentação Reprovada", icon: XCircle, color: "text-destructive" },
];

const OCR_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  aguardando_leitura: { label: "Aguardando leitura", color: "text-muted-foreground" },
  processando: { label: "Processando OCR...", color: "text-primary" },
  leitura_concluida: { label: "Leitura concluída", color: "text-accent" },
  baixa_confianca: { label: "Baixa confiança", color: "text-warning" },
  divergencia_encontrada: { label: "Divergência encontrada", color: "text-destructive" },
  suspeita_fraude: { label: "Suspeita de fraude", color: "text-destructive" },
  revisao_manual_pendente: { label: "Revisão manual pendente", color: "text-warning" },
  validado_analista: { label: "Validado pelo analista", color: "text-accent" },
  rejeitado: { label: "Rejeitado", color: "text-destructive" },
};

const RISCO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  baixo: { label: "Baixo", color: "text-accent", icon: ShieldCheck },
  medio: { label: "Médio", color: "text-warning", icon: Shield },
  alto: { label: "Alto", color: "text-destructive", icon: ShieldAlert },
};

const DECISAO_OPTIONS = [
  { value: "documentacao_aprovada", label: "Aprovada" },
  { value: "documentacao_pendente", label: "Pendente" },
  { value: "documentacao_reprovada", label: "Reprovada" },
];

// ── Decision Matrix Engine ──
interface SuggestedDecision {
  decisao: string;
  label: string;
  motivos: string[];
  color: string;
  icon: typeof CheckCircle2;
}

function computeSuggestedDecision(items: DocItem[]): SuggestedDecision | null {
  if (items.length === 0) return null;

  const receivedItems = items.filter(i => i.documento_recebido && i.file_url);
  if (receivedItems.length === 0) return null;

  const motivos: string[] = [];
  let hasReprovacao = false;
  let hasPendencia = false;

  for (const item of receivedItems) {
    const tipoLabel = DOC_TYPES.find(d => d.value === item.tipo)?.label || item.tipo;

    // Suspeita de fraude → reprovada
    if (item.suspeita_fraude) {
      motivos.push(`${tipoLabel}: suspeita de fraude detectada`);
      hasReprovacao = true;
    }

    // Documento duplicado em outro cliente → reprovada
    if (item.alertas?.some((a: any) => a.tipo === "documento_duplicado")) {
      motivos.push(`${tipoLabel}: documento repetido em outro cliente`);
      hasReprovacao = true;
    }

    // Nome divergente → reprovada
    if (item.divergencias?.some((d: any) => d.tipo === "nome_divergente")) {
      motivos.push(`${tipoLabel}: nome divergente do cadastro`);
      hasReprovacao = true;
    }

    // CPF divergente → reprovada
    if (item.divergencias?.some((d: any) => d.tipo === "cpf_divergente")) {
      motivos.push(`${tipoLabel}: CPF divergente do cadastro`);
      hasReprovacao = true;
    }

    // Endereço divergente → pendente
    if (item.divergencias?.some((d: any) => d.campo === "endereco")) {
      motivos.push(`${tipoLabel}: endereço divergente`);
      hasPendencia = true;
    }

    // Documento ilegível → pendente
    if (item.documento_recebido && !item.legivel) {
      motivos.push(`${tipoLabel}: documento ilegível`);
      hasPendencia = true;
    }

    // Checklist incompleto → pendente
    if (item.documento_recebido && item.file_url) {
      const checklistComplete = item.nome_confere && item.cpf_confere && item.endereco_confere && item.legivel && item.valido;
      if (!checklistComplete) {
        motivos.push(`${tipoLabel}: checklist incompleto`);
        hasPendencia = true;
      }
    }

    // Comprovante > 60 dias → pendente
    if (item.alertas?.some((a: any) => a.tipo === "comprovante_vencido")) {
      motivos.push(`${tipoLabel}: comprovante com mais de 60 dias`);
      hasPendencia = true;
    }

    // Contrato < 12 meses → pendente
    if (item.alertas?.some((a: any) => a.tipo === "contrato_curto")) {
      motivos.push(`${tipoLabel}: contrato com menos de 12 meses`);
      hasPendencia = true;
    }
  }

  // OCR < 50% mas checklist confirmado → aprovar com observação
  const lowOcrButManualOk = receivedItems.some(i =>
    i.confianca_ocr !== null && i.confianca_ocr < 0.5 &&
    i.nome_confere && i.cpf_confere && i.endereco_confere && i.legivel && i.valido
  );

  if (hasReprovacao) {
    return {
      decisao: "documentacao_reprovada",
      label: "Documentação Reprovada",
      motivos,
      color: "text-destructive",
      icon: XCircle,
    };
  }

  if (hasPendencia) {
    return {
      decisao: "documentacao_pendente",
      label: "Documentação Pendente",
      motivos,
      color: "text-warning",
      icon: AlertTriangle,
    };
  }

  // All received docs have complete checklist and low risk
  const allValid = receivedItems.every(i =>
    i.nome_confere && i.cpf_confere && i.endereco_confere && i.legivel && i.valido &&
    (i.risco_documental === "baixo" || i.risco_documental === null)
  );

  if (allValid) {
    if (lowOcrButManualOk) {
      motivos.push("OCR com baixa confiança, mas checklist confirmado manualmente");
      return {
        decisao: "documentacao_aprovada",
        label: "Aprovar com Observação",
        motivos,
        color: "text-accent",
        icon: CheckCircle2,
      };
    }
    return {
      decisao: "documentacao_aprovada",
      label: "Documentação Aprovada",
      motivos: ["Todos os documentos válidos, checklist completo, risco baixo"],
      color: "text-accent",
      icon: CheckCircle2,
    };
  }

  motivos.push("Análise requer revisão adicional");
  return {
    decisao: "documentacao_pendente",
    label: "Documentação Pendente",
    motivos,
    color: "text-warning",
    icon: AlertTriangle,
  };
}

const normalizeFaixa = (d: string | null): string => {
  if (!d) return "—";
  const u = d.toUpperCase().trim();
  if (u === "ISENTAR" || u === "ISENTA") return "Isenção";
  if (u.includes("1000")) return "R$ 1.000";
  if (u.includes("300")) return "R$ 300";
  if (u.includes("200")) return "R$ 200";
  if (u.includes("100")) return "R$ 100";
  return d;
};

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatCpfCnpj = (value: string) => {
  const c = value.replace(/\D/g, "");
  if (c.length === 14) return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
  if (c.length === 11) return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}`;
  return value;
};

// Simple hash for file dedup detection
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${file.type};base64,${btoa(binary)}`;
}

// ── Main Component ──
const DocumentAnalysis = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [creditRef, setCreditRef] = useState<CreditAnalysisRef | null>(null);

  const [docAnalysis, setDocAnalysis] = useState<DocAnalysis | null>(null);
  const [docItems, setDocItems] = useState<DocItem[]>([]);
  const [creating, setCreating] = useState(false);

  const [decisao, setDecisao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

  const [history, setHistory] = useState<DocAnalysis[]>([]);
  const [historyFilter, setHistoryFilter] = useState("todos");
  const [tab, setTab] = useState("analise");

  // OCR state per item
  const [ocrProcessing, setOcrProcessing] = useState<Record<string, boolean>>({});
  const [ocrExpanded, setOcrExpanded] = useState<Record<string, boolean>>({});

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: DocItem | null }>({ open: false, item: null });
  const [deleteMotivo, setDeleteMotivo] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from("document_analyses")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setHistory(data as any);
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
        .from("credit_analyses")
        .select("id, cpf_cnpj, nome, decisao_final, regra_aplicada, created_at, status, resultado")
        .order("created_at", { ascending: false })
        .limit(1);

      if (isNumeric) {
        query = query.eq("cpf_cnpj", cleanQuery);
      } else {
        query = query.ilike("nome", `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        toast.error("Cliente não encontrado. Verifique o CPF/CNPJ ou nome.");
        setSearching(false);
        return;
      }

      const ref = data[0] as any as CreditAnalysisRef;
      setCreditRef(ref);

      const { data: existingDoc } = await supabase
        .from("document_analyses")
        .select("*")
        .eq("cpf_cnpj", ref.cpf_cnpj)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingDoc && existingDoc.length > 0) {
        setDocAnalysis(existingDoc[0] as any);
        await loadDocItems(existingDoc[0].id);
      }
    } catch {
      toast.error("Erro na busca.");
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setCreditRef(null);
    setDocAnalysis(null);
    setDocItems([]);
    setDecisao("");
    setMotivo("");
    setObservacao("");
    setOcrProcessing({});
    setOcrExpanded({});
  };

  const loadDocItems = async (analysisId: string) => {
    const { data } = await supabase
      .from("document_items")
      .select("*")
      .eq("document_analysis_id", analysisId);
    if (data) setDocItems(data as any);
  };

  const handleCreateDocAnalysis = async () => {
    if (!creditRef) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

      const { data, error } = await supabase
        .from("document_analyses")
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
        .single();

      if (error) { toast.error("Erro ao criar análise documental."); return; }

      setDocAnalysis(data as any);
      const defaultDocs = DOC_TYPES.map(dt => ({
        document_analysis_id: (data as any).id,
        tipo: dt.value,
        documento_recebido: false,
        nome_confere: false,
        cpf_confere: false,
        endereco_confere: false,
        legivel: false,
        valido: false,
      }));

      await supabase.from("document_items").insert(defaultDocs as any);
      await loadDocItems((data as any).id);
      toast.success("Análise documental iniciada.");
    } catch { toast.error("Erro ao criar análise."); }
    finally { setCreating(false); }
  };

  const handleUploadFile = async (itemId: string, tipo: string, file: File) => {
    if (!docAnalysis) return;
    const hash = await hashFile(file);

    // Check duplicate hash across all document_items
    const { data: dupes } = await supabase
      .from("document_items")
      .select("id, document_analysis_id, tipo, file_name")
      .eq("hash_arquivo", hash)
      .neq("id", itemId);

    const alertas: any[] = [];
    let suspeita = false;

    if (dupes && dupes.length > 0) {
      alertas.push({
        tipo: "documento_duplicado",
        mensagem: `Arquivo idêntico já usado em outra análise (${dupes[0].file_name || "outro documento"})`,
        gravidade: "alto",
      });
      suspeita = true;
    }

    const path = `${docAnalysis.cpf_cnpj}/${docAnalysis.id}/${tipo}_${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("credit-documents").upload(path, file);
    if (uploadErr) { toast.error("Erro no upload."); return; }

    const { data: { publicUrl } } = supabase.storage.from("credit-documents").getPublicUrl(path);

    await supabase
      .from("document_items")
      .update({
        file_url: publicUrl,
        file_name: file.name,
        documento_recebido: true,
        hash_arquivo: hash,
        status_documento: "recebido",
        status_ocr: "aguardando_leitura",
        alertas: alertas,
        suspeita_fraude: suspeita,
        risco_documental: suspeita ? "alto" : "baixo",
      } as any)
      .eq("id", itemId);

    await loadDocItems(docAnalysis.id);

    if (suspeita) {
      toast.warning("⚠️ Documento duplicado detectado! Verifique os alertas.");
    } else {
      toast.success(`Arquivo "${file.name}" enviado.`);
    }
  };

  const handleOcr = async (item: DocItem) => {
    if (!item.file_url || !docAnalysis || !creditRef) return;

    setOcrProcessing(p => ({ ...p, [item.id]: true }));

    // Update status to processing
    await supabase.from("document_items").update({ status_ocr: "processando" } as any).eq("id", item.id);

    try {
      // Fetch the file and convert to base64
      const response = await fetch(item.file_url);
      const blob = await response.blob();
      const file = new File([blob], item.file_name || "doc", { type: blob.type });

      let imageDataUrl: string;

      if (file.type === "application/pdf") {
        // For PDF, use the existing PDF renderer
        const { renderPdfPagesToImages } = await import("@/lib/pdfExtractor");
        const pages = await renderPdfPagesToImages(file);
        imageDataUrl = pages[0] || "";
      } else {
        imageDataUrl = await fileToBase64(file);
      }

      if (!imageDataUrl) {
        throw new Error("Não foi possível converter o arquivo para imagem.");
      }

      const { data, error } = await supabase.functions.invoke("ocr-document", {
        body: { imageDataUrl, tipoDocumento: item.tipo },
      });

      if (error) throw error;

      const campos = data.campos || {};
      const confianca = data.confianca || 0;
      const texto = data.texto_extraido || "";

      // Run comparisons
      const divergencias: any[] = [];
      const alertas: any[] = [...(item.alertas || [])];
      let risco = "baixo";
      let suspeita = item.suspeita_fraude || false;

      const refNome = creditRef.nome?.toLowerCase().trim() || "";
      const refCpf = creditRef.cpf_cnpj.replace(/\D/g, "");

      // Name comparison
      const extractedName = (campos.nome || campos.nome_locatario || "").toLowerCase().trim();
      if (extractedName && refNome && !extractedName.includes(refNome) && !refNome.includes(extractedName)) {
        divergencias.push({ campo: "nome", esperado: creditRef.nome, encontrado: campos.nome || campos.nome_locatario, tipo: "nome_divergente" });
        alertas.push({ tipo: "nome_divergente", mensagem: `Nome divergente: esperado "${creditRef.nome}", encontrado "${campos.nome || campos.nome_locatario}"`, gravidade: "alto" });
        risco = "alto";
        suspeita = true;
      }

      // CPF comparison
      const extractedCpf = (campos.cpf || "").replace(/\D/g, "");
      if (extractedCpf && refCpf && extractedCpf !== refCpf) {
        divergencias.push({ campo: "cpf", esperado: refCpf, encontrado: extractedCpf, tipo: "cpf_divergente" });
        alertas.push({ tipo: "cpf_divergente", mensagem: `CPF divergente: esperado "${formatCpfCnpj(refCpf)}", encontrado "${formatCpfCnpj(extractedCpf)}"`, gravidade: "alto" });
        risco = "alto";
        suspeita = true;
      }

      // Address comparison for comprovante
      if (item.tipo === "comprovante_endereco" && campos.data_emissao) {
        const emissao = parseDate(campos.data_emissao);
        if (emissao) {
          const diffDays = Math.floor((Date.now() - emissao.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 60) {
            alertas.push({ tipo: "comprovante_vencido", mensagem: `Comprovante emitido há ${diffDays} dias (> 60 dias)`, gravidade: "medio" });
            if (risco === "baixo") risco = "medio";
          }
        }
      }

      // Contract duration check
      if (item.tipo === "contrato_aluguel") {
        const meses = campos.periodo_locacao_meses;
        if (meses !== null && meses !== undefined && meses < 12) {
          alertas.push({ tipo: "contrato_curto", mensagem: `Contrato com duração de ${meses} meses (< 12 meses)`, gravidade: "medio" });
          if (risco === "baixo") risco = "medio";
        }
      }

      // Low confidence
      if (confianca < 0.5) {
        alertas.push({ tipo: "baixa_confianca", mensagem: `Confiança da leitura OCR: ${Math.round(confianca * 100)}%`, gravidade: "medio" });
        if (risco === "baixo") risco = "medio";
      }

      let statusOcr = "leitura_concluida";
      if (confianca < 0.5) statusOcr = "baixa_confianca";
      if (divergencias.length > 0) statusOcr = "divergencia_encontrada";
      if (suspeita) statusOcr = "suspeita_fraude";
      statusOcr = "revisao_manual_pendente"; // Always require human review

      await supabase.from("document_items").update({
        texto_extraido: texto,
        confianca_ocr: confianca,
        campos_extraidos: campos,
        divergencias,
        alertas,
        risco_documental: risco,
        suspeita_fraude: suspeita,
        status_ocr: statusOcr,
        data_emissao: campos.data_emissao ? parseDateToISO(campos.data_emissao) : null,
        data_inicio_contrato: campos.data_inicio ? parseDateToISO(campos.data_inicio) : null,
        data_fim_contrato: campos.data_termino ? parseDateToISO(campos.data_termino) : null,
      } as any).eq("id", item.id);

      await loadDocItems(docAnalysis.id);
      setOcrExpanded(p => ({ ...p, [item.id]: true }));

      if (suspeita) {
        toast.error("🚨 Suspeita de fraude detectada! Verifique os alertas.");
      } else if (divergencias.length > 0) {
        toast.warning("⚠️ Divergências encontradas. Revisão manual necessária.");
      } else {
        toast.success("OCR concluído. Revisão manual pendente.");
      }
    } catch (e) {
      console.error("OCR error:", e);
      await supabase.from("document_items").update({ status_ocr: "aguardando_leitura" } as any).eq("id", item.id);
      toast.error("Erro ao processar OCR.");
    } finally {
      setOcrProcessing(p => ({ ...p, [item.id]: false }));
    }
  };

  const handleAnalystReview = async (itemId: string, action: "validado_analista" | "rejeitado") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();

    await supabase.from("document_items").update({
      status_ocr: action,
      status_documento: action === "validado_analista" ? "validado" : "rejeitado",
      revisado_por: profile?.full_name || user!.email,
      data_revisao: new Date().toISOString(),
    } as any).eq("id", itemId);

    if (docAnalysis) await loadDocItems(docAnalysis.id);
    toast.success(action === "validado_analista" ? "Documento validado pelo analista." : "Documento rejeitado.");
  };

  const handleDeleteDoc = async () => {
    if (!deleteDialog.item || !deleteMotivo.trim() || !docAnalysis) return;
    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();

      await supabase.from("document_items").update({
        file_url: null,
        file_name: null,
        documento_recebido: false,
        hash_arquivo: null,
        texto_extraido: null,
        confianca_ocr: null,
        campos_extraidos: {},
        divergencias: [],
        alertas: [],
        risco_documental: "baixo",
        suspeita_fraude: false,
        status_ocr: "aguardando_leitura",
        status_documento: "recebido",
        nome_confere: false,
        cpf_confere: false,
        endereco_confere: false,
        legivel: false,
        valido: false,
        motivo_exclusao: deleteMotivo,
        excluido_por: profile?.full_name || user!.email,
        data_exclusao: new Date().toISOString(),
        revisado_por: null,
        data_revisao: null,
      } as any).eq("id", deleteDialog.item.id);

      await loadDocItems(docAnalysis.id);
      setDeleteDialog({ open: false, item: null });
      setDeleteMotivo("");
      toast.success("Documento removido com auditoria.");
    } catch { toast.error("Erro ao excluir."); }
    finally { setDeleting(false); }
  };

  const handleChecklistChange = async (itemId: string, field: string, value: boolean) => {
    await supabase.from("document_items").update({ [field]: value } as any).eq("id", itemId);
    setDocItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
  };

  const handleItemObservacao = async (itemId: string, obs: string) => {
    await supabase.from("document_items").update({ observacao: obs } as any).eq("id", itemId);
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
        .from("document_analyses")
        .update({
          decisao_documental: decisao,
          status: decisao,
          motivo: motivo || null,
          observacao: observacao || null,
          user_name: profile?.full_name || user!.email,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", docAnalysis.id);

      if (error) { toast.error("Erro ao salvar decisão."); return; }

      setDocAnalysis({ ...docAnalysis, decisao_documental: decisao, status: decisao, motivo, observacao });
      toast.success("Decisão documental salva.");
    } catch { toast.error("Erro ao salvar decisão."); }
    finally { setSavingDecision(false); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  const filteredHistory = history.filter(h => historyFilter === "todos" || h.status === historyFilter);
  const statusInfo = (s: string) => STATUS_PROCESS.find(o => o.value === s) || STATUS_PROCESS[0];

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
              <p className="text-xs text-muted-foreground">Validação documental com OCR e detecção de fraude</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/credit")}>
              <ArrowLeft className="h-4 w-4 mr-1" />Crédito
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />Hub
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />Sair
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

          {/* ═══ TAB: Análise ═══ */}
          <TabsContent value="analise" className="space-y-6 mt-4">
            {/* Search */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />Localizar Cliente
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
                <Button variant="outline" onClick={handleClear}>
                  <Eraser className="h-4 w-4 mr-1" />Limpar
                </Button>
              </div>
            </Card>

            {/* Credit Summary */}
            {creditRef && (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />Resumo da Análise de Crédito
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                  <InfoField icon={<User className="h-3.5 w-3.5" />} label="Nome" value={creditRef.nome || "—"} />
                  <InfoField icon={<CreditCard className="h-3.5 w-3.5" />} label="CPF/CNPJ" value={formatCpfCnpj(creditRef.cpf_cnpj)} />
                  <InfoField icon={<Scale className="h-3.5 w-3.5" />} label="Faixa Final" value={normalizeFaixa(creditRef.decisao_final)} />
                  <InfoField icon={<Receipt className="h-3.5 w-3.5" />} label="Taxa Total" value={creditRef.resultado?.taxa_total !== undefined ? formatCurrency(creditRef.resultado.taxa_total) : "—"} />
                  <InfoField label="Regra" value={creditRef.regra_aplicada || "—"} />
                  <InfoField label="Data" value={new Date(creditRef.created_at).toLocaleDateString("pt-BR")} />
                  <InfoField label="Status" value={creditRef.status === "concluida" ? "Concluída" : creditRef.status} />
                </div>

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

            {/* Documents + OCR */}
            {docAnalysis && docItems.length > 0 && (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />Documentos, Checklist e OCR
                </h2>
                <div className="space-y-4">
                  {docItems.map((item) => {
                    const docType = DOC_TYPES.find(d => d.value === item.tipo);
                    const ocrStatus = OCR_STATUS_LABELS[item.status_ocr] || OCR_STATUS_LABELS.aguardando_leitura;
                    const riscoConfig = RISCO_CONFIG[item.risco_documental] || RISCO_CONFIG.baixo;
                    const RiscoIcon = riscoConfig.icon;
                    const isProcessingOcr = ocrProcessing[item.id];
                    const isExpanded = ocrExpanded[item.id];

                    const borderColor = item.suspeita_fraude
                      ? "border-destructive bg-destructive/5"
                      : item.risco_documental === "alto"
                        ? "border-destructive/50 bg-destructive/5"
                        : item.risco_documental === "medio"
                          ? "border-warning/50 bg-warning/5"
                          : item.valido
                            ? "border-accent bg-accent/5"
                            : item.documento_recebido
                              ? "border-primary/30 bg-primary/5"
                              : "border-border";

                    return (
                      <div key={item.id} className={`rounded-lg border p-4 ${borderColor}`}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {item.suspeita_fraude ? <ShieldAlert className="h-4 w-4 text-destructive" /> :
                              item.valido ? <CheckCircle2 className="h-4 w-4 text-accent" /> :
                                item.documento_recebido ? <FileCheck className="h-4 w-4 text-primary" /> :
                                  <FileX className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm font-semibold">{docType?.label || item.tipo}</span>
                            {item.file_name && (
                              <span className="text-xs text-muted-foreground">({(item.file_name || "").slice(0, 30)})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Status badges */}
                            <Badge variant="outline" className={`text-[10px] ${ocrStatus.color}`}>{ocrStatus.label}</Badge>
                            <Badge variant="outline" className={`text-[10px] ${riscoConfig.color}`}>
                              <RiscoIcon className="h-3 w-3 mr-1" />Risco {riscoConfig.label}
                            </Badge>

                            {/* Actions */}
                            {item.file_url && item.tipo !== "outro" && (
                              <Button variant="outline" size="sm" onClick={() => handleOcr(item)} disabled={isProcessingOcr} className="h-7 text-xs">
                                {isProcessingOcr ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ScanLine className="h-3 w-3 mr-1" />}
                                OCR
                              </Button>
                            )}
                            {item.file_url && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.open(item.file_url!, "_blank")}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            )}
                            {item.file_url && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setDeleteDialog({ open: true, item })}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Fraud alert */}
                        {item.suspeita_fraude && (
                          <Alert variant="destructive" className="mb-3">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle className="text-xs font-bold">🚨 Suspeita de Fraude Documental</AlertTitle>
                            <AlertDescription className="text-xs">
                              {(item.alertas || []).filter((a: any) => a.gravidade === "alto").map((a: any, i: number) => (
                                <div key={i}>• {a.mensagem}</div>
                              ))}
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Alerts */}
                        {!item.suspeita_fraude && (item.alertas || []).length > 0 && (
                          <div className="mb-3 space-y-1">
                            {(item.alertas || []).map((a: any, i: number) => (
                              <div key={i} className={`text-xs flex items-center gap-1 ${a.gravidade === "alto" ? "text-destructive" : "text-warning"}`}>
                                <AlertTriangle className="h-3 w-3" />{a.mensagem}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload */}
                        {!item.file_url && (
                          <div className="mb-3">
                            <label className="cursor-pointer">
                              <div className="border-2 border-dashed border-border rounded px-4 py-3 text-center hover:border-primary/40 transition-colors">
                                <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                                <p className="text-xs text-muted-foreground">Arraste ou clique para anexar (PDF, JPG, PNG)</p>
                              </div>
                              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadFile(item.id, item.tipo, f);
                              }} />
                            </label>
                          </div>
                        )}

                        {/* OCR Results */}
                        {item.campos_extraidos && Object.keys(item.campos_extraidos).length > 0 && (
                          <div className="mb-3">
                            <button
                              className="flex items-center gap-1 text-xs font-semibold text-primary mb-2"
                              onClick={() => setOcrExpanded(p => ({ ...p, [item.id]: !p[item.id] }))}
                            >
                              <ScanLine className="h-3 w-3" />
                              Dados extraídos pelo OCR
                              {isExpanded ? " ▾" : " ▸"}
                              {item.confianca_ocr != null && (
                                <span className={`ml-2 ${item.confianca_ocr < 0.5 ? "text-destructive" : item.confianca_ocr < 0.8 ? "text-warning" : "text-accent"}`}>
                                  ({Math.round(item.confianca_ocr * 100)}% confiança)
                                </span>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="rounded border border-border bg-card p-3 space-y-2">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {Object.entries(item.campos_extraidos).filter(([k]) => k !== "texto_completo").map(([key, val]) => (
                                    <div key={key}>
                                      <p className="text-[10px] text-muted-foreground uppercase">{key.replace(/_/g, " ")}</p>
                                      <p className="text-xs font-medium">{String(val ?? "—")}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* Divergences */}
                                {(item.divergencias || []).length > 0 && (
                                  <div className="border-t border-border pt-2 mt-2">
                                    <p className="text-[10px] font-bold text-destructive uppercase mb-1">Divergências</p>
                                    {(item.divergencias || []).map((d: any, i: number) => (
                                      <div key={i} className="text-xs text-destructive flex gap-2">
                                        <span className="font-medium">{d.campo}:</span>
                                        <span>esperado "{d.esperado}" → encontrado "{d.encontrado}"</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Analyst review buttons */}
                                {(item.status_ocr === "revisao_manual_pendente" || item.status_ocr === "divergencia_encontrada" || item.status_ocr === "suspeita_fraude" || item.status_ocr === "baixa_confianca") && (
                                  <div className="border-t border-border pt-2 mt-2 flex gap-2">
                                    <Button size="sm" variant="outline" className="h-7 text-xs text-accent border-accent" onClick={() => handleAnalystReview(item.id, "validado_analista")}>
                                      <CheckCircle2 className="h-3 w-3 mr-1" />Validar
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive" onClick={() => handleAnalystReview(item.id, "rejeitado")}>
                                      <XCircle className="h-3 w-3 mr-1" />Rejeitar
                                    </Button>
                                  </div>
                                )}

                                {item.revisado_por && (
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    Revisado por: {item.revisado_por} em {item.data_revisao ? new Date(item.data_revisao).toLocaleString("pt-BR") : "—"}
                                  </div>
                                )}
                              </div>
                            )}
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
                  <Scale className="h-4 w-4 text-primary" />Decisão Documental Final
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
                  <FileCheck className="h-4 w-4 text-primary" />Monitoramento Documental
                </h2>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Status:</Label>
                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="w-[200px] bg-card h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {STATUS_PROCESS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(o) => { if (!o) { setDeleteDialog({ open: false, item: null }); setDeleteMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" />Excluir Documento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Arquivo: <span className="font-medium text-foreground">{deleteDialog.item?.file_name}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo da exclusão *</Label>
              <Textarea
                value={deleteMotivo}
                onChange={(e) => setDeleteMotivo(e.target.value)}
                placeholder="Informe o motivo obrigatório para exclusão..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialog({ open: false, item: null }); setDeleteMotivo(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteDoc} disabled={!deleteMotivo.trim() || deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Helpers ──
const InfoField = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-1 mb-0.5">
      {icon && <span className="text-primary">{icon}</span>}
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
    <p className="text-sm font-medium text-foreground">{value}</p>
  </div>
);

function parseDate(str: string): Date | null {
  const parts = str.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return null;
}

function parseDateToISO(str: string): string | null {
  const d = parseDate(str);
  return d ? d.toISOString().split("T")[0] : null;
}

export default DocumentAnalysis;
