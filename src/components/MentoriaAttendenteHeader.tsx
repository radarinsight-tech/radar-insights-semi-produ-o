import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import logoSymbol from "@/assets/logo-symbol.png";

interface Props {
  attendantName: string;
  monthlyCount: number;
  monthlyLimit: number;
}

const MentoriaAttendenteHeader = ({ attendantName, monthlyCount, monthlyLimit }: Props) => {
  const navigate = useNavigate();
  const isBlocked = monthlyCount >= monthlyLimit;
  const counterColor = monthlyCount <= 7 ? "text-emerald-600" : monthlyCount <= 9 ? "text-amber-600" : "text-destructive";
  const progressColor = monthlyCount <= 7 ? "bg-emerald-500" : monthlyCount <= 9 ? "bg-amber-500" : "bg-destructive";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <header className="border-b border-border bg-card px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoSymbol} alt="Radar Insight" className="h-7 w-7 rounded-lg object-contain" />
          <h1 className="text-lg font-bold text-primary">Mentoria Preventiva</h1>
          <Badge variant="outline" className="text-xs">Atendente</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{attendantName}</p>
            <p className={`text-xs font-bold ${counterColor}`}>
              Mentorias este mês: {monthlyCount} / {monthlyLimit}
            </p>
          </div>
          <div className="w-24">
            <Progress value={(monthlyCount / monthlyLimit) * 100} className="h-2" />
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </div>
      {isBlocked && (
        <div className="max-w-7xl mx-auto mt-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <span className="text-base">🔒</span>
            <div>
              <p className="text-sm font-medium text-destructive">Limite mensal atingido</p>
              <p className="text-xs text-muted-foreground">
                Você já realizou {monthlyLimit} mentorias preventivas este mês.
                Seu limite será renovado em 1º do próximo mês.
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default MentoriaAttendenteHeader;
