import { useNavigate } from "react-router-dom";
import { LogOut, HeadsetIcon, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import logoSymbol from "@/assets/logo-symbol.png";
import logoFull from "@/assets/logo-full.png";

const Hub = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Radar className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-primary">Radar Insight</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-3xl w-full text-center">
          {/* Logo placeholder */}
          <div className="mb-6 flex justify-center">
            <div className="p-4 rounded-2xl bg-primary/10">
              <Radar className="h-12 w-12 text-primary" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao <span className="text-primary">Radar Insight</span>
          </h2>
          <p className="text-muted-foreground mb-10">
            Selecione o ambiente que deseja acessar
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Sucesso do Cliente */}
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

            {/* Análise de Crédito */}
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
          </div>
        </div>
      </main>
    </div>
  );
};

export default Hub;
