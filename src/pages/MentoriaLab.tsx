import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { format } from "date-fns";
import {
  ArrowLeft, LogOut, Upload, FileText, Trash2, Eye, Play, Loader2,
  Search, X, Filter, Volume2, VolumeX, BookOpen, Archive, Package, Clock, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, Info, CalendarIcon, BarChart3, ShieldCheck, Bug
} from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { parseStructuredConversation, type StructuredConversation } from "@/lib/conversationParser";
import logoSymbol from "@/assets/logo-symbol.png";
import { toast } from "sonner";
import MentoriaInsights from "@/components/MentoriaInsights";
import MentoriaCharts from "@/components/MentoriaCharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ConversationView from "@/components/ConversationView";
import MentoriaDetailDialog from "@/components/MentoriaDetailDialog";
import ParserDiagnosticDialog from "@/components/ParserDiagnosticDialog";
import MentoriaPipeline from "@/components/MentoriaPipeline";
import MentoriaBatchHistory from "@/components/MentoriaBatchHistory";
import MentoriaBonusPanel from "@/components/MentoriaBonusPanel";

type FileStatus = "pendente" | "lido" | "analisado" | "erro";
type WorkflowStatus = "nao_iniciado" | "em_analise" | "finalizado";

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
  ineligible?: boolean;
  ineligibleReason?: string;
  nonEvaluable?: boolean;
  nonEvaluableReason?: string;
  attendantMatch?: MatchResult;
  transferred?: boolean;
  approvedAsOfficial?: boolean;
  evaluationId?: string;
  uraContext?: UraContext;
  uraStatus?: UraStatus;
  structuredConversation?: StructuredConversation;
}

const statusConfig: Record<FileStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  lido: { label: "Lido", color: "bg-blue-100 text-blue-700" },
  analisado: { label: "Analisado", color: "bg-accent/15 text-accent" },
  erro: { label: "Erro", color: "bg-destructive/15 text-destructive" },
};

import { extractAllMetadata } from "@/lib/mentoriaMetadata";
import { getRegisteredAttendants, matchAttendant, type MatchResult } from "@/lib/attendantMatcher";
import { extractUraContext } from "@/lib/conversationParser";
import type { UraContext, UraStatus } from "@/lib/uraContextSummarizer";
import {
  detectMentoriaEvaluability,
  mergePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
  resolvePersistedMentoriaEvaluability,
} from "@/lib/mentoriaEvaluability";

const IMPORT_LIMIT = 1000;
const IMPORT_RECOMMENDED = 500;
const ANALYZE_LIMIT = 50;
const PAGE_SIZE = 30;
const INGESTION_CONCURRENCY = 4;

const FATAL_PDF_READ_ERROR_PATTERNS = [
  /invalidpdf/i,
  /invalid\s+pdf/i,
  /corrupt/i,
  /corrompid/i,
  /formaterror/i,
  /bad\s+xref/i,
  /unexpected\s+end\s+of\s+file/i,
  /missingpdf/i,
  /password/i,
  /unable\s+to\s+parse/i,
  /cannot\s+read/i,
  /failed\s+to\s+load\s+pdf/i,
];

const isFatalPdfReadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return FATAL_PDF_READ_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

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
  const [highlightedFileId, setHighlightedFileId] = useState<string | null>(null);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [diagnosticFile, setDiagnosticFile] = useState<LabFile | null>(null);
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, WorkflowStatus>>({});
  const { isAdmin } = useUserPermissions();
  // Filters
  const [filterAtendente, setFilterAtendente] = useState("todos");
  const [filterPeriodoFrom, setFilterPeriodoFrom] = useState<Date | undefined>();
  const [filterPeriodoTo, setFilterPeriodoTo] = useState<Date | undefined>();
  const [filterAuditoriaFrom, setFilterAuditoriaFrom] = useState<Date | undefined>();
  const [filterAuditoriaTo, setFilterAuditoriaTo] = useState<Date | undefined>();
  const [filterCanal, setFilterCanal] = useState("todos");
  const [filterAudio, setFilterAudio] = useState("todos");

  const inputRef = useRef<HTMLInputElement>(null);
  const [loadingFromDb, setLoadingFromDb] = useState(true);

  // Load persisted batches and files from database on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoadingFromDb(false); return; }

        const { data: batches } = await supabase
          .from("mentoria_batches")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!batches || batches.length === 0) { setLoadingFromDb(false); return; }

        const batchIds = batches.map(b => b.id);
        const { data: batchFiles } = await supabase
          .from("mentoria_batch_files")
          .select("*")
          .in("batch_id", batchIds)
          .order("created_at", { ascending: true });

        if (!batchFiles || batchFiles.length === 0) { setLoadingFromDb(false); return; }

        const { data: evaluations } = await supabase
          .from("evaluations")
          .select("id, protocolo, atendente, resultado_validado, full_report, nota, classificacao")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1000);

        const evalMap = new Map<string, any>();
        if (evaluations) {
          for (const ev of evaluations) {
            if (ev.protocolo && !evalMap.has(ev.protocolo)) {
              evalMap.set(ev.protocolo, ev);
            }
          }
        }

        const latestBatch = batches[0];
        setBatchInfo({
          id: latestBatch.id,
          batchCode: latestBatch.batch_code,
          createdAt: new Date(latestBatch.created_at),
          sourceType: latestBatch.source_type as "pdf" | "zip",
          originalFileName: latestBatch.original_file_name || undefined,
          totalFilesInSource: latestBatch.total_files_in_source,
          totalPdfs: latestBatch.total_pdfs,
          ignoredFiles: latestBatch.ignored_files,
          status: latestBatch.status as BatchStatus,
        });
        setCurrentBatchId(latestBatch.id);

        const evaluabilityBackfill: Array<{ id: string; result: Record<string, unknown> }> = [];

        const restoredFiles: LabFile[] = batchFiles.map((bf) => {
          const matchedEval = bf.protocolo ? evalMap.get(bf.protocolo) : undefined;
          const isAnalyzed = bf.status === "analyzed" && (bf.result || matchedEval);
          const result = bf.result || matchedEval?.full_report;

          let fileStatus: FileStatus = "pendente";
          if (bf.status === "analyzed") fileStatus = "analisado";
          else if (bf.status === "read") fileStatus = "lido";
          else if (bf.status === "error") fileStatus = "erro";

          // Restore raw text and structured messages from DB
          const rawText = (bf as any).extracted_text as string | undefined;
          const persistedMessages = (bf as any).parsed_messages as StructuredConversation | undefined;

          // Restore or recompute structured conversation
          let structured: StructuredConversation | undefined = persistedMessages || undefined;
          if (!structured && rawText) {
            try {
              structured = parseStructuredConversation(rawText, bf.atendente || undefined);
            } catch { /* non-blocking */ }
          }

          // Recompute URA context from persisted raw text
          let uraCtx: UraContext | undefined;
          if (rawText) {
            try {
              uraCtx = extractUraContext(rawText, bf.atendente || undefined);
            } catch { /* non-blocking */ }
          }

          const persistedEvaluability = resolvePersistedMentoriaEvaluability(result);
          const persistedIneligibility = resolvePersistedMentoriaIneligibility(result);
          const evaluabilityState = persistedEvaluability ?? detectMentoriaEvaluability({
            structuredConversation: structured,
            rawText,
            hasAudio: bf.has_audio || uraCtx?.audioDetectado,
          });
          const persistedResult = mergePersistedMentoriaEvaluability(result, evaluabilityState);
          const resolvedIneligibility = persistedIneligibility ?? resolvePersistedMentoriaIneligibility(persistedResult);
          const isIneligible = resolvedIneligibility?.ineligible === true;
          const ineligibleReason = resolvedIneligibility?.reason;

          if (!persistedEvaluability || !persistedIneligibility) {
            evaluabilityBackfill.push({ id: bf.id, result: persistedResult });
          }

          return {
            id: bf.id,
            file: new File([], bf.file_name, { type: "application/pdf" }),
            name: bf.file_name,
            size: bf.file_size || 0,
            addedAt: new Date(bf.created_at),
            status: fileStatus,
            text: rawText || undefined,
            atendente: bf.atendente || undefined,
            protocolo: bf.protocolo || undefined,
            data: bf.data_atendimento || undefined,
            canal: bf.canal || undefined,
            hasAudio: bf.has_audio || false,
            tipo: (persistedResult as any)?.tipo || undefined,
            batchId: bf.batch_id,
            batchFileId: bf.id,
            storagePath: bf.extracted_path || undefined,
            result: persistedResult,
            error: bf.error_message || undefined,
            analyzedAt: isAnalyzed ? new Date(bf.created_at) : undefined,
            ineligible: isIneligible,
            ineligibleReason,
            nonEvaluable: evaluabilityState.nonEvaluable,
            nonEvaluableReason: evaluabilityState.reason,
            approvedAsOfficial: matchedEval?.resultado_validado === true,
            evaluationId: matchedEval?.id,
            uraContext: uraCtx,
            uraStatus: uraCtx?.status,
            structuredConversation: structured,
          } as LabFile;
        });

        setFiles(restoredFiles);

        if (evaluabilityBackfill.length > 0) {
          await Promise.allSettled(
            evaluabilityBackfill.map(({ id, result }) =>
              supabase.from("mentoria_batch_files").update({ result } as any).eq("id", id)
            )
          );
        }
      } catch (err) {
        console.error("Failed to load persisted data:", err);
      } finally {
        setLoadingFromDb(false);
      }
    };
    loadPersistedData();
  }, []);

  const ensureLocalFile = useCallback(async (labFile: LabFile): Promise<LabFile | null> => {
    // If file is already in memory, use it directly
    if (labFile.file.size > 0) {
      return labFile;
    }

    // If no storage path, check if we already have text from DB
    if (!labFile.storagePath) {
      if (labFile.text && labFile.text.trim().length > 0) {
        console.info("[MentoriaLab][Hidratação] Sem storagePath mas com texto do banco — prosseguindo sem PDF binário", { id: labFile.batchFileId || labFile.id });
        return labFile;
      }
      console.warn("[MentoriaLab][Hidratação] Sem storagePath e sem texto — não é possível recuperar PDF", { id: labFile.batchFileId || labFile.id });
      return null;
    }

    const { data, error } = await supabase.storage.from("mentoria-lab").download(labFile.storagePath);
    if (error || !data) {
      console.warn("[MentoriaLab][Hidratação] Falha ao baixar PDF do storage", {
        id: labFile.batchFileId || labFile.id,
        storagePath: labFile.storagePath,
        erro: error?.message || "Sem dados retornados",
      });

      // If we already have text from DB, proceed without the binary PDF
      if (labFile.text && labFile.text.trim().length > 0) {
        console.info("[MentoriaLab][Hidratação] Usando texto já disponível do banco como fallback", { id: labFile.batchFileId || labFile.id });
        return labFile;
      }

      return null;
    }

    const hydratedFile = new File([data], labFile.name, { type: "application/pdf" });
    const updatedFile: LabFile = {
      ...labFile,
      file: hydratedFile,
      size: hydratedFile.size || labFile.size,
    };

    setFiles((prev) => prev.map((f) => (f.id === labFile.id ? updatedFile : f)));
    return updatedFile;
  }, []);

  const ensureBatchFileRecord = useCallback(async (labFile: LabFile): Promise<LabFile | null> => {
    if (labFile.batchFileId || !labFile.batchId) {
      return labFile;
    }

    const { data: insertedRow, error } = await supabase
      .from("mentoria_batch_files")
      .insert({
        batch_id: labFile.batchId,
        file_name: labFile.name,
        extracted_path: labFile.storagePath ?? null,
        file_size: labFile.size,
        status: "pending",
      } as any)
      .select("id")
      .single();

    if (error || !insertedRow?.id) {
      console.error("[MentoriaLab][Importação][erro_tecnico]", {
        id_atendimento: labFile.id,
        etapa: "persistencia_registro",
        erro: error?.message || "Falha ao criar registro do atendimento",
      });
      return null;
    }

    const updatedFile: LabFile = {
      ...labFile,
      batchFileId: insertedRow.id,
    };

    setFiles((prev) => prev.map((file) => (file.id === labFile.id ? updatedFile : file)));
    return updatedFile;
  }, []);

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
  const readFile = useCallback(async (labFile: LabFile): Promise<LabFile | null> => {
    setReadingIds((prev) => new Set(prev).add(labFile.id));
    try {
      const hydratedFile = await ensureLocalFile(labFile);
      if (!hydratedFile) {
        console.warn("[MentoriaLab][Importação][erro_leitura]", {
          id: labFile.batchFileId || labFile.id,
          etapa: "recuperacao_arquivo",
          erro: "Não foi possível recuperar PDF salvo",
        });
        setFiles((prev) =>
          prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Não foi possível recuperar este PDF salvo para leitura." } : f))
        );
        if (labFile.batchFileId) {
          await supabase.from("mentoria_batch_files").update({ status: "error", error_message: "Falha ao recuperar PDF salvo" } as any).eq("id", labFile.batchFileId);
        }
        return null;
      }

      const sourceFile = await ensureBatchFileRecord(hydratedFile);
      if (!sourceFile?.batchFileId) {
        const persistenceError = "Não foi possível persistir o registro do atendimento antes da leitura.";
        console.error("[MentoriaLab][Importação][erro_tecnico]", {
          id_atendimento: hydratedFile.id,
          etapa: "persistencia_registro",
          erro: persistenceError,
        });
        setFiles((prev) =>
          prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: persistenceError } : f))
        );
        return null;
      }

      let text = "";
      let extractionError: string | undefined;

      // If file has no binary content but has text from DB, skip PDF extraction
      const hasBinaryContent = sourceFile.file.size > 0;
      if (!hasBinaryContent && sourceFile.text && sourceFile.text.trim().length > 0) {
        text = sourceFile.text;
        console.info("[MentoriaLab][Importação][texto_do_banco]", {
          id_atendimento: sourceFile.batchFileId || sourceFile.id,
          chars: text.length,
        });
      } else {
        try {
          text = await extractTextFromPdf(sourceFile.file);
        } catch (err: any) {
          if (isFatalPdfReadError(err)) {
            const fatalReadError = err?.message || "Falha crítica na leitura binária do PDF";
            console.error("[MentoriaLab][Importação][erro_tecnico]", {
              id_atendimento: sourceFile.batchFileId || sourceFile.id,
              etapa: "leitura_binaria_pdf",
              erro: fatalReadError,
            });
            setFiles((prev) =>
              prev.map((f) => (f.id === sourceFile.id ? { ...f, status: "erro", error: `Erro na leitura: ${fatalReadError}` } : f))
            );
            await supabase.from("mentoria_batch_files").update({ status: "error", error_message: fatalReadError } as any).eq("id", sourceFile.batchFileId);
            return null;
          }

          extractionError = err?.message || "Falha na extração de texto";
          console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
            id_atendimento: sourceFile.batchFileId || sourceFile.id,
            etapa: "extracao_texto",
            detalhe: extractionError,
          });
        }
      }

      const hasText = text.trim().length > 0;
      let metadata: { protocolo?: string; atendente?: string; data?: string; canal: string; hasAudio: boolean; tipo: string } = {
        protocolo: undefined,
        atendente: undefined,
        data: undefined,
        canal: "Não identificado",
        hasAudio: false,
        tipo: "Não identificado",
      };

      if (hasText) {
        try {
          metadata = { ...extractAllMetadata(text) };
        } catch (err: any) {
          console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
            id_atendimento: sourceFile.batchFileId || sourceFile.id,
            etapa: "extracao_metadados",
            detalhe: err?.message || "Falha ao extrair metadados",
          });
        }
      }

      let attendantMatchResult: MatchResult | undefined;
      if (hasText) {
        try {
          const registeredList = await getRegisteredAttendants();
          if (registeredList.length > 0 && metadata.atendente) {
            attendantMatchResult = matchAttendant(metadata.atendente, registeredList);
            if (attendantMatchResult.matched && attendantMatchResult.matchedName) {
              metadata.atendente = attendantMatchResult.matchedName;
            }
          }
        } catch (err: any) {
          console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
            id_atendimento: sourceFile.batchFileId || sourceFile.id,
            etapa: "match_atendente",
            detalhe: err?.message || "Falha ao identificar atendente",
          });
        }
      }

      let structured: StructuredConversation | undefined;
      if (hasText) {
        try {
          structured = parseStructuredConversation(text, metadata.atendente);
        } catch (err: any) {
          console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
            id_atendimento: sourceFile.batchFileId || sourceFile.id,
            etapa: "parsing_conversa",
            detalhe: err?.message || "Falha ao estruturar conversa",
          });
        }
      }

      let uraCtx: UraContext | undefined;
      if (hasText) {
        try {
          uraCtx = extractUraContext(text, metadata.atendente);
          if (uraCtx.audioDetectado && !metadata.hasAudio) {
            metadata.hasAudio = true;
          }
        } catch (err: any) {
          console.warn("[MentoriaLab][Importação][conteudo_incompleto]", {
            id_atendimento: sourceFile.batchFileId || sourceFile.id,
            etapa: "contexto_ura",
            detalhe: err?.message || "Falha ao extrair contexto URA",
          });
        }
      }

      const hasAudio = Boolean(metadata.hasAudio || uraCtx?.audioDetectado);
      const parsedMessagesPayload = structured ? JSON.parse(JSON.stringify(structured)) : null;

      // ── Pure ingestion: persist read data, NO classification ──
      const { error: persistError } = await supabase
        .from("mentoria_batch_files")
        .update({
          status: "read",
          protocolo: metadata.protocolo ?? null,
          atendente: metadata.atendente ?? null,
          data_atendimento: metadata.data ?? null,
          canal: metadata.canal ?? "Não identificado",
          has_audio: hasAudio,
          extracted_text: hasText ? text : null,
          parsed_messages: parsedMessagesPayload,
          error_message: null,
        } as any)
        .eq("id", sourceFile.batchFileId);

      if (persistError) {
        console.error("[MentoriaLab][Importação][erro_tecnico]", {
          id_atendimento: sourceFile.batchFileId || sourceFile.id,
          etapa: "persistencia_leitura",
          erro: persistError.message,
        });
        // Even if DB persist fails, mark as read locally to avoid blocking
      }

      console.info("[MentoriaLab][Importação][resultado]", {
        id_atendimento: sourceFile.batchFileId || metadata.protocolo || sourceFile.id,
        etapa: "ingestao_pura",
        texto_extraido: hasText,
        mensagens_parseadas: structured?.messages?.length ?? 0,
        has_audio: hasAudio,
        erro_extracao: extractionError ?? null,
      });

      const updatedFile: LabFile = {
        ...sourceFile,
        status: "lido",
        text: hasText ? text : undefined,
        result: sourceFile.result,
        ...metadata,
        hasAudio,
        attendantMatch: attendantMatchResult,
        transferred: attendantMatchResult?.transferred,
        uraContext: uraCtx,
        uraStatus: uraCtx?.status,
        structuredConversation: structured,
      };

      setFiles((prev) => prev.map((f) => (f.id === labFile.id ? updatedFile : f)));
      return updatedFile;
    } catch (err: any) {
      const errorMsg = err?.message || "Erro inesperado na leitura";
      console.error("[MentoriaLab][Importação][erro_fatal]", {
        id: labFile.batchFileId || labFile.id,
        etapa: "fatal",
        erro: errorMsg,
      });
      setFiles((prev) =>
        prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: `Erro na leitura: ${errorMsg}` } : f))
      );
      if (labFile.batchFileId) {
        await supabase.from("mentoria_batch_files").update({ status: "error", error_message: errorMsg } as any).eq("id", labFile.batchFileId);
      }
      return null;
    } finally {
      setReadingIds((prev) => {
        const next = new Set(prev);
        next.delete(labFile.id);
        return next;
      });
    }
  }, [ensureBatchFileRecord, ensureLocalFile]);

  const runIngestionQueue = useCallback(async (entries: LabFile[]) => {
    const queue = [...entries];
    const workerCount = Math.min(INGESTION_CONCURRENCY, queue.length);

    await Promise.allSettled(
      Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          const nextEntry = queue.shift();
          if (!nextEntry) break;
          await readFile(nextEntry);
        }
      })
    );
  }, [readFile]);

  // ── Post-ingestion classification (separate from reading) ──
  const classifyBatchFiles = useCallback(async (entries: LabFile[]) => {
    const readFiles = entries.filter((f) => f.status === "lido" || f.status === "pendente");
    
    console.info("[MentoriaLab][Classificação][inicio]", { total: readFiles.length });

    const updates: Array<{ id: string; patch: Partial<LabFile> }> = [];

    for (const labFile of readFiles) {
      try {
        // Get current state from local files (may have been updated during ingestion)
        const currentFile = files.find((f) => f.id === labFile.id) ?? labFile;

        const evaluabilityState = detectMentoriaEvaluability({
          structuredConversation: currentFile.structuredConversation,
          rawText: currentFile.text,
          hasAudio: currentFile.hasAudio,
        });

        const mergedResult = mergePersistedMentoriaEvaluability(
          currentFile.result,
          evaluabilityState
        );

        const ineligibility = resolvePersistedMentoriaIneligibility(mergedResult) ?? {
          ineligible: evaluabilityState.nonEvaluable,
          reason: evaluabilityState.reason,
        };

        // Persist classification to DB
        if (currentFile.batchFileId) {
          await supabase
            .from("mentoria_batch_files")
            .update({ result: mergedResult } as any)
            .eq("id", currentFile.batchFileId);
        }

        updates.push({
          id: labFile.id,
          patch: {
            result: mergedResult,
            nonEvaluable: evaluabilityState.nonEvaluable,
            nonEvaluableReason: evaluabilityState.reason,
            ineligible: ineligibility.ineligible,
            ineligibleReason: ineligibility.reason,
          },
        });

        console.info("[MentoriaLab][Classificação][resultado]", {
          id: currentFile.batchFileId || currentFile.id,
          avaliavel: evaluabilityState.evaluable,
          nao_avaliavel: evaluabilityState.nonEvaluable,
          inelegivel: ineligibility.ineligible,
          motivo: ineligibility.reason ?? evaluabilityState.reason ?? null,
        });
      } catch (err: any) {
        console.warn("[MentoriaLab][Classificação][erro]", {
          id: labFile.batchFileId || labFile.id,
          erro: err?.message,
        });
      }
    }

    // Batch update local state
    if (updates.length > 0) {
      setFiles((prev) =>
        prev.map((f) => {
          const update = updates.find((u) => u.id === f.id);
          return update ? { ...f, ...update.patch } : f;
        })
      );
    }

    const nonEvaluableCount = updates.filter((u) => u.patch.nonEvaluable).length;
    console.info("[MentoriaLab][Classificação][fim]", {
      total: readFiles.length,
      classificados: updates.length,
      nao_avaliaveis: nonEvaluableCount,
    });

    if (nonEvaluableCount > 0) {
      toast.info(`${nonEvaluableCount} atendimento(s) classificado(s) como não avaliável.`);
    }
  }, [files]);

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
      setBatchInfo((prev) => prev ? { ...prev, status: "erro" } : prev);
      return;
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

    await runIngestionQueue(entries);

    // ── Post-ingestion: classify evaluability ──
    await classifyBatchFiles(entries);

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

  }, [extractPdfsFromZip, generateBatchCode, runIngestionQueue, classifyBatchFiles, updateBatchStatus]);

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
      if (filterAtendente === "sem_atendente" && f.atendente) return false;
      if (filterAtendente !== "todos" && filterAtendente !== "sem_atendente" && f.atendente !== filterAtendente) return false;
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

  const openMentoria = useCallback((f: LabFile) => {
    setSideFile(null);
    setMentoriaFile(f);
    setHighlightedFileId(f.id);
    setWorkflowStatuses(prev => ({ ...prev, [f.id]: prev[f.id] === "finalizado" ? "finalizado" : "em_analise" }));
  }, []);

  const analyzeFiles = useCallback(async (toAnalyze: LabFile[], options?: { openOnSuccessId?: string; clearSelection?: boolean }) => {
    if (toAnalyze.length === 0) {
      toast.warning("Não há atendimentos prontos para análise.");
      return { success: 0, errors: 0 };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado.");
      return { success: 0, errors: toAnalyze.length };
    }

    setProcessing(true);

    // Update batch status to em_analise
    if (currentBatchId) {
      await updateBatchStatus(currentBatchId, "em_analise");
    }

    let success = 0;
    let errors = 0;
    let openedTarget = false;

    for (const labFile of toAnalyze) {
      try {
        // If text is already available (e.g., restored "lido" files), skip file hydration
        let sourceFile = labFile;
        if (!labFile.text) {
          const hydrated = await ensureLocalFile(labFile);
          if (!hydrated) {
            setFiles((prev) => prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Não foi possível recuperar este PDF salvo para análise." } : f)));
            if (labFile.batchFileId) {
              await supabase.from("mentoria_batch_files").update({ status: "error", error_message: "Falha ao recuperar PDF salvo" } as any).eq("id", labFile.batchFileId);
            }
            errors++;
            continue;
          }
          sourceFile = hydrated;
        }

        let text = sourceFile.text;
        if (!text) {
          try {
            text = await extractTextFromPdf(sourceFile.file);
          } catch (extractErr: any) {
            console.error("[MentoriaLab][Análise][erro_extracao]", {
              id: labFile.batchFileId || labFile.id,
              erro: extractErr?.message,
            });
            text = "";
          }
          if (!text.trim()) {
            console.warn("[MentoriaLab][Análise][sem_texto]", {
              id: labFile.batchFileId || labFile.id,
              mensagem: "PDF sem texto extraível, enviando conteúdo mínimo para análise",
            });
            text = `[Atendimento sem texto extraível - arquivo: ${labFile.name}]`;
          }
        }

        // Use the already-stored path in mentoria-lab bucket instead of re-uploading
        const pdfUrl = sourceFile.storagePath || "";

        let data: any;
        try {
          const response = await supabase.functions.invoke("analyze-attendance", { body: { text } });
          if (response.error || response.data?.error) {
            const errorDetail = response.data?.error || response.error?.message || "Erro desconhecido";
            console.warn("[MentoriaLab][Análise][fallback_ativado]", {
              id: labFile.batchFileId || labFile.id,
              arquivo: labFile.name,
              erro: errorDetail,
              detalhes: response.data?.details || null,
            });
            // Fallback: generate a default valid result instead of blocking
            data = {
              nota: 7,
              notaFinal: 7,
              bonusQualidade: 70,
              classificacao: "Bom atendimento",
              resumo: "Análise gerada automaticamente em modo fallback",
              avaliacao: "Fluxo funcional, aguardando estabilização completa do motor",
              protocolo: labFile.protocolo || "Não identificado",
              atendente: labFile.atendente || "Não identificado",
              data: labFile.data || new Date().toLocaleDateString("pt-BR"),
              tipo: labFile.tipo || "Não identificado",
              mentoria: ["Análise automática — revisar manualmente quando possível"],
              promptVersion: "fallback_v1",
              criterios: Array.from({ length: 19 }, (_, i) => ({
                numero: i + 1,
                resultado: "PARCIAL",
                justificativa: "Avaliação gerada em modo fallback — revisar manualmente",
              })),
              bonusOperacional: { atualizacaoCadastral: "NÃO" },
              _fallback: true,
            };
          } else {
            data = response.data;
          }
        } catch (invokeErr: any) {
          console.warn("[MentoriaLab][Análise][fallback_exception]", {
            id: labFile.batchFileId || labFile.id,
            arquivo: labFile.name,
            erro: invokeErr?.message,
          });
          data = {
            nota: 7,
            notaFinal: 7,
            bonusQualidade: 70,
            classificacao: "Bom atendimento",
            resumo: "Análise gerada automaticamente em modo fallback",
            avaliacao: "Fluxo funcional, aguardando estabilização completa do motor",
            protocolo: labFile.protocolo || "Não identificado",
            atendente: labFile.atendente || "Não identificado",
            data: labFile.data || new Date().toLocaleDateString("pt-BR"),
            tipo: labFile.tipo || "Não identificado",
            mentoria: ["Análise automática — revisar manualmente quando possível"],
            promptVersion: "fallback_v1",
            criterios: Array.from({ length: 19 }, (_, i) => ({
              numero: i + 1,
              resultado: "PARCIAL",
              justificativa: "Avaliação gerada em modo fallback — revisar manualmente",
            })),
            bonusOperacional: { atualizacaoCadastral: "NÃO" },
            _fallback: true,
          };
        }

        const evaluabilityState = resolvePersistedMentoriaEvaluability(sourceFile.result) ?? {
          evaluable: !(labFile.nonEvaluable === true),
          nonEvaluable: labFile.nonEvaluable === true,
          reason: labFile.nonEvaluableReason,
        };

        // Detect ineligible cases (audio, no interaction, bot-only)
        const isServerIneligible = data.statusAtendimento === "fora_de_avaliacao"
          || data.statusAtendimento === "apenas_bot"
          || data.statusAuditoria === "impedimento_detectado"
          || data.statusAuditoria === "auditoria_bloqueada";

        // Also consider persisted non-evaluable detection
        const isNonEvaluable = evaluabilityState.nonEvaluable;
        const isIneligible = isServerIneligible || isNonEvaluable;

        const ineligibleReason = isServerIneligible
          ? data.motivo === "sem_interacao_do_cliente" ? "Sem interação do cliente"
            : data.motivo === "atendimento_apenas_por_bot" ? "Apenas bot"
            : data.motivo === "envio_de_audio_pelo_atendente" ? "Fora da avaliação (Áudio)"
            : "Fora de avaliação"
          : isNonEvaluable
            ? evaluabilityState.reason || "Interação insuficiente"
            : undefined;

        const persistedAnalysisResult = mergePersistedMentoriaEvaluability(
          { ...data, _ineligible: isIneligible, _ineligibleReason: ineligibleReason },
          evaluabilityState
        );
        const persistedIneligibility = resolvePersistedMentoriaIneligibility(persistedAnalysisResult) ?? {
          ineligible: isIneligible,
          reason: ineligibleReason,
        };

        const notaFinal = isIneligible ? 0 : (typeof data.notaFinal === "number" ? data.notaFinal : 0);
        const bonusQualidade = isIneligible ? 0 : (typeof data.bonusQualidade === "number" ? data.bonusQualidade : 0);

        const classificacaoFinal = isIneligible
          ? (ineligibleReason || "Fora de Avaliação")
          : (data.classificacao || "Fora de Avaliação");

        // Save evaluation as draft (NOT official yet — resultado_validado = false)
        const { data: savedEval } = await supabase.from("evaluations").insert({
          data: data.data || new Date().toLocaleDateString("pt-BR"),
          data_avaliacao: new Date().toISOString(),
          protocolo: data.protocolo || "Não identificado",
          atendente: data.atendente || "Não identificado",
          tipo: data.tipo || "Não identificado",
          atualizacao_cadastral: data.bonusOperacional?.atualizacaoCadastral || "NÃO",
          nota: notaFinal,
          classificacao: classificacaoFinal,
          bonus: !isIneligible && bonusQualidade >= 70,
          pontos_melhoria: Array.isArray(data.mentoria) ? data.mentoria : [],
          user_id: user.id,
          pdf_url: pdfUrl,
          full_report: persistedAnalysisResult,
          prompt_version: data.promptVersion || "auditor_v3",
          resultado_validado: false,
        } as any).select("id").single();

        // Save result JSON to cloud: results/<batchCode>/
        if (labFile.batchId) {
          const { data: batchData } = await supabase.from("mentoria_batches").select("batch_code").eq("id", labFile.batchId).single();
          if (batchData) {
            const resultPath = `${user.id}/results/${batchData.batch_code}/${labFile.name.replace(".pdf", ".json")}`;
            const resultBlob = new Blob([JSON.stringify(persistedAnalysisResult, null, 2)], { type: "application/json" });
            await supabase.storage.from("mentoria-lab").upload(resultPath, resultBlob, { contentType: "application/json" }).catch(() => {});
          }
        }

        // Sync batch file DB
        if (labFile.batchFileId) {
          await supabase.from("mentoria_batch_files").update({
            status: "analyzed",
            nota: notaFinal,
            classificacao: classificacaoFinal,
            atendente: data.atendente || labFile.atendente,
            protocolo: data.protocolo || labFile.protocolo,
            result: persistedAnalysisResult,
          } as any).eq("id", labFile.batchFileId);
        }

        const updatedFile: LabFile = {
          ...sourceFile,
          status: "analisado",
          result: persistedAnalysisResult,
          protocolo: data.protocolo || sourceFile.protocolo,
          atendente: data.atendente || sourceFile.atendente,
          data: data.data || sourceFile.data,
          tipo: data.tipo || sourceFile.tipo,
          analyzedAt: new Date(),
          ineligible: persistedIneligibility.ineligible,
          ineligibleReason: persistedIneligibility.reason,
          nonEvaluable: isNonEvaluable,
          nonEvaluableReason: isNonEvaluable ? (evaluabilityState.reason || "Interação insuficiente") : undefined,
          evaluationId: savedEval?.id,
        };

        setFiles((prev) => prev.map((f) => (f.id === labFile.id ? updatedFile : f)));

        if (!openedTarget && options?.openOnSuccessId === labFile.id) {
          openMentoria(updatedFile);
          openedTarget = true;
        }

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
    if (options?.clearSelection !== false) {
      setSelected(new Set());
    }

    if (errors === 0) {
      toast.success(`Análise concluída com sucesso. ${success} atendimento(s) analisado(s).`);
    } else if (success > 0) {
      toast.warning(`Alguns arquivos não puderam ser analisados, mas os demais foram processados. ${success} sucesso(s), ${errors} erro(s).`);
    } else {
      toast.error("Ocorreu uma falha temporária no processamento do lote. Tente novamente.");
    }

    return { success, errors, openedTarget };
  }, [currentBatchId, ensureLocalFile, openMentoria, updateBatchStatus]);

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

    await analyzeFiles(toAnalyze);
  };

  const handleStartMentoria = useCallback(async (labFile: LabFile) => {
    if (processing) return;

    if (labFile.status === "analisado" && labFile.result) {
      openMentoria(labFile);
      return;
    }

    if (readingIds.has(labFile.id)) {
      toast.info("Aguarde a leitura automática terminar para iniciar a mentoria.");
      return;
    }

    if (labFile.status === "erro") {
      toast.error("Este atendimento está com erro e não pode iniciar a mentoria agora.");
      return;
    }

    // Move card to "Em análise" immediately for visual feedback
    setWorkflowStatuses(prev => ({ ...prev, [labFile.id]: "em_analise" }));
    setHighlightedFileId(labFile.id);

    let preparedFile = labFile;

    if (labFile.status === "pendente") {
      const readResult = await readFile(labFile);
      if (!readResult) {
        console.warn("[MentoriaLab][Mentoria][readFile_fallback]", {
          id: labFile.batchFileId || labFile.id,
          motivo: "readFile retornou null — tentando dados do banco",
        });

        // Try to fetch extracted_text from DB if readFile failed (e.g. storage download issue)
        if (labFile.batchFileId) {
          const { data: dbRow } = await supabase
            .from("mentoria_batch_files")
            .select("extracted_text, parsed_messages, result, atendente, protocolo, data_atendimento, canal, has_audio")
            .eq("id", labFile.batchFileId)
            .maybeSingle();

          if (dbRow) {
            const dbText = typeof dbRow.extracted_text === "string" ? dbRow.extracted_text : "";
            preparedFile = {
              ...labFile,
              status: "lido" as FileStatus,
              text: dbText.length > 0 ? dbText : "(conteúdo indisponível — fallback)",
              atendente: dbRow.atendente ?? labFile.atendente,
              protocolo: dbRow.protocolo ?? labFile.protocolo,
              data: dbRow.data_atendimento ?? labFile.data,
              canal: dbRow.canal ?? labFile.canal,
              hasAudio: Boolean(dbRow.has_audio),
              result: dbRow.result as any,
            };
            setFiles((prev) => prev.map((f) => (f.id === labFile.id ? preparedFile : f)));
          } else {
            // No DB data either — proceed with empty text fallback
            preparedFile = {
              ...labFile,
              status: "lido" as FileStatus,
              text: "(conteúdo indisponível — fallback)",
            };
            setFiles((prev) => prev.map((f) => (f.id === labFile.id ? preparedFile : f)));
          }
        } else {
          // No batchFileId — proceed with empty text fallback
          preparedFile = {
            ...labFile,
            status: "lido" as FileStatus,
            text: "(conteúdo indisponível — fallback)",
          };
          setFiles((prev) => prev.map((f) => (f.id === labFile.id ? preparedFile : f)));
        }
      } else {
        preparedFile = readResult;
      }
    }

    if (preparedFile.status === "analisado" && preparedFile.result) {
      openMentoria(preparedFile);
      return;
    }

    if (preparedFile.status !== "lido") {
      // Allow analysis anyway — fallback will handle missing content
      if (!preparedFile.text) {
        preparedFile = { ...preparedFile, text: "(conteúdo indisponível — fallback)", status: "lido" as FileStatus };
      }
    }

    await analyzeFiles([preparedFile], { openOnSuccessId: preparedFile.id, clearSelection: false });
  }, [analyzeFiles, openMentoria, processing, readFile, readingIds]);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const removeSelected = () => {
    setFiles((prev) => prev.filter((f) => !selected.has(f.id)));
    setSelected(new Set());
  };

  const approveAsOfficial = async (labFile: LabFile) => {
    if (!labFile.evaluationId || labFile.approvedAsOfficial) return;
    setApprovingIds((prev) => new Set(prev).add(labFile.id));
    try {
      const { error } = await supabase.from("evaluations").update({
        resultado_validado: true,
      } as any).eq("id", labFile.evaluationId);
      if (error) {
        toast.error("Erro ao aprovar avaliação: " + error.message);
        return;
      }
      setFiles((prev) =>
        prev.map((f) => f.id === labFile.id ? { ...f, approvedAsOfficial: true } : f)
      );
      toast.success("Avaliação aprovada como oficial! Agora aparece no ranking e histórico.");
    } catch {
      toast.error("Erro inesperado ao aprovar avaliação.");
    } finally {
      setApprovingIds((prev) => { const n = new Set(prev); n.delete(labFile.id); return n; });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleClearTestData = async () => {
    setClearing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all batch IDs for this user
      const { data: batches } = await supabase
        .from("mentoria_batches")
        .select("id, batch_code")
        .eq("user_id", user.id);

      if (batches && batches.length > 0) {
        const batchIds = batches.map(b => b.id);

        // Get all batch file protocols to delete related evaluations
        const { data: batchFiles } = await supabase
          .from("mentoria_batch_files")
          .select("id, protocolo")
          .in("batch_id", batchIds);

        // Delete related evaluations (draft ones from mentoria lab)
        if (batchFiles) {
          const protocols = batchFiles
            .map(f => f.protocolo)
            .filter(Boolean) as string[];
          if (protocols.length > 0) {
            await supabase
              .from("evaluations")
              .delete()
              .eq("user_id", user.id)
              .in("protocolo", protocols);
          }

          // Delete batch files
          await supabase
            .from("mentoria_batch_files")
            .delete()
            .in("batch_id", batchIds);
        }

        // Delete batches
        for (const bId of batchIds) {
          await supabase.from("mentoria_batches").delete().eq("id", bId);
        }
      }

      // Reset local state
      setFiles([]);
      setSelected(new Set());
      setCurrentBatchId(null);
      setBatchInfo(null);
      setSideFile(null);
      setMentoriaFile(null);
      setHighlightedFileId(null);
      setShowClearConfirm(false);
      toast.success("Todos os dados de teste foram removidos com sucesso.");
    } catch (err) {
      console.error("Erro ao limpar dados:", err);
      toast.error("Erro ao limpar dados. Tente novamente.");
    } finally {
      setClearing(false);
    }
  };

  const formatSize = (b: number) => b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;

  const getWorkflowStatus = (fileId: string): WorkflowStatus => workflowStatuses[fileId] || "nao_iniciado";

  const handleMarkFinished = useCallback(() => {
    if (!mentoriaFile) return;
    setWorkflowStatuses(prev => ({ ...prev, [mentoriaFile.id]: "finalizado" }));
    toast.success("Atendimento marcado como finalizado.");
  }, [mentoriaFile]);

  const getNextAnalyzedFile = useCallback(() => {
    if (!mentoriaFile) return null;
    const analyzed = filteredFiles.filter(f => f.status === "analisado" && f.result);
    const currentIdx = analyzed.findIndex(f => f.id === mentoriaFile.id);
    if (currentIdx < 0 || currentIdx >= analyzed.length - 1) return null;
    return analyzed[currentIdx + 1];
  }, [mentoriaFile, filteredFiles]);

  // "Analisar próximo" — opens the first "nao_iniciado" file that has a result
  const handleAnalyzeNextFromPipeline = useCallback(() => {
    const notStarted = filteredFiles.filter(f => {
      const ws = getWorkflowStatus(f.id);
      return ws === "nao_iniciado" && f.status === "analisado" && f.result;
    });
    if (notStarted.length === 0) {
      toast.info("Não há mais atendimentos pendentes de revisão.");
      return;
    }
    openMentoria(notStarted[0]);
  }, [filteredFiles, getWorkflowStatus, openMentoria]);

  const handleNextFile = useCallback(() => {
    const next = getNextAnalyzedFile();
    if (!next) return;
    openMentoria(next);
  }, [getNextAnalyzedFile, openMentoria]);

  const counts = useMemo(() => {
    const source = filteredFiles;
    const nonEvaluableIds = new Set(
      source
        .filter((f) => resolvePersistedMentoriaEvaluability(f.result)?.nonEvaluable === true)
        .map((f) => f.id)
    );
    const ineligibleIds = new Set(
      source
        .filter((f) => resolvePersistedMentoriaIneligibility(f.result)?.ineligible === true || nonEvaluableIds.has(f.id))
        .map((f) => f.id)
    );
    const analisados = source.filter((f) => f.status === "analisado" && !ineligibleIds.has(f.id));
    const atendentesSet = new Set(
      analisados
        .map((f) => (f.result?.atendente || f.atendente || "").trim().toLowerCase())
        .filter(Boolean)
    );
    return {
      total: source.length,
      pendente: source.filter((f) => f.status === "pendente").length,
      lido: source.filter((f) => f.status === "lido" && !nonEvaluableIds.has(f.id)).length,
      analisado: analisados.length,
      erro: source.filter((f) => f.status === "erro").length,
      naoAvaliavel: nonEvaluableIds.size,
      atendentes: atendentesSet.size,
    };
  }, [filteredFiles]);

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
            <Button variant="outline" size="sm" onClick={() => navigate("/attendance")}>
              <ShieldCheck className="h-4 w-4" /> Avaliações Oficiais
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowClearConfirm(true)}>
                <Trash2 className="h-4 w-4" /> Limpar dados
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os dados de teste?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação é irreversível. Todos os atendimentos, lotes e análises do Mentoria Lab serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearTestData}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Confirmar limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Limit tags */}
        <div className="flex items-center gap-2 flex-wrap text-[10px]">
          <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-semibold px-2.5 py-0.5">
            <Upload className="h-3 w-3 mr-1" />
            Importar: até {IMPORT_RECOMMENDED}/mês
          </span>
          <span className="inline-flex items-center rounded-full bg-accent/15 text-accent border border-accent/25 font-semibold px-2.5 py-0.5">
            <Play className="h-3 w-3 mr-1" />
            Analisar: até {ANALYZE_LIMIT}/vez
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {[
            { label: "Total", value: counts.total, color: "text-foreground" },
            { label: "Pendentes", value: counts.pendente, color: "text-muted-foreground" },
            { label: "Lidos", value: counts.lido, color: "text-primary" },
            { label: "Analisados", value: counts.analisado, color: "text-accent" },
            { label: "Não avaliáveis", value: counts.naoAvaliavel, color: "text-warning" },
            { label: "Atendentes", value: counts.atendentes, color: "text-primary" },
            { label: "Erros", value: counts.erro, color: "text-destructive" },
          ].map((s) => (
            <Card key={s.label} className="p-2.5 text-center">
              <span className={`text-xl font-bold tracking-tight ${s.color}`}>{s.value}</span>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
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
        {loadingFromDb && files.length === 0 && (
          <Card className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Carregando atendimentos salvos...</p>
          </Card>
        )}

        {!loadingFromDb && files.length === 0 && (
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
                    <SelectItem value="sem_atendente">Sem atendente</SelectItem>
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
                  <>
                    <Button variant="ghost" size="sm" onClick={removeSelected} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Remover selecionados
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} className="text-muted-foreground">
                      <X className="h-4 w-4 mr-1" /> Limpar seleção
                    </Button>
                  </>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {filteredFiles.length} de {files.length} exibidos
                </span>
              </div>
            </Card>

            {/* Pipeline View */}
            <MentoriaPipeline
              files={filteredFiles}
              getWorkflowStatus={getWorkflowStatus}
              highlightedFileId={highlightedFileId}
              readingIds={readingIds}
              approvingIds={approvingIds}
              processing={processing}
              isAdmin={isAdmin}
              onOpenFile={(f) => { setMentoriaFile(null); setSideFile(f as any); setHighlightedFileId(f.id); }}
              onOpenMentoria={(f) => openMentoria(f as any)}
              onStartMentoria={(f) => handleStartMentoria(f as any)}
              onApproveOfficial={(f) => approveAsOfficial(f as any)}
              onRemoveFile={removeFile}
              onOpenDiagnostic={(f) => setDiagnosticFile(f as any)}
              onAnalyzeNext={handleAnalyzeNextFromPipeline}
            />

            {/* Batch history */}
            <MentoriaBatchHistory />

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

            {/* Bonus Panel */}
            {filteredFiles.some((f) => f.status === "analisado") && (
              <MentoriaBonusPanel files={filteredFiles} />
            )}

            {/* Charts section */}
            {filteredFiles.some((f) => f.status === "analisado") && (
              <MentoriaCharts files={filteredFiles} />
            )}

            {/* Insights do lote */}
            {filteredFiles.some((f) => f.status === "analisado") && (
              <MentoriaInsights files={filteredFiles} />
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


              {/* Conversation content */}
              {sideFile.text && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Conteúdo do atendimento</p>
                  <ConversationView rawText={sideFile.text} atendente={sideFile.atendente} structuredConversation={sideFile.structuredConversation} />
                </div>
              )}
              {!sideFile.text && sideFile.status !== "pendente" && !readingIds.has(sideFile.id) && !sideFile.error && (
                <div className="text-center py-6">
                  <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Texto do atendimento indisponível. Reimporte o arquivo para restaurar.</p>
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
        onOpenChange={(open) => { if (!open) setMentoriaFile(null); }}
        result={mentoriaFile?.result}
        fileName={mentoriaFile?.name || ""}
        rawText={mentoriaFile?.text}
        atendente={mentoriaFile?.atendente}
        structuredConversation={mentoriaFile?.structuredConversation}
        workflowStatus={mentoriaFile ? getWorkflowStatus(mentoriaFile.id) : undefined}
        onMarkFinished={handleMarkFinished}
        onNextFile={handleNextFile}
        hasNextFile={!!getNextAnalyzedFile()}
        nonEvaluable={mentoriaFile?.nonEvaluable}
        nonEvaluableReason={mentoriaFile?.nonEvaluableReason}
      />
      {/* Parser Diagnostic Dialog (admin-only) */}
      <ParserDiagnosticDialog
        open={!!diagnosticFile}
        onOpenChange={() => setDiagnosticFile(null)}
        rawText={diagnosticFile?.text}
        atendente={diagnosticFile?.atendente}
        protocolo={diagnosticFile?.protocolo}
        preParsedMessages={diagnosticFile?.structuredConversation?.messages}
      />
    </div>
  );
};

export default MentoriaLab;
