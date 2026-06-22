"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { color, font } from "@/lib/design/tokens";

/**
 * Transient "Processing…" → "Report ready" beat (design doc step 2). Mocked
 * timing now; the real STT + LLM extraction pipeline slots in behind this.
 */
const STEPS = ["Transcribing your walk-through", "Extracting parcels & features", "Checking completeness"];

export default function ProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => timers.push(setTimeout(() => setStep(i + 1), 650 * (i + 1))));
    timers.push(setTimeout(() => setReady(true), 650 * STEPS.length + 400));
    timers.push(setTimeout(() => router.replace(`/visit/${id}/review`), 650 * STEPS.length + 1500));
    return () => timers.forEach(clearTimeout);
  }, [id, router]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "26px",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          border: `3px solid ${color.borderSoft}`,
          borderTopColor: ready ? color.green : color.clay,
          animation: ready ? "none" : "spin 0.9s linear infinite",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color.green,
          fontSize: "26px",
          transition: "border-color .3s",
        }}
      >
        {ready ? "✓" : ""}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "18px", fontWeight: 600, color: color.ink }}>
          {ready ? "Report ready" : "Processing…"}
        </div>
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                fontFamily: font.mono,
                fontSize: "11.5px",
                color: i < step ? color.green : i === step ? color.body : color.fainter,
              }}
            >
              {i < step ? "✓ " : i === step ? "· " : "  "}
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
