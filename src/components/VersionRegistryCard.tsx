import { useState } from "react";
import { Bookmark, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const VersionRegistryCard = () => {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Informe o nome da versão.");
      return;
    }
    setSaving(true);
    // Simula salvamento — estrutura pronta para integração futura
    setTimeout(() => {
      toast.success("Versão registrada com sucesso!", {
        description: name.trim(),
      });
      setName("");
      setSummary("");
      setNotes("");
      setSaving(false);
    }, 600);
  };

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Registro de Versão</CardTitle>
        </div>
        <CardDescription>
          Salve o estado atual do projeto no Hub antes de iniciar novas alterações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="version-name" className="text-xs">Nome da versão</Label>
          <Input
            id="version-name"
            placeholder="Ex.: v1.6_01_04_26_blindagem-ura-humano-e-validacao-criterios"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="version-summary" className="text-xs">Resumo da versão</Label>
          <Textarea
            id="version-summary"
            placeholder="Descreva em poucas linhas o que foi estabilizado, corrigido ou decidido nesta etapa."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="min-h-[60px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="version-notes" className="text-xs">Observações</Label>
          <Textarea
            id="version-notes"
            placeholder="Anote riscos, decisões tomadas, pendências ou pontos que devem ser retomados depois."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px]"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar no Hub"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default VersionRegistryCard;
