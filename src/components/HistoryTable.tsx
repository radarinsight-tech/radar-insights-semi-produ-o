import { useState, useEffect } from "react";
import { formatNota, classificarNota, classColorFromClassificacao, formatDateBR } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Download, FileSearch, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HistoryEntry } from "@/lib/mockData";
import FullReportDialog, { type FullReport } from "@/components/FullReportDialog";
import ActionButton from "@/components/ActionButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  entries: HistoryEntry[];
  onRefresh?: () => void;
}


const extractStoragePath = (url: string): string | null => {
  const match = url.match(/\/object\/public\/pdfs\/(.+)$/);
  return match ? match[1] : null;
};

const handleDownload = async (pdfUrl: string, protocolo: string) => {
  const path = extractStoragePath(pdfUrl);
  if (!path) {
    toast.error("Caminho do PDF inválido.");
    return;
  }
  const { data, error } = await supabase.storage.from("pdfs").download(path);
  if (error || !data) {
    toast.error("Erro ao baixar o PDF.");
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${protocolo}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};


const HistoryTable = ({ entries, onRefresh }: Props) => {
  const [selectedReport, setSelectedReport] = useState<FullReport | null>(null);
  const [selectedProtocolo, setSelectedProtocolo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, []);

  const openReport = (entry: HistoryEntry) => {
    if (!entry.full_report) {
      toast.info("Relatório completo não disponível para esta avaliação.");
      return;
    }
    setSelectedReport(entry.full_report as unknown as FullReport);
    setSelectedProtocolo(entry.protocolo);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-evaluation", {
        body: { evaluationId: deleteTarget.id },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro ao excluir avaliação.");
      } else {
        toast.success("Avaliação excluída com sucesso.");
        onRefresh?.();
      }
    } catch {
      toast.error("Erro ao excluir avaliação.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Histórico de Avaliações</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Atendimento</TableHead>
                <TableHead>Data Avaliação</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Atendente</TableHead>
                <TableHead className="text-right">Nota</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Bônus</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{formatDateBR(e.data)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.data_avaliacao}</TableCell>
                    <TableCell className="text-sm font-medium">{e.protocolo}</TableCell>
                    <TableCell className="text-sm">{e.atendente}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">{formatNota(e.nota)}</TableCell>
                    <TableCell>
                      <Badge className={classColorFromClassificacao(classificarNota(e.nota))}>{classificarNota(e.nota)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={e.bonus ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                        {e.bonus ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <ActionButton
                          icon={FileSearch}
                          tooltip="Ver avaliação completa"
                          onClick={() => openReport(e)}
                        />
                        <ActionButton
                          icon={Download}
                          tooltip="Baixar PDF do atendimento"
                          disabled={!e.pdf_url}
                          onClick={() => e.pdf_url && handleDownload(e.pdf_url, e.protocolo)}
                        />
                        {isAdmin && (
                          <ActionButton
                            icon={Trash2}
                            tooltip="Excluir avaliação"
                            destructive
                            onClick={() => setDeleteTarget(e)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <FullReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        report={selectedReport}
        protocolo={selectedProtocolo}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a avaliação do protocolo{" "}
              <strong>{deleteTarget?.protocolo}</strong>? Esta ação não pode ser desfeita.
              {deleteTarget?.pdf_url && " O PDF associado também será removido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default HistoryTable;
