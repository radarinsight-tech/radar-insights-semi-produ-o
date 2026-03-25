import { useNavigate } from "react-router-dom";
import { LogOut, HeadsetIcon, CreditCard, Loader2, ShieldAlert, Users, FlaskConical, ShieldCheck, Users2, Trophy, ArrowRight, Sprout, Settings, BarChart3, PauseCircle } from "lucide-react";
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
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm px-6 py-2.5 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
      <main className="flex-1 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero branding */}
          <div className="text-center mb-8">
            <img src={logoFull} alt="Radar Insight" className="h-12 mx-auto mb-2 object-contain" />
            <p className="text-xs text-muted-foreground">Selecione o ambiente que deseja acessar</p>
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
            <div className="space-y-8">

              {/* ═══ HERO — Avaliação Oficial ═══ */}
              {showAuditoria && (
                <section>
                  <p className="text-[11px] font-semibold text-primary tracking-wide uppercase mb-2 px-1">▸ Comece por aqui</p>
                  <div
                    className="w-full relative rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/[0.04] to-primary/[0.10] p-6 sm:p-8 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                      <div className="p-3 rounded-xl bg-primary/10 shrink-0 w-fit">
                        <HeadsetIcon className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-foreground">Avaliação Oficial</h3>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0 font-semibold">Oficial</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Notas, classificação e elegibilidade a bônus da equipe.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0 gap-1.5 text-xs font-semibold shadow-sm"
                        onClick={() => navigate("/attendance")}
                      >
                        Acessar Avaliações
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {/* ═══ Grupo 1 — Ferramentas operacionais ═══ */}
              {showAuditoria && (
                <section>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">Ferramentas</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ModuleCard
                      title="Mentoria Lab"
                      description="Prepare mentorias com análise em lote dos atendimentos"
                      icon={<FlaskConical className="h-4.5 w-4.5 text-teal-500" />}
                      iconBg="bg-teal-500/10 group-hover:bg-teal-500/15"
                      onClick={() => navigate("/mentoria-lab")}
                      badge="Beta"
                    />
                    <ModuleCard
                      title="Atendentes"
                      description="Gerencie o cadastro e os setores da equipe"
                      icon={<Users2 className="h-4.5 w-4.5 text-cyan-500" />}
                      iconBg="bg-cyan-500/10 group-hover:bg-cyan-500/15"
                      onClick={() => navigate("/atendentes")}
                      highlight
                    />
                    <ModuleCard
                      title="Ranking & Bônus"
                      description="Acompanhe o desempenho mensal e o cálculo de bônus"
                      icon={<Trophy className="h-4.5 w-4.5 text-yellow-500" />}
                      iconBg="bg-yellow-500/10 group-hover:bg-yellow-500/15"
                      onClick={() => navigate("/ranking")}
                    />
                    <ModuleCard
                      title="Performance & Insights"
                      description="Visão gerencial com ranking, falhas recorrentes e evolução"
                      icon={<BarChart3 className="h-4.5 w-4.5 text-indigo-500" />}
                      iconBg="bg-indigo-500/10 group-hover:bg-indigo-500/15"
                      onClick={() => navigate("/performance")}
                      badge="Novo"
                    />
                  </div>
                </section>
              )}

              {/* ═══ Grupo 2 — Secundários ═══ */}
              {(showAuditoria || showCredito) && (
                <section>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">Outros recursos</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {showAuditoria && (
                      <ModuleCard
                        title="Mentoria Preventiva"
                        description="Identifique oportunidades de melhoria antes que se tornem problemas"
                        icon={<ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />}
                        iconBg="bg-emerald-500/10 group-hover:bg-emerald-500/15"
                        onClick={() => navigate("/mentoria-preventiva")}
                        badge="Novo"
                      />
                    )}
                    {showCredito && (
                      <ModuleCard
                        title="Análise de Crédito"
                        description="Consulte SPC/Serasa com parecer técnico automatizado"
                        icon={<CreditCard className="h-4.5 w-4.5 text-purple-500" />}
                        iconBg="bg-purple-500/10 group-hover:bg-purple-500/15"
                        onClick={() => navigate("/credit")}
                      />
                    )}
                    {showCredito && (
                      <ModuleCard
                        title="Crédito (Pausado)"
                        description="Versão legado mantida para referência — somente leitura"
                        icon={<PauseCircle className="h-4.5 w-4.5 text-orange-400" />}
                        iconBg="bg-orange-400/10 group-hover:bg-orange-400/15"
                        onClick={() => navigate("/credit-legado")}
                        badge="Legado"
                      />
                    )}
                  </div>
                </section>
              )}

              {/* ═══ Administração ═══ */}
              {showAdmin && (
                <section className="pt-2">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">Administração</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/users")}
                    className="group w-full sm:w-auto text-left rounded-xl border border-border/60 bg-card px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center gap-3"
                  >
                    <div className="p-1.5 rounded-lg bg-muted">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <span className="text-[13px] font-medium text-foreground">Usuários e Permissões</span>
                      <p className="text-[11px] text-muted-foreground">Gerencie acessos e configurações do sistema</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </section>
              )}
            </div>
          )}

          {isAdmin && (
            <p className="mt-6 text-[10px] text-muted-foreground text-center">
              Perfil administrativo — acesso liberado a todos os módulos
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

/* ── Module Card (compact) ── */
interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
  badge?: string;
  highlight?: boolean;
}

const ModuleCard = ({ title, description, icon, iconBg, onClick, badge, highlight }: ModuleCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`group relative text-left rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${highlight ? "border-primary/25 ring-1 ring-primary/10" : "border-border/60"}`}
  >
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg transition-colors shrink-0 ${iconBg}`}>
        {icon}
      </div>
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

export default Hub;
