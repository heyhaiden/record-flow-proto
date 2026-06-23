"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { color, glow, shadow } from "@/lib/design/tokens";

export type RecordMode = "idle" | "ptt" | "handsfree";

/**
 * The circular record button with its pulse rings. Extracted verbatim (visuals)
 * from the original prototype so the spring-scale and ring animation are
 * unchanged. Gesture wiring lives in the parent; this is presentational.
 */
export function RecordButton({
  mode,
  pressing = false,
  size = 96,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
}: {
  mode: RecordMode;
  pressing?: boolean;
  size?: number;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onPointerUp?: (e: ReactPointerEvent) => void;
  onPointerLeave?: (e: ReactPointerEvent) => void;
}) {
  const recording = mode === "ptt" || mode === "handsfree";
  const accent = mode === "handsfree" ? color.plum : color.clay;
  const ringGlow = mode === "handsfree" ? glow.plum : glow.clay;

  let scale = 0.62;
  if (recording) scale = 1;
  else if (pressing) scale = 0.74;

  let bg: string = color.idle;
  if (mode === "ptt") bg = color.clay;
  else if (mode === "handsfree") bg = color.plum;

  const btnStyle: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: `scale(${scale})`,
    transition: "transform .28s cubic-bezier(.34,1.5,.5,1), background .25s, box-shadow .25s",
    boxShadow: recording ? `0 0 0 9px ${ringGlow}` : shadow.rest,
    cursor: "pointer",
    touchAction: "none",
    userSelect: "none",
  };

  const rings: CSSProperties[] = [];
  if (recording) {
    const n = mode === "handsfree" ? 3 : 2;
    const dur = mode === "handsfree" ? 2.3 : 1.9;
    for (let i = 0; i < n; i++)
      rings.push({
        position: "absolute",
        inset: 0,
        margin: "auto",
        width: `${size + 4}px`,
        height: `${size + 4}px`,
        borderRadius: "50%",
        border: `2.5px solid ${accent}`,
        pointerEvents: "none",
        animation: `pulsering ${dur}s ease-out ${((i * dur) / n).toFixed(2)}s infinite`,
      });
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${size + 64}px`,
        height: `${size + 32}px`,
      }}
    >
      {rings.map((r, ri) => (
        <div key={ri} style={r} />
      ))}
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        style={btnStyle}
      >
        {mode === "handsfree" ? (
          <div style={{ width: "30px", height: "30px", background: "#fff", borderRadius: "7px" }} />
        ) : (
          <MicGlyph />
        )}
      </div>
    </div>
  );
}

function MicGlyph() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div style={{ width: "20px", height: "34px", border: "3px solid #fff", borderRadius: "11px" }} />
      <div
        style={{
          width: "26px",
          height: "12px",
          border: "3px solid #fff",
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
        }}
      />
    </div>
  );
}
