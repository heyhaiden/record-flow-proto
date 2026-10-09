import type { CSSProperties, ReactNode } from "react";
import { color, font, shadow } from "@/lib/design/tokens";

/**
 * The 480px / full-height mobile frame that every screen lives inside.
 * Lifted from the root <div> of the original record-flow prototype.
 */
export function AppShell({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        height: "100dvh",
        width: "100%",
        maxWidth: "480px",
        margin: "0 auto",
        background: color.surface,
        overflow: "hidden",
        fontFamily: font.body,
        boxShadow: shadow.frame,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          // View Transitions morph this pane; the 480px frame stays put.
          viewTransitionName: "app-page",
        }}
      >
        {children}
      </div>
    </div>
  );
}
