import type {
  Condition,
  CriterionState,
  FeatureKind,
  NoteTarget,
} from "@/lib/model/types";

/**
 * The extraction contract. The LLM (or fake heuristic) returns each value with
 * its verbatim evidence span and a bounded confidence enum; the merge code
 * (lib/extract/merge.ts) derives the green/amber/red triage from these — the
 * model never stamps the traffic-light state directly.
 */

export type Confidence = "high" | "medium" | "low";

export function isConfidence(s: string): s is Confidence {
  return s === "high" || s === "medium" || s === "low";
}

export interface ExtractedValue<T> {
  value: T | null;
  evidence: string | null;
  confidence: Confidence;
}

/** Desk-study reconciliation outcome for a parcel's habitat type. */
export type Reconciliation = "confirms" | "overrides" | "silent";

export interface ParcelPatch {
  parcelId: string;
  ukhabType?: ExtractedValue<string>;
  reconciliation?: Reconciliation;
  area?: ExtractedValue<number>;
  condition?: ExtractedValue<Condition>;
  criteria?: { id: string; state: CriterionState; evidence?: string | null }[];
}

export interface FeaturePatch {
  kind: FeatureKind;
  text: string;
  parcelRef?: string | null;
  followUp?: string | null;
}

export interface SiteContextPatch {
  weather?: ExtractedValue<string>;
  access?: ExtractedValue<string>;
  designations?: ExtractedValue<string>;
  recommendations?: ExtractedValue<string>;
}

/** What the extractor returns; merged into the Visit by mergeExtraction. */
export interface ExtractionPatch {
  parcels: ParcelPatch[];
  features: FeaturePatch[];
  siteContext: SiteContextPatch;
}

/** What the API route sends the extractor. */
export interface ExtractionInput {
  transcript: { text: string; target: NoteTarget }[];
  parcels: {
    id: string;
    name: string;
    deskStudyType: string | null;
    criteriaIds: string[];
  }[];
}
