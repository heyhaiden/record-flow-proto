import { NextResponse } from "next/server";
import { getExtractor } from "@/lib/extract/factory";
import type { ExtractionInput } from "@/lib/extract/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const input = (await req.json()) as ExtractionInput;
  if (!input?.transcript?.length) {
    return NextResponse.json({ error: "empty transcript" }, { status: 400 });
  }
  const patch = await getExtractor().extract(input);
  return NextResponse.json(patch);
}
