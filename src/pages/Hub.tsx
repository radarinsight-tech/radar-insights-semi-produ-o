import { useNavigate } from "react-router-dom";
import { LogOut, HeadsetIcon, CreditCard, Loader2, ShieldAlert, Users, FlaskConical, ShieldCheck, ClipboardCheck, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import logoSymbol from "@/assets/logo-symbol.png";
import logoFull from "@/assets/logo-full.png";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  hoverColor: string;
  badge?: string;
}

const ModuleCard = ({ title, description, icon, onClick, hoverColor, badge }: ModuleCardProps) => (
  <Card
    className={`group relative p-5 cursor-pointer border border-border/60 hover:${hoverColor} transition-all hover:shadow-md flex-1 min-w-0`}
    onClick={onClick}
  >
    <div className="flex items-start gap-3">
      {icon}
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-foreground mb-0.5 leading-tight">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
    {badge && <Badge variant="outline" className="absolute top-2.5 right-2.5 text-[10px] py-0">{badge}</Badge>}
  </Card>
);

const SectionHeader = ({ icon, title, subtitle, badge }: { icon: React.ReactNode; title: string; subtitle: string; badge?: React.ReactNode }) => (
  <div className="flex items-center gap-2.5 mb-3">
    {icon}
    <div className="min-w-0">
      <h3 className="text-sm font-bold text-foreground leading-tight">{title}</h3>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
    {badge && <div className="ml-auto shrink-0">{badge}</div>}
  </div>
);

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
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSymbol} alt="Radar Insight" className="h-7 w-7 rounded-lg object-contain" />
            <h1 className="text-lg font-bold text-primary">Radar Insight</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="max-w-4xl w-full">
          <div className="mb-5 flex justify-center">
            <img src={logoFull} alt="Radar Insight" className="h-20 object-contain" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 text-center">
            Bem-vindo ao <span className="text-primary">Radar Insight</span>
          </h2>
          <p className="text-sm text-muted-foreground mb-8 text-center">
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
            <div className="space-y-6">
              {/* ── Avaliação Oficial ── */}
              {showAuditoria && (
                <section>
                  <SectionHeader
                    icon={<div className="p-1.5 rounded-md bg-blue-500/10"><ClipboardCheck className="h-4 w-4 text-blue-500" /></div>}
                    title="Avaliação Oficial"
                    subtitle="Impacta nota, bônus e ranking mensal"
                    badge={<Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] py-0">Oficial</Badge>}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ModuleCard
                      title="Sucesso do Cliente"
                      description="Avaliação oficial de qualidade — gera nota, classificação e elegibilidade a bônus"
                      icon={<div className="p-2.5 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors shrink-0"><HeadsetIcon className="h-6 w-6 text-blue-500" /></div>}
                      onClick={() => navigate("/attendance")}
                      hoverColor="border-blue-400/50"
                    />
                    <ModuleCard
                      title="Mentoria Lab"
                      description="Análise em lote para preparação de mentorias — resultados compõem a avaliação oficial"
                      icon={<div className="p-2.5 rounded-xl bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors shrink-0"><FlaskConical className="h-6 w-6 text-teal-500" /></div>}
                      onClick={() => navigate("/mentoria-lab")}
                      hoverColor="border-teal-400/50"
                      badge="Beta"
                    />
                  </div>
                </section>
              )}

              {/* ── Desenvolvimento Preventivo ── */}
              {showAuditoria && (
                <section>
                  <SectionHeader
                    icon={<div className="p-1.5 rounded-md bg-emerald-500/10"><Sprout className="h-4 w-4 text-emerald-500" /></div>}
                    title="Desenvolvimento Preventivo"
                    subtitle="Sem impacto em nota, bônus ou ranking — apenas desenvolvimento"
                    badge={<Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] py-0">Não oficial</Badge>}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ModuleCard
                      title="Mentoria Preventiva"
                      description="Identifica oportunidades de melhoria antes que virem problemas — sem impacto em indicadores oficiais"
                      icon={<div className="p-2.5 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors shrink-0"><ShieldCheck className="h-6 w-6 text-emerald-500" /></div>}
                      onClick={() => navigate("/mentoria-preventiva")}
                      hoverColor="border-emerald-400/50"
                      badge="Beta"
                    />
                  </div>
                </section>
              )}

              {/* ── Crédito + Admin ── */}
              {(showCredito || showAdmin) && (
                <section>
                  <SectionHeader
                    icon={<div className="p-1.5 rounded-md bg-muted"><Users className="h-4 w-4 text-muted-foreground" /></div>}
                    title="Outros Módulos"
                    subtitle="Crédito e administração do sistema"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {showCredito && (
                      <ModuleCard
                        title="Análise de Crédito"
                        description="Análise de CPF via consulta SPC/Serasa com parecer técnico automatizado"
                        icon={<div className="p-2.5 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors shrink-0"><CreditCard className="h-6 w-6 text-purple-500" /></div>}
                        onClick={() => navigate("/credit")}
                        hoverColor="border-purple-400/50"
                      />
                    )}
                    {showAdmin && (
                      <ModuleCard
                        title="Usuários e Permissões"
                        description="Gerencie acessos, usuários e permissões com acesso total de administrador"
                        icon={<div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors shrink-0"><Users className="h-6 w-6 text-primary" /></div>}
                        onClick={() => navigate("/users")}
                        hoverColor="border-primary/50"
                      />
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {isAdmin && (
            <p className="mt-5 text-xs text-muted-foreground text-center">
              Seu perfil administrativo libera automaticamente todos os módulos do sistema.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Hub;