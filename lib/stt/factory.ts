import type { SttProvider } from "./provider";
import { FAKE_TRANSCRIPT, FakeSttProvider } from "./fake";
import { DeepgramSttProvider } from "./deepgram";

export function getSttProvider(): SttProvider {
  const which = process.env.STT_PROVIDER ?? "fake";
  if (which === "deepgram") {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("DEEPGRAM_API_KEY is not set");
    return new DeepgramSttProvider(key);
  }
  return new FakeSttProvider(FAKE_TRANSCRIPT);
}
