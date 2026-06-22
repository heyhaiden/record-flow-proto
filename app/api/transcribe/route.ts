import { NextResponse } from "next/server";
import { getSttProvider } from "@/lib/stt/factory";
import { vocabularyTerms } from "@/lib/vocabulary";
import { highlightKeywords } from "@/lib/highlight";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "audio too large" }, { status: 413 });
  }

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "empty audio" }, { status: 400 });
  }
  if (buf.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "audio too large" }, { status: 413 });
  }

  try {
    const keywords = vocabularyTerms();
    const provider = getSttProvider();
    const { text } = await provider.transcribe(buf, {
      keywords,
      mimeType: req.headers.get("content-type") ?? undefined,
    });
    const tokens = highlightKeywords(text, keywords);
    return NextResponse.json({ text, tokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : "transcription failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
