"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { visitCompleteness, type Visit } from "@/lib/model/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomSheet } from "@/components/BottomSheet";
import { Card, ListRow } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusDot } from "@/components/StatusDot";
import { color, font, radius } from "@/lib/design/tokens";

const SETTINGS_KEY = "record-flow:lobby-settings:v1";

export default function LobbyPage() {
  const router = useRouter();
  const { visits, hydrated, createFreestyle, updateVisit, deleteVisit } = useVisitStore();
  const [siteName, setSiteName] = useState("");
  const [siteNameError, setSiteNameError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surveyor, setSurveyor] = useState("E. Hartley");
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  const active = visits.filter((v) => v.status !== "filed" && v.status !== "archived");
  const filed = visits.filter((v) => v.status === "filed");
  const archived = visits.filter((v) => v.status === "archived");
  const siteNameDraft = siteName.trim();
  const canStartVisit = siteNameDraft.length > 0;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { surveyor?: string };
        if (saved.surveyor) setSurveyor(saved.surveyor);
      }
    } catch {
      /* keep defaults */
    } finally {
      setSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ surveyor }));
    } catch {
      /* settings are non-critical */
    }
  }, [surveyor, settingsHydrated]);

  const startVisit = () => {
    if (!canStartVisit) {
      setSiteNameError(true);
      return;
    }

    const v = createFreestyle(siteNameDraft, surveyor.trim() || "Field surveyor");
    router.push(`/visit/${v.id}/setup`);
  };

  const archiveVisit = (id: string) => {
    updateVisit(id, (v) => ({ ...v, status: "archived" }));
  };

  const restoreVisit = (id: string) => {
    updateVisit(id, (v) => ({ ...v, status: "in-progress" }));
  };

  return (
    <>
      <ScreenHeader
        title={
          <div>
            <div>Temporal</div>
            <div style={{ fontFamily: font.mono, fontSize: "10px", letterSpacing: ".14em", color: color.faint, marginTop: "2px" }}>
              FIELD MEMOS
            </div>
          </div>
        }
        right={<SettingsButton onClick={() => setSettingsOpen(true)} />}
      />

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
        <Card>
          <div style={{ fontSize: "17px", fontWeight: 700, color: color.ink, marginBottom: "5px" }}>
            Record a site visit
          </div>
          <div style={{ fontSize: "13.5px", color: color.subtle, lineHeight: 1.45, marginBottom: "12px" }}>
            Start a clean voice memo for the site you are standing in. You&apos;ll set up parcels next.
          </div>
          <input
            value={siteName}
            onChange={(e) => {
              setSiteName(e.target.value);
              if (siteNameError) setSiteNameError(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && startVisit()}
            placeholder="Site name"
            aria-label="Site name"
            aria-invalid={siteNameError}
            aria-describedby={siteNameError ? "site-name-error" : undefined}
            required
            style={{
              width: "100%",
              border: `1.5px solid ${siteNameError ? color.red : color.border}`,
              borderRadius: radius.md,
              padding: "12px 13px",
              fontSize: "15px",
              fontFamily: font.body,
              color: color.body,
              outline: "none",
              marginBottom: "10px",
            }}
          />
          {siteNameError && (
            <div id="site-name-error" role="alert" style={{ fontSize: "12px", color: color.red, margin: "-4px 0 10px" }}>
              Enter a site name before starting a recording.
            </div>
          )}
          <Button full disabled={!canStartVisit} onClick={startVisit}>
            Start recording →
          </Button>
        </Card>

        {hydrated && active.length > 0 && (
          <Section label="Continue">
            {active.map((v) => (
              <SwipeVisitRow
                key={v.id}
                visit={v}
                onClick={() => router.push(v.parcels.length === 0 ? `/visit/${v.id}/setup` : `/visit/${v.id}/record`)}
                actions={[
                  { label: "Archive", tone: "archive", onClick: () => archiveVisit(v.id) },
                  { label: "Delete", tone: "delete", onClick: () => deleteVisit(v.id) },
                ]}
              />
            ))}
          </Section>
        )}

        {hydrated && filed.length > 0 && (
          <Section label="Filed today">
            {filed.map((v) => (
              <SwipeVisitRow
                key={v.id}
                visit={v}
                onClick={() => router.push(`/visit/${v.id}/review`)}
                actions={[{ label: "Delete", tone: "delete", onClick: () => deleteVisit(v.id) }]}
              />
            ))}
          </Section>
        )}

        {hydrated && archived.length > 0 && (
          <Section label="Archived">
            {archived.map((v) => (
              <SwipeVisitRow
                key={v.id}
                visit={v}
                onClick={() => router.push(v.parcels.length === 0 ? `/visit/${v.id}/setup` : `/visit/${v.id}/record`)}
                actions={[
                  { label: "Restore", tone: "restore", onClick: () => restoreVisit(v.id) },
                  { label: "Delete", tone: "delete", onClick: () => deleteVisit(v.id) },
                ]}
              />
            ))}
          </Section>
        )}
      </div>

      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 22px)" }} />

      <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Capture settings">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "8px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontFamily: font.mono, fontSize: "10px", color: color.faint, letterSpacing: ".12em" }}>
              DEFAULT SURVEYOR
            </span>
            <input
              value={surveyor}
              onChange={(e) => setSurveyor(e.target.value)}
              placeholder="Surveyor name"
              style={inputStyle}
            />
          </label>
          <SettingRow
            title="Audio capture"
            value="High fidelity"
            detail="Echo cancellation, noise suppression, and auto gain are disabled so field audio stays natural."
          />
          <SettingRow
            title="Transcription"
            value="Deepgram when API key is present"
            detail="Falls back to the fake provider only when configured for local testing."
          />
          <SettingRow
            title="Memo organization"
            value="Archive from lobby"
            detail="Swipe site entries to archive, restore, or delete them without entering the recording flow."
          />
        </div>
      </BottomSheet>
    </>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  border: `1.5px solid ${color.border}`,
  borderRadius: radius.md,
  padding: "11px 12px",
  fontSize: "14px",
  fontFamily: font.body,
  color: color.body,
  outline: "none",
};

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open settings"
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: `1.5px solid ${color.border}`,
        background: color.surface,
        color: color.body,
        fontSize: "16px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      ⚙
    </button>
  );
}

function SettingRow({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div style={{ border: `1.5px solid ${color.borderSoft}`, borderRadius: radius.lg, padding: "11px 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: color.body }}>{title}</div>
        <div style={{ fontFamily: font.mono, fontSize: "10.5px", color: color.clay, textAlign: "right" }}>{value}</div>
      </div>
      <div style={{ fontSize: "11.5px", color: color.faint, lineHeight: 1.45, marginTop: "5px" }}>{detail}</div>
    </div>
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

interface RowAction {
  label: string;
  tone: "archive" | "delete" | "restore";
  onClick: () => void;
}

function SwipeVisitRow({
  visit,
  onClick,
  actions,
}: {
  visit: Visit;
  onClick: () => void;
  actions: RowAction[];
}) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const dragStart = useRef(0);
  const dragged = useRef(false);
  const maxReveal = actions.length * 82;

  const setRevealOffset = (next: number) => {
    offsetRef.current = next;
    setOffset(next);
  };

  const dragThreshold = 12;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    dragStart.current = offsetRef.current;
    dragged.current = false;
    setIsDragging(false);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > dragThreshold) {
      dragged.current = true;
      setIsDragging(true);
    }
    setRevealOffset(Math.max(-maxReveal, Math.min(0, dragStart.current + dx)));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    setRevealOffset(offsetRef.current < -maxReveal / 2 ? -maxReveal : 0);
  };

  const handleClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (offsetRef.current < 0) {
      setRevealOffset(0);
      return;
    }
    onClick();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleClick();
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius.xl, touchAction: "pan-y" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          justifyContent: "flex-end",
          gap: "1px",
          background: color.borderSoft,
        }}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              action.onClick();
              setRevealOffset(0);
            }}
            style={{
              width: "82px",
              border: "none",
              background:
                action.tone === "delete"
                  ? color.red
                  : action.tone === "restore"
                    ? color.green
                    : color.amber,
              color: "#fff",
              fontFamily: font.mono,
              fontSize: "10.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${visit.siteName}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? "none" : "transform .18s ease",
          position: "relative",
          zIndex: 1,
          cursor: "pointer",
          outline: "none",
        }}
      >
        <VisitRow visit={visit} />
      </div>
    </div>
  );
}

function VisitRow({ visit, onClick }: { visit: Visit; onClick?: () => void }) {
  const c = visitCompleteness(visit);
  const filed = visit.status === "filed";
  const archived = visit.status === "archived";
  const inProgress = visit.status === "in-progress";

  const subtitle = filed
    ? `filed · ${visit.parcels.length} parcel${visit.parcels.length === 1 ? "" : "s"} · ${visit.filedAt ?? "just now"}`
    : archived
      ? "archived"
    : inProgress
      ? `${c.outstanding} item${c.outstanding === 1 ? "" : "s"} to finish`
      : "ready to record";

  return (
    <ListRow
      onClick={onClick}
      tone={filed ? "green" : "plain"}
      leading={<StatusDot tone={filed ? "green" : inProgress ? "clay" : "idle"} />}
      title={visit.siteName}
      titleColor={filed ? color.greenInk : archived ? color.faint : color.body}
      subtitle={subtitle}
      subtitleColor={filed ? color.green : color.faint}
      trailing={
        <span style={{ fontFamily: font.mono, fontSize: "11px", color: color.faint }}>
          {archived ? "restore ↢" : filed ? "open ›" : inProgress ? "resume ›" : "open ›"}
        </span>
      }
    />
  );
}
