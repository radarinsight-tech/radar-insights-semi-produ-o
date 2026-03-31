import { Check, Sparkles, Zap, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type MentoriaStep = "pre-analise" | "semi-auto" | "relatorio";

const STEPS: { key: MentoriaStep; label: string; icon: typeof Sparkles }[] = [
  { key: "pre-analise", label: "Pré-Análise", icon: Sparkles },
  { key: "semi-auto", label: "Semi-Automático", icon: Zap },
  { key: "relatorio", label: "Relatório", icon: FileText },
];

interface MentoriaStepBarProps {
  currentStep: MentoriaStep;
  completedSteps: Set<MentoriaStep>;
  onStepClick: (step: MentoriaStep) => void;
  hasPreAnalysis: boolean;
  /** When true, hides the Pre-Análise step (audit mode: Semi-Auto → Relatório) */
  hidePreAnalysis?: boolean;
}

const MentoriaStepBar = ({ currentStep, completedSteps, onStepClick, hasPreAnalysis, hidePreAnalysis }: MentoriaStepBarProps) => {
  const steps = !hasPreAnalysis
    ? [STEPS[2]]
    : hidePreAnalysis
      ? STEPS.filter(s => s.key !== "pre-analise")
      : STEPS;
  const currentIdx = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="px-8 py-3 border-b border-border/40 bg-muted/10">
      <div className="flex items-center gap-0">
        {steps.map((step, idx) => {
          const isActive = step.key === currentStep;
          const isCompleted = completedSteps.has(step.key);
          const isClickable = isCompleted || idx <= currentIdx;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <button
                onClick={() => isClickable && onStepClick(step.key)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-bold",
                  isActive && "bg-primary/10 text-primary ring-1 ring-primary/30",
                  isCompleted && !isActive && "text-accent cursor-pointer hover:bg-accent/10",
                  !isActive && !isCompleted && "text-muted-foreground",
                  !isClickable && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-extrabold transition-all",
                  isActive && "bg-primary text-primary-foreground",
                  isCompleted && !isActive && "bg-accent text-accent-foreground",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground border border-border"
                )}>
                  {isCompleted && !isActive ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </div>
                <span className="whitespace-nowrap">{step.label}</span>
              </button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2 rounded-full transition-all",
                  idx < currentIdx ? "bg-accent" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MentoriaStepBar;
export { STEPS };
