import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Radar, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface ForcePasswordChangeProps {
  onComplete: () => void;
}

const ForcePasswordChange = ({ onComplete }: ForcePasswordChangeProps) => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    // Update password
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      toast.error("Erro ao atualizar senha. Tente novamente.");
      setLoading(false);
      return;
    }

    // Remove force flag
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ force_password_change: false } as any)
        .eq("id", user.id);
    }

    setLoading(false);
    toast.success("Senha atualizada com sucesso!");
    onComplete();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 rounded-xl bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Troca de senha obrigatória</h1>
          <p className="text-sm text-muted-foreground text-center">
            Sua senha é provisória. Crie uma nova senha para continuar usando o sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Salvar nova senha
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ForcePasswordChange;
