# Design System

The Record Flow look is a bespoke, warm aesthetic driven by **design tokens**, not
a CSS framework. Styling is inline-style based (React `style={{...}}`); there is
no Tailwind, no CSS modules beyond `app/globals.css` (which holds only resets,
`@font-face`/Google-font loading, and `@keyframes`).

**Single source of truth:** `lib/design/tokens.ts`. Every color, font, radius,
spacing, and shadow value lives there. Components import and reference tokens —
they do **not** hardcode hex/px/font-family literals inline.

## Rules

1. **No hardcoded literals in component styles.** Use a token. Adding a literal
   hex/font-family/shadow inline is a regression — add or reuse a token instead.
2. **No Tailwind / no new styling library.** The inline-style + token approach is
   the deliberate, current convention. (A Tailwind migration was considered and
   deferred.)
3. **A new token must be a real, reused system value** — not a one-off. If a value
   appears once and isn't conceptually part of the palette, it can stay inline
   (and should be noted), rather than polluting the token set.
4. **Triage colors go through `triage()`** (see below), never hand-picked.

## Token categories (`lib/design/tokens.ts`)

| Export | What it holds | Use for |
|---|---|---|
| `color` | surfaces, text greys, accents (`clay`, `plum`, `idle`), the warm `clayTint`, borders, the `grabber` bar, and the triage palette | every color value |
| `font` | `body` (Inter), `mono` (Spline Sans Mono), `hand` (Caveat) | every `fontFamily` |
| `radius` | `xs`→`xxl`, `pill`, `circle` | corner radii |
| `space` | `xs`(4) → `xxl`(26) | padding / gap / margin where a value matches the scale |
| `shadow` | `frame`, `rest`, `cta`, `sheet` | box shadows |
| `glow` | `clay`, `plum` | the record-button capture glow |

Notable colors: `clay` is the primary CTA / push-to-talk accent; `clayTint`
(`#f6ece4`) is the light warm wash for **selected/active** states (parcel chips,
switcher rows, lobby cards); `grabber` is the drag-handle bar on sheets;
`surface` (`#fff`) is the card/sheet background (also used for white text on
accent fills).

## Triage convention

The three-way confidence triage — **green** (confident) / **amber** (inferred,
needs a look) / **red** (missing) — is the product's core visual language. Each
status has a background / border / ink triple.

**Always resolve via the `triage(status)` helper:**

```ts
import { triage } from "@/lib/design/tokens";
const t = triage(field.status); // { bg, border, ink }
```

Do not hand-pick `color.greenBg` / `color.amberInk` / etc. per-status in a
component — that re-implements `triage()` and drifts.

> ⚠️ Known inconsistency to resolve: `triage()` currently returns the **solid**
> accent (`color.green`/`amber`/`red`) as its `border`, while several call sites
> use the **soft** `*Border` tokens (`greenBorder`, `amberBorder`) for their
> borders. These produce different borders. Pick one convention before migrating
> the remaining hand-rolled call sites onto `triage()` — see the design-pass
> report.

## Adding a token

1. Confirm the value is reused (or clearly belongs to the palette).
2. Add it to the right category in `tokens.ts` with a one-line comment on intent.
3. Reference it everywhere the literal appeared. Verify the value byte-matches so
   appearance is unchanged.
