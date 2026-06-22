import { afterEach, beforeEach, expect, test, vi } from "vitest";

const grantMock = vi.hoisted(() => vi.fn());

vi.mock("@deepgram/sdk", () => ({
  DeepgramClient: vi.fn().mockImplementation(() => ({
    auth: { v1: { tokens: { grant: grantMock } } },
  })),
}));

beforeEach(() => {
  vi.resetModules();
  grantMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("returns 503 when DEEPGRAM_API_KEY is missing", async () => {
  vi.stubEnv("DEEPGRAM_API_KEY", "");
  const { POST } = await import("./route");
  const res = await POST();
  expect(res.status).toBe(503);
});

test("returns token from Deepgram grant response", async () => {
  vi.stubEnv("DEEPGRAM_API_KEY", "test-key");
  grantMock.mockResolvedValue({ access_token: "jwt-token" });

  const { POST } = await import("./route");
  const res = await POST();
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.token).toBe("jwt-token");
  expect(json.authMode).toBe("bearer");
  expect(grantMock).toHaveBeenCalledWith({ ttl_seconds: 30 });
});

test("falls back to browser live mode when grant is forbidden", async () => {
  vi.stubEnv("DEEPGRAM_API_KEY", "member-key");
  vi.stubEnv("DEEPGRAM_ALLOW_BROWSER_LIVE", "true");
  grantMock.mockRejectedValue({ statusCode: 403, message: "forbidden" });

  const { POST } = await import("./route");
  const res = await POST();
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.token).toBe("member-key");
  expect(json.authMode).toBe("api_key");
});

test("bubbles up Deepgram grant failures", async () => {
  vi.stubEnv("DEEPGRAM_API_KEY", "bad-key");
  grantMock.mockRejectedValue({ statusCode: 401, message: "nope" });

  const { POST } = await import("./route");
  const res = await POST();
  expect(res.status).toBe(502);
});
