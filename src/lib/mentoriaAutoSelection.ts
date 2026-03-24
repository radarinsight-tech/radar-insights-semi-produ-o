/**
 * Mentoria Auto-Selection Engine
 * Selects the 6 most representative evaluable attendances per attendant
 * for monthly bonus calculation.
 */

import {
  resolvePersistedMentoriaEvaluability,
  resolvePersistedMentoriaIneligibility,
} from "./mentoriaEvaluability";

// ─── Types ──────────────────────────────────────────────────────────

export interface AutoSelectionFile {
  id: string;
  atendente?: string;
  status: string;
  result?: any;
  text?: string;
  data?: string;
  hasAudio?: boolean;
  nonEvaluable?: boolean;
  nonEvaluableReason?: string;
  structuredConversation?: {
    messages?: Array<{
      role: string;
      text: string;
      isoTimestamp?: string;
    }>;
  };
}

export type AmostraStatus = "sem_base" | "insuficiente" | "base_minima" | "amostra_fechada";
export type VolumetriaStatus = "baixa_volumetria" | "volumetria_normal";

export interface AttendantAutoSelection {
  nome: string;
  totalBruto: number;
  volumetria: VolumetriaStatus;
  totalElegiveis: number;
  totalSelecionados: number;
  amostraStatus: AmostraStatus;
  selecionados: AutoSelectionFile[];
  naoSelecionados: AutoSelectionFile[];
  media100: number | null;
  media10: number | null;
  faixa: string | null;
  percentual: number | null;
  valor: number | null;
  faixaColor: string;
  faixaBg: string;
  notas: number[];
}

// ─── Constants ──────────────────────────────────────────────────────

const TARGET_SAMPLE = 6;
const LOW_VOLUME_THRESHOLD = 50;

// ─── Priority Score ─────────────────────────────────────────────────

function computePriorityScore(file: AutoSelectionFile): number {
  let score = 0;
  const msgs = file.structuredConversation?.messages ?? [];
  const attendantMsgs = msgs.filter(m => m.role === "atendente");
  const clientMsgs = msgs.filter(m => m.role === "cliente");
  const botMsgs = msgs.filter(m => m.role === "bot" || m.role === "sistema");
  const humanMsgs = [...attendantMsgs, ...clientMsgs];

  // 1. Presença de atendente humano identificado (+30)
  if (file.atendente && file.atendente.trim().length > 0) score += 30;

  // 2. Atendimento encerrado (has result = analyzed) (+20)
  if (file.status === "analisado" && file.result) score += 20;

  // 3. Troca cliente x atendente (+15)
  let exchanges = 0;
  let lastRole: string | null = null;
  for (const msg of msgs) {
    if (msg.role === "bot" || msg.role === "sistema") continue;
    if (lastRole && lastRole !== msg.role) exchanges++;
    lastRole = msg.role;
  }
  if (exchanges >= 3) score += 15;
  else if (exchanges >= 1) score += 8;

  // 4. Densidade de interação humana (+15)
  const totalMsgs = msgs.length || 1;
  const humanDensity = humanMsgs.length / totalMsgs;
  score += Math.round(humanDensity * 15);

  // 5. Presença de condução real (+10)
  const attText = attendantMsgs.map(m => m.text).join(" ");
  const conductionPatterns = /(?:vou\s+(?:verificar|resolver|analisar)|(?:estou|vamos)\s+(?:verificar|resolver)|(?:orientação|explicação|solução|tratativa)|(?:recomendo|sugiro|aconselho)|(?:procedimento|encaminh))/gi;
  const conductionMatches = attText.match(conductionPatterns);
  if (conductionMatches && conductionMatches.length >= 2) score += 10;
  else if (conductionMatches && conductionMatches.length >= 1) score += 5;

  // 6. Menor dependência de automáticas (+5)
  const autoRatio = botMsgs.length / totalMsgs;
  score += Math.round((1 - autoRatio) * 5);

  // 7. Recência (+5) — more recent = higher
  if (file.data) {
    try {
      const d = new Date(file.data.split("/").reverse().join("-"));
      const now = new Date();
      const daysDiff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 7) score += 5;
      else if (daysDiff <= 15) score += 3;
      else if (daysDiff <= 30) score += 1;
    } catch {
      // ignore
    }
  }

  return score;
}

// ─── Bonus Tier ─────────────────────────────────────────────────────

function calcularFaixa(media100: number): {
  faixa: string;
  percentual: number;
  valor: number;
  color: string;
  bg: string;
} {
  if (media100 >= 95)
    return { faixa: "Excelente", percentual: 100, valor: 1200, color: "text-accent", bg: "bg-accent/10 border-accent/20" };
  if (media100 >= 85)
    return { faixa: "Muito bom", percentual: 90, valor: 1080, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" };
  if (media100 >= 70)
    return { faixa: "Bom atendimento", percentual: 70, valor: 840, color: "text-primary", bg: "bg-primary/10 border-primary/20" };
  if (media100 >= 50)
    return { faixa: "Em desenvolvimento", percentual: 30, valor: 360, color: "text-warning", bg: "bg-warning/10 border-warning/20" };
  return { faixa: "Abaixo do esperado", percentual: 0, valor: 0, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" };
}

// ─── Sample Status ──────────────────────────────────────────────────

function resolveAmostraStatus(elegiveisCount: number): AmostraStatus {
  if (elegiveisCount === 0) return "sem_base";
  if (elegiveisCount <= 3) return "insuficiente";
  if (elegiveisCount <= 5) return "base_minima";
  return "amostra_fechada";
}

export const AMOSTRA_STATUS_CONFIG: Record<AmostraStatus, { label: string; color: string; bg: string }> = {
  sem_base: { label: "Sem base", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  insuficiente: { label: "Insuficiente", color: "text-warning", bg: "bg-warning/10 border-warning/20" },
  base_minima: { label: "Base mínima", color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  amostra_fechada: { label: "Amostra fechada", color: "text-accent", bg: "bg-accent/10 border-accent/20" },
};

// ─── Main Engine ────────────────────────────────────────────────────

function isFileEvaluable(f: AutoSelectionFile): boolean {
  if (f.nonEvaluable) return false;
  if (!f.result) return false;
  const ev = resolvePersistedMentoriaEvaluability(f.result);
  if (ev?.nonEvaluable) return false;
  const inel = resolvePersistedMentoriaIneligibility(f.result);
  if (inel?.ineligible) return false;
  return true;
}

function isFileAnalyzed(f: AutoSelectionFile): boolean {
  return f.status === "analisado" && f.result?.notaFinal != null;
}

export function runAutoSelection(files: AutoSelectionFile[]): AttendantAutoSelection[] {
  // Group ALL files by attendant (including non-analyzed for brute count)
  const byAttendant = new Map<string, AutoSelectionFile[]>();
  for (const f of files) {
    const nome = (f.result?.atendente || f.atendente || "").trim();
    const key = nome || "Não identificado";
    if (!byAttendant.has(key)) byAttendant.set(key, []);
    byAttendant.get(key)!.push(f);
  }

  const results: AttendantAutoSelection[] = [];

  for (const [nome, attendantFiles] of byAttendant) {
    const totalBruto = attendantFiles.length;
    const volumetria: VolumetriaStatus = totalBruto <= LOW_VOLUME_THRESHOLD ? "baixa_volumetria" : "volumetria_normal";

    // Filter to analyzed + evaluable files
    const elegiveis = attendantFiles.filter(f => isFileAnalyzed(f) && isFileEvaluable(f));

    // Score and rank
    const scored = elegiveis
      .map(f => ({ file: f, score: computePriorityScore(f) }))
      .sort((a, b) => b.score - a.score);

    const selecionados = scored.slice(0, TARGET_SAMPLE).map(s => s.file);
    const naoSelecionados = scored.slice(TARGET_SAMPLE).map(s => s.file);

    const amostraStatus = resolveAmostraStatus(elegiveis.length);
    const notas = selecionados.map(f => f.result.notaFinal as number);

    let media100: number | null = null;
    let media10: number | null = null;
    let faixa: string | null = null;
    let percentual: number | null = null;
    let valor: number | null = null;
    let faixaColor = "text-muted-foreground";
    let faixaBg = "bg-muted/50 border-border";

    if (notas.length > 0) {
      media100 = Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10;
      media10 = Math.round((media100 / 10) * 10) / 10;
    }

    // Bonus only for "amostra_fechada"
    if (amostraStatus === "amostra_fechada" && media100 != null) {
      const tier = calcularFaixa(media100);
      faixa = tier.faixa;
      percentual = tier.percentual;
      valor = tier.valor;
      faixaColor = tier.color;
      faixaBg = tier.bg;
    }

    results.push({
      nome,
      totalBruto,
      volumetria,
      totalElegiveis: elegiveis.length,
      totalSelecionados: selecionados.length,
      amostraStatus,
      selecionados,
      naoSelecionados,
      media100,
      media10,
      faixa,
      percentual,
      valor,
      faixaColor,
      faixaBg,
      notas,
    });
  }

  // Sort by performance (highest average first, then by name)
  results.sort((a, b) => {
    if (a.media100 != null && b.media100 != null) return b.media100 - a.media100;
    if (a.media100 != null) return -1;
    if (b.media100 != null) return 1;
    return a.nome.localeCompare(b.nome);
  });

  return results;
}
