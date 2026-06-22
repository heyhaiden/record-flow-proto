import { DeepgramClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY is not set" }, { status: 503 });
  }

  try {
    const client = new DeepgramClient({ apiKey });
    const tokenResponse = await client.auth.v1.tokens.grant({ ttl_seconds: 30 });
    if (!tokenResponse.access_token) {
      return NextResponse.json({ error: "Deepgram grant returned no token" }, { status: 502 });
    }
    return NextResponse.json({ token: tokenResponse.access_token, authMode: "bearer" });
  } catch (err) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode: number }).statusCode)
        : 502;

    if (status === 403 && process.env.DEEPGRAM_ALLOW_BROWSER_LIVE === "true") {
      return NextResponse.json({ token: apiKey, authMode: "api_key" });
    }

    const message = err instanceof Error ? err.message : "Deepgram grant failed";
    return NextResponse.json(
      {
        error: message,
        hint:
          status === 403
            ? "Create a Deepgram API key with Member permissions, or set DEEPGRAM_ALLOW_BROWSER_LIVE=true for local dev only."
            : undefined,
      },
      { status: status === 403 ? 403 : 502 },
    );
  }
}
