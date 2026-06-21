import type { SttOptions, SttProvider, SttResult } from "./provider";

export class DeepgramSttProvider implements SttProvider {
  constructor(private readonly apiKey: string) {}

  async transcribe(audio: Uint8Array, opts?: SttOptions): Promise<SttResult> {
    const params = new URLSearchParams({ model: "nova-2", smart_format: "true" });
    for (const kw of opts?.keywords ?? []) params.append("keywords", kw);

    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: audio,
    });
    if (!res.ok) {
      throw new Error(`Deepgram error ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const text: string =
      json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return { text };
  }
}
