"use client";

import type { CSSProperties, ReactNode } from "react";
import { color, font, radius, shadow } from "@/lib/design/tokens";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, CSSProperties> = {
  primary: {
    background: color.clay,
    color: "#fff",
    border: "1.5px solid transparent",
    boxShadow: shadow.cta,
  },
  secondary: {
    background: color.surface,
    color: color.body,
    border: `1.5px solid ${color.border}`,
  },
  ghost: {
    background: "transparent",
    color: color.muted,
    border: "1.5px solid transparent",
  },
};

export function Button({
  children,
  onClick,
  onPointerDown,
  variant = "primary",
  full = false,
  disabled = false,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  onPointerDown?: () => void;
  variant?: Variant;
  full?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "13px 18px",
        borderRadius: radius.xxl,
        fontFamily: font.body,
        fontSize: "14px",
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        width: full ? "100%" : undefined,
        opacity: disabled ? 0.5 : 1,
        transition: "transform .15s ease, opacity .2s ease",
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
