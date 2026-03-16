import { useState } from "react";
import { ArrowLeft, Search, ShieldAlert, AlertTriangle, User, CreditCard, DollarSign, Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import logoSymbol from "@/assets/logo-symbol.png";
import { toast } from "sonner";

interface SpcResult {
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
  parecer: "Aprovado" | "Análise manual" | "Negado";
  justificativaParecer: string;
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

function classificarRisco(spc: number, serasa: number, protestos: number, valor: number): SpcResult["classificacaoRisco"] {
  if (spc === 0 && serasa === 0 && protestos === 0) return "Baixo risco";
  if (spc > 3 || valor > 3000) return "Alto risco";
  return "Médio risco";
}

function gerarParecer(spc: number, serasa: number, protestos: number, valor: number): { parecer: SpcResult["parecer"]; justificativa: string } {
  if (spc === 0 && serasa === 0 && protestos === 0) {
    return { parecer: "Aprovado", justificativa: "Nenhuma restrição encontrada nos bureaus de crédito. Cliente sem registros negativos." };
  }
  if (spc > 3 || valor > 3000) {
    return { parecer: "Negado", justificativa: `Reprovado automaticamente: ${spc > 3 ? `${spc} registros SPC` : ""}${spc > 3 && valor > 3000 ? " e " : ""}${valor > 3000 ? `valor total R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} acima do limite` : ""}.` };
  }
  if (spc <= 2 && valor < 1000) {
    return { parecer: "Análise manual", justificativa: `Pendências dentro da faixa de análise manual: ${spc} registro(s) SPC com valor total de R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` };
  }
  return { parecer: "Análise manual", justificativa: "Situação requer avaliação complementar pelo analista de crédito." };
}

function generateMockResult(raw: string): SpcResult {
  const digits = raw.replace(/\D/g, "");
  const isCnpj = digits.length === 14;
  const seed = digits.split("").reduce((a, b) => a + Number(b), 0);

  const formatted = isCnpj
    ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
    : `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;

  const registroSpc = seed % 7;
  const pendenciasSerasa = seed % 4;
  const protestos = seed % 3;
  const chequesSemFundo = seed % 2;
  const valorTotalPendencias = registroSpc === 0 && pendenciasSerasa === 0 ? 0 : ((seed * 127) % 8000) + 50;
  const totalOcorrencias = registroSpc + pendenciasSerasa + protestos + chequesSemFundo;

  const situacaoCpf = registroSpc === 0 && pendenciasSerasa === 0 ? "Regular" : "Com restrições";
  const classificacaoRisco = classificarRisco(registroSpc, pendenciasSerasa, protestos, valorTotalPendencias);
  const { parecer, justificativa } = gerarParecer(registroSpc, pendenciasSerasa, protestos, valorTotalPendencias);

  // Override known CPFs for demo
  if (digits === "12345678900") {
    return {
      cpfCnpj: digits, formatted, tipo: "CPF", nome: MOCK_NAMES[digits],
      situacaoCpf: "Regular", registroSpc: 0, pendenciasSerasa: 0, protestos: 0, chequesSemFundo: 0,
      totalOcorrencias: 0, valorTotalPendencias: 0, classificacaoRisco: "Baixo risco",
      parecer: "Aprovado", justificativaParecer: "Nenhuma restrição encontrada nos bureaus de crédito. Cliente sem registros negativos.",
    };
  }
  if (digits === "98765432100") {
    return {
      cpfCnpj: digits, formatted, tipo: "CPF", nome: MOCK_NAMES[digits],
      situacaoCpf: "Com restrições", registroSpc: 4, pendenciasSerasa: 2, protestos: 1, chequesSemFundo: 1,
      totalOcorrencias: 8, valorTotalPendencias: 4500, classificacaoRisco: "Alto risco",
      parecer: "Negado", justificativaParecer: "Reprovado automaticamente: 4 registros SPC e valor total R$ 4.500,00 acima do limite.",
    };
  }

  return {
    cpfCnpj: digits, formatted, tipo: isCnpj ? "CNPJ" : "CPF",
    nome: generateName(digits), situacaoCpf, registroSpc, pendenciasSerasa, protestos, chequesSemFundo,
    totalOcorrencias, valorTotalPendencias, classificacaoRisco, parecer, justificativaParecer: justificativa,
  };
}

function riscoVariant(risco: string) {
  if (risco === "Baixo risco") return "default" as const;
  if (risco === "Médio risco") return "secondary" as const;
  return "destructive" as const;
}

function parecerVariant(parecer: string) {
  if (parecer === "Aprovado") return "default" as const;
  if (parecer === "Análise manual") return "secondary" as const;
  return "destructive" as const;
}

function riscoColor(risco: string) {
  if (risco === "Baixo risco") return "text-green-600 dark:text-green-400";
  if (risco === "Médio risco") return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

const SpcConsulta = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpcResult | null>(null);

  const handleConsultar = async () => {
    const digits = input.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    setLoading(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 1200));
    setResult(generateMockResult(digits));
    setLoading(false);
    toast.success("Consulta simulada concluída");
  };

  return (
    <div className="min-h-screen bg-background" data-module="credit">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Consulta SPC — <span className="text-primary">Opção 643</span>
              </h1>
              <p className="text-xs text-muted-foreground">SPC MIX + Protesto</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/credit")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Simulation banner */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">Consulta em modo simulação</span>
          <span className="text-xs opacity-75">— Os dados exibidos são fictícios e não representam informações reais do SPC.</span>
        </div>

        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> Nova Consulta
            </CardTitle>
            <CardDescription>Informe o CPF ou CNPJ para consultar no SPC MIX + Protesto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Digite o CPF ou CNPJ..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConsultar()}
                className="max-w-sm font-mono"
              />
              <Button onClick={handleConsultar} disabled={loading}>
                <Search className="h-4 w-4 mr-1" />
                {loading ? "Consultando..." : "Consultar SPC"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {/* 1) Dados do cliente */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Dados do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{result.tipo}</p>
                    <p className="text-sm font-mono font-semibold text-foreground mt-1">{result.formatted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Nome</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{result.nome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Situação do {result.tipo}</p>
                    <Badge variant={result.situacaoCpf === "Regular" ? "default" : "destructive"} className="mt-1">
                      {result.situacaoCpf}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2) Situação de crédito */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Situação de Crédito
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Registro SPC", value: result.registroSpc },
                    { label: "Pendências Serasa", value: result.pendenciasSerasa },
                    { label: "Protestos", value: result.protestos },
                    { label: "Cheques sem fundo", value: result.chequesSemFundo },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{item.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${item.value > 0 ? "text-destructive" : "text-foreground"}`}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 3) Resumo financeiro */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> Resumo Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Ocorrências</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{result.totalOcorrencias}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor Total das Pendências</p>
                    <p className={`text-3xl font-bold mt-1 ${result.valorTotalPendencias > 0 ? "text-destructive" : "text-foreground"}`}>
                      R$ {result.valorTotalPendencias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4) Classificação Radar Insight */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Classificação Radar Insight
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge variant={riscoVariant(result.classificacaoRisco)} className="text-sm px-4 py-1.5">
                    {result.classificacaoRisco}
                  </Badge>
                  <div className="flex gap-1">
                    {["Baixo risco", "Médio risco", "Alto risco"].map((level) => (
                      <div
                        key={level}
                        className={`h-3 w-16 rounded-full transition-colors ${
                          level === "Baixo risco"
                            ? result.classificacaoRisco === "Baixo risco" ? "bg-green-500" : "bg-muted"
                            : level === "Médio risco"
                            ? result.classificacaoRisco === "Médio risco" || result.classificacaoRisco === "Alto risco" ? "bg-yellow-500" : "bg-muted"
                            : result.classificacaoRisco === "Alto risco" ? "bg-red-500" : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 5) Parecer automático de crédito */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Parecer Automático de Crédito
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Badge variant={parecerVariant(result.parecer)} className="text-sm px-4 py-1.5">
                    {result.parecer}
                  </Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.justificativaParecer}</p>
                  <div className="text-xs text-muted-foreground border-t border-border pt-3 mt-3">
                    <p className="font-medium mb-1">Regras aplicadas:</p>
                    <ul className="list-disc list-inside space-y-0.5 opacity-75">
                      <li>SPC=0, Serasa=0, Protesto=0 → Aprovado</li>
                      <li>SPC≤2 e valor&lt;R$1.000 → Análise manual</li>
                      <li>SPC&gt;3 ou valor&gt;R$3.000 → Negado</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default SpcConsulta;
