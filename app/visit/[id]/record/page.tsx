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
import { field } from "@/lib/model/types";
import type { Tok } from "@/lib/types";
import { newId } from "@/lib/id";
import { habitatOptions } from "@/lib/model/conditions";
import { buildFreestyleParcel } from "@/lib/model/seed";
import { recordingEventsFromVisit, type CapturedNote } from "@/lib/model/captured-notes";
import { mergeTranscript } from "@/lib/stt/transcript-merge";
import { tokenStyle } from "@/components/Token";
import { ScreenHeader } from "@/components/ScreenHeader";
import { RecordButton } from "@/components/RecordButton";
import { BottomSheet } from "@/components/BottomSheet";
import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/Button";
import { NotFound } from "@/components/nav";
import { color, font, radius } from "@/lib/design/tokens";

type Target = { kind: "parcel"; parcelId: string } | { kind: "site" } | { kind: "feature" };

export default function RecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit, hydrated } = useVisitStore();
  const visit = getVisit(id);

  const [target, setTarget] = useState<Target>({ kind: "parcel", parcelId: "" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const scrollEl = useRef<HTMLDivElement | null>(null);

  // default active parcel = first to-assess, else first parcel
  useEffect(() => {
    if (!visit) return;
    if (visit.parcels.length === 0) {
      router.replace(`/visit/${id}/setup`);
      return;
    }
    if (target.kind !== "parcel" || target.parcelId) return;
    const first = visit.parcels.find((p) => p.status === "to-assess") ?? visit.parcels[0];
    if (first) setTarget({ kind: "parcel", parcelId: first.id });
  }, [visit, target, id, router]);

  const targetLabel = useMemo(() => {
    if (!visit) return "";
    if (target.kind === "site") return "Site-level note";
    if (target.kind === "feature") return "Feature";
    const p = visit.parcels.find((x) => x.id === target.parcelId);
    return p ? `${p.name} · ${p.ukhabType.value ?? p.deskStudyOrigin?.ukhabType ?? "untyped"}` : "Parcel";
  }, [visit, target]);

  const events = useMemo(() => (visit ? recordingEventsFromVisit(visit) : []), [visit]);

  const onCommit = useCallback(
    (toks: Tok[], time: string) => {
      const text = toks.map((tok) => tok.text).join("").trim();
      if (!text) return;
      const parcelRef = target.kind === "parcel" ? target.parcelId : null;
      updateVisit(id, (v) => {
        const last = v.features[v.features.length - 1];
        const canMerge =
          last?.kind === "target-note" &&
          last.capturedAt === time &&
          last.targetLabel === targetLabel &&
          last.parcelRef === parcelRef;

        if (canMerge) {
          const merged = mergeTranscript(last.text.value ?? "", text);
          return {
            ...v,
            features: v.features.map((f, i) =>
              i === v.features.length - 1
                ? { ...f, text: field(merged, merged, "green") }
                : f,
            ),
          };
        }

        return {
          ...v,
          features: [
            ...v.features,
            {
              id: newId("f"),
              kind: "target-note",
              text: field(text, text, "green"),
              parcelRef,
              capturedAt: time,
              targetLabel,
            },
          ],
        };
      });
    },
    [id, target, targetLabel, updateVisit],
  );

  const cap = useCapture(onCommit);

  useEffect(() => {
    if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
  }, [events, cap.live]);

  if (!hydrated) {
    return <div style={{ flex: 1 }} aria-busy="true" />;
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
    const parcel = buildFreestyleParcel(`Parcel ${n}`, habitatId);
    updateVisit(id, (v) => ({
      ...v,
      parcels: [...v.parcels, parcel],
    }));
    setTarget({ kind: "parcel", parcelId: parcel.id });
    setSheetOpen(false);
  };

  return (
    <RecordView
      scrollEl={scrollEl}
      visit={visit}
      cap={cap}
      events={events}
      targetLabel={targetLabel}
      onOpenSwitcher={() => setSheetOpen(true)}
      onFinish={() => router.push(`/visit/${id}/processing`)}
    >
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Where does the next note go?">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "8px" }}>
          {visit.parcels.map((p) => {
            const active = target.kind === "parcel" && target.parcelId === p.id;
            return (
              <SwitcherRow
                key={p.id}
                active={active}
                title={p.name}
                sub={p.ukhabType.value ?? p.deskStudyOrigin?.ukhabType ?? "untyped"}
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

function RecordingEventRow({
  time,
  targetLabel,
  toks,
  live,
  accent = color.clay,
}: {
  time: string;
  targetLabel: string;
  toks: Tok[];
  live?: boolean;
  accent?: string;
}) {
  if (toks.length === 0 && !live) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "4px" }}>
        <span style={{ fontFamily: font.mono, fontSize: "11px", color: color.subtle }}>{time}</span>
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
          {targetLabel}
        </span>
        <div style={{ height: "1px", flex: 1, background: color.hair }} />
      </div>
      <div style={{ fontSize: "14px", color: live ? color.ink : color.body, lineHeight: 1.6 }}>
        {toks.map((tk, ti) => (
          <span key={ti} style={tokenStyle(tk.k)}>
            {tk.text}
          </span>
        ))}
        {live && (
          <span
            style={{
              display: "inline-block",
              width: "2px",
              height: "16px",
              marginLeft: "3px",
              verticalAlign: "-3px",
              background: accent,
              animation: "cursorblink 1s step-end infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}

function RecordView({
  scrollEl,
  visit,
  cap,
  events,
  targetLabel,
  onOpenSwitcher,
  onFinish,
  children,
}: {
  scrollEl: React.RefObject<HTMLDivElement | null>;
  visit: ReturnType<ReturnType<typeof useVisitStore>["getVisit"]>;
  cap: ReturnType<typeof useCapture>;
  events: CapturedNote[];
  targetLabel: string;
  onOpenSwitcher: () => void;
  onFinish: () => void;
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

  const needsMicAccess = cap.phase === "prompt" || cap.phase === "checking";
  const btnLabel = cap.mode === "ptt" ? "Release to stop" : cap.mode === "handsfree" ? "Tap to stop" : "";
  const subHint = needsMicAccess
    ? "tap and hold the button to allow the microphone"
    : cap.mode === "idle"
      ? "hold to talk · double-tap for hands-free"
      : "";

  const showError =
    cap.error &&
    !(cap.error === "stt" && (events.length > 0 || cap.live.length > 0));

  const lastEvent = events[events.length - 1];
  const sessionActive = Boolean(cap.sessionTime);
  const continuesLast =
    sessionActive &&
    lastEvent?.time === cap.sessionTime &&
    lastEvent?.targetLabel === targetLabel;
  const staticEvents = continuesLast ? events.slice(0, -1) : events;
  const activeToks = continuesLast ? [...lastEvent.toks, ...cap.live] : cap.live;
  const activeTime = continuesLast ? lastEvent.time : cap.sessionTime;

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

  const swipeVisible = cap.mode === "idle" && !cap.processing && events.length > 0;
  const showRecordControls =
    cap.phase === "ready" || cap.phase === "prompt" || cap.phase === "checking";

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      <div style={contentStyle}>
        <ScreenHeader
          left={
            <StatusDot tone={cap.mode === "handsfree" ? "plum" : cap.mode === "ptt" ? "clay" : "idle"} live={recording} />
          }
          title={visit!.siteName}
          right={
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
          }
        />

        {showError && (
          <ErrorBanner
            error={cap.error!}
            onDismiss={cap.dismissError}
            onRetry={cap.retryMic}
          />
        )}

        <div
          ref={scrollEl}
          className="tscroll"
          style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "11px" }}
        >
          {needsMicAccess && <PermissionPrompt onEnable={cap.requestMic} />}

          {cap.phase === "insecure" && <InsecureMicNotice />}

          {cap.phase === "denied" && <PermissionDenied onRetry={cap.requestMic} />}

          {staticEvents.map((e, i) => (
            <RecordingEventRow key={i} time={e.time} targetLabel={e.targetLabel} toks={e.toks} />
          ))}

          {sessionActive && activeTime && (
            <RecordingEventRow
              time={activeTime}
              targetLabel={targetLabel}
              toks={activeToks}
              live={recording || cap.live.length > 0}
              accent={accent}
            />
          )}
        </div>

        {showRecordControls && (
          <div
            className="gesture-lock"
            style={{
              position: "relative",
              borderTop: `1.5px solid ${color.borderSoft}`,
              padding: "8px 26px calc(env(safe-area-inset-bottom,0px) + 26px)",
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
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "8px 22px 10px", cursor: "grab", touchAction: "none", userSelect: "none" }}
              >
                <div style={{ width: "42px", height: "5px", borderRadius: "3px", background: "#d8d5cd", marginBottom: "4px" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "bob 2.2s ease-in-out infinite" }}>
                  <span style={{ fontSize: "14px", color: color.clay, lineHeight: 1 }}>⌃</span>
                  <span style={{ fontFamily: font.mono, fontSize: "10px", color: color.subtle, letterSpacing: ".03em" }}>
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
            <div style={{ height: "18px", textAlign: "center", fontSize: "13px", fontWeight: 600, color: color.ink }}>{btnLabel}</div>
            {subHint && (
              <div style={{ textAlign: "center", fontSize: "11px", fontFamily: font.mono, color: color.faint, marginTop: "3px" }}>
                {subHint}
              </div>
            )}
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
        Tap the button below and allow microphone access when your browser asks.
      </div>
      <Button onPointerDown={onEnable} onClick={onEnable}>
        Enable microphone
      </Button>
    </Centered>
  );
}

function InsecureMicNotice() {
  return (
    <Centered>
      <div style={{ fontSize: "40px", marginBottom: "10px" }}>🔒</div>
      <div style={{ fontSize: "16px", fontWeight: 600, color: color.ink, marginBottom: "8px" }}>
        HTTPS required for microphone
      </div>
      <div style={{ fontSize: "12.5px", lineHeight: 1.55, color: color.subtle, textAlign: "left" }}>
        <p style={{ margin: "0 0 10px" }}>
          Chrome on your phone blocks the mic on <span style={{ fontFamily: font.mono }}>http://</span>{" "}
          addresses like <span style={{ fontFamily: font.mono }}>192.168.x.x</span>.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          On your computer run <span style={{ fontFamily: font.mono }}>npm run dev:https</span>, then open
          the <span style={{ fontFamily: font.mono }}>https://</span> URL shown in the terminal. Accept the
          certificate warning in Chrome.
        </p>
        <p style={{ margin: 0 }}>
          Android shortcut: with USB debugging, run{" "}
          <span style={{ fontFamily: font.mono }}>adb reverse tcp:3000 tcp:3000</span> and open{" "}
          <span style={{ fontFamily: font.mono }}>http://localhost:3000</span> in Chrome — localhost is
          allowed without HTTPS.
        </p>
      </div>
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
      <div style={{ fontSize: "12.5px", lineHeight: 1.55, color: color.subtle, marginBottom: "14px", maxWidth: "280px", marginInline: "auto" }}>
        In Chrome, tap the lock icon next to the address bar → Permissions → Microphone → Allow, then
        retry. You can also type notes below in the meantime.
      </div>
      <Button variant="secondary" onPointerDown={onRetry} onClick={onRetry}>
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

function SwitcherRow({ active, title, sub, onClick }: { active?: boolean; title: string; sub: string; onClick: () => void }) {
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
        <div style={{ fontSize: "11px", color: color.faint, marginTop: "1px" }}>{sub}</div>
      </div>
      {active && <span style={{ color: color.clay, fontSize: "13px" }}>✓</span>}
    </button>
  );
}
