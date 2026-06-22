"use client";

import type { ReactNode } from "react";
import { color, radius, shadow } from "@/lib/design/tokens";

/**
 * Slide-up sheet anchored inside the 480px frame. Used for the parcel switcher
 * and the voice gap-fill prompt. Tapping the scrim or the grab handle dismisses.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {/* scrim */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(28,28,26,.28)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .25s ease",
          zIndex: 40,
        }}
      />
      {/* sheet */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: color.surface,
          borderRadius: `${radius.xxl} ${radius.xxl} 0 0`,
          boxShadow: shadow.sheet,
          transform: open ? "translateY(0)" : "translateY(110%)",
          transition: "transform .3s cubic-bezier(.34,1.2,.5,1)",
          zIndex: 41,
          maxHeight: "80%",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
        }}
      >
        <div
          onClick={onClose}
          style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", cursor: "grab" }}
        >
          <div style={{ width: "42px", height: "5px", borderRadius: "3px", background: "#d8d5cd" }} />
        </div>
        {title && (
          <div
            style={{
              padding: "4px 20px 12px",
              fontSize: "15px",
              fontWeight: 600,
              color: color.ink,
              borderBottom: `1.5px solid ${color.borderSoft}`,
            }}
          >
            {title}
          </div>
        )}
        <div style={{ overflowY: "auto", padding: "12px 18px 4px" }}>{open ? children : null}</div>
      </div>
    </>
  );
}
