import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Upload, FileText, Trash2, Eye, Play, Loader2, CheckSquare, Square, Search, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import logoSymbol from "@/assets/logo-symbol.png";
import { toast } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";

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
}

const statusConfig: Record<FileStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  lido: { label: "Lido", color: "bg-blue-100 text-blue-700" },
  analisado: { label: "Analisado", color: "bg-accent/15 text-accent" },
  erro: { label: "Erro", color: "bg-destructive/15 text-destructive" },
};

const MentoriaLab = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<LabFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<LabFile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Multi-file upload
  const handleFiles = (newFiles: FileList | File[]) => {
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
    toast.success(`${pdfs.length} arquivo(s) adicionado(s).`);
  };

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

  const toggleSelectAll = () => {
    if (selected.size === filteredFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  // Auto-read single file
  const readFile = useCallback(async (labFile: LabFile) => {
    setReading(labFile.id);
    try {
      const text = await extractTextFromPdf(labFile.file);
      if (!text.trim()) {
        setFiles((prev) =>
          prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Sem texto extraído" } : f))
        );
        return;
      }
      // Extract metadata
      const protocolMatch = text.match(/(?:protocolo|prot\.?)\s*[:\-]?\s*([A-Za-z0-9]+)/i);
      const atendenteMatch = text.match(/(?:atendente|agente|operador)\s*[:\-]?\s*([^\n]+)/i);
      const dataMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);

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
              }
            : f
        )
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === labFile.id ? { ...f, status: "erro", error: "Falha na leitura" } : f
        )
      );
    } finally {
      setReading(null);
    }
  }, []);

  // Batch analyze selected
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
            setFiles((prev) =>
              prev.map((f) => (f.id === labFile.id ? { ...f, status: "erro", error: "Sem texto" } : f))
            );
            errors++;
            continue;
          }
        }

        // Upload PDF
        const fileName = `mentoria_${Date.now()}_${labFile.name}`;
        await supabase.storage.from("pdfs").upload(fileName, labFile.file, { contentType: "application/pdf" });
        const { data: urlData } = supabase.storage.from("pdfs").getPublicUrl(fileName);

        // Analyze
        const { data, error } = await supabase.functions.invoke("analyze-attendance", {
          body: { text },
        });

        if (error || data?.error) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === labFile.id ? { ...f, status: "erro", error: data?.error || "Erro na análise" } : f
            )
          );
          errors++;
          continue;
        }

        // Save to evaluations
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Não autenticado");

        const fullReport = { ...data };
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
          full_report: fullReport,
          prompt_version: data.promptVersion || "auditor_v3",
          resultado_validado: true,
        } as any);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === labFile.id
              ? {
                  ...f,
                  status: "analisado",
                  result: data,
                  protocolo: data.protocolo || f.protocolo,
                  atendente: data.atendente || f.atendente,
                  data: data.data || f.data,
                }
              : f
          )
        );
        success++;
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === labFile.id ? { ...f, status: "erro", error: "Erro inesperado" } : f
          )
        );
        errors++;
      }
    }

    setProcessing(false);
    setSelected(new Set());
    toast.success(`Análise concluída: ${success} sucesso(s), ${errors} erro(s).`);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const removeSelected = () => {
    setFiles((prev) => prev.filter((f) => !selected.has(f.id)));
    setSelected(new Set());
  };

  // Filters
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase()) && !f.protocolo?.toLowerCase().includes(searchTerm.toLowerCase()) && !f.atendente?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (statusFilter !== "todos" && f.status !== statusFilter) return false;
      return true;
    });
  }, [files, searchTerm, statusFilter]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const counts = useMemo(() => ({
    total: files.length,
    pendente: files.filter((f) => f.status === "pendente").length,
    lido: files.filter((f) => f.status === "lido").length,
    analisado: files.filter((f) => f.status === "analisado").length,
    erro: files.filter((f) => f.status === "erro").length,
  }), [files]);

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
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
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
              <p className="text-2xl font-bold tracking-tight" style={{ color: undefined }}>
                <span className={s.color}>{s.value}</span>
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Upload zone */}
        <Card className="p-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById("mentoria-file-input")?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Arraste os PDFs aqui ou clique para selecionar <strong>múltiplos arquivos</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Somente arquivos PDF — upload múltiplo habilitado</p>
          </div>
          <input
            id="mentoria-file-input"
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />
        </Card>

        {/* Toolbar */}
        {files.length > 0 && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, protocolo ou atendente..."
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

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="lido">Lido</SelectItem>
                  <SelectItem value="analisado">Analisado</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                </SelectContent>
              </Select>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={analyzeSelected}
                  disabled={selected.size === 0 || processing}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Analisar selecionados ({selected.size})
                </Button>
                {selected.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={removeSelected} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* File table */}
        {filteredFiles.length > 0 && (
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
                    <th className="p-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Protocolo</th>
                    <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Atendente</th>
                    <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Data</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">Status</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((f) => (
                    <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <Checkbox
                          checked={selected.has(f.id)}
                          onCheckedChange={() => toggleSelect(f.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[200px]">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">
                        {f.protocolo || "—"}
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">
                        {f.atendente || "—"}
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">
                        {f.data || "—"}
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={`${statusConfig[f.status].color} text-xs`}>
                          {statusConfig[f.status].label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => readFile(f)}
                            disabled={reading === f.id || f.status === "lido" || f.status === "analisado"}
                            title="Ler PDF"
                          >
                            {reading === f.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setPreviewFile(f)}
                            disabled={!f.text && f.status === "pendente"}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeFile(f.id)}
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {files.length === 0 && (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum arquivo carregado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Faça upload de PDFs de atendimentos para começar.</p>
          </Card>
        )}
      </main>

      {/* Preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {previewFile?.name}
            </DialogTitle>
          </DialogHeader>
          {previewFile?.result && (
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Nota</p>
                  <p className="text-lg font-bold text-foreground">{previewFile.result.notaFinal ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Classificação</p>
                  <p className="text-lg font-bold text-foreground">{previewFile.result.classificacao ?? "—"}</p>
                </div>
              </div>
              {previewFile.result.mentoria && previewFile.result.mentoria.length > 0 && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs font-semibold text-primary mb-2">Pontos de Mentoria</p>
                  <ul className="space-y-1">
                    {previewFile.result.mentoria.map((m: string, i: number) => (
                      <li key={i} className="text-xs text-foreground">• {m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {previewFile?.text ? (
            <div className="bg-muted/30 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed text-foreground">
              {previewFile.text}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Arquivo ainda não foi lido. Clique em "Ler PDF" na tabela primeiro.
            </p>
          )}
          {previewFile?.error && (
            <p className="text-xs text-destructive mt-2">Erro: {previewFile.error}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MentoriaLab;
