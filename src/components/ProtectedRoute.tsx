import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LogIn, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
}

const DEMO_MODE = true; // Sync with Index.tsx DEMO_MODE

const ProtectedRoute = ({ children }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [demoBypass, setDemoBypass] = useState(false);
  const location = useLocation();

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

    // Safety timeout — never stay loading forever
    const timeout = setTimeout(() => {
      setTimedOut(true);
      setLoading(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

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

  // Allow demo bypass for attendance page
  if (demoBypass) {
    return <>{children}</>;
  }

  if (!session) {
    const isAttendance = location.pathname === "/attendance";

    // Show visible fallback instead of silent redirect
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
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.href = "/auth"} className="w-full">
              <LogIn className="h-4 w-4 mr-2" /> Fazer login
            </Button>
            {isAttendance && DEMO_MODE && (
              <Button
                variant="outline"
                onClick={() => setDemoBypass(true)}
                className="w-full gap-2"
              >
                <FlaskConical className="h-4 w-4" /> Entrar em Modo Demo
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
