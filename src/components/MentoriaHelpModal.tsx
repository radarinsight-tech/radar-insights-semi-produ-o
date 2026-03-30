import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  {
    num: 1,
    icon: "📥",
    color: "bg-blue-500",
    title: "Exporte o PDF do atendimento",
    description:
      "Acesse o sistema onde seus atendimentos ficam registrados. Localize o atendimento que deseja avaliar e exporte/baixe como PDF.",
    tip: "Certifique-se de que o arquivo PDF contém seu nome como atendente responsável.",
  },
  {
    num: 2,
    icon: "📂",
    color: "bg-purple-500",
    title: "Selecione o arquivo aqui",
    description:
      "Clique em 'Selecionar Arquivos', escolha o PDF. O sistema lê automaticamente o conteúdo.",
    tip: "Você pode importar mais de um PDF por vez.",
  },
  {
    num: 3,
    icon: "🤖",
    color: "bg-orange-500",
    title: "Clique em Analisar",
    description:
      "Clique em 'Analisar Selecionados'. A IA processa o atendimento em 30 a 60 segundos.",
    tip: "Se aparecer 'Erro', o atendimento pode pertencer a outro colaborador — você só pode analisar os seus próprios.",
  },
  {
    num: 4,
    icon: "📊",
    color: "bg-emerald-500",
    title: "Acesse o resultado",
    description:
      "Clique em 'Ver' para visualizar sua nota, pontos fortes e oportunidades de melhoria.",
    tip: null,
  },
];

const rules = [
  "Somente seus próprios atendimentos podem ser analisados",
  "Meta: 4 mentorias por semana — acompanhe pelo painel acima",
  "Limite de 12 mentorias por mês — ao atingir, novas importações são bloqueadas",
  "A nota exibida é orientativa para seu desenvolvimento pessoal — não é a nota oficial de avaliação e não impacta seu bônus",
  "As mentorias serão acompanhadas pelo seu gestor",
  "Não é possível excluir uma mentoria após analisada",
];

const MentoriaHelpModal = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">📘 Como usar a Mentoria Preventiva</DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para analisar seus atendimentos
          </DialogDescription>
        </DialogHeader>

        {/* Steps */}
        <div className="grid gap-4 mt-2">
          {steps.map((step) => (
            <div
              key={step.num}
              className="flex gap-4 rounded-xl border border-border bg-card p-4"
            >
              {/* Number badge */}
              <div
                className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-full text-white font-bold text-sm ${step.color}`}
              >
                {step.num}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>{step.icon}</span> {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
                {step.tip && (
                  <p className="text-xs text-primary/80 italic">
                    💡 {step.tip}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Rules */}
        <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 space-y-2">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
            ⚠️ Regras importantes:
          </p>
          <ul className="space-y-1.5">
            {rules.map((rule, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="shrink-0 mt-0.5">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Close button */}
        <div className="mt-4 flex justify-center">
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            ✅ Entendido, vamos começar!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MentoriaHelpModal;
