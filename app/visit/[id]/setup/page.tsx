"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { buildFreestyleParcel } from "@/lib/model/seed";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/Button";
import { BackButton, NotFound } from "@/components/nav";
import { color, font, radius } from "@/lib/design/tokens";

export default function SetupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit, hydrated } = useVisitStore();
  const visit = getVisit(id);

  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (!visit) return;
    if (visit.parcels.length > 0) {
      setNames(visit.parcels.map((p) => p.name));
    }
  }, [visit]);

  const addParcel = () => {
    const n = names.length + 1;
    setNames((prev) => [...prev, `Parcel ${n}`]);
  };

  const removeParcel = (index: number) => {
    setNames((prev) => prev.filter((_, i) => i !== index));
  };

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((name, i) => (i === index ? value : name)));
  };

  const continueToRecord = () => {
    const parcelNames =
      names.map((n) => n.trim()).filter(Boolean).length > 0
        ? names.map((n) => n.trim()).filter(Boolean)
        : ["Site"];

    updateVisit(id, (v) => ({
      ...v,
      parcels: parcelNames.map((name) => buildFreestyleParcel(name)),
    }));
    router.push(`/visit/${id}/record`);
  };

  const usingDefault = names.length === 0;

  if (!hydrated) {
    return <div style={{ flex: 1 }} aria-busy="true" />;
  }

  if (!visit) return <NotFound />;

  return (
    <>
      <ScreenHeader
        title={visit.siteName}
        eyebrow="BEFORE YOU RECORD"
        left={<BackButton onClick={() => router.push("/")} />}
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: color.ink, marginBottom: "6px" }}>
            Set up parcels
          </div>
          <div style={{ fontSize: "14px", color: color.subtle, lineHeight: 1.5 }}>
            Parcels are where your voice memos land. Skip this and we&apos;ll use a single area for
            everything.
          </div>
        </div>

        {usingDefault ? (
          <div
            style={{
              padding: "16px",
              borderRadius: radius.xl,
              border: `1.5px solid ${color.borderSoft}`,
              background: color.surface,
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 600, color: color.body }}>Single area</div>
            <div style={{ fontSize: "13px", color: color.subtle, marginTop: "4px", lineHeight: 1.45 }}>
              All audio goes into one bucket called <span style={{ fontFamily: font.mono }}>Site</span>.
              Good for a quick walk-through.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {names.map((name, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <input
                  value={name}
                  onChange={(e) => updateName(i, e.target.value)}
                  placeholder={`Parcel ${i + 1}`}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => removeParcel(i)}
                  aria-label={`Remove ${name}`}
                  style={removeBtnStyle}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={addParcel} style={addBtnStyle}>
          + Add parcel
        </button>
      </div>

      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
        <Button full onClick={continueToRecord}>
          {usingDefault ? "Continue with single area →" : "Continue to recording →"}
        </Button>
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: `1.5px solid ${color.border}`,
  borderRadius: radius.md,
  padding: "12px 13px",
  fontSize: "15px",
  fontFamily: font.body,
  color: color.body,
  outline: "none",
};

const removeBtnStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: radius.md,
  border: `1.5px solid ${color.borderSoft}`,
  background: color.surface,
  color: color.faint,
  fontSize: "18px",
  cursor: "pointer",
  flex: "none",
};

const addBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: `1.5px dashed ${color.border}`,
  borderRadius: radius.lg,
  padding: "12px",
  fontSize: "13px",
  fontWeight: 600,
  color: color.muted,
  cursor: "pointer",
  width: "100%",
};
