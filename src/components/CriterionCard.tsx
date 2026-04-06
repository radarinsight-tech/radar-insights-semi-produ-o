/**
 * CriterionCard — Unified criterion display component.
 *
 * Supports two modes:
 * - "readonly": Shows criterion result with no editing controls
 * - "audit": Shows criterion with Accept / Adjust / Fora de escopo actions
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, XCircle, ShieldCheck, Check, X, Pencil,
  MessageSquareQuote, ChevronDown, ChevronUp, TriangleAlert, Eye,
} from "lucide-react";
import type { SugestaoResultado, Confianca } from "@/lib/mentoriaPreAnalysis";
import { CRITERIA_WEIGHTS } from "@/lib/mentoriaScoring";

/* ─── Types ─── */
export type CriterionMode = "readonly" | "audit";
export type DecisionStatus = "pending" | "accepted" | "adjusted" | "rejected";

export interface CriterionDecision {
  numero: number;
  sugestaoOriginal: SugestaoResultado;
  decisaoFinal: SugestaoResultado;
  status: DecisionStatus;
  editadoManualmente: boolean;
  confiancaOriginal: Confianca;
}

export interface CriterionCardData {
  numero: number;
  nome: string;
  categoria: string;
  justificativa: string;
  evidencia?: string;
  confianca: Confianca;
  sugestao: SugestaoResultado;
  /** Points obtained (from IA result) — used in readonly */
  pontosObtidos?: number;
  /** Max weight */
  pesoMaximo?: number;
}

interface CriterionCardProps {
  item: CriterionCardData;
  mode: CriterionMode;
  /** Required in audit mode */
  decision?: CriterionDecision;
  confirmed?: boolean;
  onAccept?: (numero: number) => void;
  onAdjust?: (numero: number, value: SugestaoResultado) => void;
  onReject?: (numero: number) => void;
}

/* ─── Config ─── */
const SENSITIVE_CRITERIA = new Set([6, 11, 12, 17, 18]);

const sugestaoConfig: Record<SugestaoResultado, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  SIM: { label: "SIM", icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10 border-accent/20" },
  NÃO: { label: "NÃO", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  "FORA DO ESCOPO": { label: "N/A", icon: ShieldCheck, color: "text-muted-foreground", bg: "bg-muted/50 border-muted-foreground/20" },
};

const statusConfig: Record<DecisionStatus, { label: string; color: string; icon: typeof Check }> = {
  pending: { label: "Pendente", color: "text-muted-foreground", icon: Eye },
  accepted: { label: "Aceito", color: "text-accent", icon: Check },
  adjusted: { label: "Ajustado", color: "text-primary", icon: Pencil },
  rejected: { label: "Rejeitado", color: "text-destructive", icon: X },
};

function getCriterionAlerts(numero: number, confianca: Confianca, sugestao: SugestaoResultado, evidencia?: string) {
  const alerts: { key: string; label: string; tooltip: string }[] = [];
  if (confianca === "baixa") {
    alerts.push({ key: "low-conf", label: "Baixa confiança", tooltip: "A IA tem baixa certeza neste critério — revise com atenção" });
  }
  if (sugestao === "SIM" && !evidencia) {
    alerts.push({ key: "no-evidence", label: "Sem evidência", tooltip: "Sugestão SIM sem trecho de evidência no texto — valide manualmente" });
  }
  if (SENSITIVE_CRITERIA.has(numero)) {
    alerts.push({ key: "sensitive", label: "Critério sensível", tooltip: "Este critério historicamente gera mais divergências — revise com cuidado" });
  }
  return alerts;
}

const CriterionCard = ({ item, mode, decision, confirmed, onAccept, onAdjust, onReject }: CriterionCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isAudit = mode === "audit";

  // Determine visual config based on mode
  const displayResult = decision ? decision.decisaoFinal : item.sugestao;
  const cfg = sugestaoConfig[displayResult];
  const Icon = cfg.icon;

  // Background logic
  let cardBg = `${cfg.bg}`;
  if (isAudit && decision) {
    const requiresReview = decision.confiancaOriginal === "baixa" && decision.status === "pending";
    const needsAttention = decision.confiancaOriginal === "media" && decision.status === "pending";
    if (confirmed) cardBg = "opacity-75 border-border bg-card";
    else if (requiresReview) cardBg = "border-destructive/30 bg-destructive/5";
    else if (needsAttention) cardBg = "border-warning/30 bg-warning/5";
    else if (decision.status === "accepted") cardBg = "border-accent/20 bg-accent/5";
    else if (decision.status === "adjusted") cardBg = "border-primary/20 bg-primary/5";
    else if (decision.status === "rejected") cardBg = "border-destructive/20 bg-destructive/5";
    else cardBg = "border-border bg-card";
  }

  // Status icon for audit mode
  const stCfg = decision ? statusConfig[decision.status] : null;
  const StIcon = stCfg?.icon || Icon;

  const weight = CRITERIA_WEIGHTS.find(c => c.numero === item.numero)?.peso || 0;
  const alerts = getCriterionAlerts(item.numero, item.confianca, item.sugestao, item.evidencia);

  return (
    <div className={`rounded-xl border p-3.5 transition-all ${cardBg}`}>
      {/* Main row */}
      <div className="flex items-center gap-2.5">
        {isAudit && stCfg ? (
          <StIcon className={`h-4 w-4 shrink-0 ${stCfg.color}`} />
        ) : (
          <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
        )}
        <span className="text-[13px] font-semibold text-foreground flex-1 leading-snug">
          {item.numero}. {item.nome}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Result badge */}
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-extrabold border ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </Badge>

          {/* Show original if adjusted */}
          {isAudit && decision?.editadoManualmente && decision.decisaoFinal !== decision.sugestaoOriginal && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 line-through opacity-50">
                    {sugestaoConfig[decision.sugestaoOriginal].label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Sugestão original da IA</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Confidence badge */}
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-bold ${
            item.confianca === "alta" ? "bg-accent/15 text-accent border-accent/30" :
            item.confianca === "media" ? "bg-warning/15 text-warning border-warning/30" :
            "bg-muted text-muted-foreground border-border"
          }`}>
            {item.confianca === "alta" ? "Alta" : item.confianca === "media" ? "Média" : "Baixa"}
          </Badge>

          {/* Review required (audit only) */}
          {isAudit && decision?.confiancaOriginal === "baixa" && decision?.status === "pending" && (
            <Badge className="text-[9px] px-1.5 py-0 bg-destructive text-destructive-foreground border-0 animate-pulse">
              Revisão obrigatória
            </Badge>
          )}

          {/* Points (readonly) */}
          {!isAudit && item.pontosObtidos != null && item.pesoMaximo != null && (
            <span className="text-[10px] text-muted-foreground font-semibold tabular-nums">
              {item.pontosObtidos}/{item.pesoMaximo} pts
            </span>
          )}

          {/* Alerts */}
          {alerts.map(alert => (
            <TooltipProvider key={alert.key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-semibold bg-warning/10 text-warning border-warning/30 gap-0.5">
                    <TriangleAlert className="h-2.5 w-2.5" /> {alert.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[250px]">{alert.tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}

          {/* Expand toggle */}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(!isExpanded)} disabled={!!confirmed}>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Justification */}
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed" style={{ marginLeft: "26px" }}>
        {item.justificativa}
      </p>

      {/* Audit actions */}
      {isAudit && !confirmed && decision && (
        <div className="flex items-center gap-1.5 mt-2.5" style={{ marginLeft: "26px" }}>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={decision.status === "accepted" ? "default" : "outline"}
                  size="sm"
                  className="text-[10px] h-6 px-2.5 gap-1 font-semibold"
                  onClick={() => onAccept?.(item.numero)}
                >
                  <Check className="h-3 w-3" /> Aceitar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[220px]">
                Confirma o resultado sugerido pela IA.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Select value="" onValueChange={(v) => onAdjust?.(item.numero, v as SugestaoResultado)}>
                    <SelectTrigger className="h-6 w-[90px] text-[10px] font-semibold">
                      <Pencil className="h-3 w-3 mr-1" /> Ajustar
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIM">SIM</SelectItem>
                      <SelectItem value="NÃO">NÃO</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[220px]">
                Substitui o resultado da IA pela sua decisão.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={decision.status === "rejected" ? "destructive" : "ghost"}
                  size="sm"
                  className="text-[10px] h-6 px-2.5 gap-1 font-semibold"
                  onClick={() => onReject?.(item.numero)}
                >
                  <X className="h-3 w-3" /> Fora de escopo
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[280px]">
                Exclui este critério do cálculo.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-[9px] text-muted-foreground ml-auto">Peso: {weight} pts</span>
        </div>
      )}

      {/* Weight info (readonly) */}
      {!isAudit && (
        <div className="flex items-center mt-1" style={{ marginLeft: "26px" }}>
          <span className="text-[9px] text-muted-foreground">Peso: {weight} pts</span>
        </div>
      )}

      {/* Evidence (expanded) */}
      {isExpanded && item.evidencia && (
        <div className="mt-2.5 rounded-lg px-3 py-2 text-[11px] italic border-l-[3px] border-primary/40 bg-primary/5 text-foreground/80" style={{ marginLeft: "26px" }}>
          <MessageSquareQuote className="h-3 w-3 inline mr-1.5 opacity-50" />
          "{item.evidencia}"
        </div>
      )}
      {isExpanded && !item.evidencia && (
        <p className="text-[10px] text-muted-foreground/60 mt-2 italic" style={{ marginLeft: "26px" }}>
          Sem trecho de evidência encontrado.
        </p>
      )}
    </div>
  );
};

export default CriterionCard;
