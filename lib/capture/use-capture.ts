"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Tok } from "@/lib/types";
import { useAudioRecorder } from "@/app/use-audio-recorder";
import { transcribeAudio } from "./transcribe-client";
import {
  GESTURE,
  initialGestureState,
  onHoldTimer,
  onPointerDown,
  onPointerUp,
  type CaptureMode,
  type GestureEvent,
} from "./gesture";
import { connectLiveSession, fetchLiveCreds, type LiveSession } from "./live-stt";
import { highlightKeywords } from "@/lib/highlight";
import { vocabularyTerms } from "@/lib/vocabulary";

/**
 * Capture engine for the record screen. Owns the mic-permission lifecycle, the
 * recording mode, live transcription, and the error/robustness states
 * (no-speech, STT failure, offline, interruption).
 *
 * Hold ≥200ms = push-to-talk. Double-tap = hands-free (stays on until tap).
 * Words stream in as you speak (Deepgram websocket, or a scripted fake live
 * path). If live STT cannot start, release falls back to the batch POST.
 */

export type CapturePhase = "checking" | "prompt" | "denied" | "ready";
export type { CaptureMode };
export type CaptureError = null | "no-speech" | "stt" | "offline" | "interrupted";

function clock(): string {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function toksFor(text: string): Tok[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return highlightKeywords(trimmed, vocabularyTerms());
}

export function useCapture(onCommit: (toks: Tok[], time: string) => void) {
  const [phase, setPhase] = useState<CapturePhase>("checking");
  const [mode, setModeState] = useState<CaptureMode>("idle");
  const [pressing, setPressing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<CaptureError>(null);

  const recorder = useAudioRecorder();
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const modeRef = useRef<CaptureMode>("idle");
  const setMode = (m: CaptureMode) => {
    modeRef.current = m;
    setModeState(m);
  };

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRef = useRef(initialGestureState());
  const liveSessionRef = useRef<LiveSession | null>(null);
  const sessionGen = useRef(0);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

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

  const checkPermission = useCallback(async () => {
    try {
      const perm = await navigator.permissions?.query?.({
        name: "microphone" as PermissionName,
      });
      if (perm?.state === "granted") setPhase("ready");
      else if (perm?.state === "denied") setPhase("denied");
      else setPhase("prompt");
    } catch {
      setPhase("prompt");
    }
  }, []);

  const requestMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPhase("ready");
    } catch {
      setPhase("denied");
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const begin = useCallback(
    async (kind: CaptureMode) => {
      const gen = ++sessionGen.current;
      setMode(kind);
      setPressing(false);
      setError(null);
      setLiveText("");
      haptic();
      acquireWakeLock();

      let live: LiveSession | null = null;
      try {
        const creds = await fetchLiveCreds();
        if (gen !== sessionGen.current) return;
        live = connectLiveSession(creds, (text) => {
          if (gen === sessionGen.current) setLiveText(text);
        }, vocabularyTerms());
        liveSessionRef.current = live;
      } catch {
        live = null;
        liveSessionRef.current = null;
      }

      try {
        await recorderRef.current.start(
          live ? { timeslice: 250, onChunk: (blob) => liveSessionRef.current?.send(blob) } : undefined,
        );
      } catch {
        if (gen !== sessionGen.current) return;
        liveSessionRef.current = null;
        setMode("idle");
        setLiveText("");
        releaseWakeLock();
        setError("stt");
      }
    },
    [acquireWakeLock, releaseWakeLock],
  );

  const finish = useCallback(async () => {
    sessionGen.current += 1;
    gestureRef.current = initialGestureState();
    setMode("idle");
    setPressing(false);
    releaseWakeLock();

    let liveFinal = "";
    try {
      liveFinal = (await liveSessionRef.current?.close()) ?? "";
    } catch {
      liveFinal = "";
    }
    liveSessionRef.current = null;

    let blob: Blob = new Blob();
    try {
      blob = await recorderRef.current.stop();
    } catch {
      if (!liveFinal.trim()) {
        setError("stt");
        setLiveText("");
        return;
      }
    }

    const liveTokens = toksFor(liveFinal);
    if (liveTokens.length) {
      onCommitRef.current(liveTokens, clock());
      setLiveText("");
      return;
    }

    if (blob.size === 0) {
      setError("no-speech");
      setLiveText("");
      return;
    }
    setTranscribing(true);
    try {
      const tokens = await transcribeAudio(blob);
      if (tokens.length) onCommitRef.current(tokens, clock());
      else setError("no-speech");
    } catch {
      setError("stt");
    } finally {
      setTranscribing(false);
      setLiveText("");
    }
  }, [releaseWakeLock]);

  const stop = useCallback(() => {
    haptic(8);
    void finish();
  }, [finish]);

  const applyEvents = useCallback(
    (events: GestureEvent[]) => {
      for (const ev of events) {
        if (ev === "press") setPressing(true);
        if (ev === "unpress") setPressing(false);
        if (ev === "begin-ptt") void begin("ptt");
        if (ev === "begin-handsfree") void begin("handsfree");
        if (ev === "stop") stop();
      }
    },
    [begin, stop],
  );

  useEffect(() => {
    const onOffline = () => setError((e) => e ?? "offline");
    const onOnline = () => setError((e) => (e === "offline" ? null : e));
    const onHidden = () => {
      if (document.hidden && modeRef.current !== "idle") {
        liveSessionRef.current?.close().catch(() => {});
        liveSessionRef.current = null;
        recorderRef.current.stop().catch(() => {});
        sessionGen.current += 1;
        gestureRef.current = initialGestureState();
        setMode("idle");
        setPressing(false);
        setLiveText("");
        releaseWakeLock();
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

  const onBtnDown = useCallback(() => {
    if (phase !== "ready") return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    const now = performance.now();
    const next = onPointerDown(gestureRef.current, now, GESTURE);
    gestureRef.current = next.state;
    applyEvents(next.events);
    if (next.state.holdArmed) {
      holdTimer.current = setTimeout(() => {
        const fired = onHoldTimer(gestureRef.current, performance.now());
        gestureRef.current = fired.state;
        applyEvents(fired.events);
      }, GESTURE.holdMs);
    }
  }, [applyEvents, phase]);

  const onBtnUp = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    const next = onPointerUp(gestureRef.current, performance.now(), GESTURE);
    gestureRef.current = next.state;
    applyEvents(next.events);
  }, [applyEvents]);

  const onBtnLeave = useCallback(() => {
    if (gestureRef.current.mode === "handsfree") {
      setPressing(false);
      return;
    }
    onBtnUp();
  }, [onBtnUp]);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      sessionGen.current += 1;
      liveSessionRef.current?.close().catch(() => {});
      releaseWakeLock();
    },
    [releaseWakeLock],
  );

  const dismissError = useCallback(() => setError(null), []);
  const simulateSttError = useCallback(() => setError("stt"), []);

  return {
    phase,
    mode,
    pressing,
    transcribing,
    liveText,
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
