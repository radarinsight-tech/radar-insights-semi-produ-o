import { useNavigate } from "react-router-dom";
import { LogOut, HeadsetIcon, CreditCard, Loader2, ShieldAlert, Users, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import logoSymbol from "@/assets/logo-symbol.png";
import logoFull from "@/assets/logo-full.png";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const Hub = () => {
  const navigate = useNavigate();
  const { canAccess, loading, isAdmin } = useUserPermissions();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const showAuditoria = canAccess("auditoria");
  const showCredito = canAccess("credito");
  const showAdmin = canAccess("admin");
  const noAccess = !showAuditoria && !showCredito && !showAdmin;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-8 w-8 rounded-lg object-contain" />
            <h1 className="text-xl font-bold text-primary">Radar Insight</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full text-center">
          <div className="mb-6 flex justify-center">
            <img src={logoFull} alt="Radar Insight" className="h-28 object-contain" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao <span className="text-primary">Radar Insight</span>
          </h2>
          <p className="text-muted-foreground mb-10">
            Selecione o ambiente que deseja acessar
          </p>

          {noAccess ? (
            <Card className="p-8 max-w-md mx-auto text-center space-y-4">
              <div className="p-3 rounded-full bg-destructive/10 w-fit mx-auto">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Sem permissão</h3>
              <p className="text-sm text-muted-foreground">
                Seu usuário ainda não possui acesso a nenhum módulo. Solicite ao administrador a liberação do acesso.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {showAuditoria && (
                <Card
                  className="group relative p-8 cursor-pointer border-2 border-border hover:border-blue-400/50 transition-all hover:shadow-lg"
                  onClick={() => navigate("/attendance")}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                      <HeadsetIcon className="h-10 w-10 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1">Sucesso do Cliente</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Avaliação de qualidade de atendimentos com análise detalhada por critérios
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {showAuditoria && (
                <Card
                  className="group relative p-8 cursor-pointer border-2 border-border hover:border-teal-400/50 transition-all hover:shadow-lg"
                  onClick={() => navigate("/mentoria-lab")}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-xl bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
                      <FlaskConical className="h-10 w-10 text-teal-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1">Mentoria Lab</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Upload múltiplo, seleção e análise em lote de atendimentos para preparação de mentorias
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="absolute top-3 right-3 text-xs">Beta</Badge>
                </Card>
              )}

              {showCredito && (
                <Card
                  className="group relative p-8 cursor-pointer border-2 border-border hover:border-purple-400/50 transition-all hover:shadow-lg"
                  onClick={() => navigate("/credit")}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                      <CreditCard className="h-10 w-10 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1">Análise de Crédito</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Análise de CPF via consulta SPC/Serasa com parecer técnico automatizado
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {showAdmin && (
                <Card
                  className="group relative p-8 cursor-pointer border-2 border-border hover:border-primary/50 transition-all hover:shadow-lg"
                  onClick={() => navigate("/users")}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <Users className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1">
                        Administração / Usuários
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Gerencie acessos, usuários e permissões com acesso total de administrador
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {isAdmin && (
            <p className="mt-6 text-sm text-muted-foreground">
              Seu perfil administrativo libera automaticamente todos os módulos do sistema.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Hub;
