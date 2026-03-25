import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import LegacyBanner from "@/components/LegacyBanner";

const CreditDocsLegado = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/credit-legado")}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Voltar
          </Button>
          <span className="text-xs text-muted-foreground font-medium">Documentos (Legado — somente leitura)</span>
        </div>
        <LegacyBanner
          message="⚠️ Versão legado — somente leitura"
          description="Use o módulo principal de Análise de Crédito para upload e validação de documentos."
        />

        <div className="text-center p-12 border border-dashed border-border rounded-xl bg-muted/30 mt-4">
          <p className="text-sm text-muted-foreground font-medium">
            Upload e validação de documentos estão desabilitados nesta versão legado.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/credit-docs")}>
            Ir para Documentos (versão ativa)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreditDocsLegado;
