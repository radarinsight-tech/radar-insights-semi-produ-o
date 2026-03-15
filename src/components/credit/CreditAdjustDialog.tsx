import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FAIXAS = [
  { value: "ISENTAR", label: "ISENTAR (R$ 0)" },
  { value: "TAXA_R$100", label: "TAXA R$ 100,00" },
  { value: "TAXA_R$200", label: "TAXA R$ 200,00" },
  { value: "TAXA_R$300", label: "TAXA R$ 300,00" },
  { value: "TAXA_R$1000", label: "TAXA R$ 1.000,00" },
];

const MOTIVOS = [
  "Relacionamento comercial",
  "Comprovante adicional",
  "Cliente recorrente",
  "Exceção aprovada",
  "Negociação autorizada",
  "Outro",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  currentFaixa: string | null;
  clientName: string | null;
  onAdjusted: () => void;
}

const CreditAdjustDialog = ({ open, onOpenChange, analysisId, currentFaixa, clientName, onAdjusted }: Props) => {
  const [novaFaixa, setNovaFaixa] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!novaFaixa || !motivo) {
      toast.error("Selecione a nova faixa e o motivo.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Usuário não autenticado."); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const userName = profile?.full_name || user.email || "Desconhecido";

      // Map faixa to taxa_total
      const taxaMap: Record<string, number> = {
        "ISENTAR": 0, "TAXA_R$100": 100, "TAXA_R$200": 200, "TAXA_R$300": 300, "TAXA_R$1000": 1000,
      };

      const { error } = await supabase
        .from("credit_analyses" as any)
        .update({
          ajuste_manual: true,
          faixa_original: currentFaixa || "Sem faixa",
          decisao_final: novaFaixa,
          motivo_ajuste: motivo,
          observacao_ajuste: observacao || null,
          usuario_ajuste: userName,
          data_ajuste: new Date().toISOString(),
        } as any)
        .eq("id", analysisId) as any;

      if (error) {
        console.error("Adjust error:", error);
        toast.error("Erro ao salvar ajuste.");
      } else {
        toast.success("Ajuste manual salvo com sucesso.");
        onAdjusted();
        onOpenChange(false);
        setNovaFaixa("");
        setMotivo("");
        setObservacao("");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar ajuste.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Decisão</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {clientName && (
            <p className="text-sm text-muted-foreground">
              Cliente: <strong className="text-foreground">{clientName}</strong>
            </p>
          )}

          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Decisão digital original</Label>
            <div className="mt-1">
              <Badge variant="outline">{currentFaixa || "Sem faixa"}</Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Nova faixa final *</Label>
            <Select value={novaFaixa} onValueChange={setNovaFaixa}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Selecione a faixa" />
              </SelectTrigger>
              <SelectContent>
                {FAIXAS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observação adicional..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditAdjustDialog;
