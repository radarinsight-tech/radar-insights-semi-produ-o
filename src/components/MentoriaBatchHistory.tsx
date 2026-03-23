import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Calendar, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
  extraindo_arquivos: { label: "Extraindo", className: "bg-blue-100 text-blue-700" },
  organizando_atendimentos: { label: "Organizando", className: "bg-blue-100 text-blue-700" },
  pronto_para_curadoria: { label: "Pronto", className: "bg-primary/15 text-primary" },
  em_analise: { label: "Em análise", className: "bg-warning/15 text-warning" },
  concluido: { label: "Concluído", className: "bg-accent/15 text-accent" },
  erro: { label: "Erro", className: "bg-destructive/15 text-destructive" },
};

const MentoriaBatchHistory = () => {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
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
        .limit(20);

      setBatches(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || batches.length === 0) return null;

  const visible = expanded ? batches : batches.slice(0, 3);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Histórico de lotes
        </h3>
        {batches.length > 3 && (
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Menos" : `Ver todos (${batches.length})`}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {visible.map((b) => {
          const st = statusLabels[b.status] || statusLabels.recebido;
          const date = new Date(b.created_at);
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-foreground">{b.batch_code}</span>
                  <Badge className={`text-[9px] px-1.5 py-0 h-auto ${st.className}`}>
                    {st.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    {b.total_pdfs} atendimento(s)
                  </span>
                  {b.original_file_name && (
                    <span className="truncate max-w-[150px]">{b.original_file_name}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default MentoriaBatchHistory;
