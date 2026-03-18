import { useNavigate } from "react-router-dom";
import { LogOut, HeadsetIcon, CreditCard, Loader2, ShieldAlert, Users, FlaskConical, ShieldCheck, ClipboardCheck, Sprout, Users2, Trophy } from "lucide-react";
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
  accentClass: string;
  badge?: string;
}

const ModuleCard = ({ title, description, icon, onClick, accentClass, badge }: ModuleCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`group relative text-left rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${accentClass}`}
  >
    <div className="flex items-start gap-3.5">
      {icon}
      <div className="min-w-0 flex-1">
        <h4 className="text-[13px] font-semibold text-foreground leading-snug">{title}</h4>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{description}</p>
      </div>
    </div>
    {badge && (
      <Badge variant="outline" className="absolute top-2.5 right-2.5 text-[9px] px-1.5 py-0 font-medium">{badge}</Badge>
    )}
  </button>
);

const SectionLabel = ({ icon, title, subtitle, badge }: { icon: React.ReactNode; title: string; subtitle: string; badge?: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-2.5">
    {icon}
    <span className="text-xs font-semibold text-foreground tracking-wide uppercase">{title}</span>
    <span className="hidden sm:inline text-[10px] text-muted-foreground font-normal normal-case">— {subtitle}</span>
    {badge && <div className="ml-auto">{badge}</div>}
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
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm px-6 py-2.5 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoSymbol} alt="Radar Insight" className="h-6 w-6 rounded-md object-contain" />
            <span className="text-sm font-bold text-primary tracking-tight">Radar Insight</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5 mr-1" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="max-w-3xl w-full">
          {/* Hero */}
          <div className="text-center mb-7">
            <img src={logoFull} alt="Radar Insight" className="h-14 mx-auto mb-3 object-contain" />
            <h2 className="text-lg font-bold text-foreground">
              Bem-vindo ao <span className="text-primary">Radar Insight</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Selecione o ambiente que deseja acessar</p>
          </div>

          {noAccess ? (
            <Card className="p-8 max-w-sm mx-auto text-center space-y-3 shadow-sm">
              <div className="p-3 rounded-full bg-destructive/10 w-fit mx-auto">
                <ShieldAlert className="h-7 w-7 text-destructive" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Sem permissão</h3>
              <p className="text-xs text-muted-foreground">
                Seu usuário ainda não possui acesso a nenhum módulo. Solicite ao administrador.
              </p>
            </Card>
          ) : (
            <div className="space-y-5">
              {/* ── Avaliação Oficial ── */}
              {showAuditoria && (
                <section>
                  <SectionLabel
                    icon={<ClipboardCheck className="h-3.5 w-3.5 text-blue-500" />}
                    title="Avaliação Oficial"
                    subtitle="Impacta nota, bônus e ranking"
                    badge={<Badge className="bg-blue-500/10 text-blue-600 border-blue-200/60 text-[9px] px-1.5 py-0 font-medium">Oficial</Badge>}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ModuleCard
                      title="Sucesso do Cliente"
                      description="Avaliação oficial de qualidade — gera nota, classificação e elegibilidade a bônus"
                      icon={<div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors shrink-0"><HeadsetIcon className="h-5 w-5 text-blue-500" /></div>}
                      onClick={() => navigate("/attendance")}
                      accentClass="hover:border-blue-400/40"
                    />
                    <ModuleCard
                      title="Mentoria Lab"
                      description="Análise em lote para preparação de mentorias — compõe a avaliação oficial"
                      icon={<div className="p-2 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors shrink-0"><FlaskConical className="h-5 w-5 text-teal-500" /></div>}
                      onClick={() => navigate("/mentoria-lab")}
                      accentClass="hover:border-teal-400/40"
                      badge="Beta"
                    />
                    <ModuleCard
                      title="Atendentes"
                      description="Cadastro e gestão dos atendentes para padronização de análises"
                      icon={<div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors shrink-0"><Users2 className="h-5 w-5 text-cyan-500" /></div>}
                      onClick={() => navigate("/atendentes")}
                      accentClass="hover:border-cyan-400/40"
                    />
                  </div>
                </section>
              )}

              {/* ── Desenvolvimento Preventivo ── */}
              {showAuditoria && (
                <section>
                  <SectionLabel
                    icon={<Sprout className="h-3.5 w-3.5 text-emerald-500" />}
                    title="Desenvolvimento Preventivo"
                    subtitle="Sem impacto em nota ou bônus"
                    badge={<Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200/60 text-[9px] px-1.5 py-0 font-medium">Não oficial</Badge>}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ModuleCard
                      title="Mentoria Preventiva"
                      description="Identifica oportunidades de melhoria antes que virem problemas recorrentes"
                      icon={<div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors shrink-0"><ShieldCheck className="h-5 w-5 text-emerald-500" /></div>}
                      onClick={() => navigate("/mentoria-preventiva")}
                      accentClass="hover:border-emerald-400/40"
                      badge="Beta"
                    />
                    {/* Placeholder to maintain grid alignment */}
                    <div className="hidden sm:block" aria-hidden="true" />
                  </div>
                </section>
              )}

              {/* ── Outros ── */}
              {(showCredito || showAdmin) && (
                <section>
                  <SectionLabel
                    icon={<CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
                    title="Outros Módulos"
                    subtitle="Crédito e administração"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {showCredito && (
                      <ModuleCard
                        title="Análise de Crédito"
                        description="Consulta SPC/Serasa com parecer técnico automatizado"
                        icon={<div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors shrink-0"><CreditCard className="h-5 w-5 text-purple-500" /></div>}
                        onClick={() => navigate("/credit")}
                        accentClass="hover:border-purple-400/40"
                      />
                    )}
                    {showAdmin && (
                      <ModuleCard
                        title="Usuários e Permissões"
                        description="Gerencie acessos e permissões do sistema"
                        icon={<div className="p-2 rounded-lg bg-muted group-hover:bg-muted/80 transition-colors shrink-0"><Users className="h-5 w-5 text-muted-foreground" /></div>}
                        onClick={() => navigate("/users")}
                        accentClass="hover:border-border"
                      />
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {isAdmin && (
            <p className="mt-4 text-[10px] text-muted-foreground text-center">
              Perfil administrativo — acesso liberado a todos os módulos
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Hub;