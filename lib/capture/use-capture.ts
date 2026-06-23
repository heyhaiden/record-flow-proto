"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Tok } from "@/lib/types";

/**
 * Capture engine for the record screen. Owns the mic-permission lifecycle, the
 * recording mode (push-to-talk / hands-free), the live transcript stream, and
 * the error/robustness states (no-speech, STT failure, offline, interruption).
 *
 * For the prototype the transcript is streamed from scripted demo phrases, but
 * the mic permission, wake-lock, online/offline and interruption handling are
 * REAL — that robustness layer is the point. Swapping the demo stream for
 * useAudioRecorder + POST /api/transcribe (the M1 seam) is a localised change.
 */

export type CapturePhase = "checking" | "prompt" | "denied" | "ready";
export type CaptureMode = "idle" | "ptt" | "handsfree";
export type CaptureError = null | "no-speech" | "stt" | "offline" | "interrupted";

const DEMO_PHRASES: Tok[][] = [
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

function clock(): string {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function useCapture(onCommit: (toks: Tok[], time: string) => void) {
  const [phase, setPhase] = useState<CapturePhase>("checking");
  const [mode, setModeState] = useState<CaptureMode>("idle");
  const [pressing, setPressing] = useState(false);
  const [live, setLiveState] = useState<Tok[]>([]);
  const [error, setError] = useState<CaptureError>(null);

  // refs to read latest values inside timers / pointer handlers
  const modeRef = useRef<CaptureMode>("idle");
  const liveRef = useRef<Tok[]>([]);
  const setMode = (m: CaptureMode) => {
    modeRef.current = m;
    setModeState(m);
  };
  const setLive = (u: Tok[] | ((p: Tok[]) => Tok[])) =>
    setLiveState((prev) => {
      const next = typeof u === "function" ? u(prev) : u;
      liveRef.current = next;
      return next;
    });

  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCount = useRef(0);
  const pIdx = useRef(-1);
  const segs = useRef<Tok[]>([]);
  const pos = useRef(0);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // wake lock (keep screen awake during capture)
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const acquireWakeLock = useCallback(async () => {
    try {
      if (navigator.wakeLock) wakeLock.current = await navigator.wakeLock.request("screen");
    } catch {
      /* non-fatal */
    }
  }, []);
  const releaseWakeLock = useCallback(() => {
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const haptic = (ms = 12) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* ignore */
    }
  };

  // -------- mic permission --------
  const checkPermission = useCallback(async () => {
    try {
      const perm = await navigator.permissions?.query?.({
        name: "microphone" as PermissionName,
      });
      if (perm?.state === "granted") setPhase("ready");
      else if (perm?.state === "denied") setPhase("denied");
      else setPhase("prompt");
    } catch {
      setPhase("prompt"); // permissions API unavailable — show the pre-prompt
    }
  }, []);

  const requestMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only needed consent; release the device until capture starts.
      stream.getTracks().forEach((t) => t.stop());
      setPhase("ready");
    } catch {
      setPhase("denied");
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // -------- offline + interruption --------
  useEffect(() => {
    const onOffline = () => setError((e) => e ?? "offline");
    const onOnline = () => setError((e) => (e === "offline" ? null : e));
    const onHidden = () => {
      if (document.hidden && (modeRef.current === "ptt" || modeRef.current === "handsfree")) {
        stopInternal();
        setError("interrupted");
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHidden);
    if (!navigator.onLine) setError("offline");
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHidden);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- streaming engine --------
  const nextPhrase = () => {
    pIdx.current = (pIdx.current + 1) % DEMO_PHRASES.length;
    return DEMO_PHRASES[pIdx.current].slice();
  };

  const commit = useCallback(() => {
    const cur = liveRef.current;
    if (!cur.length) return;
    onCommitRef.current(cur, clock());
    setLive([]);
  }, []);

  const tick = useCallback(
    (kind: CaptureMode) => {
      if (pos.current < segs.current.length) {
        const seg = segs.current[pos.current++];
        setLive((s) => [...s, seg]);
      } else if (kind === "handsfree") {
        commit();
        segs.current = nextPhrase();
        pos.current = 0;
      } else if (streamTimer.current) {
        clearInterval(streamTimer.current); // ptt: hold caret until release
      }
    },
    [commit],
  );

  const begin = useCallback(
    (kind: CaptureMode) => {
      if (streamTimer.current) clearInterval(streamTimer.current);
      segs.current = nextPhrase();
      pos.current = 0;
      setMode(kind);
      setLive([]);
      setPressing(false);
      setError(null);
      haptic();
      acquireWakeLock();
      streamTimer.current = setInterval(() => tick(kind), 300);
    },
    [acquireWakeLock, tick],
  );

  const stopInternal = useCallback(() => {
    if (streamTimer.current) clearInterval(streamTimer.current);
    commit();
    setMode("idle");
    setLive([]);
    setPressing(false);
    releaseWakeLock();
  }, [commit, releaseWakeLock]);

  const stop = useCallback(() => {
    haptic(8);
    stopInternal();
  }, [stopInternal]);

  // -------- gesture detection (hold = ptt, double-tap = handsfree) --------
  const registerTap = useCallback(() => {
    if (modeRef.current === "handsfree") {
      stop();
      return;
    }
    tapCount.current += 1;
    if (tapCount.current === 1) {
      tapTimer.current = setTimeout(() => (tapCount.current = 0), 280);
    } else {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapCount.current = 0;
      if (modeRef.current === "idle") begin("handsfree");
    }
  }, [begin, stop]);

  const onBtnDown = useCallback(() => {
    if (phase !== "ready") return;
    setPressing(true);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      if (modeRef.current === "idle") begin("ptt");
    }, 200);
  }, [begin, phase]);

  const onBtnUp = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPressing(false);
    if (modeRef.current === "ptt") {
      stop();
      return;
    }
    registerTap();
  }, [registerTap, stop]);

  const onBtnLeave = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPressing(false);
    if (modeRef.current === "ptt") stop();
  }, [stop]);

  // cleanup
  useEffect(
    () => () => {
      if (streamTimer.current) clearInterval(streamTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      releaseWakeLock();
    },
    [releaseWakeLock],
  );

  const dismissError = useCallback(() => setError(null), []);
  /** Dev/demo affordance to exercise the STT-error recovery path. */
  const simulateSttError = useCallback(() => setError("stt"), []);

  return {
    phase,
    mode,
    pressing,
    live,
    error,
    requestMic,
    retryMic: requestMic,
    onBtnDown,
    onBtnUp,
    onBtnLeave,
    dismissError,
    simulateSttError,
  };
}
