import { expect, test } from "vitest";
import {
  accumulateLiveText,
  fakeTranscriptAt,
  parseDeepgramLiveMessage,
} from "./live-stt";
import { FAKE_TRANSCRIPT } from "@/lib/stt/fake";

test("parses an interim Deepgram live payload", () => {
  const parsed = parseDeepgramLiveMessage({
    is_final: false,
    channel: { alternatives: [{ transcript: "hawthorn on the" }] },
  });
  expect(parsed).toEqual({ text: "hawthorn on the", isFinal: false });
});

test("parses a final Deepgram live payload", () => {
  const parsed = parseDeepgramLiveMessage({
    is_final: true,
    channel: { alternatives: [{ transcript: "western edge" }] },
  });
  expect(parsed).toEqual({ text: "western edge", isFinal: true });
});

test("ignores empty or malformed live payloads", () => {
  expect(parseDeepgramLiveMessage({})).toBeNull();
  expect(parseDeepgramLiveMessage({ channel: { alternatives: [{ transcript: "" }] } })).toBeNull();
  expect(parseDeepgramLiveMessage(null)).toBeNull();
});

test("accumulateLiveText appends finals and replaces the interim", () => {
  const a = accumulateLiveText("", "", { text: "hawthorn", isFinal: false });
  expect(a).toEqual({ finals: "", interim: "hawthorn", display: "hawthorn" });
  const b = accumulateLiveText(a.finals, a.interim, { text: "hawthorn dominant", isFinal: true });
  expect(b).toEqual({ finals: "hawthorn dominant", interim: "", display: "hawthorn dominant" });
  const c = accumulateLiveText(b.finals, b.interim, { text: "on the western", isFinal: false });
  expect(c.display).toBe("hawthorn dominant on the western");
});

test("fake live transcript reveals words over time", () => {
  expect(fakeTranscriptAt(0, FAKE_TRANSCRIPT, 280)).toBe("Hawthorn");
  const later = fakeTranscriptAt(280 * 3, FAKE_TRANSCRIPT, 280);
  expect(later.split(" ").length).toBe(4);
  expect(fakeTranscriptAt(60_000, FAKE_TRANSCRIPT, 280)).toBe(FAKE_TRANSCRIPT);
});
