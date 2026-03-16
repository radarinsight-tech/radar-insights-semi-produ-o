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
