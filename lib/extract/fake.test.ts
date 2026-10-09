import { expect, test } from "vitest";
import { FakeExtractor } from "./fake";
import type { ExtractionInput } from "./schema";

test("parses area, condition and a type for a parcel note", async () => {
  const input: ExtractionInput = {
    transcript: [
      { text: "Lowland meadow, about 2.5 hectares, condition good", target: { kind: "parcel", parcelId: "p1" } },
    ],
    parcels: [{ id: "p1", name: "Parcel 1", deskStudyType: null, criteriaIds: ["A"] }],
  };
  const patch = await new FakeExtractor().extract(input);
  const p = patch.parcels.find((x) => x.parcelId === "p1")!;
  expect(p.area?.value).toBe(2.5);
  expect(p.condition?.value).toBe("Good");
  expect(p.ukhabType?.value).toBeTruthy();
});

test("flags a protected-species feature", async () => {
  const input: ExtractionInput = {
    transcript: [{ text: "Badger latrine at the south corner", target: { kind: "feature" } }],
    parcels: [],
  };
  const patch = await new FakeExtractor().extract(input);
  expect(patch.features).toHaveLength(1);
  expect(patch.features[0].kind).toBe("protected-species");
});

test("confirms desk-study type when the surveyor mentions it", async () => {
  const input: ExtractionInput = {
    transcript: [{ text: "Yeah this is lowland meadow", target: { kind: "parcel", parcelId: "p1" } }],
    parcels: [{ id: "p1", name: "Parcel 1", deskStudyType: "lowland meadow", criteriaIds: [] }],
  };
  const patch = await new FakeExtractor().extract(input);
  expect(patch.parcels.find((x) => x.parcelId === "p1")?.reconciliation).toBe("confirms");
});
