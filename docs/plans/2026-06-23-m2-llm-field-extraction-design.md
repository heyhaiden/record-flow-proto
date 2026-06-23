# M2: LLM Field Extraction — Design

**Date:** 2026-06-23
**Status:** Validated (brainstorming complete), pre-implementation
**Depends on:** M1 voice capture + STT (shipped). Builds on the parcel-first
data model in `lib/model/types.ts` and the MVP design doc
(`2026-06-21-field-to-form-bng-pea-mvp-design.md`).

---

## 1. What M2 is

M2 turns a recorded walk-through into a filled, evidence-linked report. Today the
record screen captures a transcript and the review screen shows triaged fields —
but **nothing connects them**: the captured notes live in local component state
and are dropped on "finish", the `/processing` screen runs fake timers, and the
review screen only ever shows what `seed.ts` pre-filled. The regex parsers
(`parseAreaFromSpeech`, `parseConditionFromSpeech`) are used solely for manual
voice gap-fill on the review screen; they never touch the walk-through.

So M2 is **not** "bolt an LLM onto processing." It is three things:

1. **Persist the captured transcript** into the visit (with structured target
   refs), instead of dropping it.
2. **Extract** structured field values from that transcript with an LLM.
3. **Merge** the extraction into the visit's `Field<T>` values, assigning the
   green/amber/red triage and the evidence spans that drive the review UI and the
   completeness banner.

The LLM replaces both the seed pre-fill and the regex stubs as the transformer
that produces a real report from real speech.

### Scope decision: both paths run real extraction (choice B)

Both the guided demo (Oakfield Meadow) and the freestyle path run live
extraction. The guided demo's reliability is preserved by the `fake` extractor,
which returns a deterministic canned extraction for the demo's canned transcript
— no API key, works offline. Only configured-live runs depend on a network call.
For the guided demo, the stubbed desk study supplies provisional parcel types as
**priors** that the extractor confirms or overrides.

---

## 2. Architecture

### 2.1 The extractor seam

A new `lib/extract/` directory mirrors the existing `lib/stt/` provider seam, so
the screens depend on an interface, not an implementation:

- `provider.ts` — the `Extractor` interface:
  `extract(input: ExtractionInput): Promise<ExtractionResult>`.
- `factory.ts` — `getExtractor()` reads the `EXTRACT_PROVIDER` env var and
  returns `fake` (default) or `claude`.
- `fake.ts` — `FakeExtractor`. Returns canned output for the guided-demo
  transcript; for freestyle, a light heuristic that reuses the existing
  `parseAreaFromSpeech` / `parseConditionFromSpeech` helpers. No API key; drives
  tests and the offline demo.
- `claude.ts` — `ClaudeExtractor`. The structured-output call (see §4).
- `merge.ts` — the pure merge + triage function (see §3.3). Not a provider; the
  deterministic core both providers feed.

This matches M1's pattern exactly (`SttProvider` / `getSttProvider` / `fake` /
`deepgram`), down to the env-var selector.

### 2.2 Data flow

1. **Record screen** persists transcript notes **into the visit**, each carrying
   a structured target ref (`{kind: "parcel", parcelId}` / `{kind: "site"}` /
   `{kind: "feature"}`) — not just the display `targetLabel` it stores today, and
   not just local state. This is the prerequisite wiring.
2. On finish, the **processing screen** calls `POST /api/extract` with
   `{ transcript notes, desk-study priors }`.
3. The route runs `getExtractor().extract(...)` and returns a structured
   **patch**.
4. The processing screen applies the patch with `mergeExtraction(visit, patch)`
   (pure function), saves the merged visit through the existing
   `useVisitStore().updateVisit`, then routes to `/review`.

The processing screen keeps its existing three-beat animation; the real
round-trip slots in behind it.

### 2.3 Why one whole-transcript call (not per-target)

The notes are pre-segmented by target (the record-screen switcher), but real
surveyors ramble and don't always switch the target chip. So we send the **whole
transcript in one call**, passing the target tags and desk-study types as
**strong hints** in the prompt rather than as hard routing. This survives messy
speech and cross-references ("the badger latrine I mentioned earlier was actually
in Parcel 1"), keeps it to a single round-trip, and keeps the merge logic simple.

### 2.4 Division of responsibility (the load-bearing decision)

**The LLM proposes; the merge code decides triage.** The model returns each value
with its evidence span and a bounded `confidence` enum. It never stamps the
green/amber/red state directly. All triage derivation and desk-study
reconciliation live in `merge.ts` — deterministic, unit-testable, and identical
across the fake and real providers.

---

## 3. The extraction contract

### 3.1 `ExtractionInput` (what we send)

- The transcript notes, each tagged with its target hint.
- Each existing parcel: its desk-study provisional type and the list of criteria
  ids available for its habitat (so the model can only mark criteria that exist).
- The site-context slots to fill (weather, access, designations,
  recommendations).

### 3.2 `ExtractionResult` (the schema-constrained patch)

Constrained by a Zod schema via structured outputs. Per parcel:

- `ukhabType`, `area` (+ `areaUnit`), `condition` (enum `Good | Moderate | Poor`)
- `criteria`: list of `{ id, state: pass | fail | not-assessed }`
- `reconciliation` (parcel type only): enum `confirms | overrides | silent`

Plus:

- `features`: list of `{ kind, text, parcelRef, followUp }`
- `siteContext`: the four context values

**Every extracted value carries three fields:** `value`, `evidence` (verbatim
transcript span), and `confidence` (`high | medium | low`).

### 3.3 Triage derivation + reconciliation (in `merge.ts`)

Base triage:

| Model signal | Triage |
|---|---|
| `confidence: high` + evidence present | **green** |
| `confidence: medium` / inferred | **amber** |
| value missing / not mentioned | **red** |

Desk-study reconciliation for parcel type (choice-B logic):

- `confirms` → green; value = confirmed type; `Parcel.status: "confirmed"`.
- `overrides` → value = new type; `Parcel.status: "overridden"`; capture
  `overrideReason` from the evidence; triage green/amber per confidence.
- `silent` → **keep the desk-study type as a hypothesis but mark it amber.** This
  is the "you walked the parcel but never confirmed its type" nudge — the
  methodology-aware completeness value, not an error.

`merge.ts` returns a new `Visit` (immutable update), leaving the existing
`visitCompleteness` / `parcelCompleteness` functions to recompute the banner from
the merged `Field` statuses unchanged.

---

## 4. The Claude call (`claude.ts`)

- **Model:** `claude-opus-4-8`.
- **Structured outputs:** `client.messages.parse()` with
  `output_config: { format: zodOutputFormat(ExtractionSchema) }`, so the response
  is schema-valid JSON — no defensive free-text parsing.
- **Thinking:** adaptive (`thinking: { type: "adaptive" }`) — the
  evidence-grounding and reconciliation reasoning warrants it; `effort` tuned
  during implementation.
- **Runtime:** server-side only, in the API route (`runtime = "nodejs"`), exactly
  like `/api/transcribe`. The `@anthropic-ai/sdk` is the dependency.
- **Key:** `ANTHROPIC_API_KEY`, required only when `EXTRACT_PROVIDER=claude`
  (mirrors `DEEPGRAM_API_KEY` gating). Add both to `.env.example`.

The system prompt states the BNG/PEA methodology, the triage definitions
(green = confident value + clear evidence; amber = inferred; the model emits
`confidence`, not the colour), the verbatim-evidence requirement, and the
desk-study reconciliation instruction.

Note: structured-output schemas don't support numeric min/max or string-length
constraints — fine here (we validate `area > 0` etc. in merge code, the existing
pattern).

---

## 5. Error handling

The extraction round-trip degrades the same way M1's transcribe route does — the
captured data is never lost:

- **Extractor failure / network error** (live only): the route returns an error;
  the processing screen surfaces a non-destructive banner ("Couldn't auto-fill —
  your notes are saved; fill the report by voice") and routes to `/review` with
  the transcript persisted and fields left `red`/`amber`. The existing review
  gap-fill path then handles everything manually. No data loss.
- **Empty / no usable transcript:** skip the call; go straight to review with the
  seeded/empty visit.
- **Malformed model output:** `messages.parse()` guarantees schema validity; a
  parse failure is treated as an extractor failure (above).
- **Offline:** the processing screen detects offline and behaves as the failure
  case; re-extraction can be retried from review later (deferred polish).

---

## 6. Testing

Vitest, node env, following the existing `lib/**/*.test.ts` convention:

- `lib/extract/merge.test.ts` — the core. Triage derivation for each
  confidence/evidence combination; all three reconciliation branches
  (`confirms` / `overrides` / `silent`); immutability; completeness recompute.
- `lib/extract/fake.test.ts` — canned guided-demo output and the freestyle
  heuristic.
- `lib/extract/factory.test.ts` — env-var selection + missing-key guard (mirrors
  `lib/stt/factory.test.ts`).
- `app/api/extract/route.test.ts` — empty input → 400; happy path returns a
  patch (mirrors `app/api/transcribe/route.test.ts`).

The `claude.ts` provider is not unit-tested against the live API; the seam keeps
all logic under test on the `fake` path. Manual verification runs the guided demo
end-to-end with `EXTRACT_PROVIDER=fake`, then a live spot-check with `=claude`.

---

## 7. Out of scope (deferred)

- Re-extraction / "re-run auto-fill" from the review screen (M2.1 polish).
- Photo or geotag evidence (V2, per the MVP decision log).
- Per-field audit trail / retained audio (V2 defensibility).
- Streaming the extraction into the UI — a single `parse()` call returns the
  whole patch; the processing animation covers the latency.

---

## 8. Build sequence

1. Persist transcript notes into the visit with structured target refs (record
   screen + `lib/model/types.ts`).
2. `lib/extract/` skeleton: `provider.ts`, `factory.ts`, schema, `merge.ts`
   (TDD — `merge.test.ts` first).
3. `fake.ts` + tests; wire processing screen → `/api/extract` → merge → review on
   the fake path. Guided demo works end-to-end offline.
4. `app/api/extract/route.ts` + test.
5. `claude.ts` structured-output call; `.env.example`; live spot-check.
