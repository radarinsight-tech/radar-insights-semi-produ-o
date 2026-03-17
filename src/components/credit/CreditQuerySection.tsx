import { useState } from "react";
import { Search, ShieldAlert, AlertTriangle, User as UserIcon, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
}

// Placeholder for future real SPC integration
export async function consultarSPCReal(cpf: string): Promise<SpcQueryResult | null> {
  // TODO: Implement real SPC 643 API call
  // This function will be called when mode is "producao"
  console.warn("[SPC] consultarSPCReal called — integration not yet implemented for:", cpf);
  return null;
}


function classificarRisco(spc: number, serasa: number, protestos: number, valor: number): SpcQueryResult["classificacaoRisco"] {
  if (spc === 0 && serasa === 0 && protestos === 0) return "Baixo risco";
  if (spc > 3 || valor > 3000) return "Alto risco";
  return "Médio risco";
}

function generateMockResult(raw: string, nomeCliente?: string): SpcQueryResult {
  const digits = raw.replace(/\D/g, "");
  const isCnpj = digits.length === 14;
  const seed = digits.split("").reduce((a, b) => a + Number(b), 0);

  const formatted = isCnpj
    ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
    : `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;

  const now = new Date().toLocaleString("pt-BR");

  // Known CPFs for demo
  if (digits === "12345678900") {
    return {
      cpfCnpj: digits, formatted, tipo: "CPF", nome: nomeCliente || "Nome não informado",
      situacaoCpf: "Regular", registroSpc: 0, pendenciasSerasa: 0, protestos: 0, chequesSemFundo: 0,
      totalOcorrencias: 0, valorTotalPendencias: 0, classificacaoRisco: "Baixo risco", dataConsulta: now,
    };
  }
  if (digits === "98765432100") {
    return {
      cpfCnpj: digits, formatted, tipo: "CPF", nome: nomeCliente || "Nome não informado",
      situacaoCpf: "Com restrições", registroSpc: 4, pendenciasSerasa: 2, protestos: 1, chequesSemFundo: 1,
      totalOcorrencias: 8, valorTotalPendencias: 4500, classificacaoRisco: "Alto risco", dataConsulta: now,
    };
  }

  const registroSpc = seed % 7;
  const pendenciasSerasa = seed % 4;
  const protestos = seed % 3;
  const chequesSemFundo = seed % 2;
  const valorTotalPendencias = registroSpc === 0 && pendenciasSerasa === 0 ? 0 : ((seed * 127) % 8000) + 50;
  const totalOcorrencias = registroSpc + pendenciasSerasa + protestos + chequesSemFundo;
  const situacaoCpf = registroSpc === 0 && pendenciasSerasa === 0 ? "Regular" : "Com restrições";

  return {
    cpfCnpj: digits, formatted, tipo: isCnpj ? "CNPJ" : "CPF",
    nome: nomeCliente || "Nome não informado", situacaoCpf,
    registroSpc, pendenciasSerasa, protestos, chequesSemFundo,
    totalOcorrencias, valorTotalPendencias,
    classificacaoRisco: classificarRisco(registroSpc, pendenciasSerasa, protestos, valorTotalPendencias),
    dataConsulta: now,
  };
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
      const { toast } = await import("sonner");
      toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    setIsLoading(true);

    if (mode === "producao") {
      // Future real integration
      const realResult = await consultarSPCReal(digits);
      if (realResult) {
        onResult({ ...realResult, modoConsulta: "producao" });
      } else {
        const { toast } = await import("sonner");
        toast.error("Integração SPC real ainda não disponível. Use o modo simulação.");
      }
      setIsLoading(false);
      return;
    }

    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));
    const result = generateMockResult(digits, nomeCliente.trim() || undefined);
    onResult({ ...result, modoConsulta: "simulacao" });
    setIsLoading(false);
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
