import { expect, test } from "vitest";
import {
  buildDeepgramListenUrl,
  buildDeepgramWebSocketProtocols,
  parseDeepgramLiveMessage,
} from "./deepgram-live";

test("buildDeepgramWebSocketProtocols uses bearer for grant tokens", () => {
  expect(buildDeepgramWebSocketProtocols("eyJhbGciOi.test")).toEqual([
    "bearer",
    "eyJhbGciOi.test",
  ]);
});

test("buildDeepgramWebSocketProtocols uses token for api keys", () => {
  expect(buildDeepgramWebSocketProtocols("dg-key", "api_key")).toEqual(["token", "dg-key"]);
});

test("buildDeepgramListenUrl includes realtime params", () => {
  const url = buildDeepgramListenUrl();
  expect(url).toContain("wss://api.deepgram.com/v1/listen");
  expect(url).toContain("interim_results=true");
  expect(url).toContain("model=nova-3");
});

test("parseDeepgramLiveMessage extracts interim transcript", () => {
  const result = parseDeepgramLiveMessage(
    JSON.stringify({
      type: "Results",
      channel: { alternatives: [{ transcript: "hawthorn dominant" }] },
      is_final: false,
    }),
  );
  expect(result).toEqual({ transcript: "hawthorn dominant", isFinal: false });
});

test("parseDeepgramLiveMessage extracts final transcript", () => {
  const result = parseDeepgramLiveMessage(
    JSON.stringify({
      type: "Results",
      channel: { alternatives: [{ transcript: "badger latrine" }] },
      is_final: true,
    }),
  );
  expect(result).toEqual({ transcript: "badger latrine", isFinal: true });
});

test("parseDeepgramLiveMessage ignores empty transcript", () => {
  expect(
    parseDeepgramLiveMessage(
      JSON.stringify({
        type: "Results",
        channel: { alternatives: [{ transcript: "   " }] },
        is_final: false,
      }),
    ),
  ).toBeNull();
});
