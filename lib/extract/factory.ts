import type { Extractor } from "./provider";
import { FakeExtractor } from "./fake";
import { ClaudeExtractor } from "./claude";

export function getExtractor(): Extractor {
  if ((process.env.EXTRACT_PROVIDER ?? "fake") === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    return new ClaudeExtractor(key);
  }
  return new FakeExtractor();
}
