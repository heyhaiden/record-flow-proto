import { describe, expect, it } from "vitest";
import { buildFreestyle } from "@/lib/model/seed";
import { collectReviewGaps, evidenceAddsDetail } from "@/lib/model/review-gaps";
import { field } from "@/lib/model/types";

describe("review gaps", () => {
  it("collects outstanding fields", () => {
    const visit = buildFreestyle("Test site");
    const gaps = collectReviewGaps(visit);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some((g) => g.id === "site:weather")).toBe(true);
  });

  it("skips duplicate evidence when it matches value", () => {
    expect(evidenceAddsDetail({ value: "Overcast", evidence: "Overcast" })).toBe(false);
    expect(evidenceAddsDetail({ value: "Overcast", evidence: "Overcast, light wind" })).toBe(true);
    expect(evidenceAddsDetail(field<string>(null, "some speech"))).toBe(true);
  });
});
