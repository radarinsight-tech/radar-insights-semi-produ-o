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
  if (nota >= 90) return { classificacao: "Excelente", percentual: 100, valor: 1200 };
  if (nota >= 80) return { classificacao: "Ótimo", percentual: 58, valor: 700 };
  if (nota >= 60) return { classificacao: "Bom", percentual: 25, valor: 300 };
  return { classificacao: "Fraco", percentual: 0, valor: 0 };
}

/**
 * Formats a monetary value in BRL.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Normalizes any date string or Date object to DD/MM/AAAA (Brazilian format).
 * Handles ISO strings, "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", Date objects, and timestamps.
 * Returns "—" if the input is invalid or empty.
 */
export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) return "—";

  // If already a Date object
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "—";
    return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const str = String(value).trim();
  if (!str) return "—";

  // Already DD/MM/YYYY — validate and return
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const d = +dd, m = +mm;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return `${dd}/${mm}/${yyyy}`;
  }

  // ISO or "YYYY-MM-DD..." format
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}/${mm}/${yyyy}`;
  }

  // MM/DD/YYYY (American) — detect by checking if month > 12 means it's actually DD/MM
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, a, b, yyyy] = slashMatch;
    const pa = a.padStart(2, "0");
    const pb = b.padStart(2, "0");
    // If first number > 12, it must be a day (DD/MM/YYYY) — already handled above
    // If second number > 12, first is month (MM/DD/YYYY)
    if (+b > 12) return `${pb}/${pa}/${yyyy}`;
    // If first <= 12 and second <= 12, ambiguous — assume MM/DD/YYYY (American) and convert
    if (+a <= 12 && +b <= 12 && +a !== +b) return `${pb}/${pa}/${yyyy}`;
    return `${pa}/${pb}/${yyyy}`;
  }

  // Try parsing as Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return str; // Return as-is if nothing matches
}

/**
 * Formats a date+time string/Date to "DD/MM/AAAA HH:MM" in Brazilian format.
 */
export function formatDateTimeBR(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
