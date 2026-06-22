"use client";

import { color, font, radius } from "@/lib/design/tokens";
import type { CompletenessSummary } from "@/lib/model/types";

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
  const bg = done ? color.greenBg : "#f6ece4";
  return (
    <div
      onClick={done ? undefined : onJumpToGap}
      style={{
        margin: "12px 18px 0",
        padding: "12px 14px",
        borderRadius: radius.xl,
        background: bg,
        border: `1.5px solid ${done ? color.greenBorder : "#e4cdbd"}`,
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
          color: "#fff",
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
        <div style={{ fontSize: "13px", fontWeight: 600, color: done ? color.greenInk : "#7a4a30" }}>
          {done ? "Ready to leave site" : `${summary.outstanding} item${summary.outstanding === 1 ? "" : "s"} to finish`}
        </div>
        <div style={{ fontSize: "11px", color: done ? color.green : "#9a6b4d", marginTop: "1px" }}>
          {summary.detail}
        </div>
      </div>
      {!done && (
        <span style={{ fontFamily: font.mono, fontSize: "11px", color: accent }}>jump ›</span>
      )}
    </div>
  );
}
