import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

type Mode = "choose" | "email" | "manual";

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: ResetPasswordDialogProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reset = () => {
    setMode("choose");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleEmail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-reset-password",
        { body: { targetUserId: userId, mode: "email" } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("E-mail de redefinição enviado com sucesso");
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  };

  const handleManual = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-reset-password",
        { body: { targetUserId: userId, mode: "manual", newPassword } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Senha redefinida com sucesso");
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Usuário: <span className="font-medium text-foreground">{userName}</span>
        </p>

        {mode === "choose" && (
          <div className="space-y-3 pt-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={() => setMode("email")}
            >
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="font-medium">Enviar e-mail de redefinição</p>
                <p className="text-xs text-muted-foreground">
                  O usuário receberá um link para criar uma nova senha
                </p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={() => setMode("manual")}
            >
              <KeyRound className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="font-medium">Definir nova senha manualmente</p>
                <p className="text-xs text-muted-foreground">
                  Você define a nova senha diretamente
                </p>
              </div>
            </Button>
          </div>
        )}

        {mode === "email" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Um e-mail com link de redefinição será enviado para o usuário.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setMode("choose")} disabled={loading}>
                Voltar
              </Button>
              <Button onClick={handleEmail} disabled={loading} className="flex-1">
                {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Enviar e-mail
              </Button>
            </div>
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-pw">Nova senha</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirmar senha</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setMode("choose")} disabled={loading}>
                Voltar
              </Button>
              <Button onClick={handleManual} disabled={loading} className="flex-1">
                {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Salvar nova senha
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
