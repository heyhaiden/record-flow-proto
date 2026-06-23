"use client";

import { useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { visitCompleteness, type Visit } from "@/lib/model/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ListRow } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusDot } from "@/components/StatusDot";
import { color, font } from "@/lib/design/tokens";

export default function LobbyPage() {
  const router = useRouter();
  const { visits, createFreestyle } = useVisitStore();

  const inProgress = visits.filter((v) => v.status === "in-progress");
  const scheduled = visits.filter((v) => v.status === "scheduled");
  const filed = visits.filter((v) => v.status === "filed");

  const startFreestyle = () => {
    const v = createFreestyle("New site");
    router.push(`/visit/${v.id}/record`);
  };

  return (
    <>
      <ScreenHeader eyebrow="SITE LOBBY" title="Today’s visits" />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        {inProgress.length > 0 && (
          <Section label="In progress">
            {inProgress.map((v) => (
              <VisitRow key={v.id} visit={v} onClick={() => router.push(`/visit/${v.id}/record`)} />
            ))}
          </Section>
        )}

        <Section label="Scheduled">
          {scheduled.length === 0 && <Empty text="No scheduled visits." />}
          {scheduled.map((v) => (
            <VisitRow key={v.id} visit={v} onClick={() => router.push(`/visit/${v.id}`)} />
          ))}
        </Section>

        {filed.length > 0 && (
          <Section label="Filed today">
            {filed.map((v) => (
              <VisitRow key={v.id} visit={v} onClick={() => router.push(`/visit/${v.id}/review`)} />
            ))}
          </Section>
        )}
      </div>

      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
        <Button full onClick={startFreestyle}>
          <span style={{ fontSize: "17px" }}>+</span> Start new visit
        </Button>
      </div>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
      <div
        style={{
          fontFamily: font.mono,
          fontSize: "10px",
          letterSpacing: ".14em",
          color: color.faint,
        }}
      >
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: "12.5px", color: color.fainter }}>{text}</div>;
}

function VisitRow({ visit, onClick }: { visit: Visit; onClick: () => void }) {
  const c = visitCompleteness(visit);
  const filed = visit.status === "filed";
  const inProgress = visit.status === "in-progress";

  const subtitle = filed
    ? `filed · ${visit.parcels.length} parcel${visit.parcels.length === 1 ? "" : "s"} · ${visit.filedAt ?? "just now"}`
    : inProgress
      ? `${c.outstanding} item${c.outstanding === 1 ? "" : "s"} to finish`
      : visit.source === "desk-study"
        ? `desk study ready · ${visit.parcels.length} parcel${visit.parcels.length === 1 ? "" : "s"} · ${visit.scheduledAt ?? ""}`
        : `scheduled · ${visit.scheduledAt ?? ""}`;

  return (
    <ListRow
      onClick={onClick}
      tone={filed ? "green" : "plain"}
      leading={<StatusDot tone={filed ? "green" : inProgress ? "clay" : "idle"} />}
      title={visit.siteName}
      titleColor={filed ? color.greenInk : color.body}
      subtitle={subtitle}
      subtitleColor={filed ? color.green : color.faint}
      trailing={
        <span style={{ fontFamily: font.mono, fontSize: "11px", color: color.faint }}>
          {filed ? "open ›" : inProgress ? "resume ›" : "open ›"}
        </span>
      }
    />
  );
}
