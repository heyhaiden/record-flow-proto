import type { SttOptions, SttProvider, SttResult } from "./provider";
import { DEEPGRAM_LISTEN_OPTIONS } from "./deepgram-config";

/** Normalize browser MediaRecorder MIME types for Deepgram pre-recorded upload. */
export function normalizeDeepgramMimeType(mime?: string): string {
  if (!mime) return "application/octet-stream";
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/mp4" || base === "audio/m4a") return "audio/mp4";
  if (base === "audio/webm") return "audio/webm";
  if (base === "audio/ogg") return "audio/ogg";
  if (base === "audio/wav") return "audio/wav";
  return base || "application/octet-stream";
}

export class DeepgramSttProvider implements SttProvider {
  constructor(private readonly apiKey: string) {}

  async transcribe(audio: Uint8Array, opts?: SttOptions): Promise<SttResult> {
    const params = new URLSearchParams({
      model: DEEPGRAM_LISTEN_OPTIONS.model,
      smart_format: "true",
      language: DEEPGRAM_LISTEN_OPTIONS.language,
    });
    for (const kw of opts?.keywords ?? []) params.append("keywords", kw);
    const body = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
    const contentType = normalizeDeepgramMimeType(opts?.mimeType);

    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": contentType,
      },
      body,
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
