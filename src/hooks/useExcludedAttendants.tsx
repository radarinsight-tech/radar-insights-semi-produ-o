import { useState, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "radar_excluded_attendants";

export interface ExcludedEntry {
  nome: string;
  excludedAt: string;
  excludedBy: string;
}

// ── Singleton store so every hook instance shares the same state ──

let _cache: Map<string, ExcludedEntry> | null = null;
const _listeners = new Set<() => void>();

function readStorage(): Map<string, ExcludedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr: ExcludedEntry[] = JSON.parse(raw);
    return new Map(arr.map((e) => [e.nome, e]));
  } catch {
    return new Map();
  }
}

function getSnapshot(): Map<string, ExcludedEntry> {
  if (!_cache) _cache = readStorage();
  return _cache;
}

function writeAndNotify(next: Map<string, ExcludedEntry>) {
  _cache = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next.values()]));
  _listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  _listeners.add(listener);

  // Also react to changes from other tabs / HMR reloads
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      _cache = readStorage();
      _listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    _listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useExcludedAttendants() {
  const excludedNames = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const excludeAttendants = useCallback((names: string[], excludedBy = "admin") => {
    const now = new Date().toISOString();
    const prev = getSnapshot();
    const next = new Map(prev);
    for (const nome of names) {
      if (!next.has(nome)) {
        next.set(nome, { nome, excludedAt: now, excludedBy });
      }
    }
    writeAndNotify(next);
  }, []);

  const restoreAttendants = useCallback((names: string[]) => {
    const prev = getSnapshot();
    const next = new Map(prev);
    for (const nome of names) {
      next.delete(nome);
    }
    writeAndNotify(next);
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
