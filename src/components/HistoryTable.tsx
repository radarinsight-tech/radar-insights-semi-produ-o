import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Download, ExternalLink, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HistoryEntry } from "@/lib/mockData";
import FullReportDialog, { type FullReport } from "@/components/FullReportDialog";

interface Props {
  entries: HistoryEntry[];
}

const classColor = (c: string) => {
  if (c === "Excelente" || c === "Ótimo") return "bg-accent text-accent-foreground";
  if (c === "Bom") return "bg-primary text-primary-foreground";
  return "bg-warning text-warning-foreground";
};

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

const handleOpen = async (pdfUrl: string) => {
  const path = extractStoragePath(pdfUrl);
  if (!path) {
    toast.error("Caminho do PDF inválido.");
    return;
  }
  const { data, error } = await supabase.storage.from("pdfs").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    toast.error("Erro ao gerar link do PDF.");
    return;
  }
  window.open(data.signedUrl, "_blank");
};

const HistoryTable = ({ entries }: Props) => {
  const [selectedReport, setSelectedReport] = useState<FullReport | null>(null);
  const [selectedProtocolo, setSelectedProtocolo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const openReport = (entry: HistoryEntry) => {
    if (!entry.full_report) {
      toast.info("Relatório completo não disponível para esta avaliação.");
      return;
    }
    setSelectedReport(entry.full_report as unknown as FullReport);
    setSelectedProtocolo(entry.protocolo);
    setDialogOpen(true);
  };

  return (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Histórico de Avaliações</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e.protocolo}>
                    <TableCell className="text-sm">{e.data}</TableCell>
                    <TableCell className="text-sm font-medium">{e.protocolo}</TableCell>
                    <TableCell className="text-sm">{e.atendente}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">{e.nota.toFixed(1)}</TableCell>
                    <TableCell>
                      <Badge className={classColor(e.classificacao)}>{e.classificacao}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={e.bonus ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                        {e.bonus ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Ver avaliação completa"
                          onClick={() => openReport(e)}
                        >
                          <FileSearch className="h-4 w-4" />
                        </Button>
                        {e.pdf_url && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Baixar PDF"
                              onClick={() => handleDownload(e.pdf_url!, e.protocolo)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Abrir PDF"
                              onClick={() => handleOpen(e.pdf_url!)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </>
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
    </>
  );
};

export default HistoryTable;
