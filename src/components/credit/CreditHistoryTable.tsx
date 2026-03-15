import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileSearch, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ActionButton from "@/components/ActionButton";
import CreditFilters, { type CreditFilterValues } from "./CreditFilters";
import CreditReportDialog from "./CreditReportDialog";
import type { CreditAnalysisData } from "./CreditAnalysisResult";
import jsPDF from "jspdf";
import { parse, isWithinInterval } from "date-fns";
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

interface CreditHistoryEntry {
  id: string;
  created_at: string;
  cpf_cnpj: string;
  doc_type: string;
  nome: string | null;
  user_name: string | null;
  decisao_final: string | null;
  regra_aplicada: string | null;
  observacoes: string | null;
  status: string;
  resultado: CreditAnalysisData | null;
}

const decisionBadge = (d: string | null) => {
  switch (d) {
    case "APROVADO":
      return <Badge className="bg-accent text-accent-foreground">Aprovado</Badge>;
    case "APROVADO COM RESSALVA":
      return <Badge className="bg-warning text-warning-foreground">Com Ressalva</Badge>;
    case "REPROVADO":
      return <Badge className="bg-destructive text-destructive-foreground">Reprovado</Badge>;
    default:
      return <Badge variant="outline">—</Badge>;
  }
};

const statusBadge = (s: string) => {
  if (s === "reanalise") return <Badge variant="outline" className="text-xs">Reanálise</Badge>;
  return <Badge variant="secondary" className="text-xs">Nova</Badge>;
};

const formatCpfCnpj = (value: string, type: string) => {
  if (type === "CNPJ" && value.length === 14) {
    return `${value.slice(0,2)}.${value.slice(2,5)}.${value.slice(5,8)}/${value.slice(8,12)}-${value.slice(12)}`;
  }
  if (value.length === 11) {
    return `${value.slice(0,3)}.${value.slice(3,6)}.${value.slice(6,9)}-${value.slice(9)}`;
  }
  return value;
};

const exportSinglePdf = (data: CreditAnalysisData, cpfCnpj: string) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 15;
  const maxW = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 20;
  const addText = (text: string, size: number, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += size * 0.45;
    }
  };
  const gap = (g = 4) => { y += g; };

  addText("RADAR INSIGHT — ANÁLISE DE CRÉDITO", 14, true); gap(6);
  addText(`Nome: ${data.nome}`, 10);
  addText(`CPF/CNPJ: ${data.cpf}`, 10);
  addText(`Idade: ${data.idade}`, 10);
  addText(`Registros Negativos: ${data.quantidadeRegistrosNegativos}`, 10);
  addText(`Valor Total: ${data.valorTotalDividas}`, 10);
  addText(`Decisão: ${data.decisaoFinal}`, 10, true); gap(6);
  addText("CREDORES", 12, true); gap(3);
  if (data.credores?.length) {
    data.credores.forEach(c => addText(`• ${c.nome} (${c.tipo}) — ${c.valor}`, 9));
  }
  gap(6);
  addText("REGRA APLICADA", 12, true); gap(3);
  addText(data.regraAplicada || "—", 9); gap(6);
  addText("ORIENTAÇÃO", 12, true); gap(3);
  addText(data.orientacaoOperacional || "—", 9); gap(6);
  addText("OBSERVAÇÕES", 12, true); gap(3);
  addText(data.observacoes || "—", 9);
  doc.save(`analise_credito_${cpfCnpj}.pdf`);
};

interface Props {
  refreshTrigger: number;
}

const CreditHistoryTable = ({ refreshTrigger }: Props) => {
  const [entries, setEntries] = useState<CreditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState<CreditFilterValues>({
    usuario: "todos",
    decisao: "todos",
    busca: "",
  });
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [dialogData, setDialogData] = useState<CreditAnalysisData | null>(null);
  const [dialogCpf, setDialogCpf] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CreditHistoryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("credit_analyses" as any)
      .select("*")
      .order("created_at", { ascending: false }) as any;

    if (error) {
      console.error("Error fetching credit history:", error);
      setEntries([]);
    } else {
      setEntries(data || []);
      const names = [...new Set((data || []).map((e: any) => e.user_name).filter(Boolean))] as string[];
      setUsuarios(names);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

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

  const filteredEntries = entries.filter((e) => {
    if (filters.usuario !== "todos" && e.user_name !== filters.usuario) return false;
    if (filters.decisao !== "todos" && e.decisao_final !== filters.decisao) return false;
    if (filters.busca) {
      const search = filters.busca.toLowerCase();
      const matchName = e.nome?.toLowerCase().includes(search);
      const matchCpf = e.cpf_cnpj?.includes(filters.busca.replace(/\D/g, ""));
      if (!matchName && !matchCpf) return false;
    }
    if (filters.periodoInicio && filters.periodoFim) {
      const entryDate = new Date(e.created_at);
      const start = parse(filters.periodoInicio, "dd/MM/yyyy", new Date());
      const end = parse(filters.periodoFim, "dd/MM/yyyy", new Date());
      end.setHours(23, 59, 59, 999);
      if (!isWithinInterval(entryDate, { start, end })) return false;
    }
    return true;
  });

  const handleView = (entry: CreditHistoryEntry) => {
    if (!entry.resultado) {
      toast.info("Resultado completo não disponível para esta consulta.");
      return;
    }
    setDialogData(entry.resultado);
    setDialogCpf(entry.cpf_cnpj);
    setDialogOpen(true);
  };

  const handleDownloadPdf = (entry: CreditHistoryEntry) => {
    if (!entry.resultado) {
      toast.info("Resultado não disponível para exportação.");
      return;
    }
    exportSinglePdf(entry.resultado, entry.cpf_cnpj);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("credit_analyses" as any)
        .delete()
        .eq("id", deleteTarget.id) as any;
      if (error) {
        toast.error("Erro ao excluir consulta.");
      } else {
        toast.success("Consulta excluída com sucesso.");
        fetchData();
      }
    } catch {
      toast.error("Erro ao excluir consulta.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Histórico de Consultas de Crédito</h2>

        <div className="mb-4">
          <CreditFilters usuarios={usuarios} filters={filters} onChange={setFilters} />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Decisão</TableHead>
                <TableHead>Regra aplicada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma consulta encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{e.nome || "—"}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {formatCpfCnpj(e.cpf_cnpj, e.doc_type)}
                    </TableCell>
                    <TableCell className="text-sm">{e.user_name || "—"}</TableCell>
                    <TableCell>{decisionBadge(e.decisao_final)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {e.regra_aplicada || "—"}
                    </TableCell>
                    <TableCell>{statusBadge(e.status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <ActionButton
                          icon={FileSearch}
                          tooltip="Ver análise completa"
                          onClick={() => handleView(e)}
                        />
                        <ActionButton
                          icon={Download}
                          tooltip="Baixar PDF da análise"
                          disabled={!e.resultado}
                          onClick={() => handleDownloadPdf(e)}
                        />
                        {isAdmin && (
                          <ActionButton
                            icon={Trash2}
                            tooltip="Excluir consulta"
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

      <CreditReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        data={dialogData}
        cpfCnpj={dialogCpf}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir consulta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a consulta de{" "}
              <strong>{deleteTarget?.nome || deleteTarget?.cpf_cnpj}</strong>? Esta ação não pode ser desfeita.
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

export default CreditHistoryTable;
