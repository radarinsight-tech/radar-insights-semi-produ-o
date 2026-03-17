import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { format } from "date-fns";
import {
  ArrowLeft, LogOut, Upload, FileText, Trash2, Eye, Play, Loader2,
  Search, X, Filter, Volume2, VolumeX, BookOpen, Archive, Package, Clock, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, Info, CalendarIcon, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatDateBR, notaToScale10, formatNota } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import logoSymbol from "@/assets/logo-symbol.png";
import { toast } from "sonner";
import MentoriaInsights from "@/components/MentoriaInsights";
import MentoriaCharts from "@/components/MentoriaCharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ConversationView from "@/components/ConversationView";
import MentoriaDetailDialog from "@/components/MentoriaDetailDialog";

type FileStatus = "pendente" | "lido" | "analisado" | "erro";

type BatchStatus = "recebido" | "extraindo_arquivos" | "organizando_atendimentos" | "pronto_para_curadoria" | "em_analise" | "concluido" | "erro";

interface BatchInfo {
  id: string;
  batchCode: string;
  createdAt: Date;
  sourceType: "pdf" | "zip";
  originalFileName?: string;
  totalFilesInSource: number;
  totalPdfs: number;
  ignoredFiles: number;
  status: BatchStatus;
}

const batchStatusConfig: Record<BatchStatus, { label: string; icon: typeof Package; color: string }> = {
  recebido: { label: "Recebido", icon: Package, color: "text-muted-foreground" },
  extraindo_arquivos: { label: "Extraindo arquivos", icon: Loader2, color: "text-blue-600" },
  organizando_atendimentos: { label: "Organizando atendimentos", icon: Clock, color: "text-blue-600" },
  pronto_para_curadoria: { label: "Pronto para curadoria", icon: CheckCircle2, color: "text-primary" },
  em_analise: { label: "Em análise", icon: Loader2, color: "text-warning" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-accent" },
  erro: { label: "Erro", icon: AlertTriangle, color: "text-destructive" },
};

interface LabFile {
  id: string;
  file: File;
  name: string;
  size: number;
  addedAt: Date;
  status: FileStatus;
  text?: string;
  result?: any;
  error?: string;
  atendente?: string;
  protocolo?: string;
  data?: string;
  canal?: string;
  hasAudio?: boolean;
  tipo?: string;
  batchId?: string;
  batchFileId?: string;
  storagePath?: string;
  analyzedAt?: Date;
}

const statusConfig: Record<FileStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  lido: { label: "Lido", color: "bg-blue-100 text-blue-700" },
  analisado: { label: "Analisado", color: "bg-accent/15 text-accent" },
  erro: { label: "Erro", color: "bg-destructive/15 text-destructive" },
};

import { extractAllMetadata } from "@/lib/mentoriaMetadata";

const IMPORT_LIMIT = 1000;
const IMPORT_RECOMMENDED = 500;
const ANALYZE_LIMIT = 50;
const PAGE_SIZE = 30;

const MentoriaLab = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<LabFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [readingIds, setReadingIds] = useState<Set<string>>(new Set());
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [sideFile, setSideFile] = useState<LabFile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAnalyzeWarning, setShowAnalyzeWarning] = useState(false);
  const [mentoriaFile, setMentoriaFile] = useState<LabFile | null>(null);
  const [showCharts, setShowCharts] = useState(false);

  // Filters
  const [filterAtendente, setFilterAtendente] = useState("todos");
  const [filterPeriodoFrom, setFilterPeriodoFrom] = useState<Date | undefined>();
  const [filterPeriodoTo, setFilterPeriodoTo] = useState<Date | undefined>();
  const [filterAuditoriaFrom, setFilterAuditoriaFrom] = useState<Date | undefined>();
  const [filterAuditoriaTo, setFilterAuditoriaTo] = useState<Date | undefined>();
  const [filterCanal, setFilterCanal] = useState("todos");
  const [filterAudio, setFilterAudio] = useState("todos");

  const inputRef = useRef<HTMLInputElement>(null);

  // Derived unique values for filter dropdowns
  const atendentes = useMemo(() => {
    const set = new Set(files.map((f) => f.atendente).filter(Boolean) as string[]);
    return [...set].sort();
  }, [files]);

  const canais = useMemo(() => {
    const set = new Set(files.map((f) => f.canal).filter(Boolean) as string[]);
    return [...set].sort();
  }, [files]);

  // Auto-read a file + sync metadata to DB
  const readFile = useCallback(async (labFile: LabFile) => {
    setReadingIds((prev) => new Set(prev).add(labFile.id));
    try {
      const text = await extractTextFromPdf(labFile.file);
      if (!text.trim()) {
        setFiles((prev) =>
          prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Não foi possível extrair texto deste PDF." } : f))
        );
        if (labFile.batchFileId) {
          await supabase.from("mentoria_batch_files").update({ status: "error", error_message: "Não foi possível extrair texto deste PDF." } as any).eq("id", labFile.batchFileId);
        }
        return;
      }
      const metadata = extractAllMetadata(text);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === labFile.id
            ? { ...f, status: "lido", text, ...metadata }
            : f
        )
      );

      // Sync to DB
      if (labFile.batchFileId) {
        await supabase.from("mentoria_batch_files").update({
          status: "read",
          protocolo: metadata.protocolo,
          atendente: metadata.atendente,
          data_atendimento: metadata.data,
          canal: metadata.canal,
          has_audio: metadata.hasAudio,
        } as any).eq("id", labFile.batchFileId);
      }
    } catch {
      setFiles((prev) =>
        prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Não foi possível ler este arquivo. Verifique se o PDF é válido." } : f))
      );
      if (labFile.batchFileId) {
        await supabase.from("mentoria_batch_files").update({ status: "error", error_message: "Falha na leitura do PDF" } as any).eq("id", labFile.batchFileId);
      }
    } finally {
      setReadingIds((prev) => {
        const next = new Set(prev);
        next.delete(labFile.id);
        return next;
      });
    }
  }, []);

  // Extract PDFs from a ZIP file with detailed reporting
  const extractPdfsFromZip = useCallback(async (zipFile: File): Promise<{ pdfs: File[]; totalEntries: number; ignored: number }> => {
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const allEntries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
      const totalEntries = allEntries.length;

      if (totalEntries === 0) {
        toast.error("O arquivo ZIP está vazio. Verifique o conteúdo e tente novamente.");
        return { pdfs: [], totalEntries: 0, ignored: 0 };
      }

      const pdfEntries = allEntries.filter(([name]) => name.toLowerCase().endsWith(".pdf"));
      const ignored = totalEntries - pdfEntries.length;

      const pdfFiles: File[] = [];
      for (const [name, entry] of pdfEntries) {
        const blob = await entry.async("blob");
        const fileName = name.split("/").pop() || name;
        pdfFiles.push(new File([blob], fileName, { type: "application/pdf" }));
      }

      return { pdfs: pdfFiles, totalEntries, ignored };
    } catch {
      toast.error("Não foi possível abrir o ZIP enviado. Verifique o arquivo e tente novamente.");
      return { pdfs: [], totalEntries: 0, ignored: 0 };
    }
  }, []);

  // Generate batch code: lote-YYYY-MM-NNN
  const generateBatchCode = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    return `lote-${y}-${m}-${seq}`;
  }, []);

  // Helper to update batch status both locally and in DB
  const updateBatchStatus = useCallback(async (batchId: string, status: BatchStatus) => {
    setBatchInfo((prev) => prev ? { ...prev, status } : prev);
    await supabase.from("mentoria_batches").update({ status } as any).eq("id", batchId);
  }, []);

  // Multi-file upload + auto-read (PDF + ZIP) with cloud storage
  const handleFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const allowedExts = [".pdf", ".zip"];
    const invalid = fileArray.filter((f) => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      return !allowedExts.includes(ext);
    });
    if (invalid.length > 0) {
      toast.error("Este formato não é suportado. Envie PDFs ou um arquivo ZIP.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado para importar arquivos.");
      return;
    }

    const zipFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith(".zip"));
    const pdfFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const isZipSource = zipFiles.length > 0;
    const batchCode = generateBatchCode();
    const userPrefix = user.id;
    const totalFilesInSource = isZipSource ? 0 : pdfFiles.length; // will be updated after zip extraction

    // Initialize batch info immediately as "recebido"
    const tempBatchInfo: BatchInfo = {
      id: "",
      batchCode,
      createdAt: new Date(),
      sourceType: isZipSource ? "zip" : "pdf",
      originalFileName: isZipSource ? zipFiles[0]?.name : undefined,
      totalFilesInSource,
      totalPdfs: 0,
      ignoredFiles: 0,
      status: "recebido",
    };
    setBatchInfo(tempBatchInfo);

    // Extract ZIPs
    let extractedPdfs: File[] = [];
    let totalZipEntries = 0;
    let totalIgnored = 0;

    if (isZipSource) {
      setBatchInfo((prev) => prev ? { ...prev, status: "extraindo_arquivos" } : prev);
      for (const zf of zipFiles) {
        const result = await extractPdfsFromZip(zf);
        extractedPdfs = [...extractedPdfs, ...result.pdfs];
        totalZipEntries += result.totalEntries;
        totalIgnored += result.ignored;
      }
    }

    if (isZipSource && extractedPdfs.length === 0 && pdfFiles.length === 0) {
      setBatchInfo((prev) => prev ? { ...prev, status: "erro", totalFilesInSource: totalZipEntries, ignoredFiles: totalZipEntries } : prev);
      toast.error("O ZIP não contém PDFs válidos para análise.");
      return;
    }

    const allPdfs = [...pdfFiles, ...extractedPdfs];
    if (allPdfs.length === 0) {
      setBatchInfo((prev) => prev ? { ...prev, status: "erro" } : prev);
      toast.error("Nenhum PDF válido encontrado. Verifique os arquivos enviados.");
      return;
    }

    if (allPdfs.length > IMPORT_LIMIT) {
      setBatchInfo((prev) => prev ? { ...prev, status: "erro" } : prev);
      toast.error(`O limite máximo é de ${IMPORT_LIMIT} atendimentos por lote. Você tentou importar ${allPdfs.length}.`);
      return;
    }

    if (allPdfs.length > IMPORT_RECOMMENDED) {
      toast.warning(`Você importou ${allPdfs.length} atendimentos. O uso recomendado é de até ${IMPORT_RECOMMENDED} por mês.`);
    }

    // Update counts
    setBatchInfo((prev) => prev ? {
      ...prev,
      status: "organizando_atendimentos",
      totalFilesInSource: isZipSource ? totalZipEntries : pdfFiles.length,
      totalPdfs: allPdfs.length,
      ignoredFiles: totalIgnored,
    } : prev);

    // 1. Save originals to cloud: uploads/
    let uploadPath: string | undefined;
    if (isZipSource) {
      for (const zf of zipFiles) {
        const path = `${userPrefix}/uploads/${batchCode}/${zf.name}`;
        await supabase.storage.from("mentoria-lab").upload(path, zf, { contentType: "application/zip" }).catch(() => {});
        uploadPath = `${userPrefix}/uploads/${batchCode}`;
      }
    } else {
      for (const pf of pdfFiles) {
        const path = `${userPrefix}/uploads/${batchCode}/${pf.name}`;
        await supabase.storage.from("mentoria-lab").upload(path, pf, { contentType: "application/pdf" }).catch(() => {});
      }
      uploadPath = `${userPrefix}/uploads/${batchCode}`;
    }

    // 2. Save extracted PDFs to cloud: extracted/
    const pdfPaths: Map<string, string> = new Map();
    for (const pdf of allPdfs) {
      const storagePath = `${userPrefix}/extracted/${batchCode}/${pdf.name}`;
      await supabase.storage.from("mentoria-lab").upload(storagePath, pdf, { contentType: "application/pdf" }).catch(() => {});
      pdfPaths.set(pdf.name, storagePath);
    }

    // 3. Create batch record in DB
    const { data: batchRow, error: batchErr } = await supabase.from("mentoria_batches").insert({
      user_id: user.id,
      batch_code: batchCode,
      source_type: isZipSource ? "zip" : "pdf",
      original_file_name: isZipSource ? zipFiles[0]?.name : null,
      total_files_in_source: isZipSource ? totalZipEntries : pdfFiles.length,
      total_pdfs: allPdfs.length,
      ignored_files: totalIgnored,
      status: "organizando_atendimentos",
      upload_path: uploadPath,
    } as any).select("id").single();

    if (batchErr || !batchRow) {
      console.error("Failed to create batch:", batchErr);
      toast.error("Erro ao registrar lote. Arquivos foram salvos.");
    }

    const batchId = batchRow?.id;
    setCurrentBatchId(batchId || null);
    setBatchInfo((prev) => prev ? { ...prev, id: batchId || "" } : prev);

    // 4. Create batch file records + local entries
    const entries: LabFile[] = [];
    for (const pdf of allPdfs) {
      const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const storagePath = pdfPaths.get(pdf.name) || "";

      let batchFileId: string | undefined;
      if (batchId) {
        const { data: bf } = await supabase.from("mentoria_batch_files").insert({
          batch_id: batchId,
          file_name: pdf.name,
          file_path: `${userPrefix}/uploads/${batchCode}/${pdf.name}`,
          extracted_path: storagePath,
          file_size: pdf.size,
          status: "pending",
        } as any).select("id").single();
        batchFileId = bf?.id;
      }

      entries.push({
        id: localId,
        file: pdf,
        name: pdf.name,
        size: pdf.size,
        addedAt: new Date(),
        status: "pendente",
        batchId,
        batchFileId,
        storagePath,
      });
    }

    setFiles((prev) => [...prev, ...entries]);

    // Update to "pronto_para_curadoria"
    const finalStatus: BatchStatus = "pronto_para_curadoria";
    setBatchInfo((prev) => prev ? { ...prev, status: finalStatus } : prev);
    if (batchId) {
      await supabase.from("mentoria_batches").update({ status: finalStatus } as any).eq("id", batchId);
    }

    // Toast
    if (isZipSource) {
      const parts = [`${extractedPdfs.length} PDF(s) extraído(s) do ZIP`];
      if (pdfFiles.length > 0) parts.push(`${pdfFiles.length} PDF(s) avulso(s)`);
      if (totalIgnored > 0) parts.push(`${totalIgnored} arquivo(s) ignorado(s)`);
      toast.success(`${allPdfs.length} atendimento(s) importado(s). ${parts.join(" · ")}. Leitura automática iniciada.`);
    } else {
      toast.success(`${allPdfs.length} arquivo(s) importado(s). Leitura automática iniciada.`);
    }

    entries.forEach((entry) => readFile(entry));
  }, [readFile, extractPdfsFromZip, generateBatchCode, updateBatchStatus]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  // Selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!f.name.toLowerCase().includes(q) && !f.protocolo?.toLowerCase().includes(q) && !f.atendente?.toLowerCase().includes(q)) return false;
      }
      if (filterAtendente !== "todos" && f.atendente !== filterAtendente) return false;
      if (filterCanal !== "todos" && f.canal !== filterCanal) return false;
      if (filterAudio === "com" && !f.hasAudio) return false;
      if (filterAudio === "sem" && f.hasAudio) return false;

      // Period filter (attendance date)
      if (filterPeriodoFrom || filterPeriodoTo) {
        if (!f.data) return false;
        const parts = f.data.split("/");
        if (parts.length !== 3) return false;
        const fileDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        if (filterPeriodoFrom && fileDate < filterPeriodoFrom) return false;
        if (filterPeriodoTo) {
          const endOfDay = new Date(filterPeriodoTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (fileDate > endOfDay) return false;
        }
      }

      // Audit date filter
      if (filterAuditoriaFrom || filterAuditoriaTo) {
        if (!f.analyzedAt) return false;
        if (filterAuditoriaFrom && f.analyzedAt < filterAuditoriaFrom) return false;
        if (filterAuditoriaTo) {
          const endOfDay = new Date(filterAuditoriaTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (f.analyzedAt > endOfDay) return false;
        }
      }

      return true;
    });
  }, [files, searchTerm, filterAtendente, filterCanal, filterAudio, filterPeriodoFrom, filterPeriodoTo, filterAuditoriaFrom, filterAuditoriaTo]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterAtendente, filterCanal, filterAudio, filterPeriodoFrom, filterPeriodoTo, filterAuditoriaFrom, filterAuditoriaTo]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFiles.slice(start, start + PAGE_SIZE);
  }, [filteredFiles, currentPage]);

  const toggleSelectAll = () => {
    if (selected.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  // Batch analyze with cloud storage for results
  const analyzeSelected = async () => {
    const toAnalyze = files.filter((f) => selected.has(f.id) && (f.status === "lido" || f.status === "pendente"));
    if (toAnalyze.length === 0) {
      toast.warning("Selecione arquivos lidos ou pendentes para análise.");
      return;
    }

    // Show warning for large selections but allow continuing
    if (toAnalyze.length > ANALYZE_LIMIT && !showAnalyzeWarning) {
      setShowAnalyzeWarning(true);
      toast.warning(`Você selecionou ${toAnalyze.length} atendimentos. Recomendamos analisar em blocos de até ${ANALYZE_LIMIT} para melhor desempenho.`, {
        duration: 8000,
        action: {
          label: "Continuar mesmo assim",
          onClick: () => {
            setShowAnalyzeWarning(false);
            analyzeSelected();
          },
        },
      });
      return;
    }
    setShowAnalyzeWarning(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado.");
      return;
    }

    setProcessing(true);

    // Update batch status to em_analise
    if (currentBatchId) {
      await updateBatchStatus(currentBatchId, "em_analise");
    }

    let success = 0;
    let errors = 0;

    for (const labFile of toAnalyze) {
      try {
        let text = labFile.text;
        if (!text) {
          text = await extractTextFromPdf(labFile.file);
          if (!text.trim()) {
            setFiles((prev) => prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Não foi possível extrair texto deste arquivo." } : f)));
            if (labFile.batchFileId) {
              await supabase.from("mentoria_batch_files").update({ status: "error", error_message: "Sem texto extraído" } as any).eq("id", labFile.batchFileId);
            }
            errors++;
            continue;
          }
        }

        // Use the already-stored path in mentoria-lab bucket instead of re-uploading
        const pdfUrl = labFile.storagePath || "";

        const { data, error } = await supabase.functions.invoke("analyze-attendance", { body: { text } });

        if (error || data?.error) {
          setFiles((prev) => prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Ocorreu uma falha ao analisar este atendimento." } : f)));
          if (labFile.batchFileId) {
            await supabase.from("mentoria_batch_files").update({ status: "error", error_message: "Falha na análise" } as any).eq("id", labFile.batchFileId);
          }
          errors++;
          continue;
        }

        const notaFinal = typeof data.notaFinal === "number" ? data.notaFinal : 0;
        const bonusQualidade = typeof data.bonusQualidade === "number" ? data.bonusQualidade : 0;

        // Save evaluation
        await supabase.from("evaluations").insert({
          data: data.data || new Date().toLocaleDateString("pt-BR"),
          data_avaliacao: new Date().toISOString(),
          protocolo: data.protocolo || "Não identificado",
          atendente: data.atendente || "Não identificado",
          tipo: data.tipo || "Não identificado",
          atualizacao_cadastral: data.bonusOperacional?.atualizacaoCadastral || "NÃO",
          nota: notaFinal,
          classificacao: data.classificacao || "Fora de Avaliação",
          bonus: bonusQualidade >= 70,
          pontos_melhoria: Array.isArray(data.mentoria) ? data.mentoria : [],
          user_id: user.id,
          pdf_url: pdfUrl,
          full_report: { ...data },
          prompt_version: data.promptVersion || "auditor_v3",
          resultado_validado: true,
        } as any);

        // Save result JSON to cloud: results/<batchCode>/
        if (labFile.batchId) {
          const { data: batchData } = await supabase.from("mentoria_batches").select("batch_code").eq("id", labFile.batchId).single();
          if (batchData) {
            const resultPath = `${user.id}/results/${batchData.batch_code}/${labFile.name.replace(".pdf", ".json")}`;
            const resultBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            await supabase.storage.from("mentoria-lab").upload(resultPath, resultBlob, { contentType: "application/json" }).catch(() => {});
          }
        }

        // Sync batch file DB
        if (labFile.batchFileId) {
          await supabase.from("mentoria_batch_files").update({
            status: "analyzed",
            nota: notaFinal,
            classificacao: data.classificacao || "Fora de Avaliação",
            atendente: data.atendente || labFile.atendente,
            protocolo: data.protocolo || labFile.protocolo,
            result: data,
          } as any).eq("id", labFile.batchFileId);
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === labFile.id
              ? { ...f, status: "analisado", result: data, protocolo: data.protocolo || f.protocolo, atendente: data.atendente || f.atendente, data: data.data || f.data, tipo: data.tipo || f.tipo, analyzedAt: new Date() }
              : f
          )
        );
        success++;
      } catch {
        setFiles((prev) => prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Ocorreu uma falha temporária no processamento. Tente novamente." } : f)));
        if (labFile.batchFileId) {
          await supabase.from("mentoria_batch_files").update({ status: "error", error_message: "Falha temporária" } as any).eq("id", labFile.batchFileId);
        }
        errors++;
      }
    }

    // Update batch status + save summary
    if (currentBatchId) {
      const analyzed = files.filter((f) => f.status === "analisado" || f.result);
      const summary = {
        total_analyzed: success,
        total_errors: errors,
        completed_at: new Date().toISOString(),
      };
      const finalBatchStatus: BatchStatus = errors === toAnalyze.length ? "erro" : "concluido";
      await updateBatchStatus(currentBatchId, finalBatchStatus);
      await supabase.from("mentoria_batches").update({ summary } as any).eq("id", currentBatchId);

      // Save summary.json to cloud
      const { data: batchData } = await supabase.from("mentoria_batches").select("batch_code").eq("id", currentBatchId).single();
      if (batchData) {
        const summaryPath = `${user.id}/results/${batchData.batch_code}/summary.json`;
        const summaryBlob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
        await supabase.storage.from("mentoria-lab").upload(summaryPath, summaryBlob, { contentType: "application/json", upsert: true }).catch(() => {});
      }
    }

    setProcessing(false);
    setSelected(new Set());
    if (errors === 0) {
      toast.success(`Análise concluída com sucesso. ${success} atendimento(s) analisado(s).`);
    } else if (success > 0) {
      toast.warning(`Alguns arquivos não puderam ser analisados, mas os demais foram processados. ${success} sucesso(s), ${errors} erro(s).`);
    } else {
      toast.error("Ocorreu uma falha temporária no processamento do lote. Tente novamente.");
    }
    // Stay on the table so users can click "Ver mentoria" on individual items
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const removeSelected = () => {
    setFiles((prev) => prev.filter((f) => !selected.has(f.id)));
    setSelected(new Set());
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatSize = (b: number) => b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;

  const counts = useMemo(() => {
    const analisados = files.filter((f) => f.status === "analisado");
    const atendentesSet = new Set(
      analisados
        .map((f) => (f.result?.atendente || f.atendente || "").trim().toLowerCase())
        .filter(Boolean)
    );
    return {
      total: files.length,
      pendente: files.filter((f) => f.status === "pendente").length,
      lido: files.filter((f) => f.status === "lido").length,
      analisado: analisados.length,
      erro: files.filter((f) => f.status === "erro").length,
      atendentes: atendentesSet.size,
    };
  }, [files]);

  // Keep sideFile in sync with files state
  useEffect(() => {
    if (sideFile) {
      const updated = files.find((f) => f.id === sideFile.id);
      if (updated) setSideFile(updated);
    }
  }, [files, sideFile]);

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <h1 className="text-xl font-bold text-foreground">
            Radar Insight — <span className="text-primary">Mentoria Lab</span>
          </h1>
          <Badge variant="outline" className="ml-2 text-xs">Beta</Badge>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Limit tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium px-3 py-1 cursor-help">
                  <Upload className="h-3 w-3 mr-1.5" />
                  IMPORTAR: até {IMPORT_RECOMMENDED} por mês
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">Volume recomendado de atendimentos por período mensal.</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center rounded-full bg-accent/15 text-accent border border-accent/25 text-xs font-medium px-3 py-1 cursor-help">
                  <Play className="h-3 w-3 mr-1.5" />
                  ANALISAR: até {ANALYZE_LIMIT} por vez
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">Para melhor desempenho, analise em blocos de até 50 atendimentos.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { label: "Total", value: counts.total, color: "text-foreground" },
            { label: "Pendentes", value: counts.pendente, color: "text-muted-foreground" },
            { label: "Lidos", value: counts.lido, color: "text-primary" },
            { label: "Analisados", value: counts.analisado, color: "text-accent" },
            { label: "Atendentes", value: counts.atendentes, color: "text-primary" },
            { label: "Erros", value: counts.erro, color: "text-destructive" },
          ].map((s) => (
            <Card key={s.label} className="p-3 text-center">
              <span className={`text-2xl font-bold tracking-tight ${s.color}`}>{s.value}</span>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Batch Info Card */}
        {batchInfo && (
          <Card className="p-5 border-l-4 border-l-accent bg-accent/5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-accent/10">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Lote importado com sucesso</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Importado em {batchInfo.createdAt.toLocaleDateString("pt-BR")} às {batchInfo.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              {(() => {
                const cfg = batchStatusConfig[batchInfo.status];
                const Icon = cfg.icon;
                const isAnimated = batchInfo.status === "extraindo_arquivos" || batchInfo.status === "organizando_atendimentos" || batchInfo.status === "em_analise";
                const isActionable = batchInfo.status === "pronto_para_curadoria";
                const readyFiles = isActionable ? files.filter(f => f.status === "lido") : [];
                const handleBadgeClick = () => {
                  if (!isActionable || readyFiles.length === 0) return;
                  // Select all "lido" files
                  setSelected(new Set(readyFiles.map(f => f.id)));
                  // Scroll to table
                  document.getElementById("mentoria-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  toast.success(`${readyFiles.length} atendimento${readyFiles.length !== 1 ? "s" : ""} pronto${readyFiles.length !== 1 ? "s" : ""} selecionado${readyFiles.length !== 1 ? "s" : ""}. Clique em "Analisar" para iniciar.`);
                };
                return (
                  <Badge
                    variant="outline"
                    className={`gap-1.5 ${cfg.color} border-current/20 shrink-0 ${isActionable ? "cursor-pointer hover:bg-primary/10 hover:scale-105 transition-all" : ""}`}
                    onClick={isActionable ? handleBadgeClick : undefined}
                    title={isActionable ? `Selecionar ${readyFiles.length} atendimento(s) pronto(s) para análise` : undefined}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isAnimated ? "animate-spin" : ""}`} />
                    {cfg.label}
                    {isActionable && readyFiles.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-[10px] font-bold">{readyFiles.length}</span>
                    )}
                  </Badge>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm border-t border-border pt-3">
              <div className="flex justify-between sm:flex-col sm:text-center">
                <span className="text-muted-foreground text-xs">ID do lote</span>
                <span className="font-mono font-semibold text-foreground text-xs">{batchInfo.batchCode}</span>
              </div>
              <div className="flex justify-between sm:flex-col sm:text-center">
                <span className="text-muted-foreground text-xs">Entrada</span>
                <span className="font-semibold text-foreground text-xs">{batchInfo.sourceType === "zip" ? "ZIP" : "Múltiplos PDFs"}{batchInfo.originalFileName ? ` (${batchInfo.originalFileName})` : ""}</span>
              </div>
              <div className="flex justify-between sm:flex-col sm:text-center">
                <span className="text-muted-foreground text-xs">Arquivos recebidos</span>
                <span className="font-bold text-foreground text-xs">{batchInfo.totalFilesInSource}</span>
              </div>
              <div className="flex justify-between sm:flex-col sm:text-center">
                <span className="text-muted-foreground text-xs">PDFs válidos</span>
                <span className="font-bold text-primary text-xs">{batchInfo.totalPdfs}</span>
              </div>
              <div className="flex justify-between sm:flex-col sm:text-center">
                <span className="text-muted-foreground text-xs">Ignorados</span>
                <span className="font-bold text-muted-foreground text-xs">{batchInfo.ignoredFiles}</span>
              </div>
              <div className="flex justify-between sm:flex-col sm:text-center">
                <span className="text-muted-foreground text-xs">Status</span>
                <span className={`font-semibold text-xs ${batchStatusConfig[batchInfo.status].color}`}>{batchStatusConfig[batchInfo.status].label}</span>
              </div>
            </div>
          </Card>
        )}

        {/* 3 Main Action Cards */}
        {files.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card
              className="p-6 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
              onClick={() => inputRef.current?.click()}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">Importar Atendimentos</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Envie PDFs ou um ZIP com atendimentos para iniciar a curadoria.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-6 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group opacity-60 pointer-events-none"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="p-3 rounded-xl bg-accent/10 group-hover:bg-accent/15 transition-colors">
                  <Play className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">Analisar Lote</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Selecione atendimentos importados e gere análises automáticas em lote.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-6 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group opacity-60 pointer-events-none"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="p-3 rounded-xl bg-secondary/50 group-hover:bg-secondary/70 transition-colors">
                  <BookOpen className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">Ver Insights</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Visualize tendências, pontos de melhoria e evolução dos atendentes.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Upload input (hidden) */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.zip"
          multiple
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
          className="hidden"
        />

        {/* Upload drop zone — only when files exist (inline re-import) */}
        {files.length > 0 && (
          <Card className="p-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Upload className="h-4 w-4 text-primary/60" />
                Arraste PDFs ou ZIP aqui para adicionar ao lote
              </p>
            </div>
          </Card>
        )}

        {/* Atendimentos importados — populated */}
        {files.length > 0 && (
          <>
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">📂 Atendimentos importados</h3>
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar arquivo, protocolo ou atendente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Atendente */}
                <Select value={filterAtendente} onValueChange={setFilterAtendente}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos atendentes</SelectItem>
                    {atendentes.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Período do atendimento */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[200px] justify-start text-left text-xs font-normal h-10", !filterPeriodoFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {filterPeriodoFrom ? (
                        filterPeriodoTo
                          ? `${format(filterPeriodoFrom, "dd/MM")} – ${format(filterPeriodoTo, "dd/MM/yy")}`
                          : `A partir de ${format(filterPeriodoFrom, "dd/MM/yy")}`
                      ) : "Período atendimento"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={filterPeriodoFrom && filterPeriodoTo ? { from: filterPeriodoFrom, to: filterPeriodoTo } : filterPeriodoFrom ? { from: filterPeriodoFrom, to: undefined } : undefined}
                      onSelect={(range) => {
                        setFilterPeriodoFrom(range?.from);
                        setFilterPeriodoTo(range?.to);
                      }}
                      numberOfMonths={2}
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {(filterPeriodoFrom || filterPeriodoTo) && (
                      <div className="px-3 pb-3">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFilterPeriodoFrom(undefined); setFilterPeriodoTo(undefined); }}>
                          Limpar período
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                {/* Data da auditoria */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[200px] justify-start text-left text-xs font-normal h-10", !filterAuditoriaFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {filterAuditoriaFrom ? (
                        filterAuditoriaTo
                          ? `${format(filterAuditoriaFrom, "dd/MM")} – ${format(filterAuditoriaTo, "dd/MM/yy")}`
                          : `A partir de ${format(filterAuditoriaFrom, "dd/MM/yy")}`
                      ) : "Data da auditoria"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={filterAuditoriaFrom && filterAuditoriaTo ? { from: filterAuditoriaFrom, to: filterAuditoriaTo } : filterAuditoriaFrom ? { from: filterAuditoriaFrom, to: undefined } : undefined}
                      onSelect={(range) => {
                        setFilterAuditoriaFrom(range?.from);
                        setFilterAuditoriaTo(range?.to);
                      }}
                      numberOfMonths={2}
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {(filterAuditoriaFrom || filterAuditoriaTo) && (
                      <div className="px-3 pb-3">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFilterAuditoriaFrom(undefined); setFilterAuditoriaTo(undefined); }}>
                          Limpar período
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                {/* Áudio */}
                <Select value={filterAudio} onValueChange={setFilterAudio}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Áudio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="com">Com áudio</SelectItem>
                    <SelectItem value="sem">Sem áudio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                <Button
                  onClick={analyzeSelected}
                  disabled={selected.size === 0 || processing}
                  size="lg"
                  className="gap-2 font-semibold"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {processing ? "Analisando..." : `Analisar ${selected.size} selecionado${selected.size !== 1 ? "s" : ""}`}
                </Button>
                {selected.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={removeSelected} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" /> Remover selecionados
                  </Button>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {filteredFiles.length} de {files.length} exibidos
                </span>
              </div>
            </Card>

            {/* Table */}
            <Card id="mentoria-table" className="overflow-hidden scroll-mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="p-3 text-left w-10">
                        <Checkbox
                          checked={selected.size === filteredFiles.length && filteredFiles.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Arquivo</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Atendente</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Tipo</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Data</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Protocolo</th>
                      <th className="p-3 text-center font-medium text-muted-foreground">Áudio</th>
                      <th className="p-3 text-center font-medium text-muted-foreground">Status</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Data da Auditoria</th>
                      <th className="p-3 text-center font-medium text-muted-foreground">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFiles.map((f) => (
                      <tr key={f.id} className={cn("border-b border-border last:border-0 hover:bg-muted/30 transition-colors", f.status === "analisado" && "bg-accent/8 border-l-[3px] border-l-accent")}>
                        <td className="p-3">
                          <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggleSelect(f.id)} />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[220px]">{f.name}</p>
                              <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {readingIds.has(f.id) ? <Loader2 className="h-3 w-3 animate-spin inline" /> : (f.atendente || <span className="italic opacity-60">Não identificado</span>)}
                        </td>
                        <td className="p-3 text-xs">
                          {(() => {
                            const tipo = f.result?.tipo || f.tipo;
                            if (!tipo || tipo === "Outro") return <span className="italic text-muted-foreground opacity-60">—</span>;
                            return <Badge variant="outline" className="text-[10px] font-medium">{tipo}</Badge>;
                          })()}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{f.data ? formatDateBR(f.data) : <span className="italic opacity-60">—</span>}</td>
                        <td className="p-3 text-muted-foreground text-xs">{f.protocolo || <span className="italic opacity-60">—</span>}</td>
                        <td className="p-3 text-center">
                          {f.hasAudio === undefined ? (
                            <span className="text-xs italic opacity-60">—</span>
                          ) : f.hasAudio ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent">Sim</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Não</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {readingIds.has(f.id) ? (
                              <Badge className="bg-primary/10 text-primary text-xs">Lendo...</Badge>
                            ) : (
                              <Badge className={`${statusConfig[f.status].color} text-xs`}>
                                {statusConfig[f.status].label}
                              </Badge>
                            )}
                            {f.status === "analisado" && f.result?.notaFinal != null && notaToScale10(f.result.notaFinal) < 7 && (
                              <Badge className="bg-warning/15 text-warning text-[10px] whitespace-nowrap">
                                Necessita mentoria
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {f.analyzedAt ? formatDateBR(f.analyzedAt) : <span className="italic opacity-60">—</span>}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => setSideFile(f)}
                            >
                              <Eye className="h-3 w-3" /> Abrir
                            </Button>
                            {f.status === "analisado" && f.result && (
                              <Button
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => setMentoriaFile(f)}
                              >
                                <BookOpen className="h-3 w-3" /> Ver mentoria
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeFile(f.id)}
                              title="Remover"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredFiles.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          Nenhum atendimento encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages} · {filteredFiles.length} atendimento(s)
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3 w-3" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Próxima <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Selection warning */}
            {selected.size > ANALYZE_LIMIT && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Muitos atendimentos selecionados</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Você selecionou {selected.size} atendimentos. Recomendamos analisar em blocos de até {ANALYZE_LIMIT} para melhor desempenho.
                  </p>
                </div>
              </div>
            )}

            {/* Charts card */}
            {filteredFiles.some((f) => f.status === "analisado") && !showCharts && (
              <Card
                className="p-5 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
                onClick={() => setShowCharts(true)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-foreground mb-0.5">Ver Gráficos</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Evolução de notas, performance por atendente e volume de auditorias.
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Card>
            )}

            {/* Charts section (expandable) */}
            {showCharts && filteredFiles.some((f) => f.status === "analisado") && (
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCharts(false)}>
                    <X className="h-3 w-3" /> Fechar
                  </Button>
                </div>
                <MentoriaCharts files={filteredFiles} />
              </div>
            )}

            {/* Insights do lote - seção secundária colapsável (filtered) */}
            {filteredFiles.some((f) => f.status === "analisado") && (
              <details id="mentoria-insights" className="scroll-mt-6 group">
                <summary className="flex items-center gap-2 cursor-pointer select-none py-3 px-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Resumo geral do lote</span>
                  
                </summary>
                <div className="mt-3">
                  <MentoriaInsights files={filteredFiles} />
                </div>
              </details>
            )}
          </>
        )}
      </main>

      {/* Side panel */}
      <Sheet open={!!sideFile} onOpenChange={() => setSideFile(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              {sideFile?.name}
            </SheetTitle>
          </SheetHeader>

          {sideFile && (
            <div className="mt-4 space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Atendente", value: sideFile.atendente },
                  { label: "Tipo", value: sideFile.result?.tipo || sideFile.tipo || "—" },
                  { label: "Data", value: sideFile.data },
                  { label: "Áudio", value: sideFile.hasAudio ? "Sim" : "Não" },
                  { label: "Protocolo", value: sideFile.protocolo },
                  { label: "Status", value: statusConfig[sideFile.status].label },
                ].map((m) => (
                  <div key={m.label} className="p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-medium text-foreground">{m.value || "—"}</p>
                  </div>
                ))}
              </div>

              {/* Analysis result */}
              {sideFile.result && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-xs text-muted-foreground">Nota</p>
                      <p className="text-xl font-bold text-foreground">{sideFile.result.notaFinal != null ? formatNota(sideFile.result.notaFinal) : "—"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-xs text-muted-foreground">Classificação</p>
                      <p className="text-xl font-bold text-foreground">{sideFile.result.classificacao ?? "—"}</p>
                    </div>
                  </div>
                  {sideFile.result.mentoria?.length > 0 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs font-semibold text-primary mb-2">Pontos de Mentoria</p>
                      <ul className="space-y-1">
                        {sideFile.result.mentoria.map((m: string, i: number) => (
                          <li key={i} className="text-xs text-foreground">• {m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Auto-read button if pending */}
              {sideFile.status === "pendente" && !readingIds.has(sideFile.id) && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => readFile(sideFile)}
                >
                  <BookOpen className="h-4 w-4" /> Iniciar leitura automática
                </Button>
              )}

              {readingIds.has(sideFile.id) && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Lendo PDF...</span>
                </div>
              )}

              {/* Conversation content */}
              {sideFile.text && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Conteúdo do atendimento</p>
                  <ConversationView rawText={sideFile.text} atendente={sideFile.atendente} />
                </div>
              )}

              {sideFile.error && (
                <p className="text-xs text-destructive">Erro: {sideFile.error}</p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* Mentoria Detail Dialog */}
      <MentoriaDetailDialog
        open={!!mentoriaFile}
        onOpenChange={() => setMentoriaFile(null)}
        result={mentoriaFile?.result}
        fileName={mentoriaFile?.name || ""}
        rawText={mentoriaFile?.text}
        atendente={mentoriaFile?.atendente}
      />
    </div>
  );
};

export default MentoriaLab;
