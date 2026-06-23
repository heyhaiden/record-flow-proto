"use client";

import { color, font, radius } from "@/lib/design/tokens";

export interface CompletenessSummary {
  /** Items still missing/needing review across the whole visit. */
  outstanding: number;
  /** Total items tracked. */
  total: number;
  /** Short human line, e.g. "Parcel 1 ✓ · Parcel 2: 2 missing". */
  detail: string;
}

/**
 * The "ready to leave?" banner. Green + reassuring when complete; clay + nudging
 * when gaps remain. Tapping when incomplete jumps to the first gap.
 */
export function CompletenessBanner({
  summary,
  onJumpToGap,
}: {
  summary: CompletenessSummary;
  onJumpToGap?: () => void;
}) {
  const done = summary.outstanding === 0;
  const accent = done ? color.green : color.clay;
  const bg = done ? color.greenBg : color.clayTint;
  return (
    <div
      onClick={done ? undefined : onJumpToGap}
      style={{
        margin: "12px 18px 0",
        padding: "12px 14px",
        borderRadius: radius.xl,
        background: bg,
        border: `1.5px solid ${done ? color.greenBorder : color.warnBorder}`,
        display: "flex",
        alignItems: "center",
        gap: "11px",
        cursor: done ? "default" : "pointer",
      }}
    >
      <span
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: accent,
          color: color.onAccent,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          flex: "none",
        }}
      >
        {done ? "✓" : summary.outstanding}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: done ? color.greenInk : color.warnInk }}>
          {done ? "Ready to leave site" : `${summary.outstanding} item${summary.outstanding === 1 ? "" : "s"} to finish`}
        </div>
        <div style={{ fontSize: "11px", color: done ? color.green : color.warnSubtle, marginTop: "1px" }}>
          {summary.detail}
        </div>
      </div>
      {!done && (
        <span style={{ fontFamily: font.mono, fontSize: "11px", color: accent }}>jump ›</span>
      )}
    </div>
  );
}
