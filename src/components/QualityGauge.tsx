interface QualityGaugeProps {
  score: number;
  classification: string;
}

const QualityGauge = ({ score, classification }: QualityGaugeProps) => {
  const clampedScore = Math.max(0, Math.min(100, score));
  
  // Map score 0-100 to angle -135 to 135 (270 degree arc)
  const angle = -135 + (clampedScore / 100) * 270;
  
  // Color based on score ranges from spec
  const getColor = (s: number) => {
    if (s <= 40) return "hsl(0, 84%, 60%)";       // destructive red
    if (s <= 60) return "hsl(38, 92%, 50%)";       // warning orange
    if (s <= 80) return "hsl(217, 91%, 60%)";      // primary blue
    return "hsl(160, 84%, 39%)";                    // accent green
  };

  const getLabel = (s: number) => {
    if (s <= 40) return "Qualidade crítica";
    if (s <= 60) return "Abaixo do esperado";
    if (s <= 80) return "Bom";
    return "Excelente";
  };

  const color = getColor(clampedScore);
  const label = getLabel(clampedScore);

  // SVG arc parameters
  const cx = 100, cy = 100, r = 80;
  const startAngle = -225; // degrees (from 7 o'clock position)
  const endAngle = 45;     // degrees (to 5 o'clock position)
  
  const polarToCartesian = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Background arc
  const bgStart = polarToCartesian(startAngle);
  const bgEnd = polarToCartesian(endAngle);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

  // Filled arc based on score
  const fillAngle = startAngle + (clampedScore / 100) * (endAngle - startAngle);
  const fillEnd = polarToCartesian(fillAngle);
  const largeArc = (fillAngle - startAngle) > 180 ? 1 : 0;
  const fillPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`;

  // Needle endpoint
  const needleEnd = polarToCartesian(fillAngle);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 130" className="w-48 h-auto">
        {/* Background arc */}
        <path d={bgPath} fill="none" stroke="hsl(var(--border))" strokeWidth="14" strokeLinecap="round" />
        
        {/* Colored arc */}
        {clampedScore > 0 && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        )}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke="hsl(var(--foreground))"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill="hsl(var(--foreground))" />

        {/* Score text */}
        <text x={cx} y={cy - 15} textAnchor="middle" className="text-3xl font-bold" fill="hsl(var(--foreground))" fontSize="28" fontWeight="700">
          {clampedScore.toFixed(1)}
        </text>
      </svg>
      <p className="text-sm font-semibold mt-1" style={{ color }}>{label}</p>
      <p className="text-xs text-muted-foreground">{classification}</p>
    </div>
  );
};

export default QualityGauge;
