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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: ResetPasswordDialogProps) {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reset = () => {
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
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
      toast.success("Senha provisória definida. O usuário será obrigado a trocar no próximo login.");
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
          <DialogTitle>Definir senha provisória</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Usuário: <span className="font-medium text-foreground">{userName}</span>
        </p>

        <p className="text-sm text-muted-foreground">
          Defina uma senha provisória. O usuário será obrigado a criar uma nova senha no próximo login.
        </p>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="new-pw">Senha provisória</Label>
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
          <Button onClick={handleManual} disabled={loading} className="w-full">
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Salvar senha provisória
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
