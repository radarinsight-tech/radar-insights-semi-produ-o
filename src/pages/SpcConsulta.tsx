import { useState } from "react";
import { ArrowLeft, Search, ShieldAlert, AlertTriangle } from "lucide-react";
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
  score: number;
  restricoes: number;
  situacao: string;
}

const MOCK_RESPONSES: Record<string, SpcResult> = {
  "12345678900": {
    cpfCnpj: "12345678900", formatted: "123.456.789-00", tipo: "CPF",
    score: 720, restricoes: 0, situacao: "Regular",
  },
  "98765432100": {
    cpfCnpj: "98765432100", formatted: "987.654.321-00", tipo: "CPF",
    score: 350, restricoes: 3, situacao: "Com restrições",
  },
  "11222333000181": {
    cpfCnpj: "11222333000181", formatted: "11.222.333/0001-81", tipo: "CNPJ",
    score: 580, restricoes: 1, situacao: "Com pendências",
  },
};

function generateMockResult(raw: string): SpcResult {
  const digits = raw.replace(/\D/g, "");
  if (MOCK_RESPONSES[digits]) return MOCK_RESPONSES[digits];

  const isCnpj = digits.length === 14;
  const seed = digits.split("").reduce((a, b) => a + Number(b), 0);
  const score = 200 + (seed * 37) % 800;
  const restricoes = seed % 5;

  const formatted = isCnpj
    ? `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`
    : `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;

  return {
    cpfCnpj: digits, formatted, tipo: isCnpj ? "CNPJ" : "CPF",
    score, restricoes,
    situacao: restricoes === 0 ? "Regular" : restricoes <= 2 ? "Com pendências" : "Com restrições",
  };
}

function scoreColor(score: number) {
  if (score >= 700) return "text-green-600";
  if (score >= 400) return "text-yellow-600";
  return "text-red-600";
}

function situacaoBadge(situacao: string) {
  if (situacao === "Regular") return "default" as const;
  if (situacao === "Com pendências") return "secondary" as const;
  return "destructive" as const;
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

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 1200));

    setResult(generateMockResult(digits));
    setLoading(false);
    toast.success("Consulta simulada concluída");
  };

  return (
    <div className="min-h-screen bg-background" data-module="credit">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Consulta SPC — <span className="text-primary">Opção 643</span>
              </h1>
              <p className="text-xs text-muted-foreground">Consulta de score e restrições</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/credit")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
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
              <ShieldAlert className="h-5 w-5 text-primary" />
              Nova Consulta
            </CardTitle>
            <CardDescription>Informe o CPF ou CNPJ para consultar</CardDescription>
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
          <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <CardHeader>
              <CardTitle className="text-lg">Resultado da Consulta</CardTitle>
              <CardDescription>
                {result.tipo}: {result.formatted}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{result.tipo} Consultado</p>
                  <p className="text-lg font-mono font-semibold text-foreground">{result.formatted}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Score</p>
                  <p className={`text-3xl font-bold ${scoreColor(result.score)}`}>{result.score}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Restrições</p>
                  <p className="text-3xl font-bold text-foreground">{result.restricoes}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Situação</p>
                  <Badge variant={situacaoBadge(result.situacao)} className="mt-1 text-sm">
                    {result.situacao}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default SpcConsulta;
