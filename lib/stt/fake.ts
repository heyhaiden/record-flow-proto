import type { SttOptions, SttProvider, SttResult } from "./provider";

export class FakeSttProvider implements SttProvider {
  lastKeywords: string[] = [];
  constructor(private readonly scripted: string) {}
  async transcribe(_audio: Uint8Array, opts?: SttOptions): Promise<SttResult> {
    this.lastKeywords = opts?.keywords ?? [];
    return { text: this.scripted };
  }
}
