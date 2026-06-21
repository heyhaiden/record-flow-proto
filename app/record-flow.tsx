"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Tok } from "@/lib/types";
import { useAudioRecorder } from "./use-audio-recorder";

type Mode = "idle" | "ptt" | "handsfree" | "lobby";

interface Marker {
  time: string;
  gap: string | null;
}
interface Note {
  marker: Marker | null;
  toks: Tok[];
}

const PHRASES: Tok[][] = [
  [
    { text: "Standing water by the ", k: 0 },
    { text: "pond", k: 1 },
    { text: " after rain, the margins look churned.", k: 0 },
  ],
  [
    { text: "Possible ", k: 0 },
    { text: "badger latrine", k: 2 },
    { text: " at the south corner — flag for ", k: 0 },
    { text: "protected species", k: 2 },
    { text: " check.", k: 0 },
  ],
  [
    { text: "North boundary has mature ", k: 0 },
    { text: "oak", k: 1 },
    { text: " with ", k: 0 },
    { text: "bat roost", k: 2 },
    { text: " features worth a look.", k: 0 },
  ],
  [
    { text: "Margins show ", k: 0 },
    { text: "soft rush", k: 1 },
    { text: " and ", k: 0 },
    { text: "reed canary-grass", k: 1 },
    { text: ", a wetter mosaic than mapped.", k: 0 },
  ],
];

const INITIAL_NOTES: Note[] = [
  {
    marker: { time: "09:38", gap: null },
    toks: [
      { text: "Semi-improved ", k: 0 },
      { text: "neutral grassland", k: 1 },
      { text: ", roughly ", k: 0 },
      { text: "two hectares", k: 1 },
      { text: ", gentle north-facing slope.", k: 0 },
    ],
  },
  {
    marker: null,
    toks: [
      { text: "Hedgerow", k: 1 },
      { text: " on the western edge — ", k: 0 },
      { text: "hawthorn", k: 1 },
      { text: " dominant, some ", k: 0 },
      { text: "elder", k: 1 },
      { text: ".", k: 0 },
    ],
  },
];

const INITIAL_TIME_QUEUE: Marker[] = [
  { time: "10:14", gap: "6 min later" },
  { time: "10:31", gap: "4 min later" },
  { time: "10:48", gap: "5 min later" },
  { time: "11:05", gap: "3 min later" },
];

function styleFor(k: number): CSSProperties {
  if (k === 1)
    return {
      background: "#eef2ec",
      borderBottom: "2px solid #5f7a5b",
      borderRadius: "2px",
      padding: "0 2px",
    };
  if (k === 2)
    return {
      background: "#f6e0dc",
      borderBottom: "2px solid #b5604e",
      borderRadius: "2px",
      padding: "0 2px",
      color: "#7a2f28",
      fontWeight: 500,
    };
  return {};
}

export default function RecordFlow() {
  // -------- render state --------
  const [mode, setModeState] = useState<Mode>("idle");
  const [siteName, setSiteNameState] = useState("Oakfield Meadow");
  const [notes, setNotesState] = useState<Note[]>(INITIAL_NOTES);
  const [live, setLiveState] = useState<Tok[]>([]);
  const [showLive, setShowLive] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [dragY, setDragYState] = useState(0);
  const [dragActive, setDragActiveState] = useState(false);
  const [filing, setFiling] = useState(false);
  const [filedName, setFiledName] = useState("Oakfield Meadow");
  const [filedCount, setFiledCount] = useState(9);

  // -------- mirrors for closures inside timers / pointer handlers --------
  const modeRef = useRef<Mode>(mode);
  const liveRef = useRef<Tok[]>(live);
  const notesRef = useRef<Note[]>(notes);
  const siteNameRef = useRef(siteName);
  const dragYRef = useRef(0);
  const dragActiveRef = useRef(false);

  const setMode = (v: Mode) => {
    modeRef.current = v;
    setModeState(v);
  };
  const setLive = (updater: Tok[] | ((prev: Tok[]) => Tok[])) => {
    setLiveState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      liveRef.current = next;
      return next;
    });
  };
  const setNotes = (updater: Note[] | ((prev: Note[]) => Note[])) => {
    setNotesState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      notesRef.current = next;
      return next;
    });
  };
  const setSiteName = (v: string) => {
    siteNameRef.current = v;
    setSiteNameState(v);
  };
  const setDragY = (v: number) => {
    dragYRef.current = v;
    setDragYState(v);
  };
  const setDragActive = (v: boolean) => {
    dragActiveRef.current = v;
    setDragActiveState(v);
  };

  // -------- audio + transcription --------
  const recorder = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);

  // -------- engine refs --------
  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCount = useRef(0);
  const pIdx = useRef(-1);
  const timeQueue = useRef<Marker[]>([...INITIAL_TIME_QUEUE]);
  const streamSegs = useRef<Tok[]>([]);
  const streamPos = useRef(0);
  const sessionFirst = useRef(true);
  const grabStart = useRef(0);
  const scrollEl = useRef<HTMLDivElement | null>(null);

  // keep the transcript pinned to the bottom (componentDidUpdate equivalent)
  useEffect(() => {
    if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
  }, [notes, live, mode]);

  // clear any pending timers on unmount
  useEffect(() => {
    return () => {
      if (streamTimer.current) clearInterval(streamTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const nextPhrase = useCallback((): Tok[] => {
    pIdx.current = (pIdx.current + 1) % PHRASES.length;
    return PHRASES[pIdx.current].slice();
  }, []);

  const commitLive = useCallback(() => {
    const current = liveRef.current;
    if (!current.length) return;
    const marker = sessionFirst.current
      ? timeQueue.current.shift() || { time: "12:00", gap: "later" }
      : null;
    sessionFirst.current = false;
    setNotes((prev) => [...prev, { marker, toks: current }]);
    setLive([]);
  }, []);

  const tick = useCallback(
    (kind: Mode) => {
      if (streamPos.current < streamSegs.current.length) {
        const seg = streamSegs.current[streamPos.current++];
        setLive((s) => [...s, seg]);
      } else if (kind === "handsfree") {
        commitLive();
        streamSegs.current = nextPhrase();
        streamPos.current = 0;
      } else if (streamTimer.current) {
        clearInterval(streamTimer.current);
      }
    },
    [commitLive, nextPhrase],
  );

  const beginStream = useCallback(
    (kind: Mode) => {
      if (streamTimer.current) clearInterval(streamTimer.current);
      sessionFirst.current = true;
      streamSegs.current = nextPhrase();
      streamPos.current = 0;
      setMode(kind);
      setShowLive(true);
      setLive([]);
      setPressing(false);
      streamTimer.current = setInterval(() => tick(kind), 300);
    },
    [nextPhrase, tick],
  );

  const startHandsfree = useCallback(() => {
    beginStream("handsfree");
  }, [beginStream]);

  const startPTT = useCallback(() => {
    if (modeRef.current !== "idle") return;
    setMode("ptt");
    setShowLive(true);
    setLive([]);
    recorder.start().catch(() => {
      setMode("idle");
      setShowLive(false);
    });
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    if (streamTimer.current) clearInterval(streamTimer.current);
    if (modeRef.current === "handsfree") {
      commitLive();
      setMode("idle");
      setShowLive(false);
      setLive([]);
      setPressing(false);
      return;
    }
    setMode("idle");
    setShowLive(false);
    setPressing(false);
    if (!recorder.recording) return;
    setTranscribing(true);
    const blob = await recorder.stop();
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      const json = (await res.json()) as { tokens: Tok[] };
      if (json.tokens?.length) {
        const marker = sessionFirst.current
          ? timeQueue.current.shift() ?? { time: "12:00", gap: "later" }
          : null;
        sessionFirst.current = false;
        setNotes((prev) => [...prev, { marker, toks: json.tokens }]);
      }
    } finally {
      setTranscribing(false);
      setLive([]);
    }
  }, [commitLive, recorder]);

  // -------- gesture detection --------
  const registerTap = useCallback(() => {
    if (modeRef.current === "handsfree") {
      stopRecording();
      return;
    }
    tapCount.current += 1;
    if (tapCount.current === 1) {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
      }, 280);
    } else {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapCount.current = 0;
      if (modeRef.current === "idle") startHandsfree();
    }
  }, [startHandsfree, stopRecording]);

  const onBtnDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    setPressing(true);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(startPTT, 200);
  };
  const onBtnUp = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPressing(false);
    if (modeRef.current === "ptt") {
      stopRecording();
      return;
    }
    registerTap();
  };
  const onBtnLeave = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPressing(false);
    if (modeRef.current === "ptt") stopRecording();
  };

  // -------- swipe to finish --------
  const onGrabDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    grabStart.current = e.clientY;
    setDragActive(true);
  };
  const onGrabMove = (e: ReactPointerEvent) => {
    if (!dragActiveRef.current) return;
    setDragY(Math.min(0, e.clientY - grabStart.current));
  };
  const onGrabUp = () => {
    const finish = dragYRef.current <= -90;
    setDragActive(false);
    if (finish) {
      setFiling(true);
      setDragY(-820);
      setTimeout(() => {
        setFiling(false);
        setDragY(0);
        setFiledName(siteNameRef.current);
        setFiledCount(notesRef.current.length);
        setMode("lobby");
      }, 360);
    } else {
      setDragY(0);
    }
  };

  const onStartNew = () => {
    pIdx.current = -1;
    timeQueue.current = [
      { time: "13:02", gap: "start" },
      { time: "13:20", gap: "5 min later" },
      { time: "13:34", gap: "4 min later" },
    ];
    setMode("idle");
    setSiteName("Mill Pond scrub");
    setNotes([]);
    setLive([]);
    setShowLive(false);
    setDragY(0);
  };
  const onResume = () => {
    setMode("idle");
    setSiteName(filedName);
    setDragY(0);
  };

  // -------- derived render values --------
  const recording = mode === "ptt" || mode === "handsfree";
  const accent = mode === "handsfree" ? "#7c6585" : "#a8674e";
  const glow =
    mode === "handsfree" ? "rgba(124,101,133,.22)" : "rgba(168,103,78,.2)";

  let scale = 0.62;
  if (recording) scale = 1;
  else if (pressing) scale = 0.74;

  let bg = "#b0ada4";
  if (mode === "ptt") bg = "#a8674e";
  else if (mode === "handsfree") bg = "#7c6585";

  const btnStyle: CSSProperties = {
    width: "96px",
    height: "96px",
    borderRadius: "50%",
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: `scale(${scale})`,
    transition:
      "transform .28s cubic-bezier(.34,1.5,.5,1), background .25s, box-shadow .25s",
    boxShadow: recording
      ? `0 0 0 9px ${glow}`
      : "0 4px 12px rgba(0,0,0,.12)",
    cursor: "pointer",
    touchAction: "none",
    userSelect: "none",
  };

  const rings: CSSProperties[] = [];
  if (recording) {
    const n = mode === "handsfree" ? 3 : 2;
    const dur = mode === "handsfree" ? 2.3 : 1.9;
    for (let i = 0; i < n; i++)
      rings.push({
        position: "absolute",
        inset: 0,
        margin: "auto",
        width: "100px",
        height: "100px",
        borderRadius: "50%",
        border: `2.5px solid ${accent}`,
        pointerEvents: "none",
        animation: `pulsering ${dur}s ease-out ${((i * dur) / n).toFixed(2)}s infinite`,
      });
  }

  const dotStyle: CSSProperties = {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
    background:
      mode === "handsfree" ? "#7c6585" : mode === "ptt" ? "#a8674e" : "#bdbab2",
    animation: recording ? "blink 1.4s ease-in-out infinite" : "none",
  };
  const statusText =
    mode === "ptt" ? "Recording" : mode === "handsfree" ? "Hands-free" : "";
  const statusStyle: CSSProperties = {
    fontSize: "11px",
    fontWeight: 500,
    color: mode === "handsfree" ? "#7c6585" : "#a8674e",
    fontFamily: "'Spline Sans Mono',monospace",
    marginLeft: "2px",
  };

  const contentStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    transform: filing
      ? "translateY(-110vh)"
      : `translateY(${Math.min(0, dragY)}px)`,
    opacity: filing ? 0 : 1,
    transition: dragActive ? "none" : "transform .34s ease, opacity .34s ease",
  };

  const caretStyle: CSSProperties = {
    display: "inline-block",
    width: "2px",
    height: "16px",
    marginLeft: "3px",
    verticalAlign: "-3px",
    background: accent,
    animation: "cursorblink 1s step-end infinite",
  };

  const btnLabel =
    mode === "ptt"
      ? "Release to stop"
      : mode === "handsfree"
        ? "Tap to stop"
        : "";
  const subHint =
    mode === "ptt"
      ? "keep holding while you speak"
      : mode === "handsfree"
        ? "walk the site — it keeps listening"
        : "hold to talk · double-tap for hands-free";

  const swipeVisible = mode === "idle" && notes.length > 0;
  const emptyState = notes.length === 0 && !showLive;
  const isLobby = mode === "lobby";

  return (
    <div
      style={{
        position: "relative",
        height: "100dvh",
        width: "100%",
        maxWidth: "480px",
        margin: "0 auto",
        background: "#fff",
        overflow: "hidden",
        fontFamily: "'Inter',sans-serif",
        boxShadow: "0 0 0 1px rgba(0,0,0,.04)",
      }}
    >
      {/* ===================== RECORD VIEW ===================== */}
      {!isLobby && (
        <div style={contentStyle}>
          {/* header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "26px 20px 12px",
              borderBottom: "1.5px solid #ece9e1",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: "#3a3833",
                fontWeight: 600,
              }}
            >
              <span style={dotStyle} />
              {siteName}
              {statusText && <span style={statusStyle}>{statusText}</span>}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 11px",
                border: "1.5px solid #d4d1c9",
                borderRadius: "8px",
                fontSize: "11.5px",
                color: "#55534d",
              }}
            >
              Form ▾
            </div>
          </div>

          {/* transcript */}
          <div
            ref={scrollEl}
            className="tscroll"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "11px",
            }}
          >
            {emptyState && (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  color: "#b0ada4",
                  maxWidth: "220px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Caveat',cursive",
                    fontSize: "24px",
                    color: "#9a978f",
                    marginBottom: "6px",
                  }}
                >
                  Nothing captured yet
                </div>
                <div style={{ fontSize: "12.5px", lineHeight: 1.5 }}>
                  Hold the button to talk, or double-tap for hands-free.
                </div>
              </div>
            )}

            {notes.map((note, ni) => (
              <div key={ni} style={{ display: "contents" }}>
                {note.marker && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      marginTop: "2px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Spline Sans Mono',monospace",
                        fontSize: "11px",
                        color: "#8a877f",
                      }}
                    >
                      {note.marker.time}
                    </span>
                    {note.marker.gap && (
                      <span style={{ fontSize: "10.5px", color: "#bdbab2" }}>
                        · resumed {note.marker.gap}
                      </span>
                    )}
                    <div
                      style={{ height: "1px", flex: 1, background: "#f0eee7" }}
                    />
                  </div>
                )}
                <div
                  style={{
                    fontSize: "14px",
                    color: "#3a3833",
                    lineHeight: 1.6,
                  }}
                >
                  {note.toks.map((tk, ti) => (
                    <span key={ti} style={styleFor(tk.k)}>
                      {tk.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {showLive && (
              <div
                style={{ fontSize: "14px", color: "#1c1c1a", lineHeight: 1.6 }}
              >
                {live.map((tk, ti) => (
                  <span key={ti} style={styleFor(tk.k)}>
                    {tk.text}
                  </span>
                ))}
                <span style={caretStyle} />
              </div>
            )}
            {transcribing && (
              <div style={{ fontSize: "13px", color: "#a7a49c", fontFamily: "'Spline Sans Mono',monospace" }}>
                transcribing…
              </div>
            )}
          </div>

          {/* dock */}
          <div
            style={{
              position: "relative",
              borderTop: "1.5px solid #ece9e1",
              padding: "8px 26px 26px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* swipe grab handle */}
            {swipeVisible && (
              <div
                onPointerDown={onGrabDown}
                onPointerMove={onGrabMove}
                onPointerUp={onGrabUp}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  padding: "8px 22px 10px",
                  cursor: "grab",
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "5px",
                    borderRadius: "3px",
                    background: "#d8d5cd",
                    marginBottom: "4px",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0,
                    animation: "bob 2.2s ease-in-out infinite",
                  }}
                >
                  <span
                    style={{ fontSize: "14px", color: "#a8674e", lineHeight: 1 }}
                  >
                    ⌃
                  </span>
                  <span
                    style={{
                      fontFamily: "'Spline Sans Mono',monospace",
                      fontSize: "10px",
                      color: "#8a877f",
                      letterSpacing: ".03em",
                    }}
                  >
                    swipe up to finish visit
                  </span>
                </div>
              </div>
            )}

            {/* record button */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "160px",
                height: "128px",
              }}
            >
              {rings.map((r, ri) => (
                <div key={ri} style={r} />
              ))}
              <div
                onPointerDown={onBtnDown}
                onPointerUp={onBtnUp}
                onPointerLeave={onBtnLeave}
                style={btnStyle}
              >
                {mode === "handsfree" ? (
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      background: "#fff",
                      borderRadius: "7px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "34px",
                        border: "3px solid #fff",
                        borderRadius: "11px",
                      }}
                    />
                    <div
                      style={{
                        width: "26px",
                        height: "12px",
                        border: "3px solid #fff",
                        borderTop: "none",
                        borderRadius: "0 0 14px 14px",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                height: "18px",
                textAlign: "center",
                fontSize: "13px",
                fontWeight: 600,
                color: "#1c1c1a",
              }}
            >
              {btnLabel}
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: "11px",
                fontFamily: "'Spline Sans Mono',monospace",
                color: "#a7a49c",
                marginTop: "3px",
              }}
            >
              {subHint}
            </div>
          </div>
        </div>
      )}

      {/* ===================== LOBBY VIEW ===================== */}
      {isLobby && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
          }}
        >
          <div
            style={{
              padding: "30px 20px 14px",
              borderBottom: "1.5px solid #ece9e1",
            }}
          >
            <div
              style={{
                fontFamily: "'Spline Sans Mono',monospace",
                fontSize: "10px",
                letterSpacing: ".14em",
                color: "#a7a49c",
                marginBottom: "4px",
              }}
            >
              SITE LOBBY
            </div>
            <div style={{ fontSize: "19px", fontWeight: 600, color: "#1c1c1a" }}>
              Today&apos;s visits
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "11px",
            }}
          >
            <div
              onClick={onResume}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "11px",
                padding: "13px 14px",
                border: "1.5px solid #d9e0d6",
                background: "#eef2ec",
                borderRadius: "13px",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#5f7a5b",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "11px",
                  flex: "none",
                }}
              >
                ✓
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "#2a3a28",
                  }}
                >
                  {filedName}
                </div>
                <div style={{ fontSize: "11px", color: "#5f7a5b" }}>
                  filed · {filedCount} notes · just now
                </div>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#5f7a5b",
                  fontFamily: "'Spline Sans Mono',monospace",
                }}
              >
                open ›
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "11px",
                padding: "13px 14px",
                border: "1.5px solid #e6e3db",
                borderRadius: "13px",
              }}
            >
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  border: "2px solid #c2bfb6",
                  flex: "none",
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "#3a3833",
                  }}
                >
                  Mill Pond scrub
                </div>
                <div style={{ fontSize: "11px", color: "#a7a49c" }}>
                  scheduled · 14:30
                </div>
              </div>
            </div>
            <div
              onClick={onStartNew}
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "15px",
                borderRadius: "14px",
                background: "#a8674e",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                boxShadow: "0 6px 16px rgba(168,103,78,.28)",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: "17px" }}>+</span>Start new visit
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
