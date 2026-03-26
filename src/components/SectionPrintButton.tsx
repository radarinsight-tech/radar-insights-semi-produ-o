import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SectionPrintButtonProps {
  sectionRef: React.RefObject<HTMLElement>;
  title?: string;
}

const SectionPrintButton = ({ sectionRef, title = "seção" }: SectionPrintButtonProps) => {
  const handlePrint = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    // Clone the section content
    const clone = el.cloneNode(true) as HTMLElement;

    // Remove interactive elements and loading skeletons from the clone
    clone.querySelectorAll("button, input, [role='checkbox'], [data-no-print], .animate-pulse, [data-skeleton]").forEach((node) => node.remove());

    // Copy computed styles from the main document
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");

    printWindow.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<title>${title} — Radar Insight</title>
<style>
${styles}
@media print {
  body { margin: 0; padding: 16px; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
body { font-family: Inter, system-ui, sans-serif; background: white; color: #1a1a1a; padding: 24px; }
</style>
</head><body>${clone.outerHTML}</body></html>`);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }, [sectionRef, title]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 print:hidden"
            onClick={handlePrint}
            aria-label={`Imprimir ${title}`}
            data-no-print
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Imprimir {title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SectionPrintButton;
