import { test, expect } from "vitest";
import { field, type Visit } from "./types";
import { capturedNotesFromVisit } from "./captured-notes";

const visit: Visit = {
  id: "visit_1",
  siteName: "Oakfield",
  date: "2026-06-22",
  surveyor: "E. Hartley",
  status: "in-progress",
  siteContext: {
    weather: field(null),
    access: field(null),
    designations: field(null),
    recommendations: field(null),
  },
  parcels: [
    {
      id: "parcel_1",
      name: "Parcel 1",
      ukhabType: field("Modified grassland"),
      area: field(null),
      areaUnit: "ha",
      condition: field(null),
      criteria: [],
      status: "to-assess",
    },
  ],
  features: [
    {
      id: "feature_1",
      kind: "target-note",
      text: field("Hawthorn dominant on western edge", "Hawthorn dominant on western edge", "green"),
      parcelRef: "parcel_1",
      capturedAt: "15:42",
    },
    {
      id: "feature_2",
      kind: "protected-species",
      text: field("Badger latrine", "Badger latrine", "green"),
      parcelRef: null,
    },
  ],
};

test("rebuilds visible recorder notes from persisted target-note features", () => {
  expect(capturedNotesFromVisit(visit)).toEqual([
    {
      time: "15:42",
      targetLabel: "Parcel 1 · Modified grassland",
      toks: [{ text: "Hawthorn", k: 1 }, { text: " dominant on western edge", k: 0 }],
    },
  ]);
});

test("groups fragments into one event per parcel and clock minute", () => {
  const fragmented: Visit = {
    ...visit,
    features: [
      {
        id: "f1",
        kind: "target-note",
        text: field("now I'm taking", "now I'm taking", "green"),
        parcelRef: "parcel_1",
        capturedAt: "17:16",
        targetLabel: "Site · untyped",
      },
      {
        id: "f2",
        kind: "target-note",
        text: field("a look around", "a look around", "green"),
        parcelRef: "parcel_1",
        capturedAt: "17:16",
        targetLabel: "Site · untyped",
      },
      {
        id: "f3",
        kind: "target-note",
        text: field("weather note", "weather note", "green"),
        parcelRef: "parcel_1",
        capturedAt: "17:17",
        targetLabel: "Site · untyped",
      },
    ],
  };
  const events = capturedNotesFromVisit(fragmented);
  expect(events).toHaveLength(2);
  expect(events[0].time).toBe("17:16");
  expect(events[0].toks.map((t) => t.text).join("")).toBe("now I'm taking a look around");
  expect(events[1].time).toBe("17:17");
});
