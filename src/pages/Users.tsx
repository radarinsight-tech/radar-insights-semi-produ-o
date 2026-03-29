import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserSectors } from "@/hooks/useUserSectors";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Radar, ArrowLeft, UserPlus, Users, Loader2, Pencil, Shield, MapPin,
  KeyRound, CheckCircle2, Clock, Trash2, UserX, UserCheck, Ban,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

type AppRole = "admin" | "auditoria" | "credito" | "mentoria_atendente";
type CreditSubRole = "credit_manual" | "credit_upload";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  auditoria: "Auditoria",
  credito: "Crédito",
  mentoria_atendente: "Mentoria (Atendente)",
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  auditoria: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  credito: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  mentoria_atendente: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

const CREDIT_SUB_LABELS: Record<CreditSubRole, string> = {
  credit_manual: "CPF/CNPJ",
  credit_upload: "Upload PDF",
};

interface ProfileWithRole {
  id: string;
  full_name: string | null;
  created_at: string;
  role: AppRole | null;
  creditSubRoles: CreditSubRole[];
  sectorIds: string[];
  force_password_change: boolean;
  active: boolean;
  attendant_id: string | null;
}

const UsersPage = () => {
  const navigate = useNavigate();
  const { allSectors, refresh: refreshSectors } = useUserSectors();
  const [profiles, setProfiles] = useState<ProfileWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<ProfileWithRole | null>(null);
  const [editRole, setEditRole] = useState<AppRole | "none">("none");
  const [editCreditSubs, setEditCreditSubs] = useState<CreditSubRole[]>([]);
  const [editSectorIds, setEditSectorIds] = useState<string[]>([]);
  const [editAttendantId, setEditAttendantId] = useState<string>("");
  const [attendantsList, setAttendantsList] = useState<Array<{ id: string; name: string }>>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<ProfileWithRole | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<ProfileWithRole | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleActiveOpen, setToggleActiveOpen] = useState(false);
  const [toggleActiveUser, setToggleActiveUser] = useState<ProfileWithRole | null>(null);
  const [toggleActiveLoading, setToggleActiveLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadProfiles = async () => {
    const { data: profilesData, error } = await supabase
      .from("profiles")
      .select("id, full_name, created_at, force_password_change, deleted_at, active, attendant_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading profiles:", error);
      toast.error("Erro ao carregar usuários.");
      setLoading(false);
      return;
    }

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const MAIN_ROLES: string[] = ["admin", "auditoria", "credito", "mentoria_atendente"];
    const CREDIT_SUBS: string[] = ["credit_manual", "credit_upload"];

    const roleMap = new Map<string, AppRole>();
    const creditSubMap = new Map<string, CreditSubRole[]>();
    (rolesData ?? []).forEach((r) => {
      if (MAIN_ROLES.includes(r.role)) {
        roleMap.set(r.user_id, r.role as AppRole);
      }
      if (CREDIT_SUBS.includes(r.role)) {
        const existing = creditSubMap.get(r.user_id) ?? [];
        existing.push(r.role as CreditSubRole);
        creditSubMap.set(r.user_id, existing);
      }
    });

    const { data: userSectorsData } = await supabase
      .from("user_sectors")
      .select("user_id, sector_id");

    const sectorMap = new Map<string, string[]>();
    (userSectorsData ?? []).forEach((us: any) => {
      const existing = sectorMap.get(us.user_id) ?? [];
      existing.push(us.sector_id);
      sectorMap.set(us.user_id, existing);
    });

    const merged: ProfileWithRole[] = (profilesData || []).map((p) => ({
      ...p,
      role: roleMap.get(p.id) ?? null,
      creditSubRoles: creditSubMap.get(p.id) ?? [],
      sectorIds: sectorMap.get(p.id) ?? [],
      force_password_change: (p as any).force_password_change ?? false,
      active: (p as any).active !== false,
      attendant_id: (p as any).attendant_id ?? null,
    }));

    setProfiles(merged);
    setLoading(false);
  };

  useEffect(() => {
    loadProfiles();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invitePassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setInviteLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: inviteEmail.trim(),
          password: invitePassword,
          fullName: inviteName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Usuário criado com sucesso! Ele poderá acessar com e-mail e senha provisória.");
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      setInviteOpen(false);
      setTimeout(loadProfiles, 1500);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário.");
    } finally {
      setInviteLoading(false);
    }
  };

  const openEditDialog = async (profile: ProfileWithRole) => {
    setEditUser(profile);
    setEditRole(profile.role ?? "none");
    setEditCreditSubs(profile.creditSubRoles ?? []);
    setEditSectorIds(profile.sectorIds ?? []);
    setEditAttendantId(profile.attendant_id ?? "");
    // Load attendants list
    const { data: atts } = await supabase.from("attendants").select("id, name").eq("active", true).order("name");
    setAttendantsList(atts ?? []);
    setEditOpen(true);
  };

  const toggleCreditSub = (sub: CreditSubRole) => {
    setEditCreditSubs((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  const toggleEditSector = (sectorId: string) => {
    setEditSectorIds((prev) =>
      prev.includes(sectorId) ? prev.filter((id) => id !== sectorId) : [...prev, sectorId]
    );
  };

  const handleSaveRole = async () => {
    if (!editUser) return;

    // Validate: mentoria_atendente requires attendant
    if (editRole === "mentoria_atendente" && !editAttendantId) {
      toast.error("Selecione o atendente vinculado.");
      return;
    }

    setEditLoading(true);

    try {
      await supabase.from("user_roles").delete().eq("user_id", editUser.id);

      const rolesToInsert: string[] = [];
      if (editRole !== "none") rolesToInsert.push(editRole);
      editCreditSubs.forEach((sub) => rolesToInsert.push(sub));

      if (rolesToInsert.length > 0) {
        const rows = rolesToInsert.map((role) => ({ user_id: editUser.id, role }));
        const { error } = await supabase.from("user_roles").insert(rows as any);
        if (error) throw error;
      }

      await supabase.from("user_sectors").delete().eq("user_id", editUser.id);

      if (editSectorIds.length > 0) {
        const rows = editSectorIds.map((sid) => ({ user_id: editUser.id, sector_id: sid }));
        const { error: secError } = await supabase.from("user_sectors").insert(rows as any);
        if (secError) throw secError;
      }

      // Save attendant_id on profile
      const attId = editRole === "mentoria_atendente" ? editAttendantId : null;
      const { error: profError } = await supabase
        .from("profiles")
        .update({ attendant_id: attId } as any)
        .eq("id", editUser.id);
      if (profError) throw profError;

      toast.success("Permissões e setores atualizados.");
      setEditOpen(false);
      setEditUser(null);
      await loadProfiles();
      await refreshSectors();
    } catch (err: any) {
      console.error("Error saving role:", err);
      toast.error("Erro ao salvar: " + (err.message || "erro desconhecido"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { targetUserId: deleteUser.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário excluído com sucesso.");
      setDeleteOpen(false);
      setDeleteUser(null);
      await loadProfiles();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir usuário.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleActiveUser) return;
    setToggleActiveLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { targetUserId: toggleActiveUser.id, action: "toggle_active" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Status alterado com sucesso.");
      setToggleActiveOpen(false);
      setToggleActiveUser(null);
      await loadProfiles();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status.");
    } finally {
      setToggleActiveLoading(false);
    }
  };

  const getStatusBadge = (profile: ProfileWithRole) => {
    if (!profile.active) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          <Ban className="h-3 w-3 mr-1" />
          Inativo
        </Badge>
      );
    }
    if (profile.force_password_change) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Clock className="h-3 w-3 mr-1" />
          Senha pendente
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Ativo
      </Badge>
    );
  };

  const isSelf = (id: string) => currentUserId === id;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Radar className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Radar Insight</h1>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={() => navigate("/hub")}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Usuários — Banda Turbo
              </h2>
              <p className="text-sm text-muted-foreground">
                Gerencie os membros e permissões da equipe
              </p>
            </div>
          </div>

          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4" />
                Adicionar usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar novo usuário</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Nome completo</Label>
                  <Input id="invite-name" required value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome do usuário" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">E-mail</Label>
                  <Input id="invite-email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="usuario@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-password">Senha inicial</Label>
                  <Input id="invite-password" type="password" required minLength={6} value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
                <Button type="submit" className="w-full" disabled={inviteLoading}>
                  {inviteLoading && <Loader2 className="animate-spin" />}
                  Criar conta
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  O usuário poderá acessar imediatamente com o e-mail e senha informados.
                  No primeiro login, será obrigado a trocar a senha.
                </p>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum usuário cadastrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Nome</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[140px]">Permissão</TableHead>
                    <TableHead className="min-w-[120px]">Setores</TableHead>
                    <TableHead className="min-w-[100px]">Desde</TableHead>
                    <TableHead className="min-w-[200px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id} className={!profile.active ? "opacity-60" : ""}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {profile.full_name || "Sem nome"}
                      </TableCell>
                      <TableCell>{getStatusBadge(profile)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {profile.role ? (
                            <Badge variant="outline" className={ROLE_COLORS[profile.role]}>
                              <Shield className="h-3 w-3 mr-1" />
                              {ROLE_LABELS[profile.role]}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                          {profile.creditSubRoles.map((sub) => (
                            <Badge key={sub} variant="outline" className="text-[10px] bg-muted/50 border-border">
                              {CREDIT_SUB_LABELS[sub]}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {profile.sectorIds.length > 0 ? (
                            profile.sectorIds.map((sid) => {
                              const sec = allSectors.find((s) => s.id === sid);
                              return sec ? (
                                <Badge key={sid} variant="outline" className="text-xs bg-muted/50">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {sec.name}
                                </Badge>
                              ) : null;
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(profile)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Editar permissões</p></TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setResetPwUser(profile); setResetPwOpen(true); }}>
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Redefinir senha</p></TooltipContent>
                            </Tooltip>

                            {!isSelf(profile.id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 ${profile.active ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                                    onClick={() => { setToggleActiveUser(profile); setToggleActiveOpen(true); }}
                                  >
                                    {profile.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{profile.active ? "Inativar" : "Ativar"}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {!isSelf(profile.id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => { setDeleteUser(profile); setDeleteOpen(true); }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Excluir</p></TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </main>

      {/* Edit Role Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar permissão</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Usuário</Label>
                <p className="font-medium text-foreground">{editUser.full_name || "Sem nome"}</p>
                {editUser.force_password_change && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" /> Este usuário ainda precisa redefinir a senha
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Módulo de acesso</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole | "none")}>
                  <SelectTrigger><SelectValue placeholder="Selecione a permissão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem permissão</SelectItem>
                    <SelectItem value="auditoria">Auditoria de Atendimento</SelectItem>
                    <SelectItem value="credito">Análise de Crédito</SelectItem>
                    <SelectItem value="mentoria_atendente">Mentoria Preventiva (Atendente)</SelectItem>
                    <SelectItem value="admin">Admin (acesso total)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Define qual módulo o usuário pode acessar no sistema.</p>
              </div>
              {editRole === "mentoria_atendente" && (
                <div className="space-y-2">
                  <Label>Atendente vinculado <span className="text-destructive">*</span></Label>
                  <Select value={editAttendantId} onValueChange={setEditAttendantId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o atendente" /></SelectTrigger>
                    <SelectContent>
                      {attendantsList.map((att) => (
                        <SelectItem key={att.id} value={att.id}>{att.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">O usuário só poderá analisar atendimentos deste atendente.</p>
                </div>
              )}
              {(editRole === "credito" || editRole === "admin") && (
                <div className="space-y-2">
                  <Label>Permissões de Crédito</Label>
                  <div className="space-y-2 border rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id="credit_manual" checked={editCreditSubs.includes("credit_manual")} onCheckedChange={() => toggleCreditSub("credit_manual")} />
                      <label htmlFor="credit_manual" className="text-sm cursor-pointer">Consulta manual (CPF/CNPJ)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="credit_upload" checked={editCreditSubs.includes("credit_upload")} onCheckedChange={() => toggleCreditSub("credit_upload")} />
                      <label htmlFor="credit_upload" className="text-sm cursor-pointer">Upload de documento (PDF/imagem)</label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Define quais funcionalidades de crédito o usuário pode acessar.</p>
                </div>
              )}
              {allSectors.length > 0 && (
                <div className="space-y-2">
                  <Label>Setores</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                    {allSectors.map((sec) => (
                      <div key={sec.id} className="flex items-center gap-2">
                        <Checkbox id={`sec-${sec.id}`} checked={editSectorIds.includes(sec.id)} onCheckedChange={() => toggleEditSector(sec.id)} />
                        <label htmlFor={`sec-${sec.id}`} className="text-sm cursor-pointer">{sec.name}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Setores definem quais dados o usuário pode visualizar.</p>
                </div>
              )}
              <Button className="w-full" onClick={handleSaveRole} disabled={editLoading}>
                {editLoading && <Loader2 className="animate-spin" />}
                Salvar permissões
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      {resetPwUser && (
        <ResetPasswordDialog
          open={resetPwOpen}
          onOpenChange={setResetPwOpen}
          userId={resetPwUser.id}
          userName={resetPwUser.full_name || "Sem nome"}
          onSuccess={loadProfiles}
        />
      )}

      {/* Toggle Active Confirmation Dialog */}
      <AlertDialog open={toggleActiveOpen} onOpenChange={setToggleActiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleActiveUser?.active ? "Inativar usuário" : "Ativar usuário"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleActiveUser?.active
                ? <>Tem certeza que deseja inativar <strong>{toggleActiveUser?.full_name || "Sem nome"}</strong>? O usuário não poderá fazer login enquanto estiver inativo.</>
                : <>Deseja reativar o acesso de <strong>{toggleActiveUser?.full_name || "Sem nome"}</strong>? O usuário poderá fazer login novamente.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleActiveLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              disabled={toggleActiveLoading}
              className={toggleActiveUser?.active
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
            >
              {toggleActiveLoading
                ? "Processando..."
                : toggleActiveUser?.active ? "Inativar" : "Ativar"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>{deleteUser?.full_name || "Sem nome"}</strong>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
