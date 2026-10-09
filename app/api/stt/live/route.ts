import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Hands the browser a live-STT session descriptor.
 * Fake: no token. Deepgram: a 30s grant JWT (Bearer), or the API key itself when
 * `DEEPGRAM_ALLOW_BROWSER_LIVE=true` (local-dev fallback — grant needs a Member key).
 */
export async function GET() {
  const which = process.env.STT_PROVIDER ?? "fake";
  if (which !== "deepgram") {
    return NextResponse.json({ provider: "fake" });
  }

  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY is not set" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 30 }),
    });
    if (res.ok) {
      const json = (await res.json()) as { access_token?: string };
      if (json.access_token) {
        return NextResponse.json({
          provider: "deepgram",
          scheme: "bearer",
          token: json.access_token,
        });
      }
    }
  } catch {
    /* fall through to the local-dev key handoff */
  }

  if (process.env.DEEPGRAM_ALLOW_BROWSER_LIVE === "true") {
    return NextResponse.json({
      provider: "deepgram",
      scheme: "token",
      token: key,
    });
  }

  return NextResponse.json({ error: "deepgram grant failed" }, { status: 502 });
}
