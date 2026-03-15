import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ShieldCheck, DollarSign, AlertTriangle, PenLine } from "lucide-react";

interface DailySummary {
  total: number;
  isencao: number;
  taxa100: number;
  taxa200: number;
  taxa300: number;
  taxa1000: number;
  ajustesManuais: number;
}

interface Props {
  refreshTrigger: number;
}

const normalizeFaixa = (d: string | null): string => {
  if (!d) return "";
  const upper = d.toUpperCase().trim();
  if (upper === "ISENTAR" || upper === "ISENTA") return "ISENTAR";
  if (upper.includes("100")) return "TAXA_R$100";
  if (upper.includes("200")) return "TAXA_R$200";
  if (upper.includes("300")) return "TAXA_R$300";
  if (upper.includes("1000")) return "TAXA_R$1000";
  return "";
};

const CreditDailySummary = ({ refreshTrigger }: Props) => {
  const [summary, setSummary] = useState<DailySummary>({
    total: 0, isencao: 0, taxa100: 0, taxa200: 0, taxa300: 0, taxa1000: 0, ajustesManuais: 0,
  });

  useEffect(() => {
    const fetchSummary = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("credit_analyses" as any)
        .select("decisao_final, ajuste_manual")
        .gte("created_at", today.toISOString()) as any;

      if (error || !data) return;

      const s: DailySummary = {
        total: data.length,
        isencao: 0, taxa100: 0, taxa200: 0, taxa300: 0, taxa1000: 0, ajustesManuais: 0,
      };

      for (const row of data) {
        const faixa = normalizeFaixa(row.decisao_final);
        if (faixa === "ISENTAR") s.isencao++;
        else if (faixa === "TAXA_R$100") s.taxa100++;
        else if (faixa === "TAXA_R$200") s.taxa200++;
        else if (faixa === "TAXA_R$300") s.taxa300++;
        else if (faixa === "TAXA_R$1000") s.taxa1000++;
        if (row.ajuste_manual) s.ajustesManuais++;
      }

      setSummary(s);
    };

    fetchSummary();
  }, [refreshTrigger]);

  const faixas = [
    { label: "Isenção", value: summary.isencao, color: "bg-accent", textColor: "text-accent" },
    { label: "R$ 100", value: summary.taxa100, color: "bg-warning/70", textColor: "text-warning" },
    { label: "R$ 200", value: summary.taxa200, color: "bg-warning", textColor: "text-warning" },
    { label: "R$ 300", value: summary.taxa300, color: "bg-destructive/70", textColor: "text-destructive" },
    { label: "R$ 1.000", value: summary.taxa1000, color: "bg-destructive", textColor: "text-destructive" },
  ];

  const maxVal = Math.max(1, ...faixas.map(f => f.value));

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-primary">Resumo Diário das Análises</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        {/* Total */}
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
          <p className="text-xs text-muted-foreground font-medium">Total do dia</p>
          <p className="text-2xl font-bold text-primary">{summary.total}</p>
        </div>

        {/* Per faixa */}
        {faixas.map((f) => (
          <div key={f.label} className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">{f.label}</p>
            <p className={`text-2xl font-bold ${f.textColor}`}>{f.value}</p>
          </div>
        ))}

        {/* Ajustes manuais */}
        <div className="rounded-lg bg-secondary border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
            <PenLine className="h-3 w-3" /> Ajustes
          </p>
          <p className="text-2xl font-bold text-foreground">{summary.ajustesManuais}</p>
        </div>
      </div>

      {/* Distribution bar */}
      {summary.total > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Distribuição por faixa</p>
          <div className="flex rounded-full overflow-hidden h-4">
            {faixas.map((f) =>
              f.value > 0 ? (
                <div
                  key={f.label}
                  className={`${f.color} transition-all relative group`}
                  style={{ width: `${(f.value / summary.total) * 100}%` }}
                  title={`${f.label}: ${f.value}`}
                />
              ) : null
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {faixas.map((f) => (
              <div key={f.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`h-2.5 w-2.5 rounded-full ${f.color}`} />
                <span>{f.label} ({f.value})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CreditDailySummary;
