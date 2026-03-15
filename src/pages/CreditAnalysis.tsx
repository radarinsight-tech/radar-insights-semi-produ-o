import { useState } from "react";
import { LogOut, ArrowLeft } from "lucide-react";
import logoSymbol from "@/assets/logo-symbol.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CreditUploadSection, { type CreditUploadState } from "@/components/credit/CreditUploadSection";
import CreditAnalysisResult, { type CreditAnalysisData } from "@/components/credit/CreditAnalysisResult";
import CreditHistoryTable from "@/components/credit/CreditHistoryTable";
import CreditDailySummary from "@/components/credit/CreditDailySummary";
import { extractCpfCnpj } from "@/lib/cpfCnpjExtractor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CreditAnalysis = () => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<CreditAnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadState, setUploadState] = useState<CreditUploadState>("empty");
  const [analyzedFileName, setAnalyzedFileName] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [pendingText, setPendingText] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    cpfCnpj: string; type: string; formatted: string; lastDate: string; lastNome: string | null;
  } | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleNewAnalysis = () => {
    setAnalysis(null);
    setUploadState("empty");
    setAnalyzedFileName("");
  };

  const runAnalysis = async (text: string, isReanalysis: boolean) => {
    setIsAnalyzing(true);
    setUploadState("processing");
    console.log("[CreditAnalysis] Início do processamento");

    try {
      const { data, error } = await supabase.functions.invoke("analyze-credit", {
        body: { text },
      });

      if (error) {
        toast.error("Erro ao processar a análise. Tente novamente.");
        console.error("[CreditAnalysis] Edge function error:", error);
        setUploadState("error");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setUploadState("error");
        return;
      }

      const result = data as CreditAnalysisData;
      setAnalysis(result);
      console.log("[CreditAnalysis] Análise concluída", result.regra_aplicada);

      // Save to history
      const cpfCnpjInfo = extractCpfCnpj(text);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        const decisaoFinal = result.regra_aplicada
          ? mapRegraToDecisao(result.regra_aplicada, result.classificacao_final)
          : result.decisaoFinal || null;

        const regraAplicada = result.regra_aplicada
          ? mapRegraLabel(result.regra_aplicada)
          : result.regraAplicada || null;

        await supabase.from("credit_analyses" as any).insert({
          user_id: user.id,
          cpf_cnpj: cpfCnpjInfo?.value || result.cpf_cnpj?.replace(/\D/g, "") || result.cpf?.replace(/\D/g, "") || "unknown",
          doc_type: cpfCnpjInfo?.type || (result.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"),
          nome: result.nome || null,
          user_name: profile?.full_name || user.email || null,
          decisao_final: decisaoFinal,
          regra_aplicada: regraAplicada,
          observacoes: result.motivo_decisao || result.observacoes || null,
          status: isReanalysis ? "reanalise" : "nova_consulta",
          resultado: result as any,
        } as any);

        console.log("[CreditAnalysis] Salvo no histórico");
        setHistoryRefresh((prev) => prev + 1);
      }

      setUploadState("completed");
      toast.success("Análise concluída");
    } catch (err) {
      console.error("[CreditAnalysis] Erro:", err);
      toast.error("Erro ao processar a análise. Tente novamente.");
      setUploadState("error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async (text: string) => {
    const cpfCnpjInfo = extractCpfCnpj(text);

    if (!cpfCnpjInfo) {
      await runAnalysis(text, false);
      return;
    }

    const { data: existing } = await supabase
      .from("credit_analyses" as any)
      .select("created_at, nome")
      .eq("cpf_cnpj", cpfCnpjInfo.value)
      .order("created_at", { ascending: false })
      .limit(1) as any;

    if (existing && existing.length > 0) {
      const lastDate = new Date(existing[0].created_at).toLocaleDateString("pt-BR");
      setDuplicateInfo({
        cpfCnpj: cpfCnpjInfo.value, type: cpfCnpjInfo.type, formatted: cpfCnpjInfo.formatted,
        lastDate, lastNome: existing[0].nome,
      });
      setPendingText(text);
      return;
    }

    await runAnalysis(text, false);
  };

  const handleConfirmDuplicate = async () => {
    setDuplicateInfo(null);
    if (pendingText) {
      await runAnalysis(pendingText, true);
      setPendingText(null);
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateInfo(null);
    setPendingText(null);
  };

  return (
    <div className="min-h-screen bg-background" data-module="credit">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Radar Insight — <span className="text-primary">Análise de Crédito</span>
              </h1>
              <p className="text-xs text-muted-foreground">Motor de decisão com regras de risco por faixa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Daily summary */}
        <CreditDailySummary refreshTrigger={historyRefresh} />

        {/* Upload + Result */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CreditUploadSection
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            uploadState={uploadState}
            onStateChange={setUploadState}
            analyzedFileName={analyzedFileName}
            onNewAnalysis={handleNewAnalysis}
          />
          <CreditAnalysisResult data={analysis} />
        </div>

        {/* History */}
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
              <span className="block">Deseja realizar uma nova análise?</span>
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

function mapRegraToDecisao(regra: string, classificacao: string): string {
  if (regra === "regra_01_isencao" && classificacao === "isento") return "ISENTAR";
  if (regra === "regra_01_isencao") return "TAXA_R$100";
  if (regra === "regra_02_taxa_100" && classificacao === "taxa_200_composta") return "TAXA_R$200";
  if (regra === "regra_02_taxa_100") return "TAXA_R$100";
  if (regra === "regra_03_taxa_200" && classificacao === "taxa_300_composta") return "TAXA_R$300";
  if (regra === "regra_03_taxa_200") return "TAXA_R$200";
  if (regra === "regra_04_taxa_300" && classificacao === "taxa_400_composta") return "TAXA_R$400";
  if (regra === "regra_04_taxa_300") return "TAXA_R$300";
  if (regra === "regra_especial_debito_provedor") return "TAXA_R$1000";
  return "TAXA_R$300";
}

function mapRegraLabel(regra: string): string {
  const labels: Record<string, string> = {
    regra_especial_debito_provedor: "Regra Especial — Débito Provedor (R$1.000)",
    regra_01_isencao: "Regra 01 — Isenção",
    regra_02_taxa_100: "Regra 02 — Taxa R$100",
    regra_03_taxa_200: "Regra 03 — Taxa R$200",
    regra_04_taxa_300: "Regra 04 — Taxa R$300",
  };
  return labels[regra] || regra;
}

export default CreditAnalysis;
