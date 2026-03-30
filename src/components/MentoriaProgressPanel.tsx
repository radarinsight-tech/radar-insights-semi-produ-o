import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  monthlyCount: number;
  monthlyLimit: number;
  userId: string | null;
}

/* ── SVG Progress Ring ──────────────────────────────────────────── */
const ProgressRing = ({
  value,
  max,
  size = 64,
  strokeWidth = 6,
  color,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700 ease-out"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="text-xs font-bold fill-foreground"
      >
        {value}/{max}
      </text>
    </svg>
  );
};

/* ── Weekly color logic ─────────────────────────────────────────── */
function getWeeklyColor(count: number): string {
  if (count <= 1) return "hsl(0, 72%, 51%)";     // red
  if (count === 2 || count === 3) return "hsl(45, 93%, 47%)";    // amber
  return "hsl(142, 71%, 45%)";                     // green
}

function getWeeklyLabel(count: number): string {
  if (count <= 1) return "Abaixo do esperado";
  if (count === 2 || count === 3) return "Quase lá!";
  return "Meta atingida ✓";
}

/* ── Monthly color logic ────────────────────────────────────────── */
function getMonthlyColor(count: number): string {
  if (count <= 4) return "hsl(var(--muted-foreground))";  // gray
  if (count <= 8) return "hsl(217, 91%, 60%)";             // blue
  if (count <= 11) return "hsl(142, 71%, 55%)";            // light green
  return "hsl(142, 71%, 35%)";                              // dark green
}

/* ── Monday of current week (ISO) ───────────────────────────────── */
function getMonday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/* ── Check if current day is Sunday ─────────────────────────────── */
function isSunday(): boolean {
  return new Date().getDay() === 0;
}

const MentoriaProgressPanel = ({ monthlyCount, monthlyLimit, userId }: Props) => {
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [weeklyAlertDismissed, setWeeklyAlertDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const loadWeekly = async () => {
      const monday = getMonday();
      const { count } = await supabase
        .from("preventive_mentorings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "analisado")
        .gte("created_at", monday.toISOString());
      setWeeklyCount(count ?? 0);
    };
    loadWeekly();
  }, [userId, monthlyCount]); // re-fetch when monthlyCount changes (new analysis done)

  const showWeeklyAlert = isSunday() && weeklyCount < 4 && !weeklyAlertDismissed;
  const isMonthlyGoalReached = monthlyCount >= monthlyLimit;

  return (
    <div className="space-y-3">
      {/* Weekly alert banner */}
      {showWeeklyAlert && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            ⚠️ Você não atingiu as 4 mentorias desta semana. Tente manter o ritmo na próxima!
          </p>
          <button
            onClick={() => setWeeklyAlertDismissed(true)}
            className="shrink-0 rounded p-1 hover:bg-amber-500/20 transition-colors"
          >
            <X className="h-4 w-4 text-amber-600" />
          </button>
        </div>
      )}

      {/* Monthly goal reached banner */}
      {isMonthlyGoalReached && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-lg">🏆</span>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Você atingiu o limite mensal de {monthlyLimit} mentorias. Ótimo trabalho!
          </p>
        </div>
      )}

      {/* Two counters side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Weekly counter */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <ProgressRing value={weeklyCount} max={3} color={getWeeklyColor(weeklyCount)} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Esta semana</p>
            <p className="text-sm font-bold text-foreground">
              {weeklyCount} / 3 mentorias
            </p>
            <p className="text-xs mt-0.5" style={{ color: getWeeklyColor(weeklyCount) }}>
              {getWeeklyLabel(weeklyCount)}
            </p>
          </div>
        </div>

        {/* Monthly counter */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <ProgressRing value={monthlyCount} max={monthlyLimit} color={getMonthlyColor(monthlyCount)} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Este mês</p>
            <p className="text-sm font-bold text-foreground">
              {monthlyCount} / {monthlyLimit} mentorias
            </p>
            {isMonthlyGoalReached && (
              <span className="inline-flex items-center gap-1 mt-0.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Meta atingida! 🏆
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MentoriaProgressPanel;
