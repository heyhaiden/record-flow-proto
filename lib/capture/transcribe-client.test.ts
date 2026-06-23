import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./transcribe-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transcribeAudio", () => {
  it("POSTs the blob and returns the tokens from the response", async () => {
    const tokens = [
      { text: "Mature ", k: 0 },
      { text: "oak", k: 1 },
      { text: " on the boundary.", k: 0 },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Mature oak on the boundary.", tokens }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const blob = new Blob(["audio-bytes"], { type: "audio/webm" });
    const result = await transcribeAudio(blob);

    expect(result).toEqual(tokens);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/transcribe");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(blob);
  });

  it("returns an empty array for an empty blob without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudio(new Blob([]));

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "stt failed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcribeAudio(new Blob(["x"], { type: "audio/webm" }))).rejects.toThrow();
  });
});
