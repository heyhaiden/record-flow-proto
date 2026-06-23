# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A field-recording PWA for UK ecologists running **Biodiversity Net Gain (BNG)
condition assessments** and **Preliminary Ecological Appraisal (PEA) walkovers**.
The surveyor records a voice walk-through on site; it is transcribed, parsed into
structured form fields, and triaged so they know the report is **complete before
they leave site**. The defensible value is *methodology-aware completeness
checking*, not transcription.

The full product spec and decision log live in
`docs/plans/2026-06-21-field-to-form-bng-pea-mvp-design.md` — read it before
making product-shape decisions. Milestones: M1 = voice capture + STT (current),
M2 = LLM field extraction, M4 = Drive/email export.

## Commands

```bash
npm run dev      # Next.js dev server (http://localhost:3000)
npm test         # Vitest — all *.test.ts (runs in node env, no watch)
npm run build    # tsc type-check via Next + production build
npm run lint     # next lint
```

Run a single test file: `npx vitest run lib/highlight.test.ts`
Watch mode: `npx vitest` (default `npm test` is `vitest run`, one-shot).

Tests use the `@/` alias (mapped to repo root in both `tsconfig.json` and
`vitest.config.ts`). Test env is `node` — there is no jsdom; React components are
not unit-tested, only the `lib/` logic is.

## Architecture

The app is a Next.js 15 App Router project (React 19). Everything is local/
client-side — there is **no database**. State lives in `localStorage` behind a
repository seam, and several integrations are mocked behind interfaces so the
real implementation drops in without touching screens.

### The data model (read this first)

`lib/model/types.ts` is the spine. The model is **parcel-first**:
`Visit → Parcels + Features`. The key idea is the `Field<T>` wrapper:

```ts
interface Field<T> { value: T | null; evidence: string | null; status: TriageStatus }
```

Every captured value carries (a) the value, (b) the **verbatim transcript span**
it came from, and (c) a triage status: `green` (confident) / `amber` (inferred,
needs a look) / `red` (missing). This triple drives the entire review UI and the
completeness banner. When you add a field, wrap it in `Field<T>` and set status
honestly — don't default everything to green.

`visitCompleteness()` / `parcelCompleteness()` in the same file compute the
"X outstanding" banner. Outstanding = any field that is `red` or `amber`, plus
not-assessed criteria, plus protected-species triggers missing a follow-up.

### Provider seams (mocked, swappable by interface)

- **STT** — `lib/stt/`. `SttProvider` interface; `factory.ts` (`getSttProvider`)
  selects `fake` (default, scripted transcript, no key) or `deepgram` via the
  `STT_PROVIDER` env var. Server-only (used in the API route). Copy
  `.env.example` → `.env.local` to configure.
- **Persistence** — `lib/store/visit-store.tsx`. `VisitRepository` interface with
  a `LocalStorageVisitRepository` implementation. The `VisitStoreProvider` React
  context is the only way screens touch storage; they never call localStorage
  directly. `hydrated` is false until the client has read storage (SSR-safe).
- **Drive/export** — `lib/store/connections.ts`. Mock Google Drive connection in
  localStorage; the real OAuth `DestinationProvider` lands at M4.

When extending, keep the screens talking to the interface, not the implementation.

### Capture → form pipeline

1. **Record screen** uses `useCapture` (`lib/capture/use-capture.ts`) — owns mic
   permission lifecycle, push-to-talk gesture (hold ≥200ms = record, release =
   send), wake lock, haptics, and the robustness states (`no-speech`, `stt`,
   `offline`, `interrupted`). M1 is push-to-talk batch only; the `handsfree`
   mode is stubbed in the enum for the future path.
2. It posts the audio blob via `transcribeAudio` (`lib/capture/transcribe-client.ts`)
   to `POST /api/transcribe` (`app/api/transcribe/route.ts`, `runtime = "nodejs"`).
3. The route runs STT, then `highlightKeywords` (`lib/highlight.ts`) against the
   domain vocabulary and returns `{ text, tokens }`. Tokens (`Tok[]`) are
   pre-highlighted spans so the client just renders them.
4. **Review screen** turns transcript into `Field`s. `lib/model/gap-fill.ts`
   parses values from speech (area, condition); `lib/model/review-gaps.ts`
   (`collectReviewGaps`) enumerates outstanding gaps and provides `apply(visit,
   text)` updaters so each gap can be filled by voice/typing.

### Domain config (data, not code)

Driven by JSON in `config/`:
- `vocabulary.json` — UKHab species / habitat / protected-species terms used for
  STT keyword boosting and transcript highlighting (`lib/vocabulary.ts`).
- `habitat-conditions.json` — per-habitat condition criteria + Good/Moderate/Poor
  scoring rules. Bridged into the model by `lib/model/conditions.ts`
  (`criteriaFor`, `habitatById`). Only ~two habitats are fully wired (grassland +
  hedgerow) so triage is genuine.
- `ecology-forms.json` — form schemas (BNG, PEA, bat PRA, etc.), loaded via
  `lib/model/form-schemas.ts` and surfaced through `lib/model/forms.ts`.

### Design system

`lib/design/tokens.ts` is the single source of truth for the bespoke warm
aesthetic (colours, fonts, spacing, shadows) — values lifted verbatim from the
original prototype. `TriageStatus` and the `triage()` colour resolver also live
here. Use these tokens rather than hardcoding hex/px; styling is inline-style
based (no Tailwind/CSS modules beyond `app/globals.css`).

### Routes

- `app/page.tsx` — lobby (visit list, guided demo, create freestyle)
- `app/visit/[id]/record` → `processing` → `review` → `export` — the core loop
- `app/settings/connections` — mock Drive connection

`buildGuidedDemo`/`buildFreestyle`/`seedVisits` in `lib/model/seed.ts` provide the
demo data. The guided demo ships a stubbed desk study with intentional gaps to
drive the gap-fill "aha"; don't "fix" those gaps.

## Conventions

- Two seed model versions exist (`record-flow:visits:v2`, legacy `:v1` is purged
  on load). Bump the key when the model shape changes incompatibly.
- ID generation goes through `newId(prefix)` in `lib/id.ts`.
- Mock/integration code carries comments naming the milestone where the real
  thing lands (M2/M4/V1) — preserve those markers when editing.
