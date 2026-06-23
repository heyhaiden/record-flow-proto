"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { useCapture } from "@/lib/capture/use-capture";
import { field, type Condition } from "@/lib/model/types";
import type { Tok } from "@/lib/types";
import { newId } from "@/lib/id";
import { habitatOptions, criteriaFor } from "@/lib/model/conditions";
import { tokenStyle } from "@/components/Token";
import { ScreenHeader } from "@/components/ScreenHeader";
import { RecordButton } from "@/components/RecordButton";
import { BottomSheet } from "@/components/BottomSheet";
import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/Button";
import { BackButton, NotFound } from "@/components/nav";
import { RouteTransition } from "@/components/RouteTransition";
import { color, font, radius } from "@/lib/design/tokens";

type Target = { kind: "parcel"; parcelId: string } | { kind: "site" } | { kind: "feature" };

interface LocalNote {
  toks: Tok[];
  time: string;
  targetLabel: string;
}

export default function RecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit, hydrated } = useVisitStore();
  const visit = getVisit(id);

  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [target, setTarget] = useState<Target>({ kind: "parcel", parcelId: "" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const scrollEl = useRef<HTMLDivElement | null>(null);

  // default active parcel = first to-assess, else first parcel
  useEffect(() => {
    if (!visit || target.kind !== "parcel" || target.parcelId) return;
    const first = visit.parcels.find((p) => p.status === "to-assess") ?? visit.parcels[0];
    if (first) setTarget({ kind: "parcel", parcelId: first.id });
  }, [visit, target]);

  const targetLabel = useMemo(() => {
    if (!visit) return "";
    if (target.kind === "site") return "Site-level note";
    if (target.kind === "feature") return "Feature";
    const p = visit.parcels.find((x) => x.id === target.parcelId);
    if (!p) return "Parcel";
    const habitatLabel = p.ukhabType.value ?? p.deskStudyOrigin?.ukhabType;
    return habitatLabel ? `${p.name} · ${habitatLabel}` : p.name;
  }, [visit, target]);

  const showTargetSwitcher = (visit?.parcels.length ?? 0) > 1;

  const onCommit = useCallback(
    (toks: Tok[], time: string) => {
      setNotes((prev) => [...prev, { toks, time, targetLabel }]);
      // Persist the note onto the visit (with its structured target) so the M2
      // extractor can turn the walk-through into fields. `target` is structurally
      // a NoteTarget.
      const text = toks.map((t) => t.text).join("");
      updateVisit(id, (v) => ({
        ...v,
        transcript: [...(v.transcript ?? []), { id: newId("note"), text, target, capturedAt: time }],
      }));
    },
    [targetLabel, id, target, updateVisit],
  );

  const cap = useCapture(onCommit);

  useEffect(() => {
    if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
  }, [notes, cap.transcribing]);

  if (!hydrated) {
    return <RouteTransition title="Recorder" eyebrow="VOICE CAPTURE" message="Opening recorder..." />;
  }

  if (!visit) return <NotFound />;

  const addTyped = () => {
    if (!typed.trim()) return;
    onCommit([{ text: typed.trim(), k: 0 }], new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    setTyped("");
  };

  const addParcel = () => {
    const opts = habitatOptions();
    const n = visit.parcels.length + 1;
    const habitatId = opts[(n - 1) % opts.length]?.id;
    const pid = newId("p");
    updateVisit(id, (v) => ({
      ...v,
      parcels: [
        ...v.parcels,
        {
          id: pid,
          name: `Parcel ${n}`,
          habitatId,
          ukhabType: field<string>(null, null, "red"),
          area: field<number>(null, null, "red"),
          areaUnit: "ha",
          condition: field<Condition>(null, null, "red"),
          criteria: criteriaFor(habitatId),
          status: "to-assess",
        },
      ],
    }));
    setTarget({ kind: "parcel", parcelId: pid });
    setSheetOpen(false);
  };

  // ---- swipe to finish ----
  return (
    <RecordView
      scrollEl={scrollEl}
      visit={visit}
      cap={cap}
      notes={notes}
      targetLabel={targetLabel}
      showTargetSwitcher={showTargetSwitcher}
      onOpenSwitcher={() => setSheetOpen(true)}
      onFinish={() => router.push(`/visit/${id}/processing`)}
      onBack={() => router.push("/")}
    >
      {/* permission gates render inside RecordView via cap.phase */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Where does the next note go?">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "8px" }}>
          {visit.parcels.map((p) => {
            const active = target.kind === "parcel" && target.parcelId === p.id;
            return (
              <SwitcherRow
                key={p.id}
                active={active}
                title={p.name}
                sub={p.ukhabType.value ?? p.deskStudyOrigin?.ukhabType}
                onClick={() => {
                  setTarget({ kind: "parcel", parcelId: p.id });
                  setSheetOpen(false);
                }}
              />
            );
          })}
          <SwitcherRow title="+ New parcel" sub="create on the fly" onClick={addParcel} />
          <div style={{ height: "1px", background: color.hair, margin: "4px 0" }} />
          <SwitcherRow
            active={target.kind === "site"}
            title="Site-level note"
            sub="not tied to a parcel"
            onClick={() => {
              setTarget({ kind: "site" });
              setSheetOpen(false);
            }}
          />
          <SwitcherRow
            active={target.kind === "feature"}
            title="Feature / target note"
            sub="protected species, notable feature"
            onClick={() => {
              setTarget({ kind: "feature" });
              setSheetOpen(false);
            }}
          />
        </div>
      </BottomSheet>

      {cap.phase === "denied" && (
        <TypedFallback value={typed} onChange={setTyped} onAdd={addTyped} />
      )}
    </RecordView>
  );
}

/* ----------------------------------------------------------------------- */

function RecordView({
  scrollEl,
  visit,
  cap,
  notes,
  targetLabel,
  showTargetSwitcher,
  onOpenSwitcher,
  onFinish,
  onBack,
  children,
}: {
  scrollEl: React.RefObject<HTMLDivElement | null>;
  visit: ReturnType<ReturnType<typeof useVisitStore>["getVisit"]>;
  cap: ReturnType<typeof useCapture>;
  notes: LocalNote[];
  targetLabel: string;
  showTargetSwitcher: boolean;
  onOpenSwitcher: () => void;
  onFinish: () => void;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const accent = cap.mode === "handsfree" ? color.plum : color.clay;
  const recording = cap.mode === "ptt" || cap.mode === "handsfree";

  // swipe-to-finish
  const [dragY, setDragY] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [filing, setFiling] = useState(false);
  const grabStart = useRef(0);
  const dragRef = useRef(0);
  const onGrabDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    grabStart.current = e.clientY;
    setDragActive(true);
  };
  const onGrabMove = (e: ReactPointerEvent) => {
    if (!dragActive) return;
    const dy = Math.min(0, e.clientY - grabStart.current);
    dragRef.current = dy;
    setDragY(dy);
  };
  const onGrabUp = () => {
    setDragActive(false);
    if (dragRef.current <= -90) {
      setFiling(true);
      setTimeout(onFinish, 340);
    } else {
      setDragY(0);
    }
  };

  const btnLabel = cap.mode === "ptt" ? "Release to stop" : cap.transcribing ? "Transcribing…" : "";
  const subHint = cap.mode === "ptt" ? "keep holding while you speak" : "hold to talk";

  const contentStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    background: color.surface,
    transform: filing ? "translateY(-110vh)" : `translateY(${dragY}px)`,
    opacity: filing ? 0 : 1,
    transition: dragActive ? "none" : "transform .34s ease, opacity .34s ease",
  };

  const swipeVisible = cap.mode === "idle" && notes.length > 0;

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      <div style={contentStyle}>
        <ScreenHeader
          left={<StatusDot tone={cap.mode === "handsfree" ? "plum" : cap.mode === "ptt" ? "clay" : "idle"} live={recording} />}
          title={visit!.siteName}
          right={showTargetSwitcher ? (
            <button
              type="button"
              onClick={onOpenSwitcher}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 11px",
                border: `1.5px solid ${color.border}`,
                borderRadius: radius.md,
                fontSize: "11.5px",
                color: color.muted,
                background: color.surface,
                cursor: "pointer",
                maxWidth: "180px",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{targetLabel}</span> ▾
            </button>
          ) : undefined}
        />

        {/* error banner (non-destructive) */}
        {cap.error && <ErrorBanner error={cap.error} onDismiss={cap.dismissError} onRetry={cap.retryMic} />}

        {/* transcript */}
        <div
          ref={scrollEl}
          className="tscroll"
          style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "11px" }}
        >
          {cap.phase === "checking" && <Centered>Checking microphone…</Centered>}

          {cap.phase === "prompt" && <PermissionPrompt onEnable={cap.requestMic} />}

          {cap.phase === "denied" && <PermissionDenied onRetry={cap.retryMic} />}

          {cap.phase === "ready" && notes.length === 0 && !cap.transcribing && (
            <Centered>
              <div style={{ fontFamily: font.hand, fontSize: "24px", color: "#9a978f", marginBottom: "6px" }}>
                Nothing captured yet
              </div>
              <div style={{ fontSize: "12.5px", lineHeight: 1.5, color: color.idle }}>
                Hold the button to talk.
              </div>
            </Centered>
          )}

          {notes.map((n, ni) => (
            <div key={ni}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "4px" }}>
                <span style={{ fontFamily: font.mono, fontSize: "11px", color: color.subtle }}>{n.time}</span>
                <span
                  style={{
                    fontSize: "10px",
                    fontFamily: font.mono,
                    color: color.faint,
                    border: `1px solid ${color.borderSoft}`,
                    borderRadius: radius.xs,
                    padding: "0 5px",
                  }}
                >
                  {n.targetLabel}
                </span>
                <div style={{ height: "1px", flex: 1, background: color.hair }} />
              </div>
              <div style={{ fontSize: "14px", color: color.body, lineHeight: 1.6 }}>
                {n.toks.map((tk, ti) => (
                  <span key={ti} style={tokenStyle(tk.k)}>
                    {tk.text}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {cap.transcribing && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: color.subtle }}>
              <span
                style={{
                  display: "inline-block",
                  width: "2px",
                  height: "16px",
                  background: accent,
                  animation: "cursorblink 1s step-end infinite",
                }}
              />
              Transcribing…
            </div>
          )}
        </div>

        {/* dock */}
        {cap.phase === "ready" && (
          <div
            style={{
              position: "relative",
              flex: "none",
              borderTop: `1.5px solid ${color.borderSoft}`,
              padding: "0 22px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {swipeVisible && (
              <div
                onPointerDown={onGrabDown}
                onPointerMove={onGrabMove}
                onPointerUp={onGrabUp}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1px",
                  padding: "5px 22px 2px",
                  cursor: "grab",
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                <div style={{ width: "42px", height: "4px", borderRadius: "3px", background: "#d8d5cd", marginBottom: "2px" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "bob 2.2s ease-in-out infinite" }}>
                  <span style={{ fontSize: "12px", color: color.clay, lineHeight: 1 }}>⌃</span>
                  <span style={{ fontFamily: font.mono, fontSize: "9px", color: color.subtle, letterSpacing: ".03em" }}>
                    swipe up to finish visit
                  </span>
                </div>
              </div>
            )}

            <RecordButton
              mode={cap.mode}
              pressing={cap.pressing}
              onPointerDown={cap.onBtnDown}
              onPointerUp={cap.onBtnUp}
              onPointerLeave={cap.onBtnLeave}
            />
            <div
              style={{
                textAlign: "center",
                fontSize: "12px",
                fontWeight: 600,
                color: color.ink,
                lineHeight: 1.2,
                minHeight: btnLabel ? "14px" : "0",
                marginTop: "2px",
              }}
            >
              {btnLabel}
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: "10px",
                fontFamily: font.mono,
                color: color.faint,
                marginTop: "2px",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
                minHeight: "12px",
              }}
            >
              {subHint}
            </div>
          </div>
        )}

        {/* back affordance when nothing captured (so permission screens can exit) */}
        {cap.phase !== "ready" && (
          <div style={{ padding: "12px 18px calc(env(safe-area-inset-bottom,0px) + 18px)" }}>
            <Button variant="ghost" full onClick={onBack}>
              ‹ Back to lobby
            </Button>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

/* ----------------------------------------------------------------------- */

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: "auto", textAlign: "center", color: color.idle, maxWidth: "240px" }}>{children}</div>
  );
}

function PermissionPrompt({ onEnable }: { onEnable: () => void }) {
  return (
    <Centered>
      <div style={{ fontSize: "40px", marginBottom: "10px" }}>🎙️</div>
      <div style={{ fontSize: "16px", fontWeight: 600, color: color.ink, marginBottom: "8px" }}>
        Enable your microphone
      </div>
      <div style={{ fontSize: "12.5px", lineHeight: 1.5, color: color.subtle, marginBottom: "16px" }}>
        Record Flow listens while you walk the site and turns your notes into a structured report.
        Audio stays on your device until you finish.
      </div>
      <Button onClick={onEnable}>Enable microphone</Button>
    </Centered>
  );
}

function PermissionDenied({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ margin: "auto 0", textAlign: "center", color: color.subtle, padding: "8px 0" }}>
      <div style={{ fontSize: "40px", marginBottom: "10px" }}>🔇</div>
      <div style={{ fontSize: "16px", fontWeight: 600, color: color.ink, marginBottom: "8px" }}>
        Microphone is blocked
      </div>
      <div style={{ fontSize: "12.5px", lineHeight: 1.5, color: color.subtle, marginBottom: "14px", maxWidth: "260px", marginInline: "auto" }}>
        Re-enable it in your browser’s site settings (tap the address-bar icon → Microphone → Allow), then
        retry. You can also type notes below in the meantime.
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function TypedFallback({ value, onChange, onAdd }: { value: string; onChange: (v: string) => void; onAdd: () => void }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 18px calc(env(safe-area-inset-bottom,0px) + 16px)", borderTop: `1.5px solid ${color.borderSoft}`, background: color.surface, display: "flex", gap: "8px" }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onAdd()}
        placeholder="Type a note…"
        style={{ flex: 1, border: `1.5px solid ${color.border}`, borderRadius: radius.md, padding: "10px 12px", fontSize: "14px", fontFamily: font.body, color: color.body, outline: "none" }}
      />
      <Button variant="secondary" onClick={onAdd}>
        Add
      </Button>
    </div>
  );
}

function ErrorBanner({ error, onDismiss, onRetry }: { error: NonNullable<ReturnType<typeof useCapture>["error"]>; onDismiss: () => void; onRetry: () => void }) {
  const copy: Record<string, { text: string; action?: string }> = {
    offline: { text: "You’re offline — notes are saved and will transcribe when you reconnect." },
    "no-speech": { text: "Not hearing anything — check your mic and try again.", action: "Retry" },
    stt: { text: "Transcription hit a snag — your audio is safe.", action: "Retry" },
    interrupted: { text: "Recording paused when the app lost focus. Tap to resume.", action: "Resume" },
  };
  const c = copy[error] ?? { text: "Something went wrong." };
  return (
    <div style={{ margin: "10px 18px 0", padding: "10px 12px", borderRadius: radius.lg, background: color.amberBg, border: `1.5px solid ${color.amberBorder}`, display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ fontSize: "13px" }}>⚠️</span>
      <div style={{ flex: 1, fontSize: "12px", color: color.amberInk, lineHeight: 1.4 }}>{c.text}</div>
      {c.action && (
        <button type="button" onClick={() => { onRetry(); onDismiss(); }} style={{ background: "transparent", border: "none", color: color.amberInk, fontFamily: font.mono, fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
          {c.action}
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: color.amberInk, fontSize: "14px", cursor: "pointer", lineHeight: 1 }}>
        ×
      </button>
    </div>
  );
}

function SwitcherRow({ active, title, sub, onClick }: { active?: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "11px 12px",
        borderRadius: radius.lg,
        border: `1.5px solid ${active ? color.clay : color.borderSofter}`,
        background: active ? "#f6ece4" : color.surface,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <div>
        <div style={{ fontSize: "13.5px", fontWeight: 600, color: color.body }}>{title}</div>
        {sub && <div style={{ fontSize: "11px", color: color.faint, marginTop: "1px" }}>{sub}</div>}
      </div>
      {active && <span style={{ color: color.clay, fontSize: "13px" }}>✓</span>}
    </button>
  );
}
