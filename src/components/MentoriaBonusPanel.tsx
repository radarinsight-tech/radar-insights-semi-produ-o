import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, TrendingUp, Users } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import {
  resolvePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
} from "@/lib/mentoriaEvaluability";

interface BonusFile {
  id: string;
  atendente?: string;
  status: string;
  result?: any;
}

interface AttendantBonus {
  nome: string;
  qtdAvaliados: number;
  media100: number;
  media10: number;
  faixa: string;
  percentual: number;
  valor: number;
  faixaColor: string;
  faixaBg: string;
}

function calcularFaixa(media100: number): { faixa: string; percentual: number; valor: number; color: string; bg: string } {
  if (media100 >= 95) return { faixa: "Excelente", percentual: 100, valor: 1200, color: "text-accent", bg: "bg-accent/10 border-accent/20" };
  if (media100 >= 85) return { faixa: "Muito bom", percentual: 90, valor: 1080, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" };
  if (media100 >= 70) return { faixa: "Bom atendimento", percentual: 70, valor: 840, color: "text-primary", bg: "bg-primary/10 border-primary/20" };
  if (media100 >= 50) return { faixa: "Em desenvolvimento", percentual: 30, valor: 360, color: "text-warning", bg: "bg-warning/10 border-warning/20" };
  return { faixa: "Abaixo do esperado", percentual: 0, valor: 0, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" };
}

interface MentoriaBonusPanelProps {
  files: BonusFile[];
}

const MentoriaBonusPanel = ({ files }: MentoriaBonusPanelProps) => {
  const ranking = useMemo(() => {
    // Only include analyzed, evaluable files
    const eligible = files.filter((f) => {
      if (f.status !== "analisado" || !f.result) return false;
      const ev = resolvePersistedMentoriaEvaluability(f.result);
      if (ev?.nonEvaluable) return false;
      const inel = resolvePersistedMentoriaIneligibility(f.result);
      if (inel?.ineligible) return false;
      return f.result?.notaFinal != null;
    });

    // Group by attendant
    const byAttendant = new Map<string, number[]>();
    for (const f of eligible) {
      const nome = (f.result?.atendente || f.atendente || "").trim();
      const key = nome || "Não identificado";
      if (!byAttendant.has(key)) byAttendant.set(key, []);
      byAttendant.get(key)!.push(f.result.notaFinal);
    }

    // Calculate averages and bonus
    const result: AttendantBonus[] = [];
    for (const [nome, notas] of byAttendant) {
      const media100 = notas.reduce((s, n) => s + n, 0) / notas.length;
      const rounded = Math.round(media100 * 10) / 10;
      const media10 = Math.round(rounded / 10 * 10) / 10;
      const tier = calcularFaixa(rounded);
      result.push({
        nome,
        qtdAvaliados: notas.length,
        media100: rounded,
        media10,
        faixa: tier.faixa,
        percentual: tier.percentual,
        valor: tier.valor,
        faixaColor: tier.color,
        faixaBg: tier.bg,
      });
    }

    // Sort by performance (highest first)
    result.sort((a, b) => b.media100 - a.media100);
    return result;
  }, [files]);

  if (ranking.length === 0) return null;

  const totalBonus = ranking.reduce((s, r) => s + r.valor, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-warning" />
            Painel de Bônus
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {ranking.length} atendente{ranking.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Total: {formatBRL(totalBonus)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Atendente</TableHead>
              <TableHead className="text-center">Avaliações</TableHead>
              <TableHead className="text-center">Média</TableHead>
              <TableHead className="text-center">Faixa</TableHead>
              <TableHead className="text-right">Bônus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((r, idx) => (
              <TableRow key={r.nome}>
                <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-semibold text-foreground">{r.nome}</TableCell>
                <TableCell className="text-center">{r.qtdAvaliados}</TableCell>
                <TableCell className="text-center">
                  <span className={cn("font-bold", r.faixaColor)}>
                    {r.media10.toFixed(1).replace(".", ",")}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={cn("text-[10px] px-2 py-0.5 border", r.faixaBg, r.faixaColor)}>
                    {r.faixa} ({r.percentual}%)
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold">
                  <span className={r.valor > 0 ? r.faixaColor : "text-muted-foreground"}>
                    {formatBRL(r.valor)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Régua progressiva (base R$ 1.200)</p>
          <div className="flex flex-wrap gap-2">
            {[
              { faixa: "95–100", label: "Excelente", pct: "100%", valor: "R$ 1.200", color: "text-accent bg-accent/10 border-accent/20" },
              { faixa: "85–94", label: "Muito bom", pct: "90%", valor: "R$ 1.080", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
              { faixa: "70–84", label: "Bom", pct: "70%", valor: "R$ 840", color: "text-primary bg-primary/10 border-primary/20" },
              { faixa: "50–69", label: "Em desenv.", pct: "30%", valor: "R$ 360", color: "text-warning bg-warning/10 border-warning/20" },
              { faixa: "0–49", label: "Abaixo", pct: "0%", valor: "R$ 0", color: "text-destructive bg-destructive/10 border-destructive/20" },
            ].map((t) => (
              <span key={t.faixa} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", t.color)}>
                {t.faixa}: {t.label} ({t.valor})
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MentoriaBonusPanel;
