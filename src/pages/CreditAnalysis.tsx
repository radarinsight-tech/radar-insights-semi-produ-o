import { useState } from "react";
import { Radar, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CreditUploadSection from "@/components/credit/CreditUploadSection";
import CreditAnalysisResult, { type CreditAnalysisData } from "@/components/credit/CreditAnalysisResult";
import { extractCpfCnpj } from "@/lib/cpfCnpjExtractor";
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

const CreditAnalysis = () => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<CreditAnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Duplicate check state
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    cpfCnpj: string;
    type: string;
    formatted: string;
    lastDate: string;
    lastNome: string | null;
  } | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const runAnalysis = async (text: string) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-credit", {
        body: { text },
      });

      if (error) {
        toast.error("Erro ao analisar consulta de crédito.");
        console.error("Edge function error:", error);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const result = data as CreditAnalysisData;
      setAnalysis(result);
      toast.success("Análise de crédito concluída!");

      // Save to history
      const cpfCnpjInfo = extractCpfCnpj(text);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("credit_analyses" as any).insert({
          user_id: user.id,
          cpf_cnpj: cpfCnpjInfo?.value || result.cpf?.replace(/\D/g, "") || "unknown",
          nome: result.nome || null,
          decisao_final: result.decisaoFinal || null,
          resultado: result as any,
        } as any);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Erro inesperado ao processar análise.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async (text: string) => {
    // Extract CPF/CNPJ from text
    const cpfCnpjInfo = extractCpfCnpj(text);

    if (!cpfCnpjInfo) {
      // No CPF/CNPJ found, proceed directly
      await runAnalysis(text);
      return;
    }

    // Check for existing analysis
    const { data: existing } = await supabase
      .from("credit_analyses" as any)
      .select("created_at, nome")
      .eq("cpf_cnpj", cpfCnpjInfo.value)
      .order("created_at", { ascending: false })
      .limit(1) as any;

    if (existing && existing.length > 0) {
      const lastDate = new Date(existing[0].created_at).toLocaleDateString("pt-BR");
      setDuplicateInfo({
        cpfCnpj: cpfCnpjInfo.value,
        type: cpfCnpjInfo.type,
        formatted: cpfCnpjInfo.formatted,
        lastDate,
        lastNome: existing[0].nome,
      });
      setPendingText(text);
      return;
    }

    await runAnalysis(text);
  };

  const handleConfirmDuplicate = async () => {
    setDuplicateInfo(null);
    if (pendingText) {
      await runAnalysis(pendingText);
      setPendingText(null);
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateInfo(null);
    setPendingText(null);
  };

  return (
    <div className="min-h-screen bg-background" data-module="credit">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Radar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Radar Insight — <span className="text-primary">Análise de Crédito</span>
              </h1>
              <p className="text-xs text-muted-foreground">Análise de CPF via consulta SPC/Serasa</p>
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

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CreditUploadSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          <CreditAnalysisResult data={analysis} />
        </div>
      </main>

      {/* Duplicate confirmation dialog */}
      <AlertDialog open={!!duplicateInfo} onOpenChange={(open) => !open && handleCancelDuplicate()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Consulta já realizada</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Este {duplicateInfo?.type} <strong>{duplicateInfo?.formatted}</strong>
                {duplicateInfo?.lastNome && (
                  <> ({duplicateInfo.lastNome})</>
                )}{" "}
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

export default CreditAnalysis;
