# M1: Voice Capture → STT → Transcript Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the prototype's *simulated* transcript with **real microphone capture → server-side speech-to-text (with domain custom-vocabulary) → highlighted transcript** in the existing record-flow UI.

**Architecture:** The browser records push-to-talk audio with `MediaRecorder` (foregrounded, per POC decision) and POSTs the blob to a Next.js route handler `/api/transcribe`. The route runs a **swappable `SttProvider`** (real = Deepgram; `FakeSttProvider` for tests) and returns plain transcript text. A pure `highlightKeywords()` function turns text + the domain **vocabulary config** into the existing `Tok[]` token model so matched terms render highlighted. Hands-free streaming STT is explicitly **out of M1** (needs websockets) — M1 is push-to-talk only.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest (new), Deepgram prerecorded REST API, `MediaRecorder`.

**Scope guardrails (YAGNI):** No LLM extraction (that's M2). No Drive/email (M4). No offline/photos. No auth. Hands-free button stays disabled with a "coming soon" hint in M1.

---

## Conventions

- All commands run from the worktree root: `.worktrees/m1-voice-capture-stt/`.
- Test files live next to source as `*.test.ts`.
- Commit after every task. Commit messages end with the trailer:
  `Co-Authored-By: WOZCODE <contact@withwoz.com>`
- The token model already exists in `app/record-flow.tsx`:
  `interface Tok { text: string; k: number }` — `k`: 0 plain, 1 green, 2 clay.
  We reuse it; shared types move to `lib/types.ts` in Task 2.

---

## Task 1: Add the Vitest test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/smoke.test.ts` (temporary)

**Step 1:** Install dev deps.
```bash
npm install -D vitest@^2
```

**Step 2:** Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", ".worktrees"],
  },
});
```

**Step 3:** Add a script to `package.json` `"scripts"`:
```json
"test": "vitest run"
```

**Step 4:** Write a smoke test `lib/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("harness works", () => {
  expect(1 + 1).toBe(2);
});
```

**Step 5:** Run it. `npm test` → expect 1 passed.

**Step 6:** Delete `lib/smoke.test.ts`, then commit.
```bash
rm lib/smoke.test.ts
git add -A && git commit -m "chore: add Vitest test harness"
```

---

## Task 2: STT provider interface + FakeSttProvider

**Files:**
- Create: `lib/types.ts`
- Create: `lib/stt/provider.ts`
- Create: `lib/stt/fake.ts`
- Test: `lib/stt/fake.test.ts`

**Step 1: Write the failing test** `lib/stt/fake.test.ts`:
```ts
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
```

**Step 2:** Run `npm test` → FAIL (module not found).

**Step 3:** Create `lib/types.ts`:
```ts
export interface Tok {
  text: string;
  k: number; // 0 plain · 1 green highlight · 2 clay/alert highlight
}
```

Create `lib/stt/provider.ts`:
```ts
export interface SttOptions {
  keywords?: string[];
}

export interface SttResult {
  text: string;
}

export interface SttProvider {
  transcribe(audio: Uint8Array, opts?: SttOptions): Promise<SttResult>;
}
```

Create `lib/stt/fake.ts`:
```ts
import type { SttOptions, SttProvider, SttResult } from "./provider";

export class FakeSttProvider implements SttProvider {
  lastKeywords: string[] = [];
  constructor(private readonly scripted: string) {}
  async transcribe(_audio: Uint8Array, opts?: SttOptions): Promise<SttResult> {
    this.lastKeywords = opts?.keywords ?? [];
    return { text: this.scripted };
  }
}
```

**Step 4:** Run `npm test` → PASS.

**Step 5:** Commit.
```bash
git add -A && git commit -m "feat: add SttProvider interface and FakeSttProvider"
```

---

## Task 3: Domain vocabulary config + loader

**Files:**
- Create: `config/vocabulary.json`
- Create: `lib/vocabulary.ts`
- Test: `lib/vocabulary.test.ts`

The vocabulary is the single source of truth used by BOTH the STT custom-vocab
and (later, M2) the LLM glossary.

**Step 1: Write the failing test** `lib/vocabulary.test.ts`:
```ts
import { expect, test } from "vitest";
import { loadVocabulary, vocabularyTerms } from "./vocabulary";

test("loads non-empty vocabulary terms", () => {
  const vocab = loadVocabulary();
  expect(vocab.length).toBeGreaterThan(0);
});

test("vocabularyTerms returns a flat lowercase string list", () => {
  const terms = vocabularyTerms();
  expect(terms).toContain("badger latrine");
  expect(terms.every((t) => t === t.toLowerCase())).toBe(true);
});
```

**Step 2:** Run `npm test` → FAIL.

**Step 3:** Create `config/vocabulary.json` (seed terms — extend freely; this is config, not code):
```json
{
  "terms": [
    { "term": "UKHab", "category": "method" },
    { "term": "soft rush", "category": "species" },
    { "term": "reed canary-grass", "category": "species" },
    { "term": "hawthorn", "category": "species" },
    { "term": "elder", "category": "species" },
    { "term": "oak", "category": "species" },
    { "term": "badger latrine", "category": "protected-trigger" },
    { "term": "bat roost", "category": "protected-trigger" },
    { "term": "protected species", "category": "method" },
    { "term": "hedgerow", "category": "habitat" },
    { "term": "neutral grassland", "category": "habitat" },
    { "term": "lowland meadow", "category": "habitat" }
  ]
}
```

Create `lib/vocabulary.ts`:
```ts
import vocab from "../config/vocabulary.json";

export interface VocabEntry {
  term: string;
  category: string;
}

export function loadVocabulary(): VocabEntry[] {
  return vocab.terms as VocabEntry[];
}

export function vocabularyTerms(): string[] {
  return loadVocabulary().map((e) => e.term.toLowerCase());
}
```

**Step 4:** Ensure `tsconfig.json` has `"resolveJsonModule": true` (it does). Run `npm test` → PASS.

**Step 5:** Commit.
```bash
git add -A && git commit -m "feat: add domain vocabulary config + loader"
```

---

## Task 4: highlightKeywords() — text → Tok[]

**Files:**
- Create: `lib/highlight.ts`
- Test: `lib/highlight.test.ts`

This gives the user's "raw transcript with keywords highlighted" with no LLM —
a pure, case-insensitive, longest-match-first tokenizer.

**Step 1: Write the failing test** `lib/highlight.test.ts`:
```ts
import { expect, test } from "vitest";
import { highlightKeywords } from "./highlight";

test("plain text with no matches is one k=0 token", () => {
  expect(highlightKeywords("nothing here", [])).toEqual([
    { text: "nothing here", k: 0 },
  ]);
});

test("a matched term becomes a k=1 token, case-insensitive", () => {
  const toks = highlightKeywords("Some Hawthorn here", ["hawthorn"]);
  expect(toks).toEqual([
    { text: "Some ", k: 0 },
    { text: "Hawthorn", k: 1 },
    { text: " here", k: 0 },
  ]);
});

test("longest term wins over a shorter overlapping term", () => {
  const toks = highlightKeywords("a badger latrine here", [
    "badger",
    "badger latrine",
  ]);
  expect(toks).toEqual([
    { text: "a ", k: 0 },
    { text: "badger latrine", k: 1 },
    { text: " here", k: 0 },
  ]);
});
```

**Step 2:** Run `npm test` → FAIL.

**Step 3:** Create `lib/highlight.ts`:
```ts
import type { Tok } from "./types";

export function highlightKeywords(text: string, terms: string[]): Tok[] {
  // Longest terms first so multi-word matches win over their prefixes.
  const sorted = [...terms].filter(Boolean).sort((a, b) => b.length - a.length);
  const toks: Tok[] = [];
  let i = 0;
  let plainStart = 0;

  const pushPlain = (end: number) => {
    if (end > plainStart) toks.push({ text: text.slice(plainStart, end), k: 0 });
  };

  while (i < text.length) {
    let matched: string | null = null;
    for (const term of sorted) {
      const slice = text.slice(i, i + term.length);
      if (slice.toLowerCase() === term.toLowerCase()) {
        matched = slice; // preserve original casing
        break;
      }
    }
    if (matched) {
      pushPlain(i);
      toks.push({ text: matched, k: 1 });
      i += matched.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }
  pushPlain(text.length);
  return toks.length ? toks : [{ text, k: 0 }];
}
```

**Step 4:** Run `npm test` → PASS.

**Step 5:** Commit.
```bash
git add -A && git commit -m "feat: add keyword highlighter (text -> Tok[])"
```

---

## Task 5: Deepgram provider + env-selected factory

**Files:**
- Create: `lib/stt/deepgram.ts`
- Create: `lib/stt/factory.ts`
- Test: `lib/stt/deepgram.test.ts`
- Test: `lib/stt/factory.test.ts`

**Step 1: Write the failing test** `lib/stt/deepgram.test.ts` (mock `fetch`, no real key):
```ts
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
```

**Step 2:** Run `npm test` → FAIL.

**Step 3:** Create `lib/stt/deepgram.ts`:
```ts
import type { SttOptions, SttProvider, SttResult } from "./provider";

export class DeepgramSttProvider implements SttProvider {
  constructor(private readonly apiKey: string) {}

  async transcribe(audio: Uint8Array, opts?: SttOptions): Promise<SttResult> {
    const params = new URLSearchParams({ model: "nova-2", smart_format: "true" });
    for (const kw of opts?.keywords ?? []) params.append("keywords", kw);

    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: audio,
    });
    if (!res.ok) {
      throw new Error(`Deepgram error ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const text: string =
      json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return { text };
  }
}
```

**Step 4:** Run `npm test` → PASS.

**Step 5: Write the failing test** `lib/stt/factory.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";
import { getSttProvider } from "./factory";
import { FakeSttProvider } from "./fake";
import { DeepgramSttProvider } from "./deepgram";

afterEach(() => vi.unstubAllEnvs());

test("returns FakeSttProvider when STT_PROVIDER=fake", () => {
  vi.stubEnv("STT_PROVIDER", "fake");
  expect(getSttProvider()).toBeInstanceOf(FakeSttProvider);
});

test("returns Deepgram when STT_PROVIDER=deepgram and key present", () => {
  vi.stubEnv("STT_PROVIDER", "deepgram");
  vi.stubEnv("DEEPGRAM_API_KEY", "k");
  expect(getSttProvider()).toBeInstanceOf(DeepgramSttProvider);
});
```

**Step 6:** Run `npm test` → FAIL.

**Step 7:** Create `lib/stt/factory.ts`:
```ts
import type { SttProvider } from "./provider";
import { FakeSttProvider } from "./fake";
import { DeepgramSttProvider } from "./deepgram";

export function getSttProvider(): SttProvider {
  const which = process.env.STT_PROVIDER ?? "fake";
  if (which === "deepgram") {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("DEEPGRAM_API_KEY is not set");
    return new DeepgramSttProvider(key);
  }
  return new FakeSttProvider(
    "Hawthorn dominant on the western edge, some elder. Badger latrine at the south corner.",
  );
}
```

**Step 8:** Run `npm test` → PASS.

**Step 9:** Commit.
```bash
git add -A && git commit -m "feat: add Deepgram STT provider + env-selected factory"
```

---

## Task 6: /api/transcribe route handler

**Files:**
- Create: `app/api/transcribe/route.ts`
- Test: `app/api/transcribe/route.test.ts`

**Step 1: Write the failing test** `app/api/transcribe/route.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

test("returns highlighted tokens for posted audio (fake provider)", async () => {
  vi.stubEnv("STT_PROVIDER", "fake");
  const { POST } = await import("./route");

  const body = new Uint8Array([1, 2, 3]);
  const req = new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body,
  });

  const res = await POST(req);
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(typeof json.text).toBe("string");
  expect(Array.isArray(json.tokens)).toBe(true);
  // "Hawthorn" and "elder" from the fake transcript should be highlighted
  expect(json.tokens.some((t: { k: number }) => t.k === 1)).toBe(true);
});
```

**Step 2:** Run `npm test` → FAIL.

**Step 3:** Create `app/api/transcribe/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSttProvider } from "@/lib/stt/factory";
import { vocabularyTerms } from "@/lib/vocabulary";
import { highlightKeywords } from "@/lib/highlight";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "empty audio" }, { status: 400 });
  }
  const keywords = vocabularyTerms();
  const provider = getSttProvider();
  const { text } = await provider.transcribe(buf, { keywords });
  const tokens = highlightKeywords(text, keywords);
  return NextResponse.json({ text, tokens });
}
```

**Step 4:** Run `npm test` → PASS. Then `npm run build` → expect success (route compiles).

**Step 5:** Commit.
```bash
git add -A && git commit -m "feat: add /api/transcribe route (STT + keyword highlight)"
```

---

## Task 7: useAudioRecorder hook

**Files:**
- Create: `app/use-audio-recorder.ts`

`MediaRecorder` is browser-only, so this is verified manually (Task 8), not unit
tested. Keep it a thin, well-typed wrapper.

**Step 1:** Create `app/use-audio-recorder.ts`:
```ts
"use client";

import { useCallback, useRef, useState } from "react";

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunks.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    mr.start();
    mediaRecorder.current = mr;
    setRecording(true);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const mr = mediaRecorder.current;
      if (!mr) return resolve(new Blob());
      mr.onstop = () => {
        mr.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        resolve(new Blob(chunks.current, { type: "audio/webm" }));
      };
      mr.stop();
    });
  }, []);

  return { recording, start, stop };
}
```

**Step 2:** `npm run build` → expect success.

**Step 3:** Commit.
```bash
git add -A && git commit -m "feat: add useAudioRecorder hook (MediaRecorder wrapper)"
```

---

## Task 8: Wire real capture into the record-flow UI

**Files:**
- Modify: `app/record-flow.tsx`

Replace the **push-to-talk** simulated stream with real capture. Hands-free
double-tap is disabled in M1 (show "coming soon").

**Step 1 — imports.** Near the top of `app/record-flow.tsx`, add:
```ts
import { useAudioRecorder } from "./use-audio-recorder";
```
and change the `Tok` import to come from shared types — replace the local
`interface Tok {...}` with:
```ts
import type { Tok } from "@/lib/types";
```

**Step 2 — hook + transcribing state.** Inside the component, near the other
state, add:
```ts
const recorder = useAudioRecorder();
const [transcribing, setTranscribing] = useState(false);
```

**Step 3 — real PTT.** Replace the body of `startPTT` so that instead of
`beginStream("ptt")` it starts the recorder and flips mode to `ptt`:
```ts
const startPTT = useCallback(() => {
  if (modeRef.current !== "idle") return;
  setMode("ptt");
  setShowLive(true);
  setLive([]);
  recorder.start().catch(() => {
    setMode("idle");
    setShowLive(false);
  });
}, [recorder]);
```

**Step 4 — stop + transcribe.** Replace `stopRecording` so PTT release stops the
recorder, POSTs the blob, and appends the highlighted tokens as a committed note:
```ts
const stopRecording = useCallback(async () => {
  setMode("idle");
  setShowLive(false);
  setPressing(false);
  if (!recorder.recording) return;
  setTranscribing(true);
  const blob = await recorder.stop();
  try {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: blob,
    });
    const json = (await res.json()) as { tokens: Tok[] };
    if (json.tokens?.length) {
      const marker = sessionFirst.current
        ? timeQueue.current.shift() ?? { time: "12:00", gap: "later" }
        : null;
      sessionFirst.current = false;
      setNotes((prev) => [...prev, { marker, toks: json.tokens }]);
    }
  } finally {
    setTranscribing(false);
    setLive([]);
  }
}, [recorder]);
```
> Note: `stopRecording` is now `async`. Its callers (`onBtnUp`, `onBtnLeave`)
> already call it without awaiting — that's fine. Remove the now-unused
> `beginStream`/`tick`/`commitLive` simulated-stream code for the PTT path, OR
> leave them only for hands-free. Keep the diff minimal: delete `streamTimer`
> usage tied to PTT. Run the build after to catch unused-var errors.

**Step 5 — disable hands-free in M1.** In `registerTap`, replace the
double-tap branch that calls `startHandsfree()` with a no-op that briefly sets
the sub-hint to "hands-free coming soon" (or simply do nothing). Update `subHint`
idle text to: `"hold to talk · release to transcribe"`.

**Step 6 — show transcribing state.** Where `showLive` renders the live caret
block, when `transcribing` is true render a small caption instead:
```tsx
{transcribing && (
  <div style={{ fontSize: "13px", color: "#a7a49c", fontFamily: "'Spline Sans Mono',monospace" }}>
    transcribing…
  </div>
)}
```

**Step 7 — verify build + types.** Run:
```bash
npm run build
```
Expected: compiles, no type errors, no unused-variable lint failures. Fix any
fallout from removing the simulated-stream code.

**Step 8 — manual verification (the real test).** Run `npm run dev`, open the
app, allow mic access, **press & hold** the button, say *"hawthorn dominant,
some elder, badger latrine at the south corner,"* release. With
`STT_PROVIDER=fake` (default) you get the scripted transcript appended with
"Hawthorn", "elder", "badger latrine" highlighted. Set `STT_PROVIDER=deepgram` +
`DEEPGRAM_API_KEY` in `.env.local` to hear your own words transcribed.

**Step 9:** Commit.
```bash
git add -A && git commit -m "feat: wire real mic capture + STT into record-flow (PTT)"
```

---

## Task 9: Env example, README note, final verify

**Files:**
- Create: `.env.example`
- Create: `README.md` (or append if present)

**Step 1:** Create `.env.example`:
```bash
# STT provider: "fake" (default, no key needed) or "deepgram"
STT_PROVIDER=fake
# Required only when STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=
```

**Step 2:** Add a README section documenting: `npm run dev`, the
`STT_PROVIDER` switch, and that M1 is push-to-talk only (hands-free + offline +
LLM extraction are later milestones).

**Step 3:** Final gates:
```bash
npm test        # all green
npm run build   # compiles
```

**Step 4:** Commit.
```bash
git add -A && git commit -m "docs: add .env.example and M1 README"
```

---

## Definition of Done (M1)

- `npm test` green; `npm run build` clean.
- Press-and-hold records real mic audio; release transcribes via the configured
  provider and appends a highlighted note in the existing UI.
- `STT_PROVIDER` swaps fake ↔ Deepgram with no code change.
- Domain vocabulary lives in `config/vocabulary.json` and feeds both the STT
  custom-vocab and the highlighter.
- Hands-free, offline, LLM extraction, Drive/email are untouched and clearly
  deferred.
