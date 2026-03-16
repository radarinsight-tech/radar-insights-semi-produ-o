import { useState } from "react";
import { Search, ShieldAlert, AlertTriangle, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

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
}

const MOCK_NAMES: Record<string, string> = {
  "12345678900": "Maria Aparecida da Silva",
  "98765432100": "José Carlos Ferreira",
  "11222333000181": "Comércio Souza & Filhos LTDA",
};

function generateName(digits: string): string {
  if (MOCK_NAMES[digits]) return MOCK_NAMES[digits];
  const nomes = ["Ana Paula Oliveira", "Carlos Eduardo Santos", "Fernanda Lima Costa", "Roberto Almeida Neto", "Juliana Pereira Dias"];
  const seed = digits.split("").reduce((a, b) => a + Number(b), 0);
  return nomes[seed % nomes.length];
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
      cpfCnpj: digits, formatted, tipo: "CPF", nome: nomeCliente || MOCK_NAMES[digits],
      situacaoCpf: "Regular", registroSpc: 0, pendenciasSerasa: 0, protestos: 0, chequesSemFundo: 0,
      totalOcorrencias: 0, valorTotalPendencias: 0, classificacaoRisco: "Baixo risco", dataConsulta: now,
    };
  }
  if (digits === "98765432100") {
    return {
      cpfCnpj: digits, formatted, tipo: "CPF", nome: nomeCliente || MOCK_NAMES[digits],
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
    nome: nomeCliente || generateName(digits), situacaoCpf,
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
}

const CreditQuerySection = ({ onResult, isLoading, setIsLoading }: Props) => {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");

  const handleConsultar = async () => {
    const digits = cpfCnpj.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      const { toast } = await import("sonner");
      toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    setIsLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));
    const result = generateMockResult(digits, nomeCliente.trim() || undefined);
    onResult(result);
    setIsLoading(false);
  };

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
        {/* Simulation badge */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium">Modo simulação</span>
          <span className="text-[10px] opacity-75">— dados fictícios</span>
        </div>

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
