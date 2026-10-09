# M2 Field Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn a recorded walk-through transcript into filled, evidence-linked, triaged report fields via an LLM extractor behind a provider seam.

**Architecture:** Persist transcript notes into the `Visit` with structured target refs → `POST /api/extract` runs `getExtractor().extract()` (fake heuristic by default, Claude structured-output when configured) → a pure `mergeExtraction(visit, patch)` applies values and derives green/amber/red triage + desk-study reconciliation → processing screen saves the merged visit and routes to review. The LLM proposes `value + evidence + confidence`; merge code decides triage. Mirrors the existing `lib/stt/` seam.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest (node env), `@anthropic-ai/sdk` + `zod` (added in Task 6). Path alias `@/`.

**Working dir:** `.worktrees/m2-extraction` (branch `feat/m2-field-extraction`). Run all commands from there.

**Design ref:** `docs/plans/2026-06-23-m2-llm-field-extraction-design.md`.

---

### Task 1: Transcript model — structured notes on the Visit

**Files:**
- Modify: `lib/model/types.ts` (add `NoteTarget`, `TranscriptNote`; add optional `transcript` to `Visit`)
- Test: `lib/model/transcript.test.ts` (Create)

`transcript` is **optional** so existing localStorage visits (storage key `v2`) deserialize without migration; treat missing as `[]`.

**Step 1 — failing test** (`lib/model/transcript.test.ts`):
```ts
import { expect, test } from "vitest";
import { transcriptText, type TranscriptNote } from "./types";

const notes: TranscriptNote[] = [
  { id: "n1", text: "Hawthorn dominant.", target: { kind: "parcel", parcelId: "p1" }, capturedAt: "14:30" },
  { id: "n2", text: "Badger latrine south corner.", target: { kind: "feature" }, capturedAt: "14:32" },
];

test("transcriptText joins note text with newlines", () => {
  expect(transcriptText(notes)).toBe("Hawthorn dominant.\nBadger latrine south corner.");
});

test("transcriptText is empty for no notes", () => {
  expect(transcriptText([])).toBe("");
});
```

**Step 2 — run, expect FAIL** (`transcriptText` undefined): `npx vitest run lib/model/transcript.test.ts`

**Step 3 — implement** in `lib/model/types.ts`:
```ts
export type NoteTarget =
  | { kind: "parcel"; parcelId: string }
  | { kind: "site" }
  | { kind: "feature" };

export interface TranscriptNote {
  id: string;
  text: string;
  target: NoteTarget;
  capturedAt: string;
}

export function transcriptText(notes: TranscriptNote[]): string {
  return notes.map((n) => n.text).join("\n");
}
```
Add to the `Visit` interface: `transcript?: TranscriptNote[];`

**Step 4 — run, expect PASS.**

**Step 5 — commit:** `feat(model): add structured transcript notes to Visit`

---

### Task 2: Extraction schema + types

**Files:**
- Create: `lib/extract/schema.ts`
- Test: `lib/extract/schema.test.ts`

Defines the wire contract. `ExtractedValue<T>` carries `value | evidence | confidence`. Zod schema added in Task 6 with the Claude provider (keep the hand-written TS types here so merge/fake don't depend on zod).

**Step 1 — failing test** (`lib/extract/schema.test.ts`):
```ts
import { expect, test } from "vitest";
import { isConfidence } from "./schema";

test("isConfidence accepts the enum, rejects junk", () => {
  expect(isConfidence("high")).toBe(true);
  expect(isConfidence("medium")).toBe(true);
  expect(isConfidence("low")).toBe(true);
  expect(isConfidence("definitely")).toBe(false);
});
```

**Step 2 — run, expect FAIL.**

**Step 3 — implement** (`lib/extract/schema.ts`):
```ts
import type { Condition, CriterionState, FeatureKind } from "@/lib/model/types";

export type Confidence = "high" | "medium" | "low";
export function isConfidence(s: string): s is Confidence {
  return s === "high" || s === "medium" || s === "low";
}

export interface ExtractedValue<T> {
  value: T | null;
  evidence: string | null;
  confidence: Confidence;
}

export type Reconciliation = "confirms" | "overrides" | "silent";

export interface ParcelPatch {
  parcelId: string;
  ukhabType?: ExtractedValue<string>;
  reconciliation?: Reconciliation;
  area?: ExtractedValue<number>;
  condition?: ExtractedValue<Condition>;
  criteria?: { id: string; state: CriterionState; evidence?: string | null }[];
}

export interface FeaturePatch {
  kind: FeatureKind;
  text: string;
  parcelRef?: string | null;
  followUp?: string | null;
}

export interface SiteContextPatch {
  weather?: ExtractedValue<string>;
  access?: ExtractedValue<string>;
  designations?: ExtractedValue<string>;
  recommendations?: ExtractedValue<string>;
}

export interface ExtractionPatch {
  parcels: ParcelPatch[];
  features: FeaturePatch[];
  siteContext: SiteContextPatch;
}

/** What the route sends the extractor. */
export interface ExtractionInput {
  transcript: { text: string; target: import("@/lib/model/types").NoteTarget }[];
  parcels: { id: string; name: string; deskStudyType: string | null; criteriaIds: string[] }[];
}
```

**Step 4 — run, expect PASS.**

**Step 5 — commit:** `feat(extract): add extraction schema + types`

---

### Task 3: `mergeExtraction` — the deterministic core (TDD)

**Files:**
- Create: `lib/extract/merge.ts`
- Test: `lib/extract/merge.test.ts`

This is the heart. Triage table: `value==null → red`; `evidence empty → amber`; `confidence high + evidence → green`; else `amber`. Reconciliation: `confirms → green + status "confirmed"`; `overrides → triage-by-confidence + status "overridden" + overrideReason`; `silent → keep desk-study type as amber hypothesis`.

**Step 1 — failing tests** (`lib/extract/merge.test.ts`): cover, at minimum —
- high+evidence → green; medium → amber; missing → red (an area field across a parcel).
- reconciliation `confirms` → ukhabType green, parcel.status "confirmed".
- reconciliation `overrides` → status "overridden", overrideReason set from evidence.
- reconciliation `silent` with a deskStudyOrigin → ukhabType value == desk type, status amber.
- a `protected-species` feature patch with `followUp` appends a Feature with followUp set.
- merge is immutable (input visit unchanged).

Build the input visit with `buildGuidedDemo()` from `@/lib/model/seed` (has a desk-study parcel) plus a hand-built empty parcel where useful.

**Step 2 — run, expect FAIL.**

**Step 3 — implement** (`lib/extract/merge.ts`):
```ts
import {
  field,
  newFeatureId,
  type Feature,
  type Field,
  type Parcel,
  type TriageStatus,
  type Visit,
} from "@/lib/model/types";
import { newId } from "@/lib/id";
import type { ExtractedValue, ExtractionPatch, ParcelPatch } from "./schema";

function triageFor<T>(v: ExtractedValue<T> | undefined): TriageStatus {
  if (!v || v.value == null) return "red";
  if (!v.evidence?.trim()) return "amber";
  return v.confidence === "high" ? "green" : "amber";
}

function toField<T>(v: ExtractedValue<T> | undefined): Field<T> {
  if (!v || v.value == null) return field<T>(null, v?.evidence ?? null, "red");
  return field<T>(v.value, v.evidence, triageFor(v));
}

function mergeParcel(parcel: Parcel, patch: ParcelPatch | undefined): Parcel {
  if (!patch) return parcel;
  let next: Parcel = { ...parcel };

  // --- type + desk-study reconciliation ---
  const t = patch.ukhabType;
  const desk = parcel.deskStudyOrigin?.ukhabType ?? null;
  if (patch.reconciliation === "confirms" && t?.value != null) {
    next.ukhabType = field(t.value, t.evidence, "green");
    next.status = "confirmed";
  } else if (patch.reconciliation === "overrides" && t?.value != null) {
    next.ukhabType = field(t.value, t.evidence, triageFor(t));
    next.status = "overridden";
    next.overrideReason = t.evidence ?? undefined;
  } else if (desk) {
    next.ukhabType = field(desk, null, "amber"); // silent → hypothesis
  } else {
    next.ukhabType = toField(t);
  }

  if (patch.area) next.area = toField(patch.area);
  if (patch.condition) next.condition = toField(patch.condition);

  if (patch.criteria?.length) {
    next.criteria = parcel.criteria.map((c) => {
      const hit = patch.criteria!.find((x) => x.id === c.id);
      return hit ? { ...c, state: hit.state, evidence: hit.evidence ?? c.evidence } : c;
    });
  }
  return next;
}

export function mergeExtraction(visit: Visit, patch: ExtractionPatch): Visit {
  const parcels = visit.parcels.map((p) =>
    mergeParcel(p, patch.parcels.find((pp) => pp.parcelId === p.id)),
  );

  const newFeatures: Feature[] = patch.features.map((f) => ({
    id: newId("f"),
    kind: f.kind,
    text: field(f.text, f.text, "green"),
    parcelRef: f.parcelRef ?? null,
    followUp:
      f.kind === "protected-species"
        ? field(f.followUp ?? null, f.followUp ?? null, f.followUp ? "green" : "red")
        : null,
  }));

  const sc = visit.siteContext;
  const p = patch.siteContext;
  return {
    ...visit,
    parcels,
    features: [...visit.features, ...newFeatures],
    siteContext: {
      weather: p.weather ? toField(p.weather) : sc.weather,
      access: p.access ? toField(p.access) : sc.access,
      designations: p.designations ? toField(p.designations) : sc.designations,
      recommendations: p.recommendations ? toField(p.recommendations) : sc.recommendations,
    },
  };
}
```
(If `newFeatureId` isn't worth adding, use `newId("f")` as shown — remove the unused import.)

**Step 4 — run, expect PASS.** Iterate until green.

**Step 5 — commit:** `feat(extract): mergeExtraction with triage + desk-study reconciliation`

---

### Task 4: Extractor seam — provider, factory, fake (TDD)

**Files:**
- Create: `lib/extract/provider.ts`, `lib/extract/factory.ts`, `lib/extract/fake.ts`
- Test: `lib/extract/fake.test.ts`, `lib/extract/factory.test.ts`

`fake.ts` is a deterministic heuristic (no canned-string special-case — DRY): per note, route by `target`; reuse `parseAreaFromSpeech`/`parseConditionFromSpeech` from `lib/model/gap-fill`; keyword-match habitat/species against the transcript for type + features. Good enough for offline demo + tests.

**provider.ts:**
```ts
import type { ExtractionInput, ExtractionPatch } from "./schema";
export interface Extractor {
  extract(input: ExtractionInput): Promise<ExtractionPatch>;
}
```

**factory.ts** (mirror `lib/stt/factory.ts`):
```ts
import type { Extractor } from "./provider";
import { FakeExtractor } from "./fake";
import { ClaudeExtractor } from "./claude";

export function getExtractor(): Extractor {
  if ((process.env.EXTRACT_PROVIDER ?? "fake") === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    return new ClaudeExtractor(key);
  }
  return new FakeExtractor();
}
```
(`claude.ts` lands in Task 6; until then stub the import or do Task 6 before wiring the factory — keep factory test on the fake path.)

**fake.test.ts:** given an input with a parcel note "lowland meadow, about 2.5 hectares, condition good" targeting `p1`, expect the patch parcel for `p1` has `area.value === 2.5`, `condition.value === "Good"`, and a `ukhabType` value. Given a feature note mentioning "badger", expect a `protected-species` feature.

**factory.test.ts:** mirror `lib/stt/factory.test.ts` — `EXTRACT_PROVIDER=fake` → `FakeExtractor`; `=claude` + key → `ClaudeExtractor`; `=claude` no key → throws. (Use `vi.stubEnv` / `vi.unstubAllEnvs`.)

Commit each: `feat(extract): Extractor interface + factory`, `feat(extract): deterministic fake extractor`.

---

### Task 5: `POST /api/extract` route (TDD)

**Files:**
- Create: `app/api/extract/route.ts`, `app/api/extract/route.test.ts`

Mirror `app/api/transcribe/route.ts` (`runtime = "nodejs"`). Body = `ExtractionInput` JSON. Empty transcript → 400. Else `getExtractor().extract(input)` → `NextResponse.json(patch)`.

**route.test.ts:** POST empty `{transcript:[],parcels:[]}` → 400; POST a one-note input → 200 with a `parcels` array (fake path). Mirror the transcribe route test's `Request` construction.

Commit: `feat(api): add /api/extract route`.

---

### Task 6: Claude provider (structured outputs) + deps + env

**Files:**
- Create: `lib/extract/claude.ts`
- Modify: `lib/extract/schema.ts` (add `ExtractionPatchSchema` zod), `.env.example`
- Install: `npm install @anthropic-ai/sdk zod`

`claude.ts` uses `client.messages.parse({ model: "claude-opus-4-8", thinking: { type: "adaptive" }, output_config: { format: zodOutputFormat(ExtractionPatchSchema) }, ... })`. System prompt: BNG/PEA methodology, verbatim-evidence requirement, emit `confidence` not colour, desk-study reconciliation instruction. Build the user message from `ExtractionInput`. Map `response.parsed_output` → `ExtractionPatch` (shapes match).

`.env.example` additions:
```
# Field extraction: "fake" (default, no key) or "claude"
EXTRACT_PROVIDER=fake
# Required only when EXTRACT_PROVIDER=claude
ANTHROPIC_API_KEY=
```

Not unit-tested against the live API (seam keeps logic on the fake path). Type-check: `npm run build`.

Commit: `feat(extract): Claude structured-output extractor`.

---

### Task 7: Wire the UI (record persists notes; processing extracts + merges)

**Files:**
- Modify: `app/visit/[id]/record/page.tsx` (persist notes into the visit on commit, with structured target)
- Modify: `app/visit/[id]/processing/page.tsx` (call `/api/extract` → `mergeExtraction` → `updateVisit` → route to review)

**Record screen:** in `onCommit`, in addition to local `setNotes`, append a `TranscriptNote` to the visit via `updateVisit(id, ...)` with the structured `target` derived from the current `target` state (carry the `parcelId` for parcel targets) and `text` = joined `toks`. The typed-fallback path (`addTyped`) does the same.

**Processing screen:** replace the pure-timer effect — read the visit's `transcript`; if empty, route to review unchanged. Else build `ExtractionInput` (transcript + parcels with `deskStudyType`/`criteriaIds`), `POST /api/extract`, `mergeExtraction(visit, patch)`, `updateVisit(id, () => merged)`, then route to review. Keep the three-beat animation as the latency cover. On fetch error: show the existing-style banner copy ("Couldn't auto-fill — your notes are saved"), still route to review (fields stay red/amber; manual gap-fill handles the rest). No data loss.

**Verify:** `npm test` (all green) + `npm run build`. Manual: `EXTRACT_PROVIDER=fake npm run dev`, run guided demo end-to-end, confirm review shows merged fields with triage; spot-check freestyle.

Commit: `feat(extract): wire record persistence + processing extraction`.

---

## Sequence summary
1. Transcript model → 2. Schema → 3. merge (core, TDD) → 4. provider/factory/fake → 5. API route → 6. Claude provider + deps → 7. UI wiring + manual verify.

Frequent commits per task. DRY (reuse `gap-fill` parsers, mirror `lib/stt/`). YAGNI (no re-extraction UI, no streaming — deferred per design §7).
