import { useState, useCallback, useEffect, useMemo } from "react";

const STORAGE_KEY = "radar_excluded_attendants";

export interface ExcludedEntry {
  nome: string;
  excludedAt: string;
  excludedBy: string;
}

function loadFromStorage(): Map<string, ExcludedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr: ExcludedEntry[] = JSON.parse(raw);
    return new Map(arr.map((e) => [e.nome, e]));
  } catch {
    return new Map();
  }
}

function saveToStorage(map: Map<string, ExcludedEntry>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...map.values()]));
}

export function useExcludedAttendants() {
  const [excludedNames, setExcludedNames] = useState<Map<string, ExcludedEntry>>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(excludedNames);
  }, [excludedNames]);

  const excludeAttendants = useCallback((names: string[], excludedBy = "admin") => {
    const now = new Date().toISOString();
    setExcludedNames((prev) => {
      const next = new Map(prev);
      for (const nome of names) {
        if (!next.has(nome)) {
          next.set(nome, { nome, excludedAt: now, excludedBy });
        }
      }
      return next;
    });
  }, []);

  const restoreAttendants = useCallback((names: string[]) => {
    setExcludedNames((prev) => {
      const next = new Map(prev);
      for (const nome of names) {
        next.delete(nome);
      }
      return next;
    });
  }, []);

  const isExcluded = useCallback((name: string) => excludedNames.has(name), [excludedNames]);

  const excludedSet = useMemo(() => new Set(excludedNames.keys()), [excludedNames]);

  return {
    excludedNames,
    excludedSet,
    excludeAttendants,
    restoreAttendants,
    isExcluded,
  };
}
