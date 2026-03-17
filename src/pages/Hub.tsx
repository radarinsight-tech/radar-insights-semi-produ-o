import { useNavigate } from "react-router-dom";
import { LogOut, HeadsetIcon, CreditCard, Loader2, ShieldAlert, Users, FlaskConical, ShieldCheck, ClipboardCheck, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
        <div className="max-w-5xl w-full">
          <div className="mb-6 flex justify-center">
            <img src={logoFull} alt="Radar Insight" className="h-28 object-contain" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 text-center">
            Bem-vindo ao <span className="text-primary">Radar Insight</span>
          </h2>
          <p className="text-muted-foreground mb-10 text-center">
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
            <div className="space-y-10">
              {/* ── Avaliação Oficial ── */}
              {showAuditoria && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <ClipboardCheck className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Avaliação Oficial</h3>
                      <p className="text-xs text-muted-foreground">Impacta nota, bônus e ranking mensal</p>
                    </div>
                    <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] ml-auto">Oficial</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      className="group relative p-6 cursor-pointer border-2 border-border hover:border-blue-400/50 transition-all hover:shadow-lg"
                      onClick={() => navigate("/attendance")}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors shrink-0">
                          <HeadsetIcon className="h-8 w-8 text-blue-500" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-foreground mb-1">Sucesso do Cliente</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Avaliação oficial de qualidade — gera nota, classificação e elegibilidade a bônus
                          </p>
                        </div>
                      </div>
                    </Card>
                    <Card
                      className="group relative p-6 cursor-pointer border-2 border-border hover:border-teal-400/50 transition-all hover:shadow-lg"
                      onClick={() => navigate("/mentoria-lab")}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors shrink-0">
                          <FlaskConical className="h-8 w-8 text-teal-500" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-foreground mb-1">Mentoria Lab</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Análise em lote para preparação de mentorias — resultados compõem a avaliação oficial
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="absolute top-3 right-3 text-[10px]">Beta</Badge>
                    </Card>
                  </div>
                </section>
              )}

              {/* ── Desenvolvimento Preventivo ── */}
              {showAuditoria && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Sprout className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Desenvolvimento Preventivo</h3>
                      <p className="text-xs text-muted-foreground">Sem impacto em nota, bônus ou ranking — apenas desenvolvimento</p>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] ml-auto">Não oficial</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      className="group relative p-6 cursor-pointer border-2 border-border hover:border-emerald-400/50 transition-all hover:shadow-lg"
                      onClick={() => navigate("/mentoria-preventiva")}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors shrink-0">
                          <ShieldCheck className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-foreground mb-1">Mentoria Preventiva</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Identifica oportunidades de melhoria antes que virem problemas — sem impacto em indicadores oficiais
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="absolute top-3 right-3 text-[10px]">Beta</Badge>
                    </Card>
                  </div>
                </section>
              )}

              {/* ── Crédito ── */}
              {showCredito && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <CreditCard className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Análise de Crédito</h3>
                      <p className="text-xs text-muted-foreground">Consultas e pareceres técnicos</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      className="group relative p-6 cursor-pointer border-2 border-border hover:border-purple-400/50 transition-all hover:shadow-lg"
                      onClick={() => navigate("/credit")}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors shrink-0">
                          <CreditCard className="h-8 w-8 text-purple-500" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-foreground mb-1">Análise de Crédito</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Análise de CPF via consulta SPC/Serasa com parecer técnico automatizado
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </section>
              )}

              {/* ── Admin ── */}
              {showAdmin && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Administração</h3>
                      <p className="text-xs text-muted-foreground">Gestão de usuários e permissões</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      className="group relative p-6 cursor-pointer border-2 border-border hover:border-primary/50 transition-all hover:shadow-lg"
                      onClick={() => navigate("/users")}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors shrink-0">
                          <Users className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-foreground mb-1">Usuários e Permissões</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Gerencie acessos, usuários e permissões com acesso total de administrador
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </section>
              )}
            </div>
          )}

          {isAdmin && (
            <p className="mt-6 text-sm text-muted-foreground text-center">
              Seu perfil administrativo libera automaticamente todos os módulos do sistema.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Hub;