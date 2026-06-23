"use client";

import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { habitatById } from "@/lib/model/conditions";
import type { Parcel } from "@/lib/model/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TriageChip } from "@/components/TriageChip";
import { BackButton, NotFound } from "@/components/nav";
import { color, font, radius } from "@/lib/design/tokens";

export default function VisitOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit } = useVisitStore();
  const visit = getVisit(id);

  if (!visit) return <NotFound />;

  const override = (parcelId: string) => {
    const reason = window.prompt("What did you find instead? (captured as evidence)");
    if (!reason) return;
    updateVisit(id, (v) => ({
      ...v,
      parcels: v.parcels.map((p) =>
        p.id === parcelId ? { ...p, status: "overridden", overrideReason: reason } : p,
      ),
    }));
  };

  const startWalkover = () => {
    updateVisit(id, (v) => ({ ...v, status: "in-progress" }));
    router.push(`/visit/${id}/record`);
  };

  return (
    <>
      <ScreenHeader
        eyebrow="DESK STUDY · GROUND-TRUTH"
        title={visit.siteName}
        left={<BackButton onClick={() => router.push("/")} />}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* site context */}
        <Card tone="muted">
          <Row k="Date" v={visit.date} />
          <Row k="Surveyor" v={visit.surveyor} />
          <Row k="Weather" v={visit.siteContext.weather.value ?? "— capture on site"} dim={!visit.siteContext.weather.value} />
          <Row k="Access" v={visit.siteContext.access.value ?? "— capture on site"} dim={!visit.siteContext.access.value} last />
        </Card>

        {/* parcels */}
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          <div style={{ fontFamily: font.mono, fontSize: "10px", letterSpacing: ".14em", color: color.faint }}>
            PRELOADED PARCELS — CONFIRM OR OVERRIDE
          </div>
          {visit.parcels.map((p) => (
            <ParcelCard key={p.id} parcel={p} onOverride={() => override(p.id)} />
          ))}
        </div>

        <p style={{ fontSize: "11.5px", color: color.faint, lineHeight: 1.5, margin: 0 }}>
          Preloaded types are a hypothesis from the desk study — confirm or overturn them on site. Field
          estimates only; confirm at desk.
        </p>
      </div>

      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
        <Button full onClick={startWalkover}>
          Start walkover →
        </Button>
      </div>
    </>
  );
}

function ParcelCard({ parcel, onOverride }: { parcel: Parcel; onOverride: () => void }) {
  const habitat = habitatById(parcel.habitatId);
  const statusChip =
    parcel.status === "confirmed" ? (
      <TriageChip status="green">confirmed</TriageChip>
    ) : parcel.status === "overridden" ? (
      <TriageChip status="amber">overridden</TriageChip>
    ) : (
      <TriageChip status="red">to assess</TriageChip>
    );

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ fontSize: "13.5px", fontWeight: 600, color: color.body }}>{parcel.name}</div>
        {statusChip}
      </div>
      <div style={{ fontSize: "12.5px", color: color.subtle, marginTop: "3px" }}>
        {parcel.deskStudyOrigin?.ukhabType ?? parcel.ukhabType.value ?? "Unknown type"}
        {habitat ? "" : ""}
      </div>
      {parcel.overrideReason && (
        <div style={{ fontSize: "11px", color: color.amberInk, marginTop: "4px" }}>
          “{parcel.overrideReason}”
        </div>
      )}
      <button
        type="button"
        onClick={onOverride}
        style={{
          marginTop: "8px",
          background: "transparent",
          border: `1.5px solid ${color.border}`,
          borderRadius: radius.md,
          padding: "5px 10px",
          fontSize: "11px",
          fontFamily: font.mono,
          color: color.muted,
          cursor: "pointer",
        }}
      >
        not this type ↺
      </button>
    </Card>
  );
}

function Row({ k, v, dim, last }: { k: string; v: string; dim?: boolean; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        padding: "6px 0",
        borderBottom: last ? "none" : `1px solid ${color.hair}`,
      }}
    >
      <span style={{ fontSize: "12px", color: color.faint }}>{k}</span>
      <span style={{ fontSize: "12.5px", color: dim ? color.fainter : color.body, textAlign: "right" }}>{v}</span>
    </div>
  );
}
