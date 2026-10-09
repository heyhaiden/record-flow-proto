import type { SttOptions, SttProvider, SttResult } from "./provider";

export const FAKE_TRANSCRIPT =
  "Hawthorn dominant on the western edge, some elder. Badger latrine at the south corner.";

export class FakeSttProvider implements SttProvider {
  lastKeywords: string[] = [];
  constructor(private readonly scripted: string) {}
  async transcribe(_audio: Uint8Array, opts?: SttOptions): Promise<SttResult> {
    this.lastKeywords = opts?.keywords ?? [];
    return { text: this.scripted };
  }
}
