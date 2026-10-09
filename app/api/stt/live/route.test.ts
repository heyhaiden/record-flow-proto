import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

test("fake provider returns a live session that does not need a token", async () => {
  vi.stubEnv("STT_PROVIDER", "fake");
  const { GET } = await import("./route");
  const res = await GET();
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({ provider: "fake" });
});

test("deepgram mints a bearer grant for the browser websocket", async () => {
  vi.stubEnv("STT_PROVIDER", "deepgram");
  vi.stubEnv("DEEPGRAM_API_KEY", "secret-key");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ access_token: "jwt-token", expires_in: 30 }), { status: 200 }),
  );
  const { GET } = await import("./route");
  const res = await GET();
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    provider: "deepgram",
    scheme: "bearer",
    token: "jwt-token",
  });
});
