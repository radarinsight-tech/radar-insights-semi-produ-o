import { useState } from "react";
import { LogOut, ArrowLeft, LayoutDashboard, FileCheck } from "lucide-react";
import logoSymbol from "@/assets/logo-symbol.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CreditQuerySection, { type SpcQueryResult } from "@/components/credit/CreditQuerySection";
import CreditQueryResult, { aplicarPoliticaBandaTurbo } from "@/components/credit/CreditQueryResult";
import CreditHistoryTable from "@/components/credit/CreditHistoryTable";
import CreditDailySummary from "@/components/credit/CreditDailySummary";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CreditAnalysisLegado = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserPermissions();
  const [result, setResult] = useState<SpcQueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [pendingResult, setPendingResult] = useState<SpcQueryResult | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    cpfCnpj: string; type: string; formatted: string; lastDate: string; lastNome: string | null;
  } | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const saveToHistory = async (r: SpcQueryResult, isReanalysis: boolean) => {
    const policy = aplicarPoliticaBandaTurbo(r);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const faixaMap: Record<string, string> = {
      "Isento": "ISENTAR",
      "R$ 100,00": "TAXA_R$100",
      "R$ 200,00": "TAXA_R$200",
      "R$ 300,00": "TAXA_R$300",
      "R$ 1.000,00": "TAXA_R$1000",
    };

    await supabase.from("credit_analyses" as any).insert({
      user_id: user.id,
      cpf_cnpj: r.cpfCnpj,
      doc_type: r.tipo,
      nome: r.nome,
      user_name: profile?.full_name || user.email || null,
      decisao_final: faixaMap[policy.faixa] || "TAXA_R$200",
      regra_aplicada: policy.justificativa,
      observacoes: policy.documentacao || null,
      status: isReanalysis ? "reanalise" : "nova_consulta",
      resultado: {
        nome: r.nome,
        cpf_cnpj: r.formatted,
        tipo_pessoa: r.tipo,
        situacao: r.situacaoCpf,
        registroSpc: r.registroSpc,
        pendenciasSerasa: r.pendenciasSerasa,
        protestos: r.protestos,
        chequesSemFundo: r.chequesSemFundo,
        totalOcorrencias: r.totalOcorrencias,
        valorTotalPendencias: r.valorTotalPendencias,
        classificacaoRisco: r.classificacaoRisco,
        faixa: policy.faixa,
        regra: policy.regra,
        justificativa: policy.justificativa,
        documentacao: policy.documentacao,
        modoConsulta: r.modoConsulta,
      } as any,
    } as any);

    setHistoryRefresh((prev) => prev + 1);
  };

  const handleResult = async (r: SpcQueryResult) => {
    const { data: existing } = await supabase
      .from("credit_analyses" as any)
      .select("created_at, nome")
      .eq("cpf_cnpj", r.cpfCnpj)
      .order("created_at", { ascending: false })
      .limit(1) as any;

    if (existing && existing.length > 0) {
      const lastDate = new Date(existing[0].created_at).toLocaleDateString("pt-BR");
      setDuplicateInfo({
        cpfCnpj: r.cpfCnpj, type: r.tipo, formatted: r.formatted,
        lastDate, lastNome: existing[0].nome,
      });
      setPendingResult(r);
      return;
    }

    setResult(r);
    await saveToHistory(r, false);
    toast.success("Consulta concluída");
  };

  const handleConfirmDuplicate = async () => {
    setDuplicateInfo(null);
    if (pendingResult) {
      setResult(pendingResult);
      await saveToHistory(pendingResult, true);
      setPendingResult(null);
      toast.success("Reanálise concluída");
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateInfo(null);
    setPendingResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm px-6 py-2.5 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/")}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Hub
            </Button>
            <img src={logoSymbol} alt="Radar Insight" className="h-5 w-5 rounded-md object-contain" />
            <span className="text-sm font-bold text-primary tracking-tight">Crédito (Legado)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/credit-dashboard-legado")}>
              <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
              Dashboard
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/credit-docs-legado")}>
              <FileCheck className="h-3.5 w-3.5 mr-1" />
              Documentos
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <CreditDailySummary refreshTrigger={historyRefresh} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CreditQuerySection
            onResult={handleResult}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            isAdmin={isAdmin}
          />
          <CreditQueryResult data={result} />
        </div>

        <CreditHistoryTable refreshTrigger={historyRefresh} />
      </main>

      <AlertDialog open={!!duplicateInfo} onOpenChange={(open) => !open && handleCancelDuplicate()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Consulta já realizada</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Este {duplicateInfo?.type} <strong>{duplicateInfo?.formatted}</strong>
                {duplicateInfo?.lastNome && <> ({duplicateInfo.lastNome})</>}{" "}
                já foi consultado em <strong>{duplicateInfo?.lastDate}</strong>.
              </span>
              <span className="block">Deseja realizar uma nova consulta?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDuplicate}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreditAnalysisLegado;
