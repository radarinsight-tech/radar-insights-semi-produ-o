import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ForcePasswordChange from "@/pages/ForcePasswordChange";

interface Props {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [forceChange, setForceChange] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const timeout = setTimeout(() => {
      setTimedOut(true);
      setLoading(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Check force_password_change flag
  useEffect(() => {
    if (!session?.user?.id) {
      setForceChange(null);
      return;
    }

    supabase
      .from("profiles")
      .select("force_password_change")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        setForceChange((data as any)?.force_password_change === true);
      });
  }, [session?.user?.id]);

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md w-full mx-4 text-center space-y-4">
          <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto">
            <LogIn className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Sessão não encontrada</h2>
          <p className="text-sm text-muted-foreground">
            {timedOut
              ? "Não foi possível verificar a autenticação. Verifique sua conexão."
              : "Faça login para acessar o sistema."}
          </p>
          <Button onClick={() => window.location.href = "/auth"} className="w-full">
            <LogIn className="h-4 w-4 mr-2" /> Fazer login
          </Button>
        </Card>
      </div>
    );
  }

  // Block access if force password change is required
  if (forceChange === true) {
    return <ForcePasswordChange onComplete={() => setForceChange(false)} />;
  }

  // Still loading flag
  if (forceChange === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
