/**
 * Attendant matching utilities.
 * Matches extracted attendant names against the registered attendants database.
 */

import { supabase } from "@/integrations/supabase/client";

export interface RegisteredAttendant {
  id: string;
  name: string;
  nickname: string | null;
  sector: string | null;
  active: boolean;
  role_type: string;
}

let cachedAttendants: RegisteredAttendant[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

/** Fetch registered attendants (with short cache) */
export async function getRegisteredAttendants(): Promise<RegisteredAttendant[]> {
  if (cachedAttendants && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedAttendants;
  }

  const { data, error } = await supabase
    .from("attendants")
    .select("id, name, nickname, sector, active, role_type")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Failed to fetch attendants:", error);
    return cachedAttendants || [];
  }

  cachedAttendants = (data as RegisteredAttendant[]) || [];
  cacheTimestamp = Date.now();
  return cachedAttendants;
}

/** Invalidate the attendant cache (call after CRUD operations) */
export function invalidateAttendantCache() {
  cachedAttendants = null;
  cacheTimestamp = 0;
}

/** Normalize a name for comparison */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type EvaluationStatus = "evaluable" | "outside_main_ruler" | "not_identified";

export interface MatchResult {
  matched: boolean;
  attendantId?: string;
  matchedName?: string;
  sector?: string | null;
  roleType?: string;
  /** Evaluation status based on role_type */
  evaluationStatus: EvaluationStatus;
  /** True if multiple attendants were found (transfer scenario) */
  transferred: boolean;
  allMatches: RegisteredAttendant[];
}

/**
 * Match an extracted attendant name against the registered list.
 * Supports partial matching (first+last name vs full name).
 */
export function matchAttendant(
  extractedName: string | undefined,
  registeredList: RegisteredAttendant[]
): MatchResult {
  const empty: MatchResult = { matched: false, transferred: false, allMatches: [], evaluationStatus: "not_identified" };
  if (!extractedName || !extractedName.trim()) return empty;

  const normalizedExtracted = normalize(extractedName);

  // Exact match (name or nickname)
  const exact = registeredList.find(
    (a) => normalize(a.name) === normalizedExtracted || (a.nickname && normalize(a.nickname) === normalizedExtracted)
  );
  if (exact) {
    return buildResult(exact, false, [exact]);
  }

  // Partial match: extracted name contains or is contained in registered name or nickname
  const partials = registeredList.filter((a) => {
    const nReg = normalize(a.name);
    const nNick = a.nickname ? normalize(a.nickname) : "";
    return nReg.includes(normalizedExtracted) || normalizedExtracted.includes(nReg) ||
      (nNick && (nNick.includes(normalizedExtracted) || normalizedExtracted.includes(nNick)));
  });

  if (partials.length === 1) {
    return buildResult(partials[0], false, partials);
  }

  if (partials.length > 1) {
    return buildResult(partials[0], true, partials);
  }

  // Fuzzy: try matching just the first name
  const extractedFirst = normalizedExtracted.split(" ")[0];
  if (extractedFirst.length >= 3) {
    const firstNameMatches = registeredList.filter((a) => {
      const regFirst = normalize(a.name).split(" ")[0];
      return regFirst === extractedFirst;
    });

    if (firstNameMatches.length === 1) {
      return buildResult(firstNameMatches[0], false, firstNameMatches);
    }
  }

  return empty;
}

function buildResult(primary: RegisteredAttendant, transferred: boolean, allMatches: RegisteredAttendant[]): MatchResult {
  return {
    matched: true,
    attendantId: primary.id,
    matchedName: primary.name,
    sector: primary.sector,
    roleType: primary.role_type,
    evaluationStatus: primary.role_type === "sucesso_cliente" ? "evaluable" : "outside_main_ruler",
    transferred,
    allMatches,
  };
}

/**
 * Match multiple attendant names from a single conversation (transfer detection).
 */
export function matchMultipleAttendants(
  names: string[],
  registeredList: RegisteredAttendant[]
): MatchResult {
  const allMatches: RegisteredAttendant[] = [];
  const seen = new Set<string>();

  for (const name of names) {
    const result = matchAttendant(name, registeredList);
    for (const m of result.allMatches) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        allMatches.push(m);
      }
    }
  }

  if (allMatches.length === 0) {
    return { matched: false, transferred: false, allMatches: [], evaluationStatus: "not_identified" };
  }

  const primary = allMatches[allMatches.length - 1]; // Last attendant = who handled the case
  return buildResult(primary, allMatches.length > 1, allMatches);
}
