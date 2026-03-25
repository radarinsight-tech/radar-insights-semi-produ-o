import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const LegacyBanner = () => (
  <Alert variant="destructive" className="mb-4 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
    <AlertTriangle className="h-4 w-4 text-yellow-600" />
    <AlertTitle className="text-yellow-800 dark:text-yellow-400 font-semibold">
      ⚠️ Funcionalidade pausada temporariamente
    </AlertTitle>
    <AlertDescription className="text-yellow-700 dark:text-yellow-500 text-sm">
      Esta versão está mantida apenas para referência e não deve ser utilizada em produção.
    </AlertDescription>
  </Alert>
);

export default LegacyBanner;
