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
import { field, type Condition, type NoteTarget, type Visit } from "@/lib/model/types";
import type { Tok } from "@/lib/types";
import { newId } from "@/lib/id";
import { habitatOptions, criteriaFor } from "@/lib/model/conditions";
import { highlightKeywords } from "@/lib/highlight";
import { vocabularyTerms } from "@/lib/vocabulary";
import { tokenStyle } from "@/components/Token";
import { ScreenHeader } from "@/components/ScreenHeader";
import { RecordButton } from "@/components/RecordButton";
import { BottomSheet } from "@/components/BottomSheet";
import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/Button";
import { BackButton, NotFound } from "@/components/nav";
import { color, font, radius } from "@/lib/design/tokens";
import { navigate } from "@/lib/nav";
import {
  resistedDy,
  sampleVelocity,
  shouldFinish,
  tickInertia,
} from "@/lib/capture/swipe-physics";
import {
  adoptFirstProject,
  hasPlayedSwipeTug,
  isTutorialVisit,
  markSwipeTugPlayed,
} from "@/lib/store/onboarding";

type Target = NoteTarget;

interface LocalNote {
  id: string;
  toks: Tok[];
  time: string;
  targetLabel: string;
}

function labelFromTarget(visit: Visit, target: NoteTarget): string {
  if (target.kind === "site") return "Site-level note";
  if (target.kind === "feature") return "Feature";
  const p = visit.parcels.find((x) => x.id === target.parcelId);
  if (!p) return "Parcel";
  const habitatLabel = p.ukhabType.value ?? p.deskStudyOrigin?.ukhabType;
  return habitatLabel ? `${p.name} · ${habitatLabel}` : p.name;
}

export default function RecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit, visits, hydrated } = useVisitStore();
  const visit = getVisit(id);

  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [target, setTarget] = useState<Target>({ kind: "parcel", parcelId: "" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const scrollEl = useRef<HTMLDivElement | null>(null);
  const seeded = useRef(false);
  const tutorial = Boolean(visit && isTutorialVisit(visit.id, visits));

  useEffect(() => {
    if (hydrated) adoptFirstProject(visits);
  }, [hydrated, visits]);

  useEffect(() => {
    if (!visit || target.kind !== "parcel" || target.parcelId) return;
    const first = visit.parcels.find((p) => p.status === "to-assess") ?? visit.parcels[0];
    if (first) setTarget({ kind: "parcel", parcelId: first.id });
  }, [visit, target]);

  useEffect(() => {
    if (!visit || seeded.current) return;
    seeded.current = true;
    const existing = visit.transcript ?? [];
    if (!existing.length) return;
    setNotes(
      existing.map((n) => ({
        id: n.id,
        toks: highlightKeywords(n.text, vocabularyTerms()),
        time: n.capturedAt,
        targetLabel: labelFromTarget(visit, n.target),
      })),
    );
  }, [visit]);

  const targetLabel = useMemo(() => (visit ? labelFromTarget(visit, target) : ""), [visit, target]);
  const showTargetSwitcher = (visit?.parcels.length ?? 0) > 1;

  const onCommit = useCallback(
    (toks: Tok[], time: string) => {
      const noteId = newId("note");
      setNotes((prev) => [...prev, { id: noteId, toks, time, targetLabel }]);
      const text = toks.map((t) => t.text).join("");
      updateVisit(id, (v) => ({
        ...v,
        transcript: [...(v.transcript ?? []), { id: noteId, text, target, capturedAt: time }],
      }));
    },
    [targetLabel, id, target, updateVisit],
  );

  const saveNoteText = useCallback(
    (noteId: string, text: string) => {
      const next = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (!next) return;
      const toks = highlightKeywords(next, vocabularyTerms());
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, toks } : n)));
      updateVisit(id, (v) => ({
        ...v,
        transcript: (v.transcript ?? []).map((n) => (n.id === noteId ? { ...n, text: next } : n)),
      }));
    },
    [id, updateVisit],
  );

  const cap = useCapture(onCommit);

  useEffect(() => {
    if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
  }, [notes, cap.transcribing, cap.liveText]);

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

  return (
    <RecordView
      scrollEl={scrollEl}
      visit={visit}
      cap={cap}
      notes={notes}
      targetLabel={targetLabel}
      showTargetSwitcher={showTargetSwitcher}
      onOpenSwitcher={() => setSheetOpen(true)}
      onFinish={() => navigate(router, `/visit/${id}/processing`)}
      onBack={() => navigate(router, "/")}
      tutorial={tutorial}
      onSaveNoteText={saveNoteText}
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
  tutorial,
  onSaveNoteText,
  children,
}: {
  scrollEl: React.RefObject<HTMLDivElement | null>;
  visit: Visit;
  cap: ReturnType<typeof useCapture>;
  notes: LocalNote[];
  targetLabel: string;
  showTargetSwitcher: boolean;
  onOpenSwitcher: () => void;
  onFinish: () => void;
  onBack: () => void;
  tutorial: boolean;
  onSaveNoteText: (noteId: string, text: string) => void;
  children: React.ReactNode;
}) {
  const accent = cap.mode === "handsfree" ? color.plum : color.clay;
  const recording = cap.mode === "ptt" || cap.mode === "handsfree";
  const canSwipe = cap.mode === "idle" && notes.length > 0 && !cap.liveText;
  const swipe = useSwipeToFinish(canSwipe, onFinish, { tutorial, visitId: visit.id });

  const btnLabel =
    cap.mode === "ptt"
      ? "Release to stop"
      : cap.mode === "handsfree"
        ? "Listening…"
        : cap.transcribing
          ? "Transcribing…"
          : "";
  const subHint =
    cap.mode === "ptt"
      ? "words appear as you speak"
      : cap.mode === "handsfree"
        ? "hands-free · tap to stop"
        : "hold to talk · double-tap hands-free";

  const contentStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    background: color.surface,
    transform: swipe.filing ? "translateY(-110vh)" : `translateY(${swipe.dragY}px)`,
    opacity: swipe.filing ? 0 : 1,
    transition: swipe.dragActive || swipe.coasting ? "none" : "transform .5s cubic-bezier(.22,1,.36,1), opacity .34s ease",
  };

  const swipeVisible = canSwipe;

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      <div style={contentStyle}>
        <ScreenHeader
          left={
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <BackButton onClick={onBack} />
              <StatusDot tone={cap.mode === "handsfree" ? "plum" : cap.mode === "ptt" ? "clay" : "idle"} live={recording} />
            </span>
          }
          title={visit.siteName}
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

        {cap.error && <ErrorBanner error={cap.error} onDismiss={cap.dismissError} onRetry={cap.retryMic} />}

        <div
          ref={scrollEl}
          className="tscroll"
          style={{ flex: 1, overflowY: "auto", padding: "16px 18px 28px", display: "flex", flexDirection: "column", gap: "11px" }}
        >
          {cap.phase === "checking" && <Centered>Checking microphone…</Centered>}

          {cap.phase === "prompt" && <PermissionPrompt onEnable={cap.requestMic} />}

          {cap.phase === "denied" && <PermissionDenied onRetry={cap.retryMic} />}

          {cap.phase === "ready" && notes.length === 0 && !cap.transcribing && !cap.liveText && (
            <Centered>
              <div style={{ fontFamily: font.hand, fontSize: "24px", color: "#9a978f", marginBottom: "6px" }}>
                Nothing captured yet
              </div>
              <div style={{ fontSize: "12.5px", lineHeight: 1.55, color: color.idle }}>
                Hold to talk. Double-tap to keep recording.
              </div>
            </Centered>
          )}

          {notes.map((n) => (
            <NoteRow key={n.id} note={n} onSaveText={(text) => onSaveNoteText(n.id, text)} />
          ))}

          {cap.liveText && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "4px" }}>
                <span style={{ fontFamily: font.mono, fontSize: "11px", color: accent }}>
                  {cap.mode === "handsfree" ? "LIVE" : "NOW"}
                </span>
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
              <div style={{ fontSize: "14px", color: color.body, lineHeight: 1.6 }}>
                {highlightKeywords(cap.liveText, vocabularyTerms()).map((tk, ti) => (
                  <span key={ti} style={tokenStyle(tk.k)}>
                    {tk.text}
                  </span>
                ))}
                <span
                  style={{
                    display: "inline-block",
                    width: "2px",
                    height: "14px",
                    marginLeft: "2px",
                    background: accent,
                    verticalAlign: "-2px",
                    animation: "cursorblink 1s step-end infinite",
                  }}
                />
              </div>
            </div>
          )}

          {cap.transcribing && !cap.liveText && (
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

        {cap.phase === "ready" && (
          <div
            style={{
              position: "relative",
              flex: "none",
              borderTop: `1.5px solid ${color.borderSoft}`,
              padding: swipeVisible ? "0 22px" : "8px 22px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {swipeVisible && (
              <div
                onPointerDown={swipe.onGrabDown}
                onPointerMove={swipe.onGrabMove}
                onPointerUp={swipe.onGrabUp}
                onPointerCancel={swipe.onGrabUp}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: tutorial ? "6px" : "0px",
                  padding: tutorial ? "14px 12px 6px" : "10px 12px 4px",
                  marginTop: "-6px",
                  cursor: swipe.dragActive ? "grabbing" : "grab",
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    width: tutorial ? "48px" : "36px",
                    height: "5px",
                    borderRadius: "999px",
                    background: color.grabber,
                    boxShadow: "0 1px 0 rgba(0,0,0,.04)",
                    opacity: tutorial || swipe.tugging ? 1 : 0.7,
                  }}
                />
                {tutorial && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      animation: swipe.dragActive || swipe.tugging ? "none" : "bob 2.4s ease-in-out infinite",
                      color: color.clay,
                    }}
                  >
                    <span style={{ fontSize: "11px", letterSpacing: ".12em", lineHeight: 1, opacity: 0.85 }}>⌃</span>
                    <span
                      style={{
                        fontFamily: font.hand,
                        fontSize: "20px",
                        lineHeight: 1.1,
                        color: color.clay,
                      }}
                    >
                      swipe up to finish
                    </span>
                  </div>
                )}
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
      </div>

      {children}
    </div>
  );
}

const TUG_PX = -34;

function useSwipeToFinish(
  enabled: boolean,
  onFinish: () => void,
  opts: { tutorial: boolean; visitId: string },
) {
  const [dragY, setDragY] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [coasting, setCoasting] = useState(false);
  const [filing, setFiling] = useState(false);
  const [tugging, setTugging] = useState(false);
  const dragging = useRef(false);
  const tugCancel = useRef(false);
  const rawY = useRef(0);
  const startY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const vel = useRef(0);
  const raf = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const cancelRaf = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  const file = () => {
    setCoasting(false);
    setFiling(true);
    setTimeout(() => onFinishRef.current(), 340);
  };

  const onGrabDown = (e: ReactPointerEvent) => {
    if (!enabled) return;
    tugCancel.current = true;
    setTugging(false);
    cancelRaf();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setDragActive(true);
    setCoasting(false);
    setFiling(false);
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastT.current = performance.now();
    vel.current = 0;
    rawY.current = 0;
    setDragY(0);
  };

  const onGrabMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    const now = performance.now();
    vel.current = sampleVelocity(lastY.current, e.clientY, lastT.current, now, vel.current);
    lastY.current = e.clientY;
    lastT.current = now;
    rawY.current = Math.min(0, e.clientY - startY.current);
    setDragY(resistedDy(rawY.current));
  };

  const onGrabUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setDragActive(false);
    const y = rawY.current;
    const v = vel.current;
    if (shouldFinish(y, v)) {
      file();
      return;
    }
    setCoasting(true);
    let cy = y;
    let cv = v;
    let prev = performance.now();
    const step = (t: number) => {
      const dt = Math.min(32, t - prev);
      prev = t;
      if (shouldFinish(cy, cv)) {
        file();
        return;
      }
      const next = tickInertia(cy, cv, dt);
      cy = next.dy;
      cv = next.velocity;
      setDragY(resistedDy(cy));
      if (next.settled) {
        setCoasting(false);
        setDragY(0);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelRaf(), []);

  useEffect(() => {
    if (!enabled || !opts.tutorial) return;
    if (hasPlayedSwipeTug(opts.visitId)) return;
    tugCancel.current = false;
    markSwipeTugPlayed(opts.visitId);
    let timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => {
      timers.push(setTimeout(fn, ms));
    };
    later(700, () => {
      if (tugCancel.current || dragging.current) return;
      setTugging(true);
      setDragY(TUG_PX);
    });
    later(700 + 480, () => {
      if (tugCancel.current || dragging.current) return;
      setDragY(0);
    });
    later(700 + 480 + 420, () => {
      if (tugCancel.current || dragging.current) return;
      setDragY(TUG_PX);
    });
    later(700 + 480 + 420 + 480, () => {
      if (tugCancel.current || dragging.current) return;
      setDragY(0);
      setTugging(false);
    });
    return () => {
      tugCancel.current = true;
      timers.forEach(clearTimeout);
      setTugging(false);
      if (!dragging.current) setDragY(0);
    };
    // tutorial tug runs once when the first note lands
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, opts.tutorial, opts.visitId]);

  return { dragY, dragActive, coasting, filing, tugging, onGrabDown, onGrabMove, onGrabUp };
}

function placeCaretAtPoint(x: number, y: number) {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  const sel = window.getSelection();
  if (!sel) return;
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    if (!range) return;
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function NoteRow({ note, onSaveText }: { note: LocalNote; onSaveText: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [gen, setGen] = useState(0);
  const textRef = useRef<HTMLDivElement | null>(null);
  const lastTap = useRef(0);
  const editingRef = useRef(false);
  const snapToks = useRef(note.toks);
  const original = note.toks.map((t) => t.text).join("");

  const beginEdit = (x: number, y: number) => {
    if (editingRef.current) return;
    editingRef.current = true;
    snapToks.current = note.toks;
    setEditing(true);
    requestAnimationFrame(() => {
      textRef.current?.focus();
      placeCaretAtPoint(x, y);
    });
  };

  const commit = () => {
    if (!editingRef.current) return;
    const next = (textRef.current?.innerText ?? "").replace(/\u00a0/g, " ");
    editingRef.current = false;
    setEditing(false);
    if (next.replace(/\s+/g, " ").trim() && next !== original) onSaveText(next);
    else setGen((g) => g + 1);
  };

  const cancel = () => {
    editingRef.current = false;
    setEditing(false);
    setGen((g) => g + 1);
  };

  return (
    <div style={{ touchAction: "manipulation" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "4px" }}>
        <span style={{ fontFamily: font.mono, fontSize: "11px", color: color.subtle }}>{note.time}</span>
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
          {note.targetLabel}
        </span>
        <div style={{ height: "1px", flex: 1, background: color.hair }} />
      </div>
      <div
        key={gen}
        ref={textRef}
        contentEditable={editing}
        suppressContentEditableWarning
        role={editing ? "textbox" : undefined}
        aria-label="Transcript note"
        onPointerUp={(e) => {
          if (editingRef.current) return;
          const now = performance.now();
          if (now - lastTap.current < 320) {
            lastTap.current = 0;
            beginEdit(e.clientX, e.clientY);
          } else {
            lastTap.current = now;
          }
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          beginEdit(e.clientX, e.clientY);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget as HTMLDivElement).blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        style={{
          fontSize: "14px",
          color: color.body,
          lineHeight: 1.6,
          outline: "none",
          caretColor: color.clay,
          cursor: "text",
        }}
      >
        {(editing ? snapToks.current : note.toks).map((tk, ti) => (
          <span key={ti} style={tokenStyle(tk.k)}>
            {tk.text}
          </span>
        ))}
      </div>
    </div>
  );
}

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
