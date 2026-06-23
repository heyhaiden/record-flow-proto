"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Visit } from "@/lib/model/types";
import { buildFreestyle, seedVisits } from "@/lib/model/seed";
import { newId } from "@/lib/id";

/**
 * Persistence seam. The prototype uses localStorage; a real backend later
 * implements the same interface (the screens never call storage directly).
 */
export interface VisitRepository {
  load(): Visit[];
  save(visits: Visit[]): void;
  clear(): void;
}

const STORAGE_KEY = "record-flow:visits:v2";
const LEGACY_STORAGE_KEY = "record-flow:visits:v1";

function withUniqueVisitIds(visits: Visit[]): Visit[] {
  const seen = new Set<string>();
  return visits.map((visit) => {
    if (!seen.has(visit.id)) {
      seen.add(visit.id);
      return visit;
    }
    const id = newId("visit");
    seen.add(id);
    return { ...visit, id };
  });
}

class LocalStorageVisitRepository implements VisitRepository {
  load(): Visit[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return withUniqueVisitIds(JSON.parse(raw) as Visit[]);
    } catch {
      return [];
    }
  }
  save(visits: Visit[]): void {
    if (typeof window === "undefined") return;
    try {
      if (visits.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
      }
    } catch {
      /* ignore quota / private-mode errors in the prototype */
    }
  }
  clear(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

interface VisitStore {
  visits: Visit[];
  /** False until localStorage has been read on the client. */
  hydrated: boolean;
  getVisit: (id: string) => Visit | undefined;
  updateVisit: (id: string, updater: (v: Visit) => Visit) => void;
  deleteVisit: (id: string) => void;
  createFreestyle: (siteName?: string, surveyor?: string) => Visit;
  resetSeed: () => void;
  clearAll: () => void;
}

const Ctx = createContext<VisitStore | null>(null);

export function VisitStoreProvider({ children }: { children: ReactNode }) {
  const repo = useRef<VisitRepository>(new LocalStorageVisitRepository());
  // Start from seed for a stable server/first paint; hydrate from storage after mount.
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setVisits(repo.current.load());
    setHydrated(true);
  }, []);

  // Persist on every change once hydrated.
  useEffect(() => {
    if (hydrated) repo.current.save(visits);
  }, [visits, hydrated]);

  const getVisit = useCallback((id: string) => visits.find((v) => v.id === id), [visits]);

  const updateVisit = useCallback((id: string, updater: (v: Visit) => Visit) => {
    setVisits((prev) => prev.map((v) => (v.id === id ? updater(v) : v)));
  }, []);

  const deleteVisit = useCallback((id: string) => {
    setVisits((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const createFreestyle = useCallback((siteName?: string, surveyor?: string) => {
    const v = buildFreestyle(siteName, surveyor);
    setVisits((prev) => [v, ...prev]);
    return v;
  }, []);

  const resetSeed = useCallback(() => setVisits(seedVisits()), []);

  const clearAll = useCallback(() => {
    repo.current.clear();
    setVisits([]);
  }, []);

  return (
    <Ctx.Provider value={{ visits, hydrated, getVisit, updateVisit, deleteVisit, createFreestyle, resetSeed, clearAll }}>
      {children}
    </Ctx.Provider>
  );
}

export function useVisitStore(): VisitStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVisitStore must be used within VisitStoreProvider");
  return ctx;
}

export function useVisit(id: string): Visit | undefined {
  return useVisitStore().getVisit(id);
}
