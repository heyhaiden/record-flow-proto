import { expect, test } from "vitest";
import { FakeSttProvider } from "./fake";

test("fake provider returns its scripted transcript", async () => {
  const provider = new FakeSttProvider("badger latrine at the south corner");
  const result = await provider.transcribe(new Uint8Array([1, 2, 3]), {
    keywords: ["badger latrine"],
  });
  expect(result.text).toBe("badger latrine at the south corner");
});

test("fake provider records the keywords it was given", async () => {
  const provider = new FakeSttProvider("x");
  await provider.transcribe(new Uint8Array(), { keywords: ["oak", "elder"] });
  expect(provider.lastKeywords).toEqual(["oak", "elder"]);
});
