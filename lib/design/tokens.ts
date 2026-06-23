/**
 * Design tokens — single source of truth for the Record Flow aesthetic.
 *
 * Values were lifted verbatim from the original inline styles in
 * app/record-flow.tsx so the bespoke warm look is preserved exactly. The one
 * deliberate addition is the `amber` triage colour: the prototype only had two
 * highlight states (green / clay) but the product needs a true three-way triage
 * (confident / inferred / missing).
 */

export const color = {
  // surfaces
  appBg: "#e7e5df",
  surface: "#fff",

  // text
  ink: "#1c1c1a",
  body: "#3a3833",
  muted: "#55534d",
  subtle: "#8a877f",
  faint: "#a7a49c",
  fainter: "#bdbab2",

  // accents
  clay: "#a8674e", // push-to-talk / primary CTA
  clayTint: "#f6ece4", // selected / active warm tint (light clay wash)
  plum: "#7c6585", // hands-free
  idle: "#b0ada4", // resting record button

  // borders
  border: "#d4d1c9",
  borderSoft: "#ece9e1",
  borderSofter: "#e6e3db",
  hair: "#f0eee7",
  grabber: "#d8d5cd", // drag-handle / sheet grabber bar

  // triage — green / amber / red
  green: "#5f7a5b",
  greenBg: "#eef2ec",
  greenBorder: "#d9e0d6",
  greenInk: "#2a3a28",

  amber: "#b07a1e", // NEW — inferred / needs-a-look
  amberBg: "#f6efdc",
  amberBorder: "#e6d6a8",
  amberInk: "#6b4e12",

  red: "#b5604e", // missing / required
  redBg: "#f6e0dc",
  redInk: "#7a2f28",
} as const;

export const font = {
  body: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
  mono: "'Spline Sans Mono',monospace",
  hand: "'Caveat',cursive",
} as const;

export const radius = {
  xs: "2px",
  sm: "7px",
  md: "8px",
  lg: "11px",
  xl: "13px",
  xxl: "14px",
  pill: "999px",
  circle: "50%",
} as const;

export const space = {
  xs: "4px",
  sm: "8px",
  md: "11px",
  lg: "16px",
  xl: "20px",
  xxl: "26px",
} as const;

export const shadow = {
  frame: "0 0 0 1px rgba(0,0,0,.04)",
  rest: "0 4px 12px rgba(0,0,0,.12)",
  cta: "0 6px 16px rgba(168,103,78,.28)",
  sheet: "0 -8px 30px rgba(0,0,0,.16)",
} as const;

/** Glow colours used behind the record button while capturing. */
export const glow = {
  clay: "rgba(168,103,78,.2)",
  plum: "rgba(124,101,133,.22)",
} as const;

export type TriageStatus = "green" | "amber" | "red";

/** Resolve a triage status to its display colours (bg / border / ink). */
export function triage(status: TriageStatus) {
  if (status === "green")
    return { bg: color.greenBg, border: color.green, ink: color.greenInk };
  if (status === "amber")
    return { bg: color.amberBg, border: color.amber, ink: color.amberInk };
  return { bg: color.redBg, border: color.red, ink: color.redInk };
}
