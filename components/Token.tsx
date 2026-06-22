import type { CSSProperties, ReactNode } from "react";
import { color } from "@/lib/design/tokens";

/**
 * Inline highlighted transcript span. Extends the original `styleFor` (which had
 * only plain/green/clay) with an amber state for three-way triage.
 *
 * k convention (kept backward-compatible with lib/types.ts + highlight.ts):
 *   0 = plain · 1 = green (confirmed term) · 2 = clay/red (alert) · 3 = amber (inferred)
 */
export function tokenStyle(k: number): CSSProperties {
  if (k === 1)
    return {
      background: color.greenBg,
      borderBottom: `2px solid ${color.green}`,
      borderRadius: "2px",
      padding: "0 2px",
    };
  if (k === 2)
    return {
      background: color.redBg,
      borderBottom: `2px solid ${color.red}`,
      borderRadius: "2px",
      padding: "0 2px",
      color: color.redInk,
      fontWeight: 500,
    };
  if (k === 3)
    return {
      background: color.amberBg,
      borderBottom: `2px solid ${color.amber}`,
      borderRadius: "2px",
      padding: "0 2px",
      color: color.amberInk,
    };
  return {};
}

export function Token({ k, children }: { k: number; children: ReactNode }) {
  return <span style={tokenStyle(k)}>{children}</span>;
}
