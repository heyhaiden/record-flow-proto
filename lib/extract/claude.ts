import type { Extractor } from "./provider";
import type { ExtractionInput, ExtractionPatch } from "./schema";

/**
 * Claude structured-output extractor. The real SDK call is implemented in
 * Task 6; the SDK is imported lazily inside extract() so the factory and fake
 * provider load without @anthropic-ai/sdk installed.
 */
export class ClaudeExtractor implements Extractor {
  constructor(private readonly apiKey: string) {}

  async extract(_input: ExtractionInput): Promise<ExtractionPatch> {
    void this.apiKey;
    throw new Error("ClaudeExtractor not yet implemented (Task 6)");
  }
}
