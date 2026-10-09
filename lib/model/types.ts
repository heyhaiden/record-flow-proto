/**
 * The parcel-first capture model (Visit → Parcels + Features), per the MVP
 * design doc §5. Every captured field carries a value, the verbatim evidence
 * span it was derived from, and a triage status — this is what drives the
 * green/amber/red review and the completeness banner.
 */

import type { TriageStatus } from "@/lib/design/tokens";
import type { ProjectFormId } from "./forms";

export type { TriageStatus };

/** A single extracted field: what we think it is, why, and how sure we are. */
export interface Field<T> {
  value: T | null;
  /** Verbatim transcript span supporting the value (null = nothing captured). */
  evidence: string | null;
  status: TriageStatus; // green = confident · amber = inferred · red = missing
}

export function field<T>(
  value: T | null = null,
  evidence: string | null = null,
  status: TriageStatus = value == null ? "red" : "green",
): Field<T> {
  return { value, evidence, status };
}

export type CriterionState = "pass" | "fail" | "not-assessed";

export interface Criterion {
  id: string; // matches config/habitat-conditions.json (e.g. "A", "B1")
  label: string;
  group?: string; // functional group for hedgerows
  essential?: boolean;
  state: CriterionState;
  evidence?: string | null;
}

export type Condition = "Good" | "Moderate" | "Poor";

export interface DeskStudyOrigin {
  ukhabType: string; // provisional type from the desk study (a hypothesis)
  source: string; // e.g. "Desk study (satellite/GIS)"
}

export type ParcelStatus = "to-assess" | "confirmed" | "overridden";

export interface Parcel {
  id: string;
  name: string; // "Parcel 1" / short label
  /** Links to a habitat in config/habitat-conditions.json for criteria + scoring. */
  habitatId?: string;
  ukhabType: Field<string>;
  area: Field<number>; // hectares (or km for linear — kept simple for POC)
  areaUnit: "ha" | "km";
  condition: Field<Condition>;
  criteria: Criterion[];
  deskStudyOrigin?: DeskStudyOrigin;
  status: ParcelStatus;
  /** Reason captured when a desk-study type is overridden (defensibility). */
  overrideReason?: string;
}

// ---------------------------------------------------------------------------
// Transcript — captured walk-through notes, persisted on the visit so the M2
// extractor can turn them into Fields. Each note carries a structured target
// (which parcel / site / feature it was about), not just a display label.
// ---------------------------------------------------------------------------

export type NoteTarget =
  | { kind: "parcel"; parcelId: string }
  | { kind: "site" }
  | { kind: "feature" };

export interface TranscriptNote {
  id: string;
  text: string;
  target: NoteTarget;
  capturedAt: string; // human time label, e.g. "14:30"
}

export function transcriptText(notes: TranscriptNote[]): string {
  return notes.map((n) => n.text).join("\n");
}

export type FeatureKind = "target-note" | "protected-species" | "notable";

export interface Feature {
  id: string;
  kind: FeatureKind;
  text: Field<string>;
  parcelRef?: string | null; // null = floats at site level
  capturedAt?: string;
  targetLabel?: string;
  /** Protected-species triggers must carry a follow-up decision. */
  followUp?: Field<string> | null;
}

export interface SiteContext {
  weather: Field<string>;
  access: Field<string>;
  designations: Field<string>;
  recommendations: Field<string>;
}

export type VisitStatus = "scheduled" | "in-progress" | "filed" | "archived";

export interface Visit {
  id: string;
  siteName: string;
  date: string; // ISO date
  surveyor: string;
  status: VisitStatus;
  source: "desk-study" | "freestyle";
  selectedForms?: ProjectFormId[];
  scheduledAt?: string; // human label e.g. "14:30"
  siteContext: SiteContext;
  parcels: Parcel[];
  features: Feature[];
  /** Captured walk-through notes (M2). Optional so legacy v2 records load. */
  transcript?: TranscriptNote[];
  filedAt?: string; // human label once filed
}

// ---------------------------------------------------------------------------
// Completeness — two tracks (per-parcel BNG + per-visit PEA) feed the banner.
// ---------------------------------------------------------------------------

export interface CompletenessSummary {
  outstanding: number;
  total: number;
  detail: string;
}

/** Outstanding = any field that is red (missing) or amber (needs review). */
function fieldOutstanding<T>(f: Field<T>): boolean {
  return f.status === "red" || f.status === "amber";
}

export function parcelCompleteness(p: Parcel): { outstanding: number; total: number } {
  const fields: Field<unknown>[] = [p.ukhabType, p.area, p.condition];
  let total = fields.length;
  let outstanding = fields.filter(fieldOutstanding).length;
  // A parcel still "to assess" counts every not-assessed criterion as a gap.
  const notAssessed = p.criteria.filter((c) => c.state === "not-assessed").length;
  total += p.criteria.length;
  outstanding += notAssessed;
  return { outstanding, total };
}

export function visitCompleteness(v: Visit): CompletenessSummary {
  let outstanding = 0;
  let total = 0;
  const parts: string[] = [];

  v.parcels.forEach((p) => {
    const c = parcelCompleteness(p);
    outstanding += c.outstanding;
    total += c.total;
    parts.push(c.outstanding === 0 ? `${p.name} ✓` : `${p.name}: ${c.outstanding} missing`);
  });

  // Per-visit site context.
  const ctx: Field<unknown>[] = [
    v.siteContext.weather,
    v.siteContext.access,
    v.siteContext.designations,
    v.siteContext.recommendations,
  ];
  total += ctx.length;
  outstanding += ctx.filter(fieldOutstanding).length;

  // Every protected-species trigger needs a follow-up decision.
  v.features
    .filter((f) => f.kind === "protected-species")
    .forEach((f) => {
      total += 1;
      if (!f.followUp || fieldOutstanding(f.followUp)) outstanding += 1;
    });

  return { outstanding, total, detail: parts.join(" · ") || "Site context only" };
}
