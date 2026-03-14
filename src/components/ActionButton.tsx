import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

interface ActionButtonProps {
  icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  ariaLabel?: string;
}

const ActionButton = ({ icon: Icon, tooltip, onClick, disabled, destructive, ariaLabel }: ActionButtonProps) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${destructive ? "text-destructive hover:text-destructive" : ""}`}
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel || tooltip}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{disabled ? "PDF não disponível" : tooltip}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default ActionButton;
