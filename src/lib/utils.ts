import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a score from 0-100 scale to 0-10 scale.
 * If the value is already ≤ 10, it's returned as-is.
 */
export function notaToScale10(value: number): number {
  const scaled = value > 10 ? value / 10 : value;
  return Math.round(scaled * 10) / 10;
}

/**
 * Formats a score for display: 0-10 scale, 1 decimal place, Brazilian comma.
 * Accepts values in either 0-100 or 0-10 scale.
 */
export function formatNota(value: number): string {
  return notaToScale10(value).toFixed(1).replace(".", ",");
}

/**
 * Returns the official classification for a given score (0-10 scale).
 * Accepts values in either 0-100 or 0-10 scale (auto-converts).
 */
export function classificarNota(value: number): string {
  const nota = notaToScale10(value);
  if (nota >= 9.0) return "Excelente";
  if (nota >= 7.0) return "Bom";
  if (nota >= 5.0) return "Regular";
  if (nota >= 3.0) return "Ruim";
  return "Crítico";
}

/**
 * Returns semantic CSS classes for a classification badge.
 */
export function classColorFromClassificacao(classificacao: string): string {
  switch (classificacao) {
    case "Excelente":
      return "bg-accent text-accent-foreground";
    case "Bom":
      return "bg-primary text-primary-foreground";
    case "Regular":
      return "bg-warning text-warning-foreground";
    case "Ruim":
      return "bg-orange-500 text-white";
    case "Crítico":
      return "bg-destructive text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Calculates bonus tier based on nota (0-100 scale).
 */
export interface BonusTier {
  classificacao: string;
  percentual: number;
  valor: number;
}

export function calcularBonus(nota: number): BonusTier {
  if (nota >= 95) return { classificacao: "Excelente", percentual: 100, valor: 1200 };
  if (nota >= 85) return { classificacao: "Muito bom", percentual: 90, valor: 1080 };
  if (nota >= 70) return { classificacao: "Bom atendimento", percentual: 70, valor: 840 };
  if (nota >= 50) return { classificacao: "Em desenvolvimento", percentual: 30, valor: 360 };
  return { classificacao: "Abaixo do esperado", percentual: 0, valor: 0 };
}

/**
 * Formats a monetary value in BRL.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
