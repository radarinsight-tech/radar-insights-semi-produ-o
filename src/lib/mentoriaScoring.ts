/**
 * Mentoria Scoring Engine
 * Converts 19 criteria responses into weighted scores and classifications.
 */

import type { SugestaoResultado } from "./mentoriaPreAnalysis";

export interface CriterionWeight {
  numero: number;
  nome: string;
  categoria: string;
  peso: number; // max points for this criterion
}

export const CRITERIA_WEIGHTS: CriterionWeight[] = [
  // Postura e Comunicação (total: 25)
  { numero: 1, nome: "Informou o nome e se apresentou?", categoria: "Postura e Comunicação", peso: 5 },
  { numero: 2, nome: "Foi cordial e simpático?", categoria: "Postura e Comunicação", peso: 6 },
  { numero: 3, nome: "Chamou o cliente pelo nome?", categoria: "Postura e Comunicação", peso: 5 },
  { numero: 4, nome: "Respondeu dentro do tempo adequado?", categoria: "Postura e Comunicação", peso: 5 },
  { numero: 5, nome: "Utilizou linguagem profissional?", categoria: "Postura e Comunicação", peso: 4 },
  // Entendimento e Condução (total: 30)
  { numero: 6, nome: "Fez perguntas para entender o problema?", categoria: "Entendimento e Condução", peso: 7 },
  { numero: 7, nome: "Identificou corretamente a solicitação?", categoria: "Entendimento e Condução", peso: 7 },
  { numero: 8, nome: "Demonstrou disposição para ouvir?", categoria: "Entendimento e Condução", peso: 5 },
  { numero: 9, nome: "Agiu com agilidade e proatividade?", categoria: "Entendimento e Condução", peso: 6 },
  { numero: 10, nome: "Buscou retenção em cancelamentos?", categoria: "Entendimento e Condução", peso: 5 },
  // Solução e Confirmação (total: 28)
  { numero: 11, nome: "Informou registro da solução no sistema?", categoria: "Solução e Confirmação", peso: 6 },
  { numero: 12, nome: "Confirmou se o cliente ficou confortável?", categoria: "Solução e Confirmação", peso: 5 },
  { numero: 13, nome: "Buscou alternativa quando necessário?", categoria: "Solução e Confirmação", peso: 6 },
  { numero: 14, nome: "Realizou testes com o cliente?", categoria: "Solução e Confirmação", peso: 5 },
  { numero: 15, nome: "Confirmou se restaram dúvidas?", categoria: "Solução e Confirmação", peso: 6 },
  // Encerramento e Valor (total: 17)
  { numero: 16, nome: "Cliente demonstrou satisfação?", categoria: "Encerramento e Valor", peso: 5 },
  { numero: 17, nome: "Informou serviços ou benefícios?", categoria: "Encerramento e Valor", peso: 4 },
  { numero: 18, nome: "Verificou possibilidade de upgrade?", categoria: "Encerramento e Valor", peso: 4 },
  { numero: 19, nome: "Atualizou dados do cliente?", categoria: "Encerramento e Valor", peso: 4 },
];

export const TOTAL_POSSIBLE = CRITERIA_WEIGHTS.reduce((s, c) => s + c.peso, 0); // 100

export type Classificacao = "Excelente" | "Muito bom" | "Bom atendimento" | "Em desenvolvimento" | "Abaixo do esperado";

export interface ScoringResult {
  pontosObtidos: number;
  pontosPossiveis: number;
  nota100: number; // 0-100
  nota10: number;  // 0-10
  classificacao: Classificacao;
  porCategoria: Record<string, { obtidos: number; possiveis: number; percentual: number }>;
  detalhesPorCriterio: Array<{
    numero: number;
    nome: string;
    categoria: string;
    peso: number;
    resposta: SugestaoResultado;
    pontosObtidos: number;
  }>;
}

function resultToPoints(resposta: SugestaoResultado, peso: number): number {
  switch (resposta) {
    case "SIM": return peso;
    case "NÃO": return 0;
    case "FORA DO ESCOPO": return 0; // excluded from calculation
    default: return 0;
  }
}

function isForaDoEscopo(resposta: SugestaoResultado): boolean {
  return resposta === "FORA DO ESCOPO";
}

export function classify(nota100: number): Classificacao {
  if (nota100 >= 90) return "Excelente";
  if (nota100 >= 80) return "Muito bom";
  if (nota100 >= 65) return "Bom atendimento";
  if (nota100 >= 45) return "Em desenvolvimento";
  return "Abaixo do esperado";
}

export function classificacaoColor(cls: Classificacao): string {
  switch (cls) {
    case "Excelente": return "text-accent";
    case "Muito bom": return "text-primary";
    case "Bom atendimento": return "text-primary";
    case "Em desenvolvimento": return "text-warning";
    case "Abaixo do esperado": return "text-destructive";
  }
}

export function classificacaoBg(cls: Classificacao): string {
  switch (cls) {
    case "Excelente": return "bg-accent/10 border-accent/20";
    case "Muito bom": return "bg-primary/10 border-primary/20";
    case "Bom atendimento": return "bg-primary/10 border-primary/20";
    case "Em desenvolvimento": return "bg-warning/10 border-warning/20";
    case "Abaixo do esperado": return "bg-destructive/10 border-destructive/20";
  }
}

export function calculateScore(
  respostas: Array<{ numero: number; resposta: SugestaoResultado }>
): ScoringResult {
  const detalhesPorCriterio: ScoringResult["detalhesPorCriterio"] = [];
  const catMap: Record<string, { obtidos: number; possiveis: number }> = {};

  for (const cw of CRITERIA_WEIGHTS) {
    const found = respostas.find(r => r.numero === cw.numero);
    const resposta = found?.resposta || "NÃO";
    const fora = isForaDoEscopo(resposta);
    const pts = fora ? 0 : resultToPoints(resposta, cw.peso);

    detalhesPorCriterio.push({
      numero: cw.numero,
      nome: cw.nome,
      categoria: cw.categoria,
      peso: cw.peso,
      resposta,
      pontosObtidos: pts,
    });

    if (!catMap[cw.categoria]) catMap[cw.categoria] = { obtidos: 0, possiveis: 0 };
    if (!fora) {
      catMap[cw.categoria].obtidos += pts;
      catMap[cw.categoria].possiveis += cw.peso;
    }
  }

  const pontosObtidos = detalhesPorCriterio
    .filter(d => !isForaDoEscopo(d.resposta))
    .reduce((s, d) => s + d.pontosObtidos, 0);
  const pontosPossiveis = detalhesPorCriterio
    .filter(d => !isForaDoEscopo(d.resposta))
    .reduce((s, d) => s + d.peso, 0);

  const nota100 = pontosPossiveis > 0
    ? Math.round((pontosObtidos / pontosPossiveis) * 100 * 10) / 10
    : 0;
  const nota10 = Math.round(nota100 / 10 * 10) / 10;

  const porCategoria: ScoringResult["porCategoria"] = {};
  for (const [cat, vals] of Object.entries(catMap)) {
    porCategoria[cat] = {
      ...vals,
      percentual: vals.possiveis > 0 ? Math.round((vals.obtidos / vals.possiveis) * 100) : 0,
    };
  }

  return {
    pontosObtidos,
    pontosPossiveis,
    nota100,
    nota10,
    classificacao: classify(nota100),
    porCategoria,
    detalhesPorCriterio,
  };
}

/**
 * Extract scoring from an evaluation's full_report (AI analysis result).
 * Maps the criterios array to our scoring system.
 */
export function scoreFromFullReport(fullReport: any): ScoringResult | null {
  if (!fullReport || typeof fullReport !== "object") return null;
  const criterios = fullReport.criterios;
  if (!Array.isArray(criterios)) return null;

  const respostas: Array<{ numero: number; resposta: SugestaoResultado }> = criterios.map((c: any) => ({
    numero: c.numero,
    resposta: (c.resultado === "SIM" ? "SIM" : c.resultado === "FORA DO ESCOPO" ? "FORA DO ESCOPO" : "NÃO") as SugestaoResultado,
  }));

  return calculateScore(respostas);
}

/**
 * Identify criteria with highest failure rates across multiple evaluations.
 */
export interface CriterionFailureRate {
  numero: number;
  nome: string;
  categoria: string;
  totalFalhas: number;
  totalAcertos: number;
  totalAvaliacoes: number;
  taxaFalha: number; // 0-100
  taxaAcerto: number;
}

export function analyzeCriteriaFailures(
  evaluations: Array<{ full_report: any }>
): CriterionFailureRate[] {
  const counters = new Map<number, { nao: number; parcial: number; sim: number; total: number }>();

  for (const cw of CRITERIA_WEIGHTS) {
    counters.set(cw.numero, { nao: 0, parcial: 0, sim: 0, total: 0 });
  }

  for (const ev of evaluations) {
    const criterios = ev.full_report?.criterios;
    if (!Array.isArray(criterios)) continue;

    for (const c of criterios) {
      const counter = counters.get(c.numero);
      if (!counter) continue;
      counter.total++;
      if (c.resultado === "SIM") counter.sim++;
      else if (c.resultado === "NÃO") counter.nao++;
      else counter.parcial++;
    }
  }

  return CRITERIA_WEIGHTS.map(cw => {
    const c = counters.get(cw.numero)!;
    return {
      numero: cw.numero,
      nome: cw.nome,
      categoria: cw.categoria,
      totalFalhas: c.nao,
      totalParcial: c.parcial,
      totalAcertos: c.sim,
      totalAvaliacoes: c.total,
      taxaFalha: c.total > 0 ? Math.round((c.nao / c.total) * 100) : 0,
      taxaAcerto: c.total > 0 ? Math.round((c.sim / c.total) * 100) : 0,
    };
  }).sort((a, b) => b.taxaFalha - a.taxaFalha);
}
