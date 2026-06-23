import type { Condition, Field } from "./types";
import type { TriageStatus } from "@/lib/design/tokens";

export function fieldFromSpeech<T>(
  value: T | null,
  text: string,
  status?: TriageStatus,
): Field<T> {
  return {
    value,
    evidence: text,
    status: status ?? (value == null ? "amber" : "green"),
  };
}

export function parseAreaFromSpeech(text: string): number | null {
  const m = text.replace(/,/g, "").match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseConditionFromSpeech(text: string): Condition | null {
  const t = text.toLowerCase();
  if (/\bgood\b/.test(t)) return "Good";
  if (/\bmoderate\b/.test(t)) return "Moderate";
  if (/\bpoor\b/.test(t)) return "Poor";
  return null;
}
