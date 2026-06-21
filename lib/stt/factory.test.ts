import { afterEach, expect, test, vi } from "vitest";
import { getSttProvider } from "./factory";
import { FakeSttProvider } from "./fake";
import { DeepgramSttProvider } from "./deepgram";

afterEach(() => vi.unstubAllEnvs());

test("returns FakeSttProvider when STT_PROVIDER=fake", () => {
  vi.stubEnv("STT_PROVIDER", "fake");
  expect(getSttProvider()).toBeInstanceOf(FakeSttProvider);
});

test("returns Deepgram when STT_PROVIDER=deepgram and key present", () => {
  vi.stubEnv("STT_PROVIDER", "deepgram");
  vi.stubEnv("DEEPGRAM_API_KEY", "k");
  expect(getSttProvider()).toBeInstanceOf(DeepgramSttProvider);
});
