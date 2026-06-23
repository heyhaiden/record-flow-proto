import type { Tok } from "@/lib/types";

/**
 * Sends a recorded audio clip to the transcribe endpoint and returns the
 * highlighted tokens. The /api/transcribe route already runs keyword
 * highlighting server-side, so the caller commits these tokens directly.
 *
 * An empty clip (e.g. a tap that was too short to capture audio) is a no-op
 * that resolves to []. A failed request throws so the caller can surface the
 * STT-error recovery state.
 */
export async function transcribeAudio(blob: Blob): Promise<Tok[]> {
  if (blob.size === 0) return [];

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`transcribe failed: ${res.status}`);
  }
  const data = (await res.json()) as { tokens?: Tok[] };
  return data.tokens ?? [];
}
