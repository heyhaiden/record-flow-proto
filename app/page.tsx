"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { FORM_SCHEMAS, type ProjectFormId } from "@/lib/model/forms";
import { visitCompleteness, type Visit } from "@/lib/model/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomSheet } from "@/components/BottomSheet";
import { Card, ListRow } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusDot } from "@/components/StatusDot";
import { color, font, radius } from "@/lib/design/tokens";
import { navigate } from "@/lib/nav";

const SETTINGS_KEY = "record-flow:lobby-settings:v1";

export default function LobbyPage() {
  const router = useRouter();
  const { visits, hydrated, createFreestyle, updateVisit, deleteVisit, clearAll } = useVisitStore();
  const [siteName, setSiteName] = useState("");
  const [siteNameError, setSiteNameError] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const [creationStep, setCreationStep] = useState<"project" | "forms">("project");
  const [selectedFormIds, setSelectedFormIds] = useState<ProjectFormId[]>(["pea-walkover"]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [surveyor, setSurveyor] = useState("E. Hartley");
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [pendingNewVisitId, setPendingNewVisitId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [isStarting, startRouteTransition] = useTransition();

  const active = visits.filter(
    (v) => v.status !== "filed" && v.status !== "archived" && v.id !== pendingNewVisitId,
  );
  const filed = visits.filter((v) => v.status === "filed");
  const archived = visits.filter((v) => v.status === "archived");
  const activeByDate = groupVisitsByDate(active);
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

  const openCreation = () => {
    setCreationOpen(true);
    setCreationStep("project");
    setSiteNameError(false);
    setLocationError(false);
  };

  const closeCreation = () => {
    if (isStarting) return;
    setCreationOpen(false);
  };

  const goToForms = () => {
    if (isStarting) return;
    if (!canStartVisit) {
      setSiteNameError(true);
      return;
    }
    setCreationStep("forms");
  };

  const toggleForm = (formId: ProjectFormId) => {
    setSelectedFormIds((prev) =>
      prev.includes(formId) ? prev.filter((id) => id !== formId) : [...prev, formId],
    );
  };

  const startVisit = () => {
    if (isStarting) return;
    if (!canStartVisit) {
      setSiteNameError(true);
      setCreationStep("project");
      return;
    }

    const v = createFreestyle(siteNameDraft, surveyor.trim() || "Field surveyor");
    setPendingNewVisitId(v.id);
    updateVisit(v.id, (visit) => ({
      ...visit,
      selectedForms: selectedFormIds,
    }));
    const nextHref = `/visit/${v.id}/record`;
    router.prefetch(nextHref);
    startRouteTransition(() => navigate(router, nextHref));
  };

  const locateMe = () => {
    if (locating || isStarting) return;
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }

    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setSiteName(formatLocationName(coords.latitude, coords.longitude));
        setSiteNameError(false);
        setLocating(false);
      },
      () => {
        setLocationError(true);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
    );
  };

  const openVisit = (visit: Visit) => {
    const nextHref = `/visit/${visit.id}/record`;
    if (visit.source === "desk-study" && visit.status === "scheduled") {
      updateVisit(visit.id, (v) => ({ ...v, status: "in-progress" }));
    }
    router.prefetch(nextHref);
    startRouteTransition(() => navigate(router, nextHref));
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
          padding: "16px 18px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        {hydrated &&
          activeByDate.map(({ label, visits: groupedVisits }) => (
            <Section key={label} label={label}>
              {groupedVisits.map((v) => (
                <SwipeVisitRow
                  key={v.id}
                  visit={v}
                  onClick={() => openVisit(v)}
                  actions={[
                    { label: "Archive", tone: "archive", onClick: () => archiveVisit(v.id) },
                    { label: "Delete", tone: "delete", onClick: () => deleteVisit(v.id) },
                  ]}
                />
              ))}
            </Section>
          ))}

        {hydrated && filed.length > 0 && (
          <Section label="Filed today">
            {filed.map((v) => (
              <SwipeVisitRow
                key={v.id}
                visit={v}
                onClick={() => navigate(router, `/visit/${v.id}/review`)}
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
                onClick={() => openVisit(v)}
                actions={[
                  { label: "Restore", tone: "restore", onClick: () => restoreVisit(v.id) },
                  { label: "Delete", tone: "delete", onClick: () => deleteVisit(v.id) },
                ]}
              />
            ))}
          </Section>
        )}
      </div>

      <div
        style={{
          borderTop: `1.5px solid ${color.borderSoft}`,
          padding: "10px 18px calc(env(safe-area-inset-bottom,0px) + 18px)",
          background: color.surface,
          flex: "none",
        }}
      >
        <button type="button" onClick={openCreation} style={createDockStyle}>
          <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: color.ink }}>Create Project</span>
            <span style={{ fontSize: "11.5px", color: color.subtle }}>Set name, forms, then record</span>
          </span>
          <span style={{ fontSize: "18px", color: color.clay }}>⌃</span>
        </button>
      </div>

      <BottomSheet
        open={creationOpen}
        onClose={closeCreation}
        title={creationStep === "project" ? "Create project" : "Forms to complete"}
        footer={
          <CreationWizardFooter
            step={creationStep}
            locating={locating}
            isStarting={isStarting}
            selectedCount={selectedFormIds.length}
            onLocate={locateMe}
            onNext={goToForms}
            onBack={() => setCreationStep("project")}
            onStart={startVisit}
          />
        }
      >
        <div key={creationStep} style={{ animation: "fadeIn 0.22s ease" }}>
          {creationStep === "project" ? (
            <ProjectFields
              siteName={siteName}
              siteNameError={siteNameError}
              locationError={locationError}
              onNameChange={(value) => {
                setSiteName(value);
                if (siteNameError) setSiteNameError(false);
              }}
            />
          ) : (
            <FormPicker selectedFormIds={selectedFormIds} onToggleForm={toggleForm} />
          )}
        </div>
      </BottomSheet>

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
          <Button
            variant="secondary"
            full
            onClick={() => {
              clearAll();
              setSettingsOpen(false);
            }}
          >
            Clear all projects
          </Button>
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

const createDockStyle: CSSProperties = {
  width: "100%",
  border: `1.5px solid ${color.borderSoft}`,
  borderRadius: radius.xl,
  background: color.surface,
  padding: "12px 13px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  cursor: "pointer",
  textAlign: "left",
  boxShadow: "0 -2px 14px rgba(0,0,0,.04)",
  transition: "transform .18s ease, border-color .18s ease",
};

function formatLocationName(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(5);
  const lng = longitude.toFixed(5);
  return `Site at ${lat}, ${lng}`;
}

function dateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", { month: "short", day: "2-digit" });
}

function groupVisitsByDate(visits: Visit[]): { label: string; visits: Visit[] }[] {
  const groups = new Map<string, Visit[]>();
  visits.forEach((visit) => {
    const label = dateLabel(visit.date);
    groups.set(label, [...(groups.get(label) ?? []), visit]);
  });
  return [...groups.entries()].map(([label, groupedVisits]) => ({ label, visits: groupedVisits }));
}

function FormPicker({
  selectedFormIds,
  onToggleForm,
}: {
  selectedFormIds: ProjectFormId[];
  onToggleForm: (formId: ProjectFormId) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontSize: "12.5px", color: color.subtle, lineHeight: 1.45 }}>
        Pick what you&apos;re recording for. Select as many as you need.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        {FORM_SCHEMAS.map((form) => {
          const selected = selectedFormIds.includes(form.id);
          return (
            <button
              key={form.id}
              type="button"
              onClick={() => onToggleForm(form.id)}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                padding: "10px 10px",
                borderRadius: radius.md,
                border: `1.5px solid ${selected ? color.clay : color.borderSofter}`,
                background: selected ? color.clayTint : color.surface,
                textAlign: "left",
                cursor: "pointer",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: "15px",
                  height: "15px",
                  borderRadius: radius.sm,
                  border: `1.5px solid ${selected ? color.clay : color.border}`,
                  color: color.clay,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: 700,
                  flex: "none",
                }}
              >
                {selected ? "✓" : ""}
              </span>
              <span style={{ fontSize: "13.5px", fontWeight: 600, color: color.body, lineHeight: 1.2 }}>
                {form.shortTitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProjectFields({
  siteName,
  siteNameError,
  locationError,
  onNameChange,
}: {
  siteName: string;
  siteNameError: boolean;
  locationError: boolean;
  onNameChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: color.ink, marginBottom: "4px" }}>
          Name the project
        </div>
        <div style={{ fontSize: "12.5px", color: color.subtle, lineHeight: 1.45 }}>
          Use GPS to start from where you are, or type the site name.
        </div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontFamily: font.mono, fontSize: "10px", color: color.faint, letterSpacing: ".12em" }}>
          PROJECT NAME
        </span>
        <input
          value={siteName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Site name or GPS"
          aria-label="Project name"
          aria-invalid={siteNameError}
          aria-describedby={siteNameError ? "site-name-error" : undefined}
          style={{
            ...inputStyle,
            borderColor: siteNameError ? color.red : color.border,
            fontSize: "15px",
            padding: "12px 13px",
          }}
        />
      </label>

      {siteNameError && (
        <div id="site-name-error" role="alert" style={{ fontSize: "12px", color: color.red }}>
          Enter a project name before continuing.
        </div>
      )}
      {locationError && (
        <div role="alert" style={{ fontSize: "12px", color: color.amber }}>
          Couldn&apos;t read GPS. Type the project name instead.
        </div>
      )}
    </div>
  );
}

function CreationWizardFooter({
  step,
  locating,
  isStarting,
  selectedCount,
  onLocate,
  onNext,
  onBack,
  onStart,
}: {
  step: "project" | "forms";
  locating: boolean;
  isStarting: boolean;
  selectedCount: number;
  onLocate: () => void;
  onNext: () => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const footerStyle: CSSProperties = {
    display: "flex",
    gap: "8px",
    alignItems: "stretch",
    padding: "12px 18px calc(env(safe-area-inset-bottom, 0px) + 12px)",
  };

  if (step === "project") {
    return (
      <div style={footerStyle}>
        <button
          type="button"
          onClick={onLocate}
          disabled={locating || isStarting}
          aria-label="Locate me"
          title="Locate me"
          style={{
            width: "48px",
            flex: "none",
            borderRadius: radius.xxl,
            border: `1.5px solid ${color.border}`,
            background: color.surface,
            color: locating ? color.clay : color.body,
            fontSize: "18px",
            cursor: locating || isStarting ? "default" : "pointer",
            opacity: locating || isStarting ? 0.7 : 1,
          }}
        >
          {locating ? "..." : "⌖"}
        </button>
        <Button style={{ flex: 1 }} disabled={isStarting} onClick={onNext}>
          Next →
        </Button>
      </div>
    );
  }

  return (
    <div style={footerStyle}>
      <Button variant="secondary" style={{ flex: "0 0 88px" }} disabled={isStarting} onClick={onBack}>
        Back
      </Button>
      <Button style={{ flex: 1 }} disabled={isStarting || selectedCount === 0} onClick={onStart}>
        {isStarting ? "Opening..." : "Start recording →"}
      </Button>
    </div>
  );
}

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
              color: color.surface,
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
    ? `Filed · ${visit.filedAt ?? "just now"}`
    : archived
      ? "Archived"
    : inProgress
      ? `${c.outstanding} item${c.outstanding === 1 ? "" : "s"} to finish`
      : visit.source === "desk-study"
        ? `Desk study ready${visit.scheduledAt ? ` · ${visit.scheduledAt}` : ""}`
        : `Scheduled${visit.scheduledAt ? ` · ${visit.scheduledAt}` : ""}`;

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
