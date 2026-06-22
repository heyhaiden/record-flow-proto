import { DEEPGRAM_LISTEN_OPTIONS } from "./deepgram-config";

type LiveMessage = {
  type?: string;
  channel?: { alternatives?: Array<{ transcript?: string }> };
  is_final?: boolean;
  speech_final?: boolean;
};

export interface DeepgramLiveTranscript {
  transcript: string;
  isFinal: boolean;
}

/** Build listen URL for tests / debugging (production uses @deepgram/sdk). */
export function buildDeepgramListenUrl(): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(DEEPGRAM_LISTEN_OPTIONS)) {
    params.set(key, String(value));
  }
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

/** JWT access tokens from /v1/auth/grant use the bearer subprotocol; API keys use token. */
export function buildDeepgramWebSocketProtocols(
  credential: string,
  authMode: "bearer" | "api_key" = "bearer",
): string[] {
  return authMode === "api_key" ? ["token", credential] : ["bearer", credential];
}

/** Parse a Deepgram live streaming message into transcript + finality. */
export function parseDeepgramLiveMessage(
  raw: string | LiveMessage,
): DeepgramLiveTranscript | null {
  try {
    const json: LiveMessage = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (
      json.type === "SpeechStarted" ||
      json.type === "UtteranceEnd" ||
      json.type === "Metadata"
    ) {
      return null;
    }

    if (json.type && json.type !== "Results") return null;

    const transcript = json.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
    if (!transcript) return null;

    return {
      transcript,
      isFinal: Boolean(json.is_final || json.speech_final),
    };
  } catch {
    return null;
  }
}
