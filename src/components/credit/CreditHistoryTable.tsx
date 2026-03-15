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

const normalizeFaixa = (d: string | null): string => {
  if (!d) return "";
  const upper = d.toUpperCase().trim();
  if (upper === "ISENTAR" || upper === "ISENTA") return "ISENTAR";
  if (upper === "TAXA_R$100" || upper === "IMPOSTO_R$100") return "TAXA_R$100";
  if (upper === "TAXA_R$200" || upper === "IMPOSTO_R$200") return "TAXA_R$200";
  if (upper === "TAXA_R$300" || upper === "IMPOSTO_R$300") return "TAXA_R$300";
  if (upper === "TAXA_R$400" || upper === "IMPOSTO_R$400") return "TAXA_R$400";
  if (upper === "TAXA_R$1000" || upper === "IMPOSTO_R$1000") return "TAXA_R$1000";
  return "";
};

const faixaBadge = (d: string | null) => {
  const faixa = normalizeFaixa(d);
  switch (faixa) {
    case "ISENTAR":
      return <Badge className="bg-accent text-accent-foreground">Isenção</Badge>;
    case "TAXA_R$100":
      return <Badge className="bg-warning/80 text-warning-foreground">R$ 100,00</Badge>;
    case "TAXA_R$200":
      return <Badge className="bg-warning text-warning-foreground">R$ 200,00</Badge>;
    case "TAXA_R$300":
      return <Badge className="bg-destructive/80 text-destructive-foreground">R$ 300,00</Badge>;
    case "TAXA_R$400":
      return <Badge className="bg-destructive text-destructive-foreground">R$ 400,00</Badge>;
    case "TAXA_R$1000":
      return <Badge className="bg-destructive text-destructive-foreground">R$ 1.000,00</Badge>;
    default:
      return <Badge variant="outline">Sem faixa definida</Badge>;
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

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  addText(`CPF/CNPJ: ${data.cpf_cnpj || data.cpf || cpfCnpj}`, 10);
  if (data.tipo_pessoa) addText(`Tipo: ${data.tipo_pessoa}`, 10);
  if (data.score) addText(`Score: ${data.score}`, 10);
  addText(`Registros Negativos: ${data.quantidade_registros_negativos ?? data.quantidadeRegistrosNegativos ?? 0}`, 10);
  addText(`Valor Total: ${data.valor_total_negativado || data.valorTotalDividas || "—"}`, 10);
  gap(4);

  if (data.regra_aplicada) {
    addText(`Regra Aplicada: ${data.regra_aplicada}`, 10, true);
    addText(`Classificação: ${data.classificacao_final}`, 10);
    addText(`Protesto: ${data.possui_protesto ? "SIM" : "NÃO"}`, 10);
    addText(`Débito Provedor: ${data.possui_debito_provedor ? "SIM" : "NÃO"}`, 10);
    addText(`Documento: ${data.documento_em_nome_do_contratante ? "Válido" : "Não apresentado"}`, 10);
    gap(4);
    addText("COMPOSIÇÃO DE TAXAS", 12, true); gap(3);
    addText(`Taxa de Instalação: ${formatCurrency(data.taxa_instalacao)}`, 10);
    addText(`Taxa de Análise: ${formatCurrency(data.taxa_analise_credito)}`, 10);
    addText(`Taxa Total: ${formatCurrency(data.taxa_total)}`, 10, true);
    gap(6);
  }

  addText("CREDORES", 12, true); gap(3);
  if (data.credores?.length) {
    data.credores.forEach(c => {
      const cat = (c as any).categoria || (c as any).tipo || "";
      addText(`• ${c.nome} (${cat}) — ${c.valor}`, 9);
    });
  }
  gap(6);
  addText("JUSTIFICATIVA", 12, true); gap(3);
  addText(data.motivo_decisao || data.regraAplicada || "—", 9); gap(6);
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

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);

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

  // Extract taxa_total from resultado for display
  const getTaxaTotal = (entry: CreditHistoryEntry): string | null => {
    const r = entry.resultado as any;
    if (r?.taxa_total !== undefined) return formatCurrency(r.taxa_total);
    if (r?.valorTaxa) return r.valorTaxa;
    return null;
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
                <TableHead>Faixa Final</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Taxa Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                    <TableCell>{faixaBadge(e.decisao_final)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      {e.regra_aplicada || "—"}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      {getTaxaTotal(e) || "—"}
                    </TableCell>
                    <TableCell>{statusBadge(e.status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <ActionButton icon={FileSearch} tooltip="Ver análise completa" onClick={() => handleView(e)} />
                        <ActionButton icon={Download} tooltip="Baixar PDF" disabled={!e.resultado} onClick={() => handleDownloadPdf(e)} />
                        {isAdmin && (
                          <ActionButton icon={Trash2} tooltip="Excluir" destructive onClick={() => setDeleteTarget(e)} />
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

      <CreditReportDialog open={dialogOpen} onOpenChange={setDialogOpen} data={dialogData} cpfCnpj={dialogCpf} />

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
