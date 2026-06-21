import { NextResponse } from "next/server";
import { getSttProvider } from "@/lib/stt/factory";
import { vocabularyTerms } from "@/lib/vocabulary";
import { highlightKeywords } from "@/lib/highlight";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "empty audio" }, { status: 400 });
  }
  const keywords = vocabularyTerms();
  const provider = getSttProvider();
  const { text } = await provider.transcribe(buf, { keywords });
  const tokens = highlightKeywords(text, keywords);
  return NextResponse.json({ text, tokens });
}
