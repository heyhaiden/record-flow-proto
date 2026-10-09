import { z } from "zod";
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

// ---------------------------------------------------------------------------
// Zod mirror of ExtractionPatch — drives the Claude structured-output call.
// Optional fields are modelled as nullable (structured outputs prefer
// all-required + null over optional); merge.ts already treats null the same
// as absent.
// ---------------------------------------------------------------------------

const confidenceZ = z.enum(["high", "medium", "low"]);
const extractedString = z.object({
  value: z.string().nullable(),
  evidence: z.string().nullable(),
  confidence: confidenceZ,
});
const extractedNumber = z.object({
  value: z.number().nullable(),
  evidence: z.string().nullable(),
  confidence: confidenceZ,
});
const extractedCondition = z.object({
  value: z.enum(["Good", "Moderate", "Poor"]).nullable(),
  evidence: z.string().nullable(),
  confidence: confidenceZ,
});

export const ExtractionPatchSchema = z.object({
  parcels: z.array(
    z.object({
      parcelId: z.string(),
      ukhabType: extractedString.nullable(),
      reconciliation: z.enum(["confirms", "overrides", "silent"]).nullable(),
      area: extractedNumber.nullable(),
      condition: extractedCondition.nullable(),
      criteria: z.array(
        z.object({
          id: z.string(),
          state: z.enum(["pass", "fail", "not-assessed"]),
          evidence: z.string().nullable(),
        }),
      ),
    }),
  ),
  features: z.array(
    z.object({
      kind: z.enum(["target-note", "protected-species", "notable"]),
      text: z.string(),
      parcelRef: z.string().nullable(),
      followUp: z.string().nullable(),
    }),
  ),
  siteContext: z.object({
    weather: extractedString.nullable(),
    access: extractedString.nullable(),
    designations: extractedString.nullable(),
    recommendations: extractedString.nullable(),
  }),
});
