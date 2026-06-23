import { expect, test } from "vitest";
import { field, type Condition, type Parcel, type Visit } from "@/lib/model/types";
import { mergeExtraction } from "./merge";
import type { ExtractionPatch } from "./schema";

function deskParcel(): Parcel {
  return {
    id: "p1",
    name: "Parcel 1",
    ukhabType: field<string>(null, null, "red"),
    area: field<number>(null, null, "red"),
    areaUnit: "ha",
    condition: field<Condition>(null, null, "red"),
    criteria: [{ id: "A", label: "Crit A", state: "not-assessed" }],
    deskStudyOrigin: { ukhabType: "Lowland meadow", source: "Desk study" },
    status: "to-assess",
  };
}

function baseVisit(): Visit {
  return {
    id: "v1",
    siteName: "Test",
    date: "2026-06-23",
    surveyor: "me",
    status: "in-progress",
    source: "desk-study",
    siteContext: {
      weather: field<string>(null, null, "red"),
      access: field<string>(null, null, "red"),
      designations: field<string>(null, null, "red"),
      recommendations: field<string>(null, null, "red"),
    },
    parcels: [deskParcel()],
    features: [],
  };
}

const empty: ExtractionPatch = { parcels: [], features: [], siteContext: {} };

test("high confidence + evidence → green", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    parcels: [{ parcelId: "p1", area: { value: 2.5, evidence: "about 2.5 hectares", confidence: "high" } }],
  });
  expect(out.parcels[0].area).toEqual({ value: 2.5, evidence: "about 2.5 hectares", status: "green" });
});

test("medium confidence → amber", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    parcels: [{ parcelId: "p1", area: { value: 2.5, evidence: "maybe 2.5", confidence: "medium" } }],
  });
  expect(out.parcels[0].area.status).toBe("amber");
});

test("null value → red", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    parcels: [{ parcelId: "p1", area: { value: null, evidence: null, confidence: "low" } }],
  });
  expect(out.parcels[0].area.status).toBe("red");
});

test("reconciliation confirms → green + status confirmed", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    parcels: [{ parcelId: "p1", reconciliation: "confirms", ukhabType: { value: "Lowland meadow", evidence: "yes lowland meadow", confidence: "high" } }],
  });
  expect(out.parcels[0].ukhabType).toEqual({ value: "Lowland meadow", evidence: "yes lowland meadow", status: "green" });
  expect(out.parcels[0].status).toBe("confirmed");
});

test("reconciliation overrides → status overridden + overrideReason", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    parcels: [{ parcelId: "p1", reconciliation: "overrides", ukhabType: { value: "Modified grassland", evidence: "actually modified grassland", confidence: "high" } }],
  });
  expect(out.parcels[0].ukhabType.value).toBe("Modified grassland");
  expect(out.parcels[0].status).toBe("overridden");
  expect(out.parcels[0].overrideReason).toBe("actually modified grassland");
});

test("reconciliation silent → desk-study type kept as amber hypothesis", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    parcels: [{ parcelId: "p1", reconciliation: "silent" }],
  });
  expect(out.parcels[0].ukhabType.value).toBe("Lowland meadow");
  expect(out.parcels[0].ukhabType.status).toBe("amber");
});

test("criteria patch updates state + evidence", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    parcels: [{ parcelId: "p1", criteria: [{ id: "A", state: "pass", evidence: "A passes" }] }],
  });
  expect(out.parcels[0].criteria[0].state).toBe("pass");
  expect(out.parcels[0].criteria[0].evidence).toBe("A passes");
});

test("protected-species feature with followUp is appended green", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    features: [{ kind: "protected-species", text: "Badger latrine", followUp: "Further badger survey" }],
  });
  expect(out.features).toHaveLength(1);
  expect(out.features[0].kind).toBe("protected-species");
  expect(out.features[0].followUp?.value).toBe("Further badger survey");
  expect(out.features[0].followUp?.status).toBe("green");
});

test("protected-species feature without followUp → red follow-up gap", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    features: [{ kind: "protected-species", text: "Possible bat roost" }],
  });
  expect(out.features[0].followUp?.value).toBeNull();
  expect(out.features[0].followUp?.status).toBe("red");
});

test("site context value merges with triage", () => {
  const out = mergeExtraction(baseVisit(), {
    ...empty,
    siteContext: { weather: { value: "Overcast, 15C", evidence: "overcast about fifteen", confidence: "high" } },
  });
  expect(out.siteContext.weather).toEqual({ value: "Overcast, 15C", evidence: "overcast about fifteen", status: "green" });
});

test("merge is immutable", () => {
  const v = baseVisit();
  mergeExtraction(v, {
    ...empty,
    parcels: [{ parcelId: "p1", area: { value: 9, evidence: "nine", confidence: "high" } }],
    features: [{ kind: "notable", text: "x" }],
  });
  expect(v.parcels[0].area.value).toBeNull();
  expect(v.features).toHaveLength(0);
});
