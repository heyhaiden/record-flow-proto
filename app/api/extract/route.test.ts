import { afterEach, expect, test, vi } from "vitest";
import type { ExtractionInput } from "@/lib/extract/schema";

afterEach(() => vi.unstubAllEnvs());

function post(input: unknown) {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

test("400 on empty transcript", async () => {
  vi.stubEnv("EXTRACT_PROVIDER", "fake");
  const { POST } = await import("./route");
  const res = await POST(post({ transcript: [], parcels: [] }));
  expect(res.status).toBe(400);
});

test("returns an extraction patch for a transcript (fake provider)", async () => {
  vi.stubEnv("EXTRACT_PROVIDER", "fake");
  const { POST } = await import("./route");
  const input: ExtractionInput = {
    transcript: [
      { text: "Lowland meadow, 2.5 hectares, condition good", target: { kind: "parcel", parcelId: "p1" } },
    ],
    parcels: [{ id: "p1", name: "Parcel 1", deskStudyType: null, criteriaIds: [] }],
  };
  const res = await POST(post(input));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.parcels)).toBe(true);
  expect(json.parcels[0].parcelId).toBe("p1");
});
