import type { CSSProperties } from "react";
import { color } from "@/lib/design/tokens";

type DotTone = "idle" | "clay" | "plum" | "green" | "amber" | "red";

const TONE: Record<DotTone, string> = {
  idle: color.fainter,
  clay: color.clay,
  plum: color.plum,
  green: color.green,
  amber: color.amber,
  red: color.red,
};

/** Small status dot; blinks when `live` (reuses the `blink` keyframe). */
export function StatusDot({
  tone = "idle",
  live = false,
  size = 8,
  style,
}: {
  tone?: DotTone;
  live?: boolean;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        display: "inline-block",
        background: TONE[tone],
        animation: live ? "blink 1.4s ease-in-out infinite" : "none",
        flex: "none",
        ...style,
      }}
    />
  );
}
