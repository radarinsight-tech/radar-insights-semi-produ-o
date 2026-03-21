import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const translateAuthError = (message: string): string => {
  if (message.includes("Invalid login credentials")) {
    return "E-mail ou senha incorretos. Verifique seus dados e tente novamente.";
  }
  if (message.includes("Email not confirmed")) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  }
  if (message.includes("User already registered")) {
    return "Já existe um usuário cadastrado com este e-mail.";
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
  return message;
};

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

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
      navigate("/");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Check for existing user via signup response
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        data: { full_name: signupName.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }

    // Supabase returns a fake user with no identities for existing emails
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      toast.error("Já existe um usuário cadastrado com este e-mail.");
      return;
    }

    toast.success("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Informe seu e-mail.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error.message));
    } else {
      toast.success("E-mail de redefinição enviado! Verifique sua caixa de entrada.");
      setShowForgotPassword(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <Radar className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
            <p className="text-sm text-muted-foreground">
              Informe seu e-mail para receber o link de redefinição.
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">E-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Enviar link de redefinição
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setShowForgotPassword(false)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Voltar ao login
          </button>
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

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Cadastrar</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-4">
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
                {loading && <Loader2 className="animate-spin" />}
                Entrar
              </Button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors text-center"
              >
                Esqueci minha senha
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nome completo</Label>
                <Input
                  id="signup-name"
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">E-mail</Label>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <Input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                Criar conta
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
