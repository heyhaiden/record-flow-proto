import type { Visit } from "@/lib/model/types";

export const FIRST_PROJECT_KEY = "record-flow:first-project-id";
export const SWIPE_TUG_KEY = "record-flow:swipe-tug-played";

/** Newest-first ids; the last entry is the oldest (tutorial) project. */
export function resolveFirstProjectId(
  storedId: string | null,
  freestyleIdsNewestFirst: string[],
): string | null {
  if (storedId) return storedId;
  return freestyleIdsNewestFirst[freestyleIdsNewestFirst.length - 1] ?? null;
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private-mode */
  }
}

export function rememberFirstProject(visitId: string) {
  if (!read(FIRST_PROJECT_KEY)) write(FIRST_PROJECT_KEY, visitId);
}

export function firstProjectId(visits: Visit[]): string | null {
  const stored = read(FIRST_PROJECT_KEY);
  const ids = visits.filter((v) => v.source === "freestyle").map((v) => v.id);
  return resolveFirstProjectId(stored, ids);
}

export function adoptFirstProject(visits: Visit[]) {
  const stored = read(FIRST_PROJECT_KEY);
  const first = firstProjectId(visits);
  if (first && !stored) write(FIRST_PROJECT_KEY, first);
  return first;
}

export function isTutorialVisit(visitId: string, visits: Visit[]): boolean {
  return firstProjectId(visits) === visitId;
}

export function hasPlayedSwipeTug(visitId: string): boolean {
  return read(`${SWIPE_TUG_KEY}:${visitId}`) === "1";
}

export function markSwipeTugPlayed(visitId: string) {
  write(`${SWIPE_TUG_KEY}:${visitId}`, "1");
}
