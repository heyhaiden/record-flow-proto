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
  size = 72,
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
    boxShadow: recording ? `0 0 0 6px ${ringGlow}` : shadow.rest,
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
        width: `${size + 40}px`,
        height: `${size + 16}px`,
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
          <div style={{ width: "22px", height: "22px", background: color.surface, borderRadius: "5px" }} />
        ) : (
          <MicGlyph size={size} />
        )}
      </div>
    </div>
  );
}

/** Small mic circle for “answer by voice” triggers outside the main record dock. */
export function RecordMicMark({ diameter = 36, active = false }: { diameter?: number; active?: boolean }) {
  const bg = active ? color.clay : color.idle;
  return (
    <div
      style={{
        width: diameter,
        height: diameter,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        boxShadow: active ? `0 0 0 4px ${glow.clay}` : shadow.rest,
        transition: "background .2s, box-shadow .2s",
      }}
    >
      <MicGlyph size={diameter * 1.15} />
    </div>
  );
}

function MicGlyph({ size = 72 }: { size?: number }) {
  const s = size / 96;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: `${3 * s}px` }}>
      <div
        style={{
          width: `${16 * s}px`,
          height: `${26 * s}px`,
          border: `${2.5 * s}px solid ${color.surface}`,
          borderRadius: `${9 * s}px`,
        }}
      />
      <div
        style={{
          width: `${20 * s}px`,
          height: `${9 * s}px`,
          border: `${2.5 * s}px solid ${color.surface}`,
          borderTop: "none",
          borderRadius: `0 0 ${11 * s}px ${11 * s}px`,
        }}
      />
    </div>
  );
}
