import { ScreenHeader } from "@/components/ScreenHeader";
import { color, font, radius } from "@/lib/design/tokens";

export function RouteTransition({
  title = "Temporal",
  eyebrow = "FIELD MEMOS",
  message = "Opening next step...",
}: {
  title?: string;
  eyebrow?: string;
  message?: string;
}) {
  return (
    <>
      <ScreenHeader title={title} eyebrow={eyebrow} />
      <div
        style={{
          flex: 1,
          padding: "20px 18px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "14px",
          background: color.surface,
        }}
      >
        <div
          style={{
            border: `1.5px solid ${color.borderSoft}`,
            borderRadius: radius.xl,
            padding: "16px",
            background: color.surface,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              aria-hidden="true"
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: color.clay,
                animation: "blink 1s ease-in-out infinite",
                flex: "none",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: 600, color: color.body }}>{message}</span>
          </div>
          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "7px" }}>
            <SkeletonLine width="86%" />
            <SkeletonLine width="62%" />
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: "10.5px", color: color.faint, textAlign: "center" }}>
          keeping your field memo ready
        </div>
      </div>
    </>
  );
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      style={{
        width,
        height: "9px",
        borderRadius: radius.pill,
        background: color.borderSoft,
      }}
    />
  );
}
