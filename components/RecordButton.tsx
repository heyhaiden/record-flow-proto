"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { color, glow, shadow } from "@/lib/design/tokens";

export type RecordMode = "idle" | "ptt" | "handsfree";

/**
 * The circular record button with its pulse rings. Gesture-hardened for mobile
 * browsers — prevents selection, callouts, and double-tap zoom on hold/double-tap.
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
  onPointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const recording = mode === "ptt" || mode === "handsfree";
  const accent = mode === "handsfree" ? color.plum : color.clay;
  const ringGlow = mode === "handsfree" ? glow.plum : glow.clay;

  // iOS Safari needs non-passive touch listeners to allow preventDefault.
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const blockTouch = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchstart", blockTouch, { passive: false });
    el.addEventListener("touchmove", blockTouch, { passive: false });
    return () => {
      el.removeEventListener("touchstart", blockTouch);
      el.removeEventListener("touchmove", blockTouch);
    };
  }, []);

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
    border: "none",
    padding: 0,
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
    WebkitTapHighlightColor: "transparent",
    WebkitTouchCallout: "none",
    outline: "none",
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

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onPointerDown?.(e);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onPointerUp?.(e);
  };

  const handlePointerLeave = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onPointerLeave?.(e);
  };

  const label =
    mode === "handsfree" ? "Recording hands-free, tap to stop" : "Hold to record, double-tap for hands-free";

  return (
    <div
      className="gesture-lock"
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
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        className="gesture-lock"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={btnStyle}
      >
        {mode === "handsfree" ? (
          <div style={{ width: "30px", height: "30px", background: "#fff", borderRadius: "7px", pointerEvents: "none" }} />
        ) : (
          <MicGlyph />
        )}
      </button>
    </div>
  );
}

function MicGlyph() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        pointerEvents: "none",
      }}
    >
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
