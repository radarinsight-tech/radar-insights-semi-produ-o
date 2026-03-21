import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Radar, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsRecovery(true);
        }
      }
    );

    // Check hash for recovery token
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
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
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error("Erro ao redefinir senha. Tente solicitar um novo link.");
    } else {
      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate("/"), 2000);
    }
  };

  if (!isRecovery && !success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <Radar className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Link inválido</h1>
            <p className="text-sm text-muted-foreground">
              Este link de redefinição de senha é inválido ou expirou.
            </p>
          </div>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Voltar ao login
          </Button>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-xl bg-green-500/10">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Senha redefinida!</h1>
            <p className="text-sm text-muted-foreground">
              Sua senha foi alterada com sucesso. Redirecionando...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 rounded-xl bg-primary/10">
            <Radar className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Nova senha</h1>
          <p className="text-sm text-muted-foreground">
            Escolha uma nova senha para sua conta.
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
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
            <Label htmlFor="confirm-password">Confirmar senha</Label>
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
            {loading && <Loader2 className="animate-spin" />}
            Redefinir senha
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword;
