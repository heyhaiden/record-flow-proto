"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { mergeExtraction } from "@/lib/extract/merge";
import type { ExtractionInput, ExtractionPatch } from "@/lib/extract/schema";
import { color, font } from "@/lib/design/tokens";
import { navigate } from "@/lib/nav";

/**
 * "Processing…" → "Report ready" beat (design doc step 2). Runs the real M2
 * extraction behind the animation: POST the persisted transcript to
 * /api/extract, merge the returned patch into the visit, then route to review.
 * Degrades gracefully — on failure the notes are kept and the surveyor fills the
 * report by voice on the review screen.
 */
const STEPS = ["Transcribing your walk-through", "Extracting parcels & features", "Checking completeness"];
const MIN_MS = 1700;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function ProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit, hydrated } = useVisitStore();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const ranRef = useRef(false);

  // Visual step animation (cosmetic).
  useEffect(() => {
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 650 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Extraction (runs once, after hydration).
  useEffect(() => {
    if (!hydrated || ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      let extractionFailed = false;

      const work = async () => {
        const visit = getVisit(id);
        const notes = visit?.transcript ?? [];
        if (!visit || notes.length === 0) return; // nothing captured → just review
        try {
          const input: ExtractionInput = {
            transcript: notes.map((n) => ({ text: n.text, target: n.target })),
            parcels: visit.parcels.map((p) => ({
              id: p.id,
              name: p.name,
              deskStudyType: p.ukhabType.value ?? p.deskStudyOrigin?.ukhabType ?? null,
              criteriaIds: p.criteria.map((c) => c.id),
            })),
          };
          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          if (!res.ok) throw new Error("extract failed");
          const patch = (await res.json()) as ExtractionPatch;
          updateVisit(id, (v) => mergeExtraction(v, patch));
        } catch {
          extractionFailed = true;
          setFailed(true);
        }
      };

      await Promise.all([work(), sleep(MIN_MS)]);
      setReady(true);
      setTimeout(() => navigate(router, `/visit/${id}/review`, { replace: true }), extractionFailed ? 1200 : 600);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const title = ready ? (failed ? "Notes saved" : "Report ready") : "Processing…";

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
          borderTopColor: ready ? (failed ? color.amber : color.green) : color.clay,
          animation: ready ? "none" : "spin 0.9s linear infinite",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: failed ? color.amber : color.green,
          fontSize: "26px",
          transition: "border-color .3s",
        }}
      >
        {ready ? (failed ? "!" : "✓") : ""}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "18px", fontWeight: 600, color: color.ink }}>{title}</div>
        {ready && failed ? (
          <div style={{ marginTop: "8px", fontSize: "12.5px", color: color.subtle, maxWidth: "240px" }}>
            Couldn’t auto-fill — your notes are saved. Fill the report by voice on the next screen.
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
