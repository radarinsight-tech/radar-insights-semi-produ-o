import { useState } from "react";
import { Search, ShieldAlert, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ConsultaMode = "simulacao" | "producao";

export interface SpcQueryResult {
  cpfCnpj: string;
  formatted: string;
  tipo: "CPF" | "CNPJ";
  nome: string;
  situacaoCpf: string;
  registroSpc: number;
  pendenciasSerasa: number;
  protestos: number;
  chequesSemFundo: number;
  totalOcorrencias: number;
  valorTotalPendencias: number;
  classificacaoRisco: "Baixo risco" | "Médio risco" | "Alto risco";
  dataConsulta: string;
  modoConsulta: ConsultaMode;
  consultas30dias?: number;
  consultas90dias?: number;
  protocoloConsulta?: string;
}

interface Props {
  onResult: (result: SpcQueryResult) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  isAdmin: boolean;
}

const CreditQuerySection = ({ onResult, isLoading, setIsLoading, isAdmin }: Props) => {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [mode, setMode] = useState<ConsultaMode>("simulacao");

  const handleToggleMode = (checked: boolean) => {
    if (checked && !isAdmin) return;
    setMode(checked ? "producao" : "simulacao");
  };

  const handleConsultar = async () => {
    const digits = cpfCnpj.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("consult-spc", {
        body: {
          cpfCnpj: digits,
          nome: nomeCliente.trim() || undefined,
          mode: mode === "producao" ? "production" : "simulation",
        },
      });

      if (error) {
        let msg = "Erro na consulta.";
        let code = "";
        try {
          if (data && typeof data === "object") {
            msg = data.error || error.message || msg;
            code = data.code || "";
          } else if (typeof data === "string") {
            const parsed = JSON.parse(data);
            msg = parsed.error || msg;
            code = parsed.code || "";
          }
        } catch {
          msg = error.message || msg;
        }

        if (code === "SPC_INTEGRATION_NOT_AVAILABLE") {
          toast.error("Integração SPC real ainda não disponível. Use o modo simulação.");
        } else if (code === "SPC_CREDENTIALS_MISSING") {
          toast.error("Credenciais SPC não configuradas. Use o modo simulação ou contate o administrador.");
        } else {
          toast.error(msg);
        }
        setIsLoading(false);
        return;
      }

      // Map backend response to frontend model
      const result: SpcQueryResult = {
        cpfCnpj: data.cpf,
        formatted: data.cpfFormatado,
        tipo: data.tipo,
        nome: data.nome,
        situacaoCpf: data.situacaoCpf,
        registroSpc: data.registroSpc,
        pendenciasSerasa: data.pendenciasSerasa,
        protestos: data.protestos,
        chequesSemFundo: data.chequesSemFundo,
        totalOcorrencias: data.totalOcorrencias,
        valorTotalPendencias: data.valorTotalPendencias,
        classificacaoRisco: data.classificacaoRisco,
        dataConsulta: data.dataHoraConsulta,
        modoConsulta: data.modoConsulta,
        consultas30dias: data.consultas30dias,
        consultas90dias: data.consultas90dias,
        protocoloConsulta: data.protocoloConsulta,
      };

      onResult(result);
    } catch (err) {
      console.error("[CreditQuery] Error:", err);
      toast.error("Erro inesperado ao consultar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const isProducao = mode === "producao";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Nova Consulta de Crédito
        </CardTitle>
        <CardDescription>Informe o CPF ou CNPJ do cliente para consultar no SPC — Opção 643</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex items-center justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isProducao}
                    onCheckedChange={handleToggleMode}
                    disabled={!isAdmin}
                  />
                  <span className={`text-xs font-semibold ${isProducao ? "text-accent" : "text-warning"}`}>
                    {isProducao ? "Produção" : "Simulação"}
                  </span>
                  {!isAdmin && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
              </TooltipTrigger>
              {!isAdmin && (
                <TooltipContent>
                  <p className="text-xs">Somente administradores podem usar o modo Produção</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Mode banner */}
        {isProducao ? (
          <div className="flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm text-accent dark:border-accent/30 dark:text-accent">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">Consulta real</span>
            <span className="text-[10px] opacity-75">— poderá gerar custo</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning dark:border-warning/30 dark:text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">Modo simulação</span>
            <span className="text-[10px] opacity-75">— dados fictícios</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label htmlFor="cpf-cnpj" className="text-xs font-medium text-muted-foreground">CPF / CNPJ</Label>
            <Input
              id="cpf-cnpj"
              placeholder="Digite o CPF ou CNPJ do cliente..."
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConsultar()}
              className="font-mono mt-1"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="nome-cliente" className="text-xs font-medium text-muted-foreground">Nome do cliente (opcional)</Label>
            <Input
              id="nome-cliente"
              placeholder="Nome do cliente..."
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              className="mt-1"
              disabled={isLoading}
            />
          </div>

          <Button onClick={handleConsultar} disabled={isLoading} className="w-full">
            <Search className="h-4 w-4 mr-2" />
            {isLoading ? "Consultando SPC..." : "Consultar SPC"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditQuerySection;
