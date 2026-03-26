import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAttendantName } from "@/lib/officialEvaluations";

const STORAGE_KEY = "radar_excluded_attendants";
const LEGACY_MIGRATION_KEY_PREFIX = "radar_excluded_attendants_backend_migrated";
const EXCLUSIONS_TABLE = "attendant_exclusions";

export interface ExcludedEntry {
  nome: string;
  excludedAt: string;
  excludedBy: string;
  origin?: string;
}

interface ExcludedStoreSnapshot {
  byName: Map<string, ExcludedEntry>;
  byNormalizedName: Map<string, ExcludedEntry>;
}

type ExclusionRow = {
  attendant_name: string;
  normalized_name: string;
  excluded_at: string | null;
  excluded_by: string | null;
  origin: string | null;
};

let _cache: ExcludedStoreSnapshot | null = null;
let _refreshPromise: Promise<ExcludedStoreSnapshot> | null = null;
const _listeners = new Set<() => void>();

function buildSnapshot(entries: ExcludedEntry[]): ExcludedStoreSnapshot {
  const byNormalizedName = new Map<string, ExcludedEntry>();

  for (const entry of entries) {
    const normalizedName = normalizeAttendantName(entry.nome);
    if (!normalizedName) continue;

    const currentEntry = byNormalizedName.get(normalizedName);
    const currentTime = currentEntry ? new Date(currentEntry.excludedAt).getTime() : 0;
    const nextTime = entry.excludedAt ? new Date(entry.excludedAt).getTime() : 0;

    if (!currentEntry || nextTime >= currentTime) {
      byNormalizedName.set(normalizedName, entry);
    }
  }

  return {
    byName: new Map(Array.from(byNormalizedName.values(), (entry) => [entry.nome, entry])),
    byNormalizedName,
  };
}

function serializeSnapshot(snapshot: ExcludedStoreSnapshot) {
  return JSON.stringify(Array.from(snapshot.byNormalizedName.values()));
}

function readStorage(): ExcludedStoreSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSnapshot([]);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return buildSnapshot([]);
    return buildSnapshot(parsed as ExcludedEntry[]);
  } catch {
    return buildSnapshot([]);
  }
}

function getSnapshot(): ExcludedStoreSnapshot {
  if (!_cache) _cache = readStorage();
  return _cache;
}

function writeAndNotify(next: ExcludedStoreSnapshot) {
  _cache = next;
  localStorage.setItem(STORAGE_KEY, serializeSnapshot(next));
  _listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  _listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      _cache = readStorage();
      _listeners.forEach((registeredListener) => registeredListener());
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    _listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

async function getMyCompanyId() {
  const { data, error } = await supabase.rpc("get_my_company_id");
  if (error) throw error;
  return data;
}

async function migrateLegacyLocalEntries(companyId: string) {
  const migrationKey = `${LEGACY_MIGRATION_KEY_PREFIX}:${companyId}`;
  if (localStorage.getItem(migrationKey) === "1") return;

  const legacyEntries = Array.from(readStorage().byNormalizedName.values());
  if (legacyEntries.length === 0) {
    localStorage.setItem(migrationKey, "1");
    return;
  }

  const rows = legacyEntries.map((entry) => ({
    company_id: companyId,
    attendant_name: entry.nome,
    normalized_name: normalizeAttendantName(entry.nome),
    excluded: true,
    excluded_at: entry.excludedAt || new Date().toISOString(),
    excluded_by: entry.excludedBy || "admin",
    origin: entry.origin || "painel_bonus",
  }));

  const { error } = await (supabase as any)
    .from(EXCLUSIONS_TABLE)
    .upsert(rows, { onConflict: "company_id,normalized_name" });

  if (error) throw error;

  localStorage.setItem(migrationKey, "1");
}

async function fetchRemoteSnapshot(companyId: string): Promise<ExcludedStoreSnapshot> {
  const { data, error } = await (supabase as any)
    .from(EXCLUSIONS_TABLE)
    .select("attendant_name, normalized_name, excluded_at, excluded_by, origin")
    .eq("company_id", companyId)
    .eq("excluded", true)
    .order("excluded_at", { ascending: false });

  if (error) throw error;

  const entries = ((data || []) as ExclusionRow[]).map((row) => ({
    nome: row.attendant_name,
    excludedAt: row.excluded_at || new Date().toISOString(),
    excludedBy: row.excluded_by || "sistema",
    origin: row.origin || "painel_bonus",
  }));

  return buildSnapshot(entries);
}

async function refreshPersistedSnapshot(): Promise<ExcludedStoreSnapshot> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    if (!authData.user) {
      const emptySnapshot = buildSnapshot([]);
      writeAndNotify(emptySnapshot);
      return emptySnapshot;
    }

    const companyId = await getMyCompanyId();
    if (!companyId) {
      const emptySnapshot = buildSnapshot([]);
      writeAndNotify(emptySnapshot);
      return emptySnapshot;
    }

    await migrateLegacyLocalEntries(companyId);
    const snapshot = await fetchRemoteSnapshot(companyId);
    writeAndNotify(snapshot);
    return snapshot;
  })().finally(() => {
    _refreshPromise = null;
  });

  return _refreshPromise;
}

export function useExcludedAttendants() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [loading, setLoading] = useState(false);

  const refreshExcludedAttendants = useCallback(async () => {
    setLoading(true);
    try {
      const nextSnapshot = await refreshPersistedSnapshot();
      return new Map(nextSnapshot.byName);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshExcludedAttendants();
  }, [refreshExcludedAttendants]);

  const excludeAttendants = useCallback(async (names: string[], excludedBy = "admin") => {
    const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
    if (uniqueNames.length === 0) return new Map(snapshot.byName);

    const companyId = await getMyCompanyId();
    if (!companyId) return new Map(snapshot.byName);

    const excludedAt = new Date().toISOString();
    const rows = uniqueNames.map((nome) => ({
      company_id: companyId,
      attendant_name: nome,
      normalized_name: normalizeAttendantName(nome),
      excluded: true,
      excluded_at: excludedAt,
      excluded_by: excludedBy,
      origin: "painel_bonus",
    }));

    const { error } = await (supabase as any)
      .from(EXCLUSIONS_TABLE)
      .upsert(rows, { onConflict: "company_id,normalized_name" });

    if (error) throw error;

    return refreshExcludedAttendants();
  }, [refreshExcludedAttendants, snapshot.byName]);

  const restoreAttendants = useCallback(async (names: string[]) => {
    const normalizedNames = Array.from(
      new Set(names.map((name) => normalizeAttendantName(name)).filter(Boolean))
    );
    if (normalizedNames.length === 0) return new Map(snapshot.byName);

    const companyId = await getMyCompanyId();
    if (!companyId) return new Map(snapshot.byName);

    const { error } = await (supabase as any)
      .from(EXCLUSIONS_TABLE)
      .update({
        excluded: false,
        excluded_at: null,
        excluded_by: null,
      })
      .eq("company_id", companyId)
      .in("normalized_name", normalizedNames);

    if (error) throw error;

    return refreshExcludedAttendants();
  }, [refreshExcludedAttendants, snapshot.byName]);

  const isExcluded = useCallback((name: string) => {
    return snapshot.byNormalizedName.has(normalizeAttendantName(name));
  }, [snapshot.byNormalizedName]);

  const excludedNames = snapshot.byName;
  const excludedSet = useMemo(() => new Set(Array.from(excludedNames.values(), (entry) => entry.nome)), [excludedNames]);
  const excludedNormalizedSet = useMemo(() => new Set(snapshot.byNormalizedName.keys()), [snapshot.byNormalizedName]);

  return {
    excludedNames,
    excludedSet,
    excludedNormalizedSet,
    excludeAttendants,
    restoreAttendants,
    refreshExcludedAttendants,
    isExcluded,
    loading,
  };
}
