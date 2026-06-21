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

/**
 * Persistence seam. The prototype uses localStorage; a real backend later
 * implements the same interface (the screens never call storage directly).
 */
export interface VisitRepository {
  load(): Visit[];
  save(visits: Visit[]): void;
}

const STORAGE_KEY = "record-flow:visits:v1";

class LocalStorageVisitRepository implements VisitRepository {
  load(): Visit[] {
    if (typeof window === "undefined") return seedVisits();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedVisits();
      return JSON.parse(raw) as Visit[];
    } catch {
      return seedVisits();
    }
  }
  save(visits: Visit[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch {
      /* ignore quota / private-mode errors in the prototype */
    }
  }
}

interface VisitStore {
  visits: Visit[];
  getVisit: (id: string) => Visit | undefined;
  updateVisit: (id: string, updater: (v: Visit) => Visit) => void;
  createFreestyle: (siteName?: string) => Visit;
  resetSeed: () => void;
}

const Ctx = createContext<VisitStore | null>(null);

export function VisitStoreProvider({ children }: { children: ReactNode }) {
  const repo = useRef<VisitRepository>(new LocalStorageVisitRepository());
  // Start from seed for a stable server/first paint; hydrate from storage after mount.
  const [visits, setVisits] = useState<Visit[]>(() => seedVisits());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
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

  const createFreestyle = useCallback((siteName?: string) => {
    const v = buildFreestyle(siteName);
    setVisits((prev) => [v, ...prev]);
    return v;
  }, []);

  const resetSeed = useCallback(() => setVisits(seedVisits()), []);

  return (
    <Ctx.Provider value={{ visits, getVisit, updateVisit, createFreestyle, resetSeed }}>
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
