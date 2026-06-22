import type { CSSProperties, ReactNode } from "react";
import { font, radius, triage, type TriageStatus } from "@/lib/design/tokens";

/** A small pill conveying a triage status (green/amber/red) with optional label. */
export function TriageChip({
  status,
  children,
  style,
}: {
  status: TriageStatus;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const t = triage(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "2px 8px",
        borderRadius: radius.pill,
        background: t.bg,
        border: `1.5px solid ${t.border}`,
        color: t.ink,
        fontFamily: font.mono,
        fontSize: "10.5px",
        fontWeight: 500,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: t.border,
        }}
      />
      {children}
    </span>
  );
}
