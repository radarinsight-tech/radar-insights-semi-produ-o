import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, LogOut, Upload, FileText, Trash2, Eye, Play, Loader2,
  Search, X, Filter, Volume2, VolumeX, BookOpen
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
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import logoSymbol from "@/assets/logo-symbol.png";
import { toast } from "sonner";
import MentoriaInsights from "@/components/MentoriaInsights";

type FileStatus = "pendente" | "lido" | "analisado" | "erro";

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
}

const statusConfig: Record<FileStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  lido: { label: "Lido", color: "bg-blue-100 text-blue-700" },
  analisado: { label: "Analisado", color: "bg-accent/15 text-accent" },
  erro: { label: "Erro", color: "bg-destructive/15 text-destructive" },
};

/** Extract channel from text heuristics */
function detectCanal(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("whatsapp") || lower.includes("wpp")) return "WhatsApp";
  if (lower.includes("telefone") || lower.includes("ligação") || lower.includes("chamada")) return "Telefone";
  if (lower.includes("e-mail") || lower.includes("email")) return "E-mail";
  if (lower.includes("chat")) return "Chat";
  return "Não identificado";
}

/** Detect if audio references exist */
function detectAudio(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(áudio|audio|gravação|gravacao|escuta|ligação|ligacao|chamada)\b/.test(lower);
}

const MentoriaLab = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<LabFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [readingIds, setReadingIds] = useState<Set<string>>(new Set());
  const [sideFile, setSideFile] = useState<LabFile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filters
  const [filterAtendente, setFilterAtendente] = useState("todos");
  const [filterPeriodo, setFilterPeriodo] = useState("");
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

  // Auto-read a file
  const readFile = useCallback(async (labFile: LabFile) => {
    setReadingIds((prev) => new Set(prev).add(labFile.id));
    try {
      const text = await extractTextFromPdf(labFile.file);
      if (!text.trim()) {
        setFiles((prev) =>
          prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Sem texto extraído" } : f))
        );
        return;
      }
      const protocolMatch = text.match(/(?:protocolo|prot\.?)\s*[:\-]?\s*([A-Za-z0-9]+)/i);
      const atendenteMatch = text.match(/(?:atendente|agente|operador)\s*[:\-]?\s*([^\n]+)/i);
      const dataMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      const canal = detectCanal(text);
      const hasAudio = detectAudio(text);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === labFile.id
            ? {
                ...f,
                status: "lido",
                text,
                protocolo: protocolMatch?.[1] || undefined,
                atendente: atendenteMatch?.[1]?.trim() || undefined,
                data: dataMatch?.[1] || undefined,
                canal,
                hasAudio,
              }
            : f
        )
      );
    } catch {
      setFiles((prev) =>
        prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Falha na leitura" } : f))
      );
    } finally {
      setReadingIds((prev) => {
        const next = new Set(prev);
        next.delete(labFile.id);
        return next;
      });
    }
  }, []);

  // Multi-file upload + auto-read
  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const pdfs = Array.from(newFiles).filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) {
      toast.error("Selecione apenas arquivos PDF.");
      return;
    }
    const entries: LabFile[] = pdfs.map((f) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      name: f.name,
      size: f.size,
      addedAt: new Date(),
      status: "pendente" as FileStatus,
    }));
    setFiles((prev) => [...prev, ...entries]);
    toast.success(`${pdfs.length} arquivo(s) importado(s). Leitura automática iniciada.`);
    // Auto-read each
    entries.forEach((entry) => readFile(entry));
  }, [readFile]);

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
      if (filterPeriodo) {
        if (f.data) {
          const parts = f.data.split("/");
          if (parts.length === 3) {
            const ym = `${parts[2]}-${parts[1]}`;
            if (ym !== filterPeriodo) return false;
          }
        } else {
          return false;
        }
      }
      return true;
    });
  }, [files, searchTerm, filterAtendente, filterCanal, filterAudio, filterPeriodo]);

  const toggleSelectAll = () => {
    if (selected.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  // Batch analyze
  const analyzeSelected = async () => {
    const toAnalyze = files.filter((f) => selected.has(f.id) && (f.status === "lido" || f.status === "pendente"));
    if (toAnalyze.length === 0) {
      toast.warning("Selecione arquivos lidos ou pendentes para análise.");
      return;
    }
    setProcessing(true);
    let success = 0;
    let errors = 0;

    for (const labFile of toAnalyze) {
      try {
        let text = labFile.text;
        if (!text) {
          text = await extractTextFromPdf(labFile.file);
          if (!text.trim()) {
            setFiles((prev) => prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Sem texto" } : f)));
            errors++;
            continue;
          }
        }

        const fileName = `mentoria_${Date.now()}_${labFile.name}`;
        await supabase.storage.from("pdfs").upload(fileName, labFile.file, { contentType: "application/pdf" });
        const { data: urlData } = supabase.storage.from("pdfs").getPublicUrl(fileName);

        const { data, error } = await supabase.functions.invoke("analyze-attendance", { body: { text } });

        if (error || data?.error) {
          setFiles((prev) => prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: data?.error || "Erro na análise" } : f)));
          errors++;
          continue;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Não autenticado");

        const notaFinal = typeof data.notaFinal === "number" ? data.notaFinal : 0;
        const bonusQualidade = typeof data.bonusQualidade === "number" ? data.bonusQualidade : 0;

        await supabase.from("evaluations").insert({
          data: data.data || new Date().toLocaleDateString("pt-BR"),
          protocolo: data.protocolo || "Não identificado",
          atendente: data.atendente || "Não identificado",
          tipo: data.tipo || "Não identificado",
          atualizacao_cadastral: data.bonusOperacional?.atualizacaoCadastral || "NÃO",
          nota: notaFinal,
          classificacao: data.classificacao || "Fora de Avaliação",
          bonus: bonusQualidade >= 70,
          pontos_melhoria: Array.isArray(data.mentoria) ? data.mentoria : [],
          user_id: user.id,
          pdf_url: urlData.publicUrl,
          full_report: { ...data },
          prompt_version: data.promptVersion || "auditor_v3",
          resultado_validado: true,
        } as any);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === labFile.id
              ? { ...f, status: "analisado", result: data, protocolo: data.protocolo || f.protocolo, atendente: data.atendente || f.atendente, data: data.data || f.data }
              : f
          )
        );
        success++;
      } catch {
        setFiles((prev) => prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Erro inesperado" } : f)));
        errors++;
      }
    }

    setProcessing(false);
    setSelected(new Set());
    toast.success(`Análise concluída: ${success} sucesso(s), ${errors} erro(s).`);
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

  const counts = useMemo(() => ({
    total: files.length,
    pendente: files.filter((f) => f.status === "pendente").length,
    lido: files.filter((f) => f.status === "lido").length,
    analisado: files.filter((f) => f.status === "analisado").length,
    erro: files.filter((f) => f.status === "erro").length,
  }), [files]);

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
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: counts.total, color: "text-foreground" },
            { label: "Pendentes", value: counts.pendente, color: "text-muted-foreground" },
            { label: "Lidos", value: counts.lido, color: "text-blue-600" },
            { label: "Analisados", value: counts.analisado, color: "text-accent" },
            { label: "Erros", value: counts.erro, color: "text-destructive" },
          ].map((s) => (
            <Card key={s.label} className="p-3 text-center">
              <span className={`text-2xl font-bold tracking-tight ${s.color}`}>{s.value}</span>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Upload zone */}
        <Card className="p-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Arraste os PDFs aqui ou clique para selecionar <strong>múltiplos arquivos</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Upload múltiplo com leitura automática</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
            className="hidden"
          />
        </Card>

        {/* Filters + Actions */}
        {files.length > 0 && (
          <>
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Atendimentos importados</h3>
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

                {/* Período */}
                <Input
                  type="month"
                  value={filterPeriodo}
                  onChange={(e) => setFilterPeriodo(e.target.value)}
                  className="w-[160px]"
                  placeholder="Período"
                />

                {/* Canal */}
                <Select value={filterCanal} onValueChange={setFilterCanal}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos canais</SelectItem>
                    {canais.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
            <Card className="overflow-hidden">
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
                      <th className="p-3 text-left font-medium text-muted-foreground">Data</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Canal</th>
                      <th className="p-3 text-center font-medium text-muted-foreground">Áudio</th>
                      <th className="p-3 text-center font-medium text-muted-foreground">Status</th>
                      <th className="p-3 text-center font-medium text-muted-foreground">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((f) => (
                      <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
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
                        <td className="p-3 text-muted-foreground">
                          {readingIds.has(f.id) ? <Loader2 className="h-3 w-3 animate-spin inline" /> : (f.atendente || "—")}
                        </td>
                        <td className="p-3 text-muted-foreground">{f.data || "—"}</td>
                        <td className="p-3 text-muted-foreground">{f.canal || "—"}</td>
                        <td className="p-3 text-center">
                          {f.hasAudio === undefined ? (
                            "—"
                          ) : f.hasAudio ? (
                            <Volume2 className="h-4 w-4 text-accent mx-auto" />
                          ) : (
                            <VolumeX className="h-4 w-4 text-muted-foreground/40 mx-auto" />
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
                            {f.status === "analisado" && f.result?.notaFinal != null && f.result.notaFinal < 7 && (
                              <Badge className="bg-warning/15 text-warning text-[10px] whitespace-nowrap">
                                Necessita mentoria
                              </Badge>
                            )}
                          </div>
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
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          Nenhum atendimento encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Insights da Mentoria - prominent section after analyses */}
            {files.some((f) => f.status === "analisado") && (
              <div id="mentoria-insights" className="scroll-mt-6">
                <div className="relative">
                  <div className="absolute -inset-3 bg-primary/[0.03] rounded-2xl -z-10" />
                  <MentoriaInsights files={files} />
                </div>
              </div>
            )}
          </>
        )}

        {files.length === 0 && (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum arquivo carregado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Faça upload de PDFs de atendimentos para começar a preparar a mentoria.</p>
          </Card>
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
                  { label: "Data", value: sideFile.data },
                  { label: "Canal", value: sideFile.canal },
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
                      <p className="text-xl font-bold text-foreground">{sideFile.result.notaFinal ?? "—"}</p>
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

              {/* Text content */}
              {sideFile.text && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Conteúdo extraído</p>
                  <div className="bg-muted/30 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed text-foreground border border-border">
                    {sideFile.text}
                  </div>
                </div>
              )}

              {sideFile.error && (
                <p className="text-xs text-destructive">Erro: {sideFile.error}</p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MentoriaLab;
