import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Radar, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const translateAuthError = (message: string): string => {
  if (message.includes("Invalid login credentials")) {
    return "Usuário ou senha inválidos.";
  }
  if (message.includes("Email not confirmed")) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  }
  if (message.includes("Password should be at least")) {
    return "A senha deve ter no mínimo 6 caracteres.";
  }
  if (message.includes("Unable to validate email")) {
    return "Endereço de e-mail inválido.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (message.includes("User not found")) {
    return "Conta não encontrada. Verifique o e-mail informado.";
  }
  if (message.includes("Email rate limit exceeded")) {
    return "Limite de envio de e-mails atingido. Tente novamente em alguns minutos.";
  }
  return message;
};

type AuthView = "login" | "forgot-password";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<AuthView>("login");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Forgot password
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error.message));
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/hub");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }

    setRecoverySent(true);
    toast.success("Link de redefinição enviado! Verifique seu e-mail.");
  };

  if (view === "forgot-password") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <Radar className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
            <p className="text-sm text-muted-foreground text-center">
              Informe seu e-mail para receber o link de redefinição de senha.
            </p>
          </div>

          {recoverySent ? (
            <div className="space-y-4 text-center">
              <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Se o e-mail estiver cadastrado, você receberá o link de redefinição em instantes.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setView("login");
                  setRecoverySent(false);
                  setRecoveryEmail("");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email">E-mail</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  required
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Enviar link de redefinição
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setView("login")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login
              </Button>
            </form>
          )}
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
          <h1 className="text-2xl font-bold text-foreground">Radar Insight</h1>
          <p className="text-sm text-muted-foreground">Análise inteligente de atendimentos</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">E-mail</Label>
            <Input
              id="login-email"
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Senha</Label>
            <Input
              id="login-password"
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Entrar
          </Button>
          <button
            type="button"
            onClick={() => setView("forgot-password")}
            className="w-full text-sm text-primary hover:underline text-center"
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center">Acesso liberado pelo administrador.</p>
      </Card>
    </div>
  );
};

export default Auth;
