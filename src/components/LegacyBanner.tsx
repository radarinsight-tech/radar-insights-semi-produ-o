import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const LegacyBanner = () => (
  <Alert variant="destructive" className="mb-4 border-destructive/60 bg-destructive/10 dark:bg-destructive/20">
    <AlertTriangle className="h-5 w-5 text-destructive" />
    <AlertTitle className="text-destructive font-bold text-base">
      ⚠️ Funcionalidade temporariamente desativada
    </AlertTitle>
    <AlertDescription className="text-destructive/80 dark:text-destructive/70 text-sm mt-1">
      Esta versão está mantida apenas para referência e consulta. Nenhuma operação de escrita é permitida.
    </AlertDescription>
  </Alert>
);

export default LegacyBanner;
