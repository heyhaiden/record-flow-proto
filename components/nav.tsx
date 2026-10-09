"use client";

import { useRouter } from "next/navigation";
import { color, font } from "@/lib/design/tokens";
import { back, navigate } from "@/lib/nav";
import { Button } from "./Button";

/** Compact circular back chevron for screen headers. */
export function BackButton({ onClick }: { onClick?: () => void }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={onClick ?? (() => back(router))}
      aria-label="Back"
      style={{
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        border: `1.5px solid ${color.border}`,
        background: color.surface,
        color: color.body,
        fontSize: "16px",
        lineHeight: 1,
        cursor: "pointer",
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      ‹
    </button>
  );
}

/** Friendly fallback when a visit id isn't in the store. */
export function NotFound() {
  const router = useRouter();
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: font.hand, fontSize: "24px", color: color.subtle }}>
        Visit not found
      </div>
      <Button variant="secondary" onClick={() => navigate(router, "/")}>
        Back to lobby
      </Button>
    </div>
  );
}
