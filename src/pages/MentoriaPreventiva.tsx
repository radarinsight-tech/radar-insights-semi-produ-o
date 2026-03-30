import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import {
  ArrowLeft, ShieldCheck, Upload, Loader2, FileText,
  CheckCircle2, AlertTriangle, ThumbsUp, Lightbulb, ChevronDown, ChevronUp,
  Hash, User, Calendar, Tag, Info, Shuffle, Volume2, VolumeX, X, Play,
  Eye, BarChart3, ShieldAlert, Search, FilterX
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import { extractAllMetadata, type PdfMetadata } from "@/lib/mentoriaMetadata";
import logoSymbol from "@/assets/logo-symbol.png";
import PreventiveInsights from "@/components/PreventiveInsights";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import MentoriaAttendenteHeader from "@/components/MentoriaAttendenteHeader";
import MentoriaAttendenteHistory from "@/components/MentoriaAttendenteHistory";

// ── Types ──────────────────────────────────────────────────────────────

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

type FileStatus = "pendente" | "lido" | "analisado" | "erro";

interface LabFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  text?: string;
  result?: PreventiveResult;
  error?: string;
  atendente?: string;
  protocolo?: string;
  data?: string;
  canal?: string;
  hasAudio?: boolean;
  tipo?: string;
  selected: boolean; // for sampling
}

// ── Sampling logic ─────────────────────────────────────────────────────

function autoSample(files: LabFile[], minPerAtendente = 2): Set<string> {
  // Only consider readable files without audio
  const eligible = files.filter((f) => f.status === "lido" && !f.hasAudio);
  if (eligible.length === 0) return new Set();

  // Group by atendente
  const byAtendente = new Map<string, LabFile[]>();
  for (const f of eligible) {
    const key = f.atendente || "__desconhecido__";
    if (!byAtendente.has(key)) byAtendente.set(key, []);
    byAtendente.get(key)!.push(f);
  }

  const selected = new Set<string>();

  for (const [, group] of byAtendente) {
    // Shuffle
    const shuffled = [...group].sort(() => Math.random() - 0.5);
    // Pick min(minPerAtendente, available)
    const count = Math.min(minPerAtendente, shuffled.length);
    for (let i = 0; i < count; i++) {
      selected.add(shuffled[i].id);
    }
  }

  return selected;
}

// ── Date parser helper ──────────────────────────────────────────────────
function parseFileDate(dateStr: string): Date | null {
  // dd/mm/yyyy
  const br = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  // yyyy-mm-dd
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}

// ── Component ──────────────────────────────────────────────────────────

const statusConfig: Record<FileStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  lido: { label: "Lido", color: "bg-blue-100 text-blue-700" },
  analisado: { label: "Analisado", color: "bg-accent/15 text-accent" },
  erro: { label: "Erro", color: "bg-destructive/15 text-destructive" },
};

const MentoriaPreventiva = () => {
  const navigate = useNavigate();
  const { loading: permLoading, canAccess, isMentoriaAtendente, isAdmin, attendantId, attendantName } = useUserPermissions();
  const isAttendenteMode = isMentoriaAtendente && !isAdmin;
  const MONTHLY_LIMIT = 10;

  const [files, setFiles] = useState<LabFile[]>([]);
  const [readingIds, setReadingIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [activeResult, setActiveResult] = useState<PreventiveResult | null>(null);
  const [showCriterios, setShowCriterios] = useState(false);
  const [sampled, setSampled] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterPeriodo, setFilterPeriodo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  // Load monthly count for atendente mode
  useEffect(() => {
    if (!isAttendenteMode) return;
    const loadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("preventive_mentorings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString());
      setMonthlyCount(count ?? 0);
    };
    loadCount();
  }, [isAttendenteMode]);

  // Also get currentUserId for non-atendente mode
  useEffect(() => {
    if (isAttendenteMode) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, [isAttendenteMode]);

  const isMonthlyLimitReached = isAttendenteMode && monthlyCount >= MONTHLY_LIMIT;

  // ── Name normalization for ownership check ─────────────────────────
  const normalizeName = (name: string) =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  const namesMatch = (pdfRaw: string, linkedRaw: string): boolean => {
    const pdfNorm = normalizeName(pdfRaw);
    const linkedNorm = normalizeName(linkedRaw);
    // Direct inclusion check
    if (pdfNorm.includes(linkedNorm) || linkedNorm.includes(pdfNorm)) return true;
    // Part-by-part: every part of the linked name must appear in the PDF name
    const linkedParts = linkedNorm.split(" ").filter(p => p.length >= 2);
    const pdfParts = pdfNorm.split(" ").filter(p => p.length >= 2);
    if (linkedParts.length >= 2) {
      const allLinkedInPdf = linkedParts.every(lp => pdfParts.some(pp => pp === lp));
      if (allLinkedInPdf) return true;
    }
    if (pdfParts.length >= 2) {
      const allPdfInLinked = pdfParts.every(pp => linkedParts.some(lp => lp === pp));
      if (allPdfInLinked) return true;
    }
    // First name match as minimum
    if (linkedParts.length > 0 && pdfParts.length > 0 && linkedParts[0] === pdfParts[0]) return true;
    return false;
  };

  // ── File reading ─────────────────────────────────────────────────────
  const readFile = useCallback(async (labFile: LabFile) => {
    setReadingIds((prev) => new Set(prev).add(labFile.id));
    try {
      const text = await extractTextFromPdf(labFile.file);
      if (!text.trim()) {
        setFiles((prev) => prev.map((f) => f.id === labFile.id ? { ...f, status: "erro" as FileStatus, error: "Não foi possível extrair texto." } : f));
        return;
      }
      const metadata = extractAllMetadata(text);

      // DEBUG: temporary log for ownership validation
      console.log("[DEBUG namesMatch]", {
        "metadata.atendente": metadata.atendente,
        "attendantName": attendantName,
        "isAttendenteMode": isAttendenteMode,
        "namesMatch result": metadata.atendente && attendantName ? namesMatch(metadata.atendente, attendantName) : "skipped (missing value)",
      });

      // PDF ownership validation for atendente mode (pre-analysis check)
      // Only block if metadata.atendente was successfully extracted AND doesn't match
      // If metadata.atendente is undefined/empty, allow through — post-analysis check will validate
      if (isAttendenteMode && attendantName && metadata.atendente && metadata.atendente.trim()) {
        if (!namesMatch(metadata.atendente, attendantName)) {
          console.log("[DEBUG readFile] Blocked by pre-analysis check:", { pdfAtendente: metadata.atendente, attendantName });
          setFiles((prev) => prev.map((f) => f.id === labFile.id ? { ...f, status: "erro" as FileStatus, error: "Este atendimento pertence a outro colaborador." } : f));
          toast.error("⚠️ Este atendimento pertence a outro colaborador e não pode ser importado aqui. Você só pode analisar seus próprios atendimentos.");
          return;
        }
      }

      setFiles((prev) => prev.map((f) => f.id === labFile.id ? { ...f, status: "lido" as FileStatus, text, ...metadata } : f));
    } catch {
      setFiles((prev) => prev.map((f) => f.id === labFile.id ? { ...f, status: "erro" as FileStatus, error: "Falha na leitura." } : f));
    } finally {
      setReadingIds((prev) => { const n = new Set(prev); n.delete(labFile.id); return n; });
    }
  }, [isAttendenteMode, attendantName]);

  // ── Upload handler (PDF + ZIP) ───────────────────────────────────────
  const handleFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const zips = fileArray.filter((f) => f.name.toLowerCase().endsWith(".zip"));
    const pdfs = fileArray.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const invalid = fileArray.filter((f) => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      return ext !== ".pdf" && ext !== ".zip";
    });
    if (invalid.length > 0) {
      toast.error("Envie apenas PDFs ou ZIPs.");
      return;
    }

    let allPdfs = [...pdfs];

    for (const zf of zips) {
      try {
        const zip = await JSZip.loadAsync(zf);
        const entries = Object.entries(zip.files).filter(([, e]) => !e.dir);
        for (const [name, entry] of entries) {
          if (name.toLowerCase().endsWith(".pdf")) {
            const blob = await entry.async("blob");
            const fileName = name.split("/").pop() || name;
            allPdfs.push(new File([blob], fileName, { type: "application/pdf" }));
          }
        }
      } catch {
        toast.error("Não foi possível abrir o ZIP.");
      }
    }

    if (allPdfs.length === 0) {
      toast.error("Nenhum PDF encontrado.");
      return;
    }

    setSampled(false);
    const entries: LabFile[] = allPdfs.map((pdf) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file: pdf,
      name: pdf.name,
      size: pdf.size,
      status: "pendente" as FileStatus,
      selected: false,
    }));

    setFiles((prev) => [...prev, ...entries]);
    toast.success(`${allPdfs.length} arquivo(s) importado(s). Leitura automática iniciada.`);
    entries.forEach((e) => readFile(e));
  }, [readFile]);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };

  // ── Auto sample ──────────────────────────────────────────────────────
  const runAutoSample = useCallback(() => {
    const selectedIds = autoSample(files);
    setFiles((prev) => prev.map((f) => ({ ...f, selected: selectedIds.has(f.id) })));
    setSampled(true);
    const excluded = files.filter((f) => f.status === "lido" && f.hasAudio).length;
    toast.success(`Amostragem concluída: ${selectedIds.size} atendimento(s) selecionado(s).${excluded > 0 ? ` ${excluded} com áudio excluído(s).` : ""}`);
  }, [files]);

  // ── Manual toggle ────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, selected: !f.selected } : f));
  };

  // ── Stats ────────────────────────────────────────────────────────────
  const readyFiles = useMemo(() => files.filter((f) => f.status === "lido"), [files]);
  const selectedFiles = useMemo(() => files.filter((f) => f.selected), [files]);
  const isReading = readingIds.size > 0;
  const readyCount = readyFiles.length;
  const selectedCount = selectedFiles.length;
  const audioCount = useMemo(() => readyFiles.filter((f) => f.hasAudio).length, [readyFiles]);
  const analyzedCount = useMemo(() => files.filter((f) => f.status === "analisado").length, [files]);

  // Atendentes summary
  const atendenteSummary = useMemo(() => {
    const map = new Map<string, { total: number; selected: number }>();
    for (const f of files.filter((x) => x.status === "lido")) {
      const key = f.atendente || "Não identificado";
      if (!map.has(key)) map.set(key, { total: 0, selected: 0 });
      map.get(key)!.total++;
      if (f.selected) map.get(key)!.selected++;
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [files]);

  // ── Filtered files for table display ────────────────────────────────
  const hasActiveFilters = filterSearch !== "" || filterPeriodo !== "todos" || filterStatus !== "todos";

  const filteredFiles = useMemo(() => {
    let result = files;

    // Text search
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      result = result.filter((f) =>
        f.name.toLowerCase().includes(q) ||
        (f.protocolo && f.protocolo.toLowerCase().includes(q))
      );
    }

    // Period filter
    if (filterPeriodo !== "todos") {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let cutoff: Date;
      if (filterPeriodo === "hoje") {
        cutoff = todayStart;
      } else if (filterPeriodo === "semana") {
        const day = todayStart.getDay();
        cutoff = new Date(todayStart);
        cutoff.setDate(cutoff.getDate() - (day === 0 ? 6 : day - 1));
      } else if (filterPeriodo === "mes") {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        // mes_anterior
        cutoff = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endPrev = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        result = result.filter((f) => {
          if (!f.data) return false;
          // Try to parse dd/mm/yyyy or yyyy-mm-dd
          const parsed = parseFileDate(f.data);
          return parsed && parsed >= cutoff && parsed <= endPrev;
        });
        return result;
      }
      result = result.filter((f) => {
        if (!f.data) return false;
        const parsed = parseFileDate(f.data);
        return parsed && parsed >= cutoff;
      });
    }

    // Status filter
    if (filterStatus !== "todos") {
      result = result.filter((f) => f.status === filterStatus);
    }

    return result;
  }, [files, filterSearch, filterPeriodo, filterStatus]);

  const clearFilters = () => {
    setFilterSearch("");
    setFilterPeriodo("todos");
    setFilterStatus("todos");
  };

  // ── Batch analyze selected ───────────────────────────────────────────
  const handleBatchAnalyze = async () => {
    const toAnalyze = selectedFiles.filter((f) => f.status === "lido" && f.text);
    if (toAnalyze.length === 0) {
      toast.error("Nenhum atendimento selecionado com texto extraído.");
      return;
    }

    // Check monthly limit for atendente mode
    if (isAttendenteMode && (monthlyCount + toAnalyze.length) > MONTHLY_LIMIT) {
      toast.error(`Limite mensal de ${MONTHLY_LIMIT} mentorias será excedido. Você pode analisar mais ${Math.max(0, MONTHLY_LIMIT - monthlyCount)} atendimento(s).`);
      return;
    }

    setAnalyzing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado."); setAnalyzing(false); return; }

    let successCount = 0;
    for (const f of toAnalyze) {
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("analyze-preventive", {
          body: {
            text: f.text,
            ...(isAttendenteMode ? { attendant_id: attendantId } : {}),
          },
        });
        if (fnError) throw fnError;
        const res = fnData as PreventiveResult;

        // Post-analysis ownership validation: check res.atendente against linked attendant
        if (isAttendenteMode && attendantName && res.atendente && res.atendente.trim()) {
          if (!namesMatch(res.atendente, attendantName)) {
            console.log("[DEBUG post-analysis] Blocked by post-analysis check:", { resAtendente: res.atendente, attendantName });
            setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, status: "erro" as FileStatus, error: "Este atendimento pertence a outro colaborador." } : x));
            toast.error("⚠️ A IA identificou que este atendimento pertence a outro colaborador.");
            continue;
          }
        }

        setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, status: "analisado" as FileStatus, result: res, atendente: x.atendente || res.atendente || undefined } : x));

        const { data: insertedData } = await supabase.from("preventive_mentorings").insert({
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
        } as any).select("id").single();

        successCount++;
        if (isAttendenteMode) setMonthlyCount((prev) => prev + 1);
      } catch (err: any) {
        console.error(err);
        setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, status: "erro" as FileStatus, error: err.message } : x));
      }
    }

    setAnalyzing(false);
    toast.success(`${successCount} de ${toAnalyze.length} análise(s) concluída(s).`);
  };

  // ── Colors ───────────────────────────────────────────────────────────
  const classColor = (c: string) => {
    if (c === "Excelente") return "text-emerald-500";
    if (c === "Bom atendimento") return "text-blue-500";
    if (c === "Regular") return "text-amber-500";
    return "text-destructive";
  };

  // ── Access guard ──────────────────────────────────────────────────────
  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check access: must have auditoria, admin, or mentoria_atendente
  if (!canAccess("auditoria") && !canAccess("mentoria_atendente")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md w-full mx-4 text-center space-y-4">
          <div className="p-3 rounded-full bg-destructive/10 w-fit mx-auto">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            Você não possui permissão para acessar este módulo.
          </p>
          <Button onClick={() => navigate("/hub")} className="w-full">Voltar ao início</Button>
        </Card>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — different for atendente mode */}
      {isAttendenteMode ? (
        <MentoriaAttendenteHeader
          attendantName={attendantName || "Atendente"}
          monthlyCount={monthlyCount}
          monthlyLimit={MONTHLY_LIMIT}
        />
      ) : (
        <header className="border-b border-border bg-card px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoSymbol} alt="Radar Insight" className="h-7 w-7 rounded-lg object-contain" />
              <h1 className="text-lg font-bold text-primary">Mentoria Preventiva</h1>
              <Badge variant="outline" className="text-xs">Beta</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/hub")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </div>
        </header>
      )}

      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <Info className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Ambiente de desenvolvimento</p>
              <p className="text-xs text-muted-foreground">
                Análises preventivas não geram nota oficial, não impactam bônus e não entram no ranking mensal.
              </p>
            </div>
          </div>

          {/* Upload zone */}
          {files.length === 0 && !isMonthlyLimitReached && (
            <Card
              className="p-8 text-center cursor-pointer border-2 border-dashed border-border hover:border-primary/40 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground mb-1">Importar Atendimentos</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Arraste PDFs ou um ZIP com atendimentos para iniciar
              </p>
              <Button variant="outline" size="sm">
                <Upload className="h-3 w-3 mr-1" /> Selecionar Arquivos
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.zip"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </Card>
          )}

          {/* Files imported: sampling controls */}
          {files.length > 0 && (
            <>
              {/* Sticky panel: actions + stats */}
              <div className="sticky top-0 z-20 bg-background pb-3 space-y-3">
              {/* Actions bar */}
              <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                    >
                      <Upload className="h-3 w-3 mr-1" /> Importar mais
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs"><p>Importar novos PDFs ou ZIPs de atendimentos</p></TooltipContent>
                </Tooltip>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.zip"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={runAutoSample}
                      disabled={readyCount === 0 || isReading}
                    >
                      <Shuffle className="h-3 w-3 mr-1" /> Amostragem Automática
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs"><p>Seleciona automaticamente 2 atendimentos por atendente, excluindo os com áudio</p></TooltipContent>
                </Tooltip>

                {selectedCount > 0 && (
                  <Button
                    size="sm"
                    onClick={handleBatchAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Analisando...</>
                    ) : (
                      <><Play className="h-3 w-3 mr-1" /> Analisar {selectedCount} selecionado(s)</>
                    )}
                  </Button>
                )}

                {analyzedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowInsights(!showInsights); setActiveResult(null); }}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" /> {showInsights ? "Ocultar Insights" : "Ver Insights"}
                  </Button>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setFiles([]); setSampled(false); setActiveResult(null); setShowInsights(false); }}
                    >
                      <X className="h-3 w-3 mr-1" /> Limpar tudo
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs"><p>Remove todos os arquivos importados da lista atual</p></TooltipContent>
                </Tooltip>
              </div>
              </TooltipProvider>

              {/* Stats cards */}
              <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="p-3 text-center cursor-default">
                      <p className="text-2xl font-bold text-foreground">{files.length}</p>
                      <p className="text-[10px] text-muted-foreground">Total importado</p>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs"><p>Total de arquivos carregados nesta sessão</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="p-3 text-center cursor-default">
                      <p className="text-2xl font-bold text-foreground">{readyCount}</p>
                      <p className="text-[10px] text-muted-foreground">Lidos</p>
                      {isReading && <Loader2 className="h-3 w-3 animate-spin text-primary mx-auto mt-1" />}
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs"><p>Arquivos com texto extraído com sucesso</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="p-3 text-center cursor-default">
                      <p className="text-2xl font-bold text-amber-500">{audioCount}</p>
                      <p className="text-[10px] text-muted-foreground">Com áudio (excluídos)</p>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs"><p>Arquivos ignorados por conterem áudio — não entram na análise</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="p-3 text-center cursor-default">
                      <p className="text-2xl font-bold text-primary">{selectedCount}</p>
                      <p className="text-[10px] text-muted-foreground">Selecionados</p>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs"><p>Arquivos marcados para análise</p></TooltipContent>
                </Tooltip>
              </div>
              </TooltipProvider>
              </div>

              {/* Atendente distribution */}
              {sampled && atendenteSummary.length > 0 && (
                <Card className="p-4 space-y-2">
                  <h3 className="text-xs font-bold text-foreground">Distribuição por Atendente</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {atendenteSummary.map(([name, { total, selected }]) => (
                      <div key={name} className="flex items-center justify-between p-2 rounded bg-muted/40 border border-border">
                        <span className="text-xs text-foreground truncate">{name}</span>
                        <Badge variant={selected > 0 ? "default" : "secondary"} className="text-[10px] ml-2 shrink-0">
                          {selected}/{total}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* File table */}
              <Card className="overflow-hidden">
              {/* Filter bar */}
              <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap items-center gap-3 p-3 border-b border-border bg-muted/20">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative flex-1 min-w-[180px] max-w-[280px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar arquivo ou protocolo…"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="h-8 pl-8 text-xs bg-card"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs"><p>Busque pelo nome do arquivo ou número do protocolo</p></TooltipContent>
                </Tooltip>
                <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                  <SelectTrigger className="w-[140px] h-8 text-xs bg-card">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="semana">Esta semana</SelectItem>
                    <SelectItem value="mes">Este mês</SelectItem>
                    <SelectItem value="mes_anterior">Mês anterior</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px] h-8 text-xs bg-card">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="lido">Lido</SelectItem>
                    <SelectItem value="analisado">Analisado</SelectItem>
                    <SelectItem value="erro">Erro</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
                    <FilterX className="h-3.5 w-3.5" /> Limpar filtros
                  </Button>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {filteredFiles.length} de {files.length} arquivo(s)
                </span>
              </div>
              </TooltipProvider>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <TooltipProvider delayDuration={200}>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="p-2 w-8 text-center">
                          <Checkbox
                            checked={files.length > 0 && files.every((f) => f.selected)}
                            onCheckedChange={(checked) => {
                              setFiles((prev) => prev.map((f) => ({ ...f, selected: !!checked })));
                            }}
                          />
                        </th>
                        <th className="p-2 text-left font-medium text-muted-foreground">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-default">Arquivo</span></TooltipTrigger>
                          <TooltipContent className="bg-foreground text-background text-xs"><p>Nome do arquivo PDF importado</p></TooltipContent></Tooltip>
                        </th>
                        <th className="p-2 text-left font-medium text-muted-foreground">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-default">Atendente</span></TooltipTrigger>
                          <TooltipContent className="bg-foreground text-background text-xs"><p>Nome do atendente extraído do PDF</p></TooltipContent></Tooltip>
                        </th>
                        <th className="p-2 text-left font-medium text-muted-foreground">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-default">Protocolo</span></TooltipTrigger>
                          <TooltipContent className="bg-foreground text-background text-xs"><p>Número do protocolo do atendimento</p></TooltipContent></Tooltip>
                        </th>
                        <th className="p-2 text-center font-medium text-muted-foreground">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-default">Áudio</span></TooltipTrigger>
                          <TooltipContent className="bg-foreground text-background text-xs"><p>Indica se o atendimento contém gravação de áudio</p></TooltipContent></Tooltip>
                        </th>
                        <th className="p-2 text-center font-medium text-muted-foreground">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-default">Status</span></TooltipTrigger>
                          <TooltipContent className="bg-foreground text-background text-xs"><p>Status atual da análise do arquivo</p></TooltipContent></Tooltip>
                        </th>
                        <th className="p-2 text-center font-medium text-muted-foreground">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-default">Ação</span></TooltipTrigger>
                          <TooltipContent className="bg-foreground text-background text-xs"><p>Ações disponíveis para este arquivo</p></TooltipContent></Tooltip>
                        </th>
                      </tr>
                    </TooltipProvider>
                    </thead>
                    <tbody>
                      {filteredFiles.map((f) => (
                        <tr
                          key={f.id}
                          className={`border-b border-border/50 transition-colors ${
                            f.selected ? "bg-primary/5" : "hover:bg-muted/20"
                          } ${f.hasAudio ? "opacity-60" : ""}`}
                        >
                          <td className="p-2 text-center">
                            <Checkbox
                              checked={f.selected}
                              disabled={f.hasAudio}
                              onCheckedChange={() => toggleSelect(f.id)}
                            />
                          </td>
                          <td className="p-2 max-w-[200px] truncate text-foreground">{f.name}</td>
                          <td className="p-2 text-foreground">{f.atendente || "—"}</td>
                          <td className="p-2 text-foreground font-mono text-[10px]">{f.protocolo || "—"}</td>
                          <td className="p-2 text-center">
                            {f.hasAudio ? (
                              <Badge variant="destructive" className="text-[10px]">
                                <Volume2 className="h-2.5 w-2.5 mr-0.5" /> Sim
                              </Badge>
                            ) : f.status !== "pendente" ? (
                              <Badge variant="outline" className="text-[10px]">
                                <VolumeX className="h-2.5 w-2.5 mr-0.5" /> Não
                              </Badge>
                            ) : null}
                          </td>
                          <td className="p-2 text-center">
                            {readingIds.has(f.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin text-primary mx-auto" />
                            ) : (
                              <Badge className={`text-[10px] ${statusConfig[f.status].color}`}>
                                {statusConfig[f.status].label}
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {f.status === "analisado" && f.result && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => setActiveResult(f.result!)}
                              >
                                <Eye className="h-3 w-3 mr-0.5" /> Ver
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {/* Insights panel */}
          {showInsights && analyzedCount > 0 && !activeResult && (
            <PreventiveInsights
              files={files.filter((f) => f.status === "analisado" && f.result).map((f) => ({
                id: f.id,
                name: f.name,
                atendente: f.atendente,
                result: f.result,
              }))}
            />
          )}

          {/* Result detail panel */}
          {activeResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Resultado da Mentoria Preventiva</h2>
                <Button variant="ghost" size="sm" onClick={() => setActiveResult(null)}>
                  <X className="h-3 w-3 mr-1" /> Fechar
                </Button>
              </div>

              {!activeResult.viavel ? (
                <Card className="p-8 text-center space-y-4">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                  <h3 className="text-base font-bold text-foreground">Análise Inviável</h3>
                  <p className="text-sm text-muted-foreground">{activeResult.motivoInviavel}</p>
                </Card>
              ) : (
                <>
                  {/* Header */}
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
                           {activeResult.notaInterna != null ? (activeResult.notaInterna > 10 ? (activeResult.notaInterna / 10).toFixed(1) : activeResult.notaInterna.toFixed(1)) : "—"}
                         </p>
                        <p className={`text-xs font-medium ${classColor(activeResult.classificacaoInterna)}`}>
                          {activeResult.classificacaoInterna}
                        </p>
                        <Badge variant="outline" className="mt-2 text-[10px]">Não oficial</Badge>
                      </div>
                    </div>
                  </Card>

                  {/* Unofficial note badge for atendente */}
                  {isAttendenteMode && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <span className="text-base">📌</span>
                      <p className="text-xs text-amber-700">
                        Esta nota é para sua mentoria pessoal e não tem caráter oficial.
                        Ela não afeta seu bônus nem sua avaliação formal.
                      </p>
                    </div>
                  )}

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

                  {/* Oportunidades */}
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

                  {/* Critérios */}
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
                </>
              )}
            </div>
          )}

          {/* Atendente History Section */}
          {isAttendenteMode && currentUserId && !activeResult && (
            <MentoriaAttendenteHistory userId={currentUserId} />
          )}
        </div>
      </main>
    </div>
  );
};

export default MentoriaPreventiva;
