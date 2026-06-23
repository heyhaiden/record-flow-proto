import {
  field,
  type Feature,
  type Field,
  type Parcel,
  type TriageStatus,
  type Visit,
} from "@/lib/model/types";
import { newId } from "@/lib/id";
import type { ExtractedValue, ExtractionPatch, ParcelPatch } from "./schema";

/**
 * Applies an extraction patch to a Visit, deriving the green/amber/red triage
 * deterministically from each value's confidence + evidence (the LLM proposes,
 * this decides) and reconciling parcel types against the desk study. Pure: it
 * returns a new Visit and does not mutate the input.
 */

function triageFor<T>(v: ExtractedValue<T> | undefined): TriageStatus {
  if (!v || v.value == null) return "red";
  if (!v.evidence?.trim()) return "amber";
  return v.confidence === "high" ? "green" : "amber";
}

function toField<T>(v: ExtractedValue<T> | undefined): Field<T> {
  if (!v || v.value == null) return field<T>(null, v?.evidence ?? null, "red");
  return field<T>(v.value, v.evidence, triageFor(v));
}

function mergeParcel(parcel: Parcel, patch: ParcelPatch | undefined): Parcel {
  if (!patch) return parcel;
  const next: Parcel = { ...parcel };

  // --- habitat type + desk-study reconciliation ---
  const t = patch.ukhabType;
  const desk = parcel.deskStudyOrigin?.ukhabType ?? null;
  if (patch.reconciliation === "confirms" && t?.value != null) {
    next.ukhabType = field(t.value, t.evidence, "green");
    next.status = "confirmed";
  } else if (patch.reconciliation === "overrides" && t?.value != null) {
    next.ukhabType = field(t.value, t.evidence, triageFor(t));
    next.status = "overridden";
    next.overrideReason = t.evidence ?? undefined;
  } else if (desk) {
    // silent (or unresolved): keep the desk-study type as an unconfirmed
    // hypothesis — amber nudge that the surveyor never confirmed it.
    next.ukhabType = field(desk, null, "amber");
  } else {
    next.ukhabType = toField(t);
  }

  if (patch.area) next.area = toField(patch.area);
  if (patch.condition) next.condition = toField(patch.condition);

  if (patch.criteria?.length) {
    next.criteria = parcel.criteria.map((c) => {
      const hit = patch.criteria!.find((x) => x.id === c.id);
      return hit ? { ...c, state: hit.state, evidence: hit.evidence ?? c.evidence } : c;
    });
  }
  return next;
}

export function mergeExtraction(visit: Visit, patch: ExtractionPatch): Visit {
  const parcels = visit.parcels.map((p) =>
    mergeParcel(p, patch.parcels.find((pp) => pp.parcelId === p.id)),
  );

  const newFeatures: Feature[] = patch.features.map((f) => ({
    id: newId("f"),
    kind: f.kind,
    text: field(f.text, f.text, "green"),
    parcelRef: f.parcelRef ?? null,
    followUp:
      f.kind === "protected-species"
        ? field(f.followUp ?? null, f.followUp ?? null, f.followUp ? "green" : "red")
        : null,
  }));

  const sc = visit.siteContext;
  const p = patch.siteContext;
  return {
    ...visit,
    parcels,
    features: [...visit.features, ...newFeatures],
    siteContext: {
      weather: p.weather ? toField(p.weather) : sc.weather,
      access: p.access ? toField(p.access) : sc.access,
      designations: p.designations ? toField(p.designations) : sc.designations,
      recommendations: p.recommendations ? toField(p.recommendations) : sc.recommendations,
    },
  };
}
