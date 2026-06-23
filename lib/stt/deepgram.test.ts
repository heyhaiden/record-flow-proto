import { afterEach, expect, test, vi } from "vitest";
import { DeepgramSttProvider } from "./deepgram";

afterEach(() => vi.restoreAllMocks());

test("parses transcript from Deepgram response shape", async () => {
  const fakeResponse = {
    results: {
      channels: [{ alternatives: [{ transcript: "hawthorn dominant" }] }],
    },
  };
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify(fakeResponse), { status: 200 }),
    );

  const provider = new DeepgramSttProvider("test-key");
  const result = await provider.transcribe(new Uint8Array([1, 2, 3]), {
    keywords: ["hawthorn"],
  });

  expect(result.text).toBe("hawthorn dominant");
  expect(fetchMock).toHaveBeenCalledOnce();
  const url = fetchMock.mock.calls[0][0] as string;
  expect(url).toContain("api.deepgram.com");
  expect(url).toContain("keywords=hawthorn");
});

test("throws on non-200", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("nope", { status: 401 }),
  );
  const provider = new DeepgramSttProvider("bad");
  await expect(provider.transcribe(new Uint8Array())).rejects.toThrow();
});
