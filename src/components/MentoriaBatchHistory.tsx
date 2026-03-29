import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Calendar, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface BatchRecord {
  id: string;
  batch_code: string;
  created_at: string;
  source_type: string;
  original_file_name: string | null;
  total_pdfs: number;
  status: string;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  recebido: { label: "Recebido", className: "bg-muted text-muted-foreground" },
  extraindo_arquivos: { label: "Extraindo", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  organizando_atendimentos: { label: "Organizando", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  pronto_para_curadoria: { label: "Pronto", className: "bg-primary/15 text-primary" },
  em_analise: { label: "Em análise", className: "bg-warning/15 text-warning" },
  concluido: { label: "Concluído", className: "bg-accent/15 text-accent" },
  imported: { label: "Importado", className: "bg-primary/15 text-primary" },
  erro: { label: "Erro", className: "bg-destructive/15 text-destructive" },
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const INITIAL_VISIBLE = 3;
const MAX_VISIBLE = 15;

const MentoriaBatchHistory = () => {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [open, setOpen] = useState(true); // starts expanded
  const [selectedMonth, setSelectedMonth] = useState<string>("todos");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("mentoria_batches")
        .select("id, batch_code, created_at, source_type, original_file_name, total_pdfs, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setBatches(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Map<string, string>();
    for (const b of batches) {
      const d = new Date(b.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months.has(key)) {
        months.set(key, `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
      }
    }
    return Array.from(months.entries());
  }, [batches]);

  const filtered = useMemo(() => {
    let items = batches;
    if (selectedMonth !== "todos") {
      items = batches.filter((b) => {
        const d = new Date(b.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === selectedMonth;
      });
    }
    return items;
  }, [batches, selectedMonth]);

  const visible = useMemo(() => {
    if (showAll) return filtered.slice(0, MAX_VISIBLE);
    return filtered.slice(0, INITIAL_VISIBLE);
  }, [filtered, showAll]);

  if (loading || batches.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 h-10 font-semibold text-sm"
        >
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            📦 Histórico de lotes ({batches.length})
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        {/* Month chips */}
        {availableMonths.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <button
              onClick={() => { setSelectedMonth("todos"); setShowAll(false); }}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                selectedMonth === "todos"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
              )}
            >
              Todos
            </button>
            {availableMonths.map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setSelectedMonth(key); setShowAll(false); }}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                  selectedMonth === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {visible.map((b) => {
            const st = statusLabels[b.status] || statusLabels.recebido;
            const date = new Date(b.created_at);
            return (
              <Card
                key={b.id}
                className="p-3 flex flex-col gap-1.5 border-border/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold text-foreground truncate">{b.batch_code}</span>
                  <Badge className={`text-[9px] px-1.5 py-0 h-auto shrink-0 ${st.className}`}>
                    {st.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    {b.total_pdfs} atend.
                  </span>
                </div>
                {b.original_file_name && (
                  <p className="text-[10px] text-muted-foreground truncate">{b.original_file_name}</p>
                )}
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum lote neste período.</p>
        )}

        {/* Ver mais / Ver menos */}
        {filtered.length > INITIAL_VISIBLE && (
          <div className="text-center mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Ver menos" : `Ver mais (${filtered.length - INITIAL_VISIBLE} restantes)`}
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default MentoriaBatchHistory;
