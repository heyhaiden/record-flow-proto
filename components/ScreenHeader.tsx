import type { CSSProperties, ReactNode } from "react";
import { color } from "@/lib/design/tokens";

/**
 * Top bar shared by every screen. Optional `eyebrow` (mono kicker), a `title`,
 * a `left` slot (e.g. status dot / back) and a `right` slot (e.g. the
 * active-parcel chip on the record screen).
 */
export function ScreenHeader({
  title,
  eyebrow,
  left,
  right,
  style,
}: {
  title: ReactNode;
  eyebrow?: string;
  left?: ReactNode;
  right?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px",
        padding: "26px 20px 12px",
        borderBottom: `1.5px solid ${color.borderSoft}`,
        flex: "none",
        ...style,
      }}
    >
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
        {left}
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div
              style={{
                fontFamily: "'Spline Sans Mono',monospace",
                fontSize: "10px",
                letterSpacing: ".14em",
                color: color.faint,
                marginBottom: "2px",
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: color.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
        </div>
      </div>
      {right}
    </div>
  );
}
