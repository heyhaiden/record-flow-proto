/**
 * Seed visits for the prototype. The guided demo (Oakfield Meadow) ships a
 * stubbed desk study (two parcels with provisional types) so the closed loop —
 * ground-truth → record → review → gap-fill → export — can be demonstrated
 * without a real GIS importer (deferred to V1 per the decision log).
 */

import { criteriaFor } from "./conditions";
import { field, type Condition, type Field, type Parcel, type Visit } from "./types";
import { newId } from "@/lib/id";

// Typed empty fields (null value → "red"/missing) so generics infer correctly.
const emptyStr = (): Field<string> => field<string>(null, null, "red");
const emptyNum = (): Field<number> => field<number>(null, null, "red");
const emptyCond = (): Field<Condition> => field<Condition>(null, null, "red");

function markCriteria(
  ids: string[],
  state: "pass" | "fail",
  base: ReturnType<typeof criteriaFor>,
) {
  return base.map((c) => (ids.includes(c.id) ? { ...c, state } : c));
}

export function buildGuidedDemo(): Visit {
  // Parcel 1 — grassland, fully ground-truthed (a satisfying "complete").
  const grasslandCriteria = (() => {
    let cs = criteriaFor("grassland_modified_low");
    cs = markCriteria(["A", "B", "C", "E", "G"], "pass", cs);
    cs = markCriteria(["D", "F"], "fail", cs);
    return cs;
  })();

  // Parcel 2 — hedgerow, deliberately left with gaps to drive the gap-fill aha.
  const hedgerowCriteria = (() => {
    let cs = criteriaFor("hedgerow_native_no_trees");
    cs = markCriteria(["A1", "B1", "B2"], "pass", cs);
    // A2, C1, C2, D1, D2 remain not-assessed → red/incomplete
    return cs;
  })();

  return {
    id: "demo-oakfield",
    siteName: "Oakfield Meadow",
    date: "2026-06-21",
    surveyor: "E. Hartley",
    status: "scheduled",
    source: "desk-study",
    scheduledAt: "09:30",
    siteContext: {
      weather: field("Overcast, 16°C, light wind", "overcast and about sixteen degrees", "green"),
      access: field("Field gate off Mill Lane; livestock present", "got in through the field gate off mill lane", "green"),
      designations: emptyStr(),
      recommendations: field("Badger survey recommended (see Parcel 2)", "flag for protected species check", "amber"),
    },
    parcels: [
      {
        id: "p1",
        name: "Parcel 1",
        habitatId: "grassland_modified_low",
        ukhabType: field("Modified grassland", "semi-improved neutral grassland", "green"),
        area: field(2, "roughly two hectares", "green"),
        areaUnit: "ha",
        condition: field("Moderate", "moderate condition, a few forbs", "green"),
        criteria: grasslandCriteria,
        deskStudyOrigin: { ukhabType: "Modified grassland", source: "Desk study (satellite/GIS)" },
        status: "confirmed",
      },
      {
        id: "p2",
        name: "Parcel 2",
        habitatId: "hedgerow_native_no_trees",
        ukhabType: field("Native hedgerow", "hedgerow on the western edge, hawthorn dominant", "green"),
        area: emptyNum(), // length not captured → gap-fill target
        areaUnit: "km",
        condition: emptyCond(),
        criteria: hedgerowCriteria,
        deskStudyOrigin: { ukhabType: "Native hedgerow", source: "Desk study (satellite/GIS)" },
        status: "to-assess",
      },
    ],
    features: [
      {
        id: "f1",
        kind: "protected-species",
        text: field("Possible badger latrine at the south corner", "possible badger latrine at the south corner", "green"),
        parcelRef: "p2",
        followUp: emptyStr(), // needs a follow-up decision
      },
      {
        id: "f2",
        kind: "notable",
        text: field("Mature oak on north boundary with potential bat roost features", "mature oak with bat roost features worth a look", "amber"),
        parcelRef: null,
      },
    ],
  };
}

export function buildScheduled(): Visit {
  return {
    id: "demo-millpond",
    siteName: "Mill Pond scrub",
    date: "2026-06-21",
    surveyor: "E. Hartley",
    status: "scheduled",
    source: "desk-study",
    scheduledAt: "14:30",
    siteContext: {
      weather: emptyStr(),
      access: emptyStr(),
      designations: emptyStr(),
      recommendations: emptyStr(),
    },
    parcels: [
      {
        id: "mp1",
        name: "Parcel 1",
        habitatId: "grassland_modified_low",
        ukhabType: field("Modified grassland", null, "amber"),
        area: emptyNum(),
        areaUnit: "ha",
        condition: emptyCond(),
        criteria: criteriaFor("grassland_modified_low"),
        deskStudyOrigin: { ukhabType: "Modified grassland", source: "Desk study (satellite/GIS)" },
        status: "to-assess",
      },
    ],
    features: [],
  };
}

export function buildFreestyleParcel(name: string, habitatId?: string): Parcel {
  return {
    id: newId("p"),
    name,
    habitatId,
    ukhabType: emptyStr(),
    area: emptyNum(),
    areaUnit: "ha",
    condition: emptyCond(),
    criteria: criteriaFor(habitatId),
    status: "to-assess",
  };
}

/** A blank-slate freestyle visit — capture parcels on the fly by voice. */
export function buildFreestyle(siteName = "New site", surveyor = "E. Hartley"): Visit {
  return {
    id: newId("visit"),
    siteName,
    date: new Date().toISOString().slice(0, 10),
    surveyor,
    status: "in-progress",
    source: "freestyle",
    siteContext: {
      weather: emptyStr(),
      access: emptyStr(),
      designations: emptyStr(),
      recommendations: emptyStr(),
    },
    parcels: [],
    features: [],
  };
}

export function seedVisits(): Visit[] {
  return [buildGuidedDemo(), buildScheduled()];
}
