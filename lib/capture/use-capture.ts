"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Tok } from "@/lib/types";
import { useAudioRecorder } from "@/app/use-audio-recorder";
import { transcribeAudio } from "./transcribe-client";

/**
 * Capture engine for the record screen. Owns the mic-permission lifecycle, the
 * recording mode, the transcribe round-trip, and the error/robustness states
 * (no-speech, STT failure, offline, interruption).
 *
 * M1 is push-to-talk batch: hold to record → release → POST the clip to
 * /api/transcribe → commit the returned (already-highlighted) tokens. Hands-free
 * (continuous record-then-transcribe) is deferred; the `handsfree` mode is left
 * in the enum so the future path slots in without churning the UI contract.
 */

export type CapturePhase = "checking" | "prompt" | "denied" | "ready";
export type CaptureMode = "idle" | "ptt" | "handsfree";
export type CaptureError = null | "no-speech" | "stt" | "offline" | "interrupted";

function clock(): string {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function useCapture(onCommit: (toks: Tok[], time: string) => void) {
  const [phase, setPhase] = useState<CapturePhase>("checking");
  const [mode, setModeState] = useState<CaptureMode>("idle");
  const [pressing, setPressing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<CaptureError>(null);

  const recorder = useAudioRecorder();
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  // ref to read the latest mode inside timers / pointer handlers / listeners
  const modeRef = useRef<CaptureMode>("idle");
  const setMode = (m: CaptureMode) => {
    modeRef.current = m;
    setModeState(m);
  };

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // -------- streaming / transcribe --------
  const begin = useCallback(
    async (kind: CaptureMode) => {
      setMode(kind);
      setPressing(false);
      setError(null);
      haptic();
      acquireWakeLock();
      try {
        await recorderRef.current.start();
      } catch {
        setMode("idle");
        releaseWakeLock();
        setError("stt");
      }
    },
    [acquireWakeLock, releaseWakeLock],
  );

  // Stop recording, send the clip for transcription, commit the tokens.
  const finish = useCallback(async () => {
    setMode("idle");
    setPressing(false);
    releaseWakeLock();
    let blob: Blob;
    try {
      blob = await recorderRef.current.stop();
    } catch {
      setError("stt");
      return;
    }
    if (blob.size === 0) {
      setError("no-speech");
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
    }
  }, [releaseWakeLock]);

  const stop = useCallback(() => {
    haptic(8);
    void finish();
  }, [finish]);

  // -------- offline + interruption --------
  useEffect(() => {
    const onOffline = () => setError((e) => e ?? "offline");
    const onOnline = () => setError((e) => (e === "offline" ? null : e));
    const onHidden = () => {
      if (document.hidden && modeRef.current !== "idle") {
        // Drop the in-flight clip — we don't transcribe audio captured while
        // the app was backgrounded.
        recorderRef.current.stop().catch(() => {});
        setMode("idle");
        setPressing(false);
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

  // -------- gesture detection (hold = push-to-talk) --------
  const onBtnDown = useCallback(() => {
    if (phase !== "ready") return;
    setPressing(true);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      if (modeRef.current === "idle") void begin("ptt");
    }, 200);
  }, [begin, phase]);

  const onBtnUp = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPressing(false);
    if (modeRef.current === "ptt") stop();
  }, [stop]);

  const onBtnLeave = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPressing(false);
    if (modeRef.current === "ptt") stop();
  }, [stop]);

  // cleanup
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
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
    transcribing,
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
