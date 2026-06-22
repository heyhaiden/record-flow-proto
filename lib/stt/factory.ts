import type { SttProvider } from "./provider";
import { FakeSttProvider } from "./fake";
import { DeepgramSttProvider } from "./deepgram";

export function getSttProvider(): SttProvider {
  const which = process.env.STT_PROVIDER;
  if (which === "deepgram") {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("DEEPGRAM_API_KEY is not set");
    return new DeepgramSttProvider(key);
  }
  if (!which && process.env.DEEPGRAM_API_KEY) {
    return new DeepgramSttProvider(process.env.DEEPGRAM_API_KEY);
  }
  return new FakeSttProvider(
    "Hawthorn dominant on the western edge, some elder. Badger latrine at the south corner.",
  );
}
