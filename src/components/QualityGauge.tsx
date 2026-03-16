import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface QualityGaugeProps {
  score: number;
  classification: string;
}

const QualityGauge = ({ score, classification }: QualityGaugeProps) => {
  // Support both 0-10 and 0-100 scales; normalize to 0-100 internally
  const normalized = score <= 10 ? score * 10 : score;
  const clampedScore = Math.max(0, Math.min(100, normalized));
  const displayScore = score <= 10 ? score : score; // keep original for display
  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const from = 0;
    const to = clampedScore;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [clampedScore]);

  const getColor = (s: number) => {
    if (s <= 40) return "hsl(0, 84%, 60%)";
    if (s <= 60) return "hsl(38, 92%, 50%)";
    if (s <= 80) return "hsl(217, 91%, 60%)";
    return "hsl(160, 84%, 39%)";
  };

  const getLabel = (s: number) => {
    if (s <= 30) return "Crítico";
    if (s <= 50) return "Ruim";
    if (s <= 70) return "Regular";
    if (s <= 90) return "Bom";
    return "Excelente";
  };

  const color = getColor(clampedScore);
  const label = getLabel(clampedScore);
  const isExcelente = clampedScore > 80;

  const cx = 100, cy = 100, r = 80;
  const startAngle = -225;
  const endAngle = 45;

  const polarToCartesian = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const bgStart = polarToCartesian(startAngle);
  const bgEnd = polarToCartesian(endAngle);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

  const fillAngle = startAngle + (animatedScore / 100) * (endAngle - startAngle);
  const fillEnd = polarToCartesian(fillAngle);
  const largeArc = (fillAngle - startAngle) > 180 ? 1 : 0;
  const fillPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`;
  const needleEnd = polarToCartesian(fillAngle);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 130" className="w-48 h-auto">
        <path d={bgPath} fill="none" stroke="hsl(var(--border))" strokeWidth="14" strokeLinecap="round" />
        {animatedScore > 0 && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        )}
        <line
          x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
          stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill="hsl(var(--foreground))" />
        <text x={cx} y={cy - 15} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="28" fontWeight="700">
          {(animatedScore / 10).toFixed(1).replace(".", ",")}
        </text>
      </svg>

      {isExcelente ? (
        <span className="inline-flex items-center gap-1.5 mt-1 rounded-full bg-accent/15 border border-accent/30 px-3 py-1 text-sm font-semibold text-accent animate-scale-in">
          <CheckCircle2 className="h-4 w-4" />
          {label}
        </span>
      ) : (
        <p className="text-sm font-semibold mt-1" style={{ color }}>{label}</p>
      )}
      <p className="text-xs text-muted-foreground mt-0.5">{classification}</p>
    </div>
  );
};

export default QualityGauge;
