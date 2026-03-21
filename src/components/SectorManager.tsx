import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface Sector {
  id: string;
  name: string;
  company_id: string | null;
  created_at: string;
}

interface SectorManagerProps {
  onSectorsChange?: () => void;
}

const SectorManager = ({ onSectorsChange }: SectorManagerProps) => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchSectors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Erro ao carregar setores.");
      console.error(error);
    } else {
      setSectors((data as any[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSectors(); }, []);

  const openNew = () => {
    setEditingId(null);
    setFormName("");
    setDialogOpen(true);
  };

  const openEdit = (s: Sector) => {
    setEditingId(s.id);
    setFormName(s.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmed = formName.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Nome do setor deve ter ao menos 2 caracteres.");
      return;
    }

    setSaving(true);
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    if (!companyId) {
      toast.error("Erro ao identificar a empresa.");
      setSaving(false);
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("sectors")
        .update({ name: trimmed } as any)
        .eq("id", editingId);

      if (error) {
        toast.error(error.code === "23505" ? "Setor já existe." : "Erro ao atualizar setor.");
      } else {
        toast.success("Setor atualizado.");
        setDialogOpen(false);
        fetchSectors();
        onSectorsChange?.();
      }
    } else {
      const { error } = await supabase
        .from("sectors")
        .insert({ name: trimmed, company_id: companyId } as any);

      if (error) {
        toast.error(error.code === "23505" ? "Setor já existe." : "Erro ao criar setor.");
      } else {
        toast.success("Setor criado.");
        setDialogOpen(false);
        fetchSectors();
        onSectorsChange?.();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sectors").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir setor. Verifique se não há vínculos.");
    } else {
      toast.success("Setor excluído.");
      setDeleteConfirm(null);
      fetchSectors();
      onSectorsChange?.();
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Setores</h3>
            <Badge variant="outline" className="text-xs">{sectors.length}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={openNew} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" /> Novo setor
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : sectors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nenhum setor cadastrado. Crie setores para organizar atendentes e dados.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sectors.map((s) => (
              <div
                key={s.id}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <MapPin className="h-3 w-3 text-primary" />
                <span className="text-sm text-foreground">{s.name}</span>
                <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-0.5 rounded hover:bg-muted"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(s.id)}
                    className="p-0.5 rounded hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Setor" : "Novo Setor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Nome do setor (ex: Suporte, Financeiro)"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              maxLength={60}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir setor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir este setor? Atendentes e registros vinculados perderão a associação.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SectorManager;
