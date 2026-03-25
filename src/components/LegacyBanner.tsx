import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface LegacyBannerProps {
  message?: string;
  description?: string;
}

const LegacyBanner = ({
  message = "⚠️ Funcionalidade temporariamente desativada",
  description = "Esta versão está mantida apenas para referência e consulta. Nenhuma operação de escrita é permitida.",
}: LegacyBannerProps) => (
  <Alert variant="destructive" className="mb-4 border-destructive/60 bg-destructive/10 dark:bg-destructive/20">
    <AlertTriangle className="h-5 w-5 text-destructive" />
    <AlertTitle className="text-destructive font-bold text-base">
      {message}
    </AlertTitle>
    <AlertDescription className="text-destructive/80 dark:text-destructive/70 text-sm mt-1">
      {description}
    </AlertDescription>
  </Alert>
);

export default LegacyBanner;
