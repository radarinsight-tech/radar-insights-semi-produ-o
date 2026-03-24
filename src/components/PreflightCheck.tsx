import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  Shield, Database, Cpu, CreditCard, Gauge, Settings,
} from "lucide-react";
import { toast } from "sonner";

interface CheckResult {
  key: string;
  label: string;
  category: "configuracao" | "infraestrutura" | "credito" | "autenticacao" | "limite";
  layer: "app" | "edge_function" | "supabase" | "provedor_ia" | "workspace";
  status: "ok" | "erro" | "aviso";
  message?: string;
}

interface PreflightResult {
  ready: boolean;
  hasWarnings?: boolean;
  checks: CheckResult[];
  timestamp?: string;
}

const categoryConfig: Record<string, { label: string; icon: typeof Settings }> = {
  configuracao: { label: "Configuração", icon: Settings },
  infraestrutura: { label: "Infraestrutura", icon: Cpu },
  credito: { label: "Crédito / Saldo", icon: CreditCard },
  autenticacao: { label: "Autenticação", icon: Shield },
  limite: { label: "Limite técnico", icon: Gauge },
};

const layerLabels: Record<string, string> = {
  app: "App",
  edge_function: "Função Edge",
  supabase: "Backend",
  provedor_ia: "Provedor IA",
  workspace: "Workspace",
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  ok: CheckCircle2,
  erro: XCircle,
  aviso: AlertTriangle,
};

const statusColors: Record<string, string> = {
  ok: "text-green-600",
  erro: "text-destructive",
  aviso: "text-amber-500",
};

interface PreflightCheckProps {
  /** Called when pre-check passes (ready=true) and user confirms to proceed */
  onReady: () => void;
  /** Number of files being sent for analysis (used in batch limit check) */
  batchSize?: number;
  /** The trigger button/element — will be replaced with a wrapped version */
  children: React.ReactNode;
  /** If true, skip the dialog on success and call onReady immediately */
  autoAdvance?: boolean;
}

export function usePreflightCheck() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);

  const runCheck = useCallback(async (batchSize?: number): Promise<PreflightResult> => {
    setChecking(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("preflight-mentoria", {
        body: { batchSize: batchSize ?? 0 },
      });

      if (error) {
        const fallbackResult: PreflightResult = {
          ready: false,
          checks: [{
            key: "invoke",
            label: "Pré-checagem",
            category: "infraestrutura",
            layer: "edge_function",
            status: "erro",
            message: `Não foi possível executar a pré-checagem: ${error.message}`,
          }],
        };
        setResult(fallbackResult);
        return fallbackResult;
      }

      const preflightResult = data as PreflightResult;
      setResult(preflightResult);
      return preflightResult;
    } catch (err: any) {
      const fallbackResult: PreflightResult = {
        ready: false,
        checks: [{
          key: "network",
          label: "Conectividade",
          category: "infraestrutura",
          layer: "app",
          status: "erro",
          message: "Erro de rede ao executar pré-checagem. Verifique sua conexão.",
        }],
      };
      setResult(fallbackResult);
      return fallbackResult;
    } finally {
      setChecking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  return { checking, result, runCheck, reset };
}

export default function PreflightCheck({ onReady, batchSize, children, autoAdvance }: PreflightCheckProps) {
  const { checking, result, runCheck, reset } = usePreflightCheck();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleTrigger = useCallback(async () => {
    const preflight = await runCheck(batchSize);
    if (preflight.ready) {
      if (autoAdvance && !preflight.hasWarnings) {
        onReady();
        return;
      }
    }
    setDialogOpen(true);
  }, [runCheck, batchSize, autoAdvance, onReady]);

  const handleProceed = () => {
    setDialogOpen(false);
    reset();
    onReady();
  };

  const handleRetry = async () => {
    await runCheck(batchSize);
  };

  const handleClose = () => {
    setDialogOpen(false);
    reset();
  };

  const errors = result?.checks.filter((c) => c.status === "erro") ?? [];
  const warnings = result?.checks.filter((c) => c.status === "aviso") ?? [];
  const oks = result?.checks.filter((c) => c.status === "ok") ?? [];

  // Group checks by category
  const groupedByCategory = result?.checks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, CheckResult[]>) ?? {};

  return (
    <>
      <div onClick={checking ? undefined : handleTrigger} className={checking ? "opacity-50 pointer-events-none" : "cursor-pointer"}>
        {checking ? (
          <Button variant="outline" disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando ambiente...
          </Button>
        ) : (
          children
        )}
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {result?.ready ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Ambiente pronto
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Ambiente com pendências
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {result?.ready
                ? warnings.length > 0
                  ? "O ambiente está operacional, mas há avisos que merecem atenção."
                  : "Todos os componentes estão funcionando. Você pode prosseguir com a análise."
                : "Foram detectados problemas que impedem a análise. Resolva antes de continuar."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            {Object.entries(groupedByCategory).map(([category, checks]) => {
              const config = categoryConfig[category] ?? { label: category, icon: Settings };
              const CategoryIcon = config.icon;
              return (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <CategoryIcon className="h-3.5 w-3.5" />
                    {config.label}
                  </div>
                  {checks.map((check) => {
                    const StatusIcon = statusIcons[check.status];
                    return (
                      <div key={check.key} className="flex items-start gap-2 pl-5">
                        <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${statusColors[check.status]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{check.label}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {layerLabels[check.layer] ?? check.layer}
                            </Badge>
                          </div>
                          {check.message && (
                            <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-3">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" /> {oks.length}
            </span>
            {warnings.length > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" /> {warnings.length}
              </span>
            )}
            {errors.length > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-destructive" /> {errors.length}
              </span>
            )}
          </div>

          <AlertDialogFooter>
            {!result?.ready ? (
              <>
                <AlertDialogCancel onClick={handleClose}>Fechar</AlertDialogCancel>
                <Button variant="outline" onClick={handleRetry} disabled={checking} className="gap-2">
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Verificar novamente
                </Button>
              </>
            ) : (
              <>
                <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleProceed}>
                  {warnings.length > 0 ? "Continuar mesmo assim" : "Iniciar análise"}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Compact inline status for the mentoria panel header */
export function PreflightStatusBadge() {
  const { checking, result, runCheck } = usePreflightCheck();

  if (!result && !checking) {
    return (
      <Button variant="ghost" size="sm" onClick={() => runCheck()} className="gap-1.5 text-xs h-7 px-2">
        <Shield className="h-3.5 w-3.5" />
        Diagnóstico
      </Button>
    );
  }

  if (checking) {
    return (
      <Badge variant="outline" className="gap-1 text-xs animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verificando...
      </Badge>
    );
  }

  if (result?.ready) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-green-700 border-green-300 bg-green-50 cursor-pointer" onClick={() => runCheck()}>
        <CheckCircle2 className="h-3 w-3" />
        Ambiente OK
      </Badge>
    );
  }

  const errorCount = result?.checks.filter((c) => c.status === "erro").length ?? 0;
  return (
    <Badge variant="destructive" className="gap-1 text-xs cursor-pointer" onClick={() => runCheck()}>
      <XCircle className="h-3 w-3" />
      {errorCount} problema{errorCount !== 1 ? "s" : ""}
    </Badge>
  );
}
