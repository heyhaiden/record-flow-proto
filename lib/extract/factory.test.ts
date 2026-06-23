import { afterEach, expect, test, vi } from "vitest";
import { getExtractor } from "./factory";
import { FakeExtractor } from "./fake";
import { ClaudeExtractor } from "./claude";

afterEach(() => vi.unstubAllEnvs());

test("returns FakeExtractor when EXTRACT_PROVIDER=fake", () => {
  vi.stubEnv("EXTRACT_PROVIDER", "fake");
  expect(getExtractor()).toBeInstanceOf(FakeExtractor);
});

test("returns ClaudeExtractor when EXTRACT_PROVIDER=claude and key present", () => {
  vi.stubEnv("EXTRACT_PROVIDER", "claude");
  vi.stubEnv("ANTHROPIC_API_KEY", "k");
  expect(getExtractor()).toBeInstanceOf(ClaudeExtractor);
});

test("throws when EXTRACT_PROVIDER=claude and key missing", () => {
  vi.stubEnv("EXTRACT_PROVIDER", "claude");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  expect(() => getExtractor()).toThrow();
});
