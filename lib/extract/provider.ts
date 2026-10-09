import type { ExtractionInput, ExtractionPatch } from "./schema";

export interface Extractor {
  extract(input: ExtractionInput): Promise<ExtractionPatch>;
}
