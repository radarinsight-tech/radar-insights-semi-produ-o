/**
 * Confirmation dialog for sensitive operations that impact
 * official data (scores, rankings, bonus, parser).
 */
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  type SensitiveOperation,
  getSensitiveOperationLabel,
  getSensitiveOperationWarning,
} from "@/lib/dataIntegrity";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: SensitiveOperation;
  onConfirm: () => void;
  loading?: boolean;
  extraInfo?: string;
}

const SensitiveActionDialog = ({ open, onOpenChange, operation, onConfirm, loading, extraInfo }: Props) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-warning" />
            Ação sensível
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Impacta dados oficiais
              </Badge>
              <span className="text-xs font-medium text-foreground">
                {getSensitiveOperationLabel(operation)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getSensitiveOperationWarning(operation)}
            </p>
            {extraInfo && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border">
                {extraInfo}
              </p>
            )}
            <p className="text-xs font-medium text-destructive">
              Esta ação requer confirmação de administrador e será registrada no histórico.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {loading ? "Processando..." : "Confirmar ação"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SensitiveActionDialog;
