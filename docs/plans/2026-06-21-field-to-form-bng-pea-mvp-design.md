# Field-to-Form: Voice-Driven BNG/PEA Capture — MVP/POC Design

**Date:** 2026-06-21
**Status:** Validated (brainstorming complete), pre-implementation

---

## 1. The value proposition

We are not selling transcription (commoditised). We are selling **executive
function**: an ecologist knows a site report is **complete before they leave
site**, instead of discovering gaps at 9pm after three site visits, hunting
through broken notes and unlabelled photos.

> **Aha moment:** "I finished this report standing in the field."

The defensible, ICP-specific value is **methodology-aware completeness
checking** — the app knows what a valid BNG condition assessment / PEA walkover
*requires* and tells the surveyor what they *didn't say*. These are the same
gaps that would be caught in QA, surfaced on site while memory is fresh.

**ICP:** UK ecologists running Biodiversity Net Gain (BNG) condition
assessments and Preliminary Ecological Appraisal (PEA) walkovers on site.

---

## 2. Scope

**Wedge:** BNG condition assessment is the structured core; PEA walkover context
rides along on the same site visit (one walk → both layers).

### In scope (POC)
- BNG parcel capture + PEA context, evidence-linked.
- **One** polished Google Docs output template.
- **Two** habitat types fully wired with real condition criteria (e.g. lowland
  grassland + hedgerow) so green/orange/red is genuine — not all of UKHab.
- Online only; capture-while-foregrounded PWA.
- Confidence triage UI (green / orange / red).
- Voice (and typed) gap-fill on the review screen.
- Auto-sync finished doc to Google Drive + optional "email to client."
- Guided demo site (hero) + freestyle path (for believers).

### Out of scope — deferred
- **V1.5:** Offline capture + queued sync; native wrapper (Capacitor) for true
  background/pocket recording on iOS; in-app photo capture.
- **V2:** Defensibility / audit trail (retained audio + geotag + timestamp per
  field); self-serve form builder; multi-client config UI; real auth/RBAC.

> Rationale for deferring offline: most UK sites have service. The ROI is
> immediate parsing + gap detection, not connectivity.

---

## 3. The POC demo flow (the aha, step by step)

1. Surveyor records a ~60–90s walk-through — one or two habitat parcels + a
   target note. Real voice, real STT.
2. Finish → "Processing…" → **"Report ready"** in seconds.
3. Open it: BNG parcel form + PEA context, filled.
   - **Green** = confident (valid value + clear evidence).
   - **Orange** = inferred / ambiguous / needs a look.
   - **Red** = not captured / required-but-missing.
4. **Aha beat:** completeness banner — *"Parcel 1 ✓ complete. Parcel 2: 2 items
   missing."* Flagged gaps are real methodology gaps.
5. Surveyor taps a red item and **answers by voice** — "Parcel 2's about half a
   hectare, moderate condition" — and watches it flip **green**, live.
6. Complete → finished branded doc **syncs to Google Drive** + **email to
   client** option.

Emotional payload is steps 4–5: the relief of finishing on site.

---

## 4. Architecture

```
record (PWA, foregrounded)
  → finish → upload audio
    → STT (managed cloud, custom vocabulary)
      → LLM extraction (structured output → schema JSON)
        → derive confidence + clarifying questions
          → "Report ready"
            → triage review (type OR voice gap-fill)
              → on complete: merge into Google Docs template
                → sync to Drive folder (+ optional email)
```

### Components
- **Capture:** Web app (PWA), `MediaRecorder`, capture-while-foregrounded.
  Audio buffered locally, uploaded on finish.
- **STT:** Managed cloud provider (Deepgram or AssemblyAI) with
  **custom-vocabulary** support so domain terms ("g3c", *Crataegus*, "soft
  rush", "badger latrine") transcribe correctly. **Behind a swappable
  interface** — Whisper self-host is the V1.5 option for clients needing data
  residency.
- **LLM extraction:** Structured output / tool-calling (latest Claude model).
  Returns, per field: `value`, `evidence` (verbatim transcript span), derived
  `status`. **No RAG** — bounded schema, so domain knowledge is injected via
  pick-lists + a curated glossary in the system prompt. RAG only revisited if
  the knowledge base grows large.
- **Confidence (derived, never self-reported):**
  - Green = valid pick-list value **and** clear supporting span.
  - Orange = inferred, ambiguous, or free-text needing review.
  - Red = no span / required-but-missing.
- **Clarifying questions:** LLM emits one per orange/red field; these drive the
  voice gap-fill prompts.
- **Output:** Merge into the client's own Google Doc template (documented merge
  tokens + a repeating parcel block) → sync to their Drive folder. Email option
  uses a template.

---

## 5. Capture schema (the standardized data model)

The data model is **standardized and methodology-driven — we own it.** The
*document* it lands in is the client's (see §6). This split is what eliminates
per-client customization debt.

- **Visit:** site name, date, surveyor, weather/conditions, grid ref / GPS.
- **PEA walkover context** (narrative, evidence-linked): habitat mosaic
  description, protected-species triggers (badger latrine, bat roost features,
  etc.), target notes (point observations), recommendation flags.
- **BNG core** — repeating **habitat parcels**, each:
  - `ukhab_type` → drives distinctiveness
  - `area_ha` (or `length_km` for hedgerows / watercourses)
  - `condition` (Good / Moderate / Poor) via the condition-criteria checklist
    for that habitat
  - `criteria_met` (which criteria were assessed)
- Every field carries `value` + `evidence` span + `status`.

---

## 6. Config layer — "no customization debt"

Three configurable artifacts, none requiring code per client:

1. **Capture schema** — one canonical PEA/BNG schema authored as declarative
   config (YAML/JSON): fields, types, pick-lists, voice hints. New client later
   = new schema file, not new code.
2. **Domain vocabulary** — one config file (UKHab codes + names, common species
   Latin + vernacular, condition-criteria phrases, protected-species triggers).
   Used in **both** STT custom vocab **and** the LLM glossary. Single source of
   truth; enriching it is config.
3. **Output template** — the client's **own Google Doc**, with documented merge
   tokens. They fork our polished default and edit prose / branding / order
   themselves in a tool they already use. **We never touch their document.**

Onboarding = "here's your template, connect your Drive." Self-serve. This is
both the debt-killer and a value driver (clients get a professional,
methodology-correct template).

---

## 7. Tech stack

- **Next.js (App Router) PWA + React** — already scaffolded; the existing
  record-flow prototype is ~70% of the capture/review shell.
- STT + LLM behind **provider interfaces** (swappable per original requirement).
- Claude (latest model) for extraction via structured output.
- **Google Drive + Docs API** for template fill + sync.

---

## 8. Risks & open questions

- **Google Docs repeating-section templating** (one block per habitat parcel)
  is the only non-trivial templating problem — needs a token-block-expansion or
  Docs API structural-insert approach. Prototype early.
- **Condition-criteria fidelity** for the two wired habitats: the red flags must
  be *real* QA gaps or Eleanor won't trust it. Source criteria from current
  CIEEM / statutory metric guidance; validate with a practising ecologist.
- **Confidence calibration:** "green" must be trustworthy. Tune thresholds
  against real field audio.
- **STT on Latin species names** even with custom vocab — measure, fall back to
  orange when uncertain.
- **iOS PWA**: mic permission + keep-awake during foreground capture.

---

## 9. Milestones

- **M1** — record → STT → transcript (extend existing prototype).
- **M2** — LLM extraction to BNG schema + green/orange/red triage UI.
- **M3** — voice gap-fill on the review screen.
- **M4** — Google Doc merge + Drive sync + email.
- **M5** — tune the guided demo site; enable freestyle path.

---

## Cast / decisions log (who decided what)

- **Output = filled form** (evidence-linked), triage UI, auto-sync to Drive.
- **Confidence = evidence spans**, not self-reported numbers (also pre-builds V2
  defensibility).
- **Form decoupling:** standardized capture schema (ours) + customizable Google
  Docs output template (theirs).
- **Wedge:** BNG-first, PEA walkover context captured alongside.
- **Platform:** capture-while-foregrounded PWA for POC; native wrapper V1.5.
- **Offline:** deferred to V1.5 — the ROI is completeness/executive-function,
  not connectivity.
- **STT/LLM:** managed STT + custom vocab; Claude structured output; no RAG.
- **Demo:** guided demo site as hero, freestyle as secondary.
- **Storage/destination:** Google Drive + Google Docs first, behind a pluggable
  "destination" interface. The deliverable is a formal document, so the
  production connector is chosen by the first design partner's stack (most
  likely Microsoft 365 / SharePoint). **Notion rejected** — it's a tech-startup
  tool the ICP doesn't use, planning authorities won't accept a Notion link, and
  "it has an MCP" is a dev convenience, not a customer benefit.
- **Positioning (key):** We are a **supplemental capture tool for rapid by-eye
  condition calls as desk evidence** — NOT a system of measurement. We do not
  compete with ArcGIS / satellite / specialist metric tools, and we do not
  compute the authoritative statutory metric score. Field judgements are
  captured, structured, completeness-checked, and handed back as evidence that
  feeds the surveyor's existing desk process. We may show a *provisional*
  condition read, clearly labelled "field estimate — confirm at desk."
- **BNG source data:** condition criteria are sourced from the Statutory
  Biodiversity Metric — Condition Assessments (Natural England/Defra, **Open
  Government Licence v3.0**) — freely usable. Structured into
  `config/habitat-conditions.json` (status: PROVISIONAL, pending SME validation).
- **Per-habitat scoring (M2 design note):** the Good/Moderate/Poor rule is **not
  one formula** — grassland uses *criteria-count with an essential criterion*;
  hedgerow uses *failure-count with a per-functional-group rule* (and a separate
  with-trees variant). So the schema config carries a per-habitat `scoring`
  block, and green/orange/red triage runs **per criterion**; overall parcel
  condition is computed from those.
- **POC habitats:** Modified grassland (low distinctiveness) + Native hedgerow
  (without trees). UKHab typing referenced (separate UKHab licence); PEA report
  structure encoded as factual sections only (CIEEM guidelines not reproduced).
- **Desk-study-first / ground-truthing workflow:** Support a flow where a desk
  study (satellite/GIS) defines parcels + provisional UKHab types *before* the
  visit; on site the surveyor **ground-truths** them (confirm/correct + assess
  condition). This sharpens the completeness aha to "you haven't assessed
  parcel 4 *at all*."
  - **Suggested/default, never enforced.** Blank-slate field capture (create
    parcels on the fly by voice) must always work — workflows differ per
    consultancy. One parcel-first data model, two entry points.
  - **Override rule (load-bearing for good science):** preloaded data is a
    *hypothesis the field confirms or overturns*, not a locked answer. One-tap
    override, and capture *why* it changed as evidence (a defensibility win).
  - **We consume GIS output, never rebuild it:** import is accepting their
    existing export (GeoJSON/shapefile/CSV) — a V1 feature, not POC.
  - **POC handling:** the guided demo site ships a **stubbed preloaded desk
    study** (2–3 parcels with provisional types) to demonstrate the closed loop;
    the real importer is deferred to V1. Data model goes parcel-first now.
