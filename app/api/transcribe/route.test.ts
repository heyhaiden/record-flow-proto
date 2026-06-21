import { afterEach, expect, test, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

test("returns highlighted tokens for posted audio (fake provider)", async () => {
  vi.stubEnv("STT_PROVIDER", "fake");
  const { POST } = await import("./route");

  const body = new Uint8Array([1, 2, 3]);
  const req = new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body,
  });

  const res = await POST(req);
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(typeof json.text).toBe("string");
  expect(Array.isArray(json.tokens)).toBe(true);
  // "Hawthorn" and "elder" from the fake transcript should be highlighted
  expect(json.tokens.some((t: { k: number }) => t.k === 1)).toBe(true);
});
