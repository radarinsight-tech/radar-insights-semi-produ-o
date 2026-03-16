import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

const AdminGuard = ({ children }: Props) => {
  const { canAccess, loading } = useUserPermissions();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccess("admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md w-full mx-4 text-center space-y-4">
          <div className="p-3 rounded-full bg-destructive/10 w-fit mx-auto">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Acesso administrativo restrito</h2>
          <p className="text-sm text-muted-foreground">
            Você precisa de permissão de administrador para acessar esta área.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Voltar ao início
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
