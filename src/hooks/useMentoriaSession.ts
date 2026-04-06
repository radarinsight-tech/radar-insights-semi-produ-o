/**
 * Persists Mentoria Lab state to sessionStorage so navigating away and back
 * restores the active tab, Opa Suite filters, and loaded data.
 */

const KEY = "mentoria-lab-session";

export interface MentoriaSessionState {
  activeTab: string;
  filterMonth: string;
  // Opa hook filters
  opaDateFrom?: string; // ISO
  opaDateTo?: string;
  opaFilterAtendente: string;
  opaSearchTerm: string;
  // Opa loaded attendances (raw JSON from proxy)
  opaAttendances: any[];
  opaTotal: number;
  opaHasMore: boolean;
  opaCurrentOffset: number;
  // Opa files (serializable subset of LabFile[])
  opaFiles: any[];
  // Opa local filters
  opaLocalSearchTerm: string;
  opaHumanSelected: string[];
  opaFilterAuditoriaFrom?: string;
  opaFilterAuditoriaTo?: string;
}

export function saveMentoriaSession(state: MentoriaSessionState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[MentoriaSession] Failed to save:", e);
  }
}

export function loadMentoriaSession(): MentoriaSessionState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MentoriaSessionState;
  } catch {
    return null;
  }
}

export function clearMentoriaSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
