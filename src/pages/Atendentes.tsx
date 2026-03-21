import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, LogOut, Plus, Search, X, Pencil, Trash2, Users2,
  UserCheck, UserX, Loader2, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import logoSymbol from "@/assets/logo-symbol.png";
import { toast } from "sonner";
import SectorManager from "@/components/SectorManager";

export const ROLE_TYPE_OPTIONS = [
  { value: "sucesso_cliente", label: "Sucesso do Cliente" },
  { value: "suporte_tecnico", label: "Suporte Técnico" },
  { value: "vendas", label: "Vendas" },
  { value: "outro", label: "Outro" },
] as const;

export type RoleType = typeof ROLE_TYPE_OPTIONS[number]["value"];

export function getRoleTypeLabel(value: string): string {
  return ROLE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getRoleTypeBadgeClass(value: string): string {
  switch (value) {
    case "sucesso_cliente":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "suporte_tecnico":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "vendas":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Returns true if this role_type is evaluable in the standard mentoria */
export function isEvaluableRoleType(roleType: string): boolean {
  return roleType === "sucesso_cliente";
}

interface Attendant {
  id: string;
  name: string;
  nickname: string | null;
  sector: string | null;
  active: boolean;
  role_type: string;
  created_at: string;
}

const Atendentes = () => {
  const navigate = useNavigate();
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterRoleType, setFilterRoleType] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formNickname, setFormNickname] = useState("");
  const [formSector, setFormSector] = useState("");
  const [formRoleType, setFormRoleType] = useState<string>("sucesso_cliente");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchAttendants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("attendants")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Erro ao carregar atendentes.");
      console.error(error);
    } else {
      setAttendants((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAttendants(); }, []);

  const filteredAttendants = useMemo(() => {
    return attendants.filter((a) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!a.name.toLowerCase().includes(q) && !(a.nickname || "").toLowerCase().includes(q) && !(a.sector || "").toLowerCase().includes(q)) return false;
      }
      if (filterStatus === "ativo" && !a.active) return false;
      if (filterStatus === "inativo" && a.active) return false;
      if (filterRoleType !== "todos" && a.role_type !== filterRoleType) return false;
      return true;
    });
  }, [attendants, searchTerm, filterStatus, filterRoleType]);

  const openNew = () => {
    setEditingId(null);
    setFormName("");
    setFormNickname("");
    setFormSector("");
    setFormRoleType("sucesso_cliente");
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (a: Attendant) => {
    setEditingId(a.id);
    setFormName(a.name);
    setFormNickname(a.nickname || "");
    setFormSector(a.sector || "");
    setFormRoleType(a.role_type || "sucesso_cliente");
    setFormActive(a.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      toast.error("O nome do atendente é obrigatório.");
      return;
    }
    if (trimmedName.length < 3 || trimmedName.length > 100) {
      toast.error("O nome deve ter entre 3 e 100 caracteres.");
      return;
    }

    setSaving(true);

    const { data: companyData } = await supabase.rpc("get_my_company_id");
    const companyId = companyData;

    if (!companyId) {
      toast.error("Erro ao identificar a empresa.");
      setSaving(false);
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("attendants")
        .update({
          name: trimmedName,
          nickname: formNickname.trim() || null,
          sector: formSector.trim() || null,
          role_type: formRoleType,
          active: formActive,
        } as any)
        .eq("id", editingId);

      if (error) {
        toast.error(error.code === "23505" ? "Já existe um atendente com este nome." : "Erro ao atualizar atendente.");
      } else {
        toast.success("Atendente atualizado.");
        setDialogOpen(false);
        fetchAttendants();
      }
    } else {
      const { error } = await supabase
        .from("attendants")
        .insert({
          name: trimmedName,
          nickname: formNickname.trim() || null,
          sector: formSector.trim() || null,
          role_type: formRoleType,
          active: formActive,
          company_id: companyId,
        } as any);

      if (error) {
        toast.error(error.code === "23505" ? "Já existe um atendente com este nome." : "Erro ao cadastrar atendente.");
      } else {
        toast.success("Atendente cadastrado.");
        setDialogOpen(false);
        fetchAttendants();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("attendants").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir atendente.");
    } else {
      toast.success("Atendente excluído.");
      setDeleteConfirm(null);
      fetchAttendants();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const sectors = useMemo(() => {
    const set = new Set(attendants.map((a) => a.sector).filter(Boolean) as string[]);
    return [...set].sort();
  }, [attendants]);

  const activeCount = attendants.filter((a) => a.active).length;
  const inactiveCount = attendants.filter((a) => !a.active).length;

  return (
    <div className="min-h-screen bg-background" data-module="attendance">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
          <h1 className="text-xl font-bold text-foreground">Atendentes</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Início
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <Users2 className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{attendants.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
          <Card className="p-4 text-center">
            <UserCheck className="h-5 w-5 mx-auto text-accent mb-1" />
            <p className="text-2xl font-bold text-accent">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </Card>
          <Card className="p-4 text-center">
            <UserX className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-muted-foreground">{inactiveCount}</p>
            <p className="text-xs text-muted-foreground">Inativos</p>
          </Card>
        </div>

        {/* Sector Management */}
        <SectorManager />

        {/* Filters + Actions */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRoleType} onValueChange={setFilterRoleType}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Tipo de atuação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {ROLE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo atendente
            </Button>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-3 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Apelido</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Setor</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Tipo de Atuação</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">Status</th>
                    <th className="p-3 text-center font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendants.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{a.name}</p>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {a.nickname || <span className="italic opacity-60">—</span>}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {a.sector || <span className="italic opacity-60">—</span>}
                      </td>
                      <td className="p-3">
                        <Badge className={getRoleTypeBadgeClass(a.role_type)}>
                          {getRoleTypeLabel(a.role_type)}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={a.active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}>
                          {a.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(a.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAttendants.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        {attendants.length === 0
                          ? "Nenhum atendente cadastrado. Clique em \"Novo atendente\" para começar."
                          : "Nenhum atendente encontrado com os filtros aplicados."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Atendente" : "Novo Atendente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="att-name">Nome *</Label>
              <Input
                id="att-name"
                placeholder="Nome completo do atendente"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="att-nickname">Apelido / Nome alternativo</Label>
              <Input
                id="att-nickname"
                placeholder="Ex: Bia, Marquinhos"
                value={formNickname}
                onChange={(e) => setFormNickname(e.target.value)}
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="att-sector">Setor</Label>
              <Input
                id="att-sector"
                placeholder="Ex: Suporte, Financeiro, Comercial"
                value={formSector}
                onChange={(e) => setFormSector(e.target.value)}
                maxLength={60}
                list="sector-suggestions"
              />
              {sectors.length > 0 && (
                <datalist id="sector-suggestions">
                  {sectors.map((s) => <option key={s} value={s} />)}
                </datalist>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="att-role-type">Tipo de Atuação *</Label>
              <Select value={formRoleType} onValueChange={setFormRoleType}>
                <SelectTrigger id="att-role-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formRoleType === "sucesso_cliente" && "Será avaliado na régua principal de mentoria."}
                {formRoleType === "suporte_tecnico" && "Não será avaliado na régua de Sucesso do Cliente."}
                {formRoleType === "vendas" && "Preparado para uso futuro em avaliações comerciais."}
                {formRoleType === "outro" && "Fora da régua principal de avaliação por enquanto."}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="att-active">Ativo</Label>
              <Switch id="att-active" checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja realmente excluir este atendente? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Atendentes;
