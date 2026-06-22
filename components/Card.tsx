"use client";

import type { CSSProperties, ReactNode } from "react";
import { color, radius } from "@/lib/design/tokens";

/** Generic rounded container. */
export function Card({
  children,
  onClick,
  tone = "plain",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "plain" | "green" | "muted";
  style?: CSSProperties;
}) {
  const border =
    tone === "green" ? color.greenBorder : tone === "muted" ? color.borderSofter : color.border;
  const bg = tone === "green" ? color.greenBg : color.surface;
  const baseStyle: CSSProperties = {
    padding: "13px 14px",
    border: `1.5px solid ${border}`,
    background: bg,
    borderRadius: radius.xl,
    cursor: onClick ? "pointer" : "default",
    ...style,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          display: "block",
          width: "100%",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
        }}
      >
        {children}
      </button>
    );
  }

  return <div style={baseStyle}>{children}</div>;
}

/**
 * A horizontal row: icon/marker · {title, subtitle} · trailing.
 * Covers the lobby cards, parcel rows, and review list items.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  titleColor = color.body,
  subtitleColor = color.faint,
  onClick,
  tone = "plain",
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  titleColor?: string;
  subtitleColor?: string;
  onClick?: () => void;
  tone?: "plain" | "green" | "muted";
}) {
  return (
    <Card onClick={onClick} tone={tone}>
      <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
        {leading}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13.5px", fontWeight: 600, color: titleColor }}>
            {title}
          </div>
          {subtitle != null && (
            <div style={{ fontSize: "11px", color: subtitleColor, marginTop: "1px" }}>
              {subtitle}
            </div>
          )}
        </div>
        {trailing}
      </div>
    </Card>
  );
}
