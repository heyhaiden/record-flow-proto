"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  closeDeepgramLiveConnection,
  openDeepgramLiveConnection,
  sendDeepgramLiveAudio,
  type DeepgramAuthMode,
} from "@/lib/stt/deepgram-live-connection";
import { parseDeepgramLiveMessage } from "@/lib/stt/deepgram-live";
import { mergeTranscript } from "@/lib/stt/transcript-merge";
import { highlightKeywords } from "@/lib/highlight";
import { vocabularyTerms } from "@/lib/vocabulary";
import type { Tok } from "@/lib/types";

/**
 * Capture engine for field memos. Streams audio to Deepgram over a live WebSocket
 * for interim on-screen transcription, committing final utterances as memo notes.
 * Falls back to batch /api/transcribe when live streaming is unavailable.
 */

export type CapturePhase = "checking" | "prompt" | "denied" | "insecure" | "ready";
export type CaptureMode = "idle" | "ptt" | "handsfree";
export type CaptureError = null | "no-speech" | "stt" | "offline" | "interrupted";

const LIVE_CHUNK_MS = 250;
const CLOSE_GRACE_MS = 450;

function clock(): string {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function bestAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function fieldMicConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };
}

function requestMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: fieldMicConstraints() });
}

async function fetchDeepgramToken(): Promise<{ token: string; authMode: DeepgramAuthMode }> {
  const res = await fetch("/api/deepgram/token", { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as { token?: string; authMode?: DeepgramAuthMode };
  if (!json.token) throw new Error("missing token");
  return { token: json.token, authMode: json.authMode ?? "bearer" };
}

export function useCapture(onCommit: (toks: Tok[], time: string) => void) {
  const [phase, setPhase] = useState<CapturePhase>("checking");
  const [mode, setModeState] = useState<CaptureMode>("idle");
  const [pressing, setPressing] = useState(false);
  const [live, setLiveState] = useState<Tok[]>([]);
  const [error, setError] = useState<CaptureError>(null);
  const [processing, setProcessing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sessionTime, setSessionTime] = useState<string | null>(null);

  const modeRef = useRef<CaptureMode>("idle");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const socketRef = useRef<Awaited<ReturnType<typeof openDeepgramLiveConnection>> | null>(null);
  const chunks = useRef<Blob[]>([]);
  const keywordsRef = useRef<string[]>([]);
  const gotSpeechRef = useRef(false);
  const liveTextRef = useRef("");
  const sessionTextRef = useRef("");
  const sessionTimeRef = useRef("");
  const realtimeRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<CapturePhase>("checking");
  const pendingStreamRef = useRef<Promise<MediaStream> | null>(null);
  const captureIdRef = useRef(0);

  const setPhaseBoth = useCallback((next: CapturePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const releasePendingStream = useCallback(() => {
    const pending = pendingStreamRef.current;
    pendingStreamRef.current = null;
    if (!pending) return;
    void pending
      .then((stream) => stream.getTracks().forEach((track) => track.stop()))
      .catch(() => {});
  }, []);

  const setMode = (m: CaptureMode) => {
    modeRef.current = m;
    setModeState(m);
  };

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCount = useRef(0);
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

  const startSession = useCallback(() => {
    sessionTextRef.current = "";
    const t = clock();
    sessionTimeRef.current = t;
    setSessionTime(t);
    gotSpeechRef.current = false;
    liveTextRef.current = "";
    setLiveState([]);
  }, []);

  const refreshLiveDisplay = useCallback((interim: string) => {
    const display = mergeTranscript(sessionTextRef.current, interim);
    if (!display.trim()) {
      setLiveState([]);
      return;
    }
    setLiveState(highlightKeywords(display, keywordsRef.current));
  }, []);

  const appendFinalSegment = useCallback(
    (text: string) => {
      const merged = mergeTranscript(sessionTextRef.current, text);
      if (!merged.trim()) return;
      sessionTextRef.current = merged;
      gotSpeechRef.current = true;
      liveTextRef.current = "";
      setError(null);
      refreshLiveDisplay("");
    },
    [refreshLiveDisplay],
  );

  const commitSession = useCallback(() => {
    const text = sessionTextRef.current.trim();
    if (!text) return false;
    gotSpeechRef.current = true;
    setError(null);
    onCommitRef.current(highlightKeywords(text, keywordsRef.current), sessionTimeRef.current || clock());
    sessionTextRef.current = "";
    sessionTimeRef.current = "";
    setSessionTime(null);
    setLiveState([]);
    liveTextRef.current = "";
    return true;
  }, []);

  const showLiveTranscript = useCallback(
    (text: string) => {
      liveTextRef.current = text.trim();
      refreshLiveDisplay(text);
    },
    [refreshLiveDisplay],
  );

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    closeDeepgramLiveConnection(socket);
  }, []);

  const stopTracks = useCallback(() => {
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    mediaStream.current = null;
  }, []);

  const transcribeChunks = useCallback(async () => {
    const audio = new Blob(chunks.current, {
      type: mediaRecorder.current?.mimeType || "audio/webm",
    });
    chunks.current = [];
    mediaRecorder.current = null;
    releaseWakeLock();

    if (audio.size === 0) {
      if (!gotSpeechRef.current) setError("no-speech");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": audio.type },
        body: audio,
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { tokens?: Tok[]; text?: string };
      const tokens = json.tokens?.length ? json.tokens : json.text ? [{ text: json.text, k: 0 }] : [];
      if (tokens.length === 0) {
        if (!gotSpeechRef.current) setError("no-speech");
        return;
      }
      const text = tokens.map((t) => t.text).join("").trim();
      sessionTextRef.current = mergeTranscript(sessionTextRef.current, text);
      commitSession();
      gotSpeechRef.current = true;
      setLiveState([]);
    } catch {
      if (!gotSpeechRef.current) {
        setError(navigator.onLine ? "stt" : "offline");
      }
    } finally {
      setProcessing(false);
    }
  }, [commitSession, releaseWakeLock]);

  const finalizeRealtime = useCallback(() => {
    closeSocket();
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (liveTextRef.current.trim()) {
        sessionTextRef.current = mergeTranscript(sessionTextRef.current, liveTextRef.current);
        liveTextRef.current = "";
      }
      if (commitSession()) return;
      if (gotSpeechRef.current) {
        setError(null);
        setLiveState([]);
        setSessionTime(null);
        return;
      }
      setLiveState([]);
      setSessionTime(null);
      setError("no-speech");
    }, CLOSE_GRACE_MS + 50);
  }, [closeSocket, commitSession]);

  const finishCapture = useCallback(() => {
    captureIdRef.current += 1;

    const recorder = mediaRecorder.current;
    const usedRealtime = realtimeRef.current;
    realtimeRef.current = false;
    setConnecting(false);
    setMode("idle");
    setPressing(false);

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    stopTracks();
    releaseWakeLock();

    if (usedRealtime) {
      finalizeRealtime();
      return;
    }

    setLiveState([]);
    liveTextRef.current = "";
    if (chunks.current.length > 0) {
      void transcribeChunks();
    } else if (!gotSpeechRef.current) {
      setError("no-speech");
    }
  }, [finalizeRealtime, releaseWakeLock, stopTracks, transcribeChunks]);

  const beginBatch = useCallback(
    async (kind: CaptureMode, stream: MediaStream, mimeType?: string) => {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      startSession();
      realtimeRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTracks();
        if (!realtimeRef.current) void transcribeChunks();
      };

      mediaRecorder.current = recorder;
      mediaStream.current = stream;
      setMode(kind);
      setLiveState([]);
      setPressing(false);
      setError(null);
      haptic();
      await acquireWakeLock();
      // Single blob on stop — concatenated timeslices are invalid for batch upload.
      recorder.start();
    },
    [acquireWakeLock, startSession, stopTracks, transcribeChunks],
  );

  const beginRealtime = useCallback(
    async (
      kind: CaptureMode,
      stream: MediaStream,
      mimeType: string | undefined,
      token: string,
      authMode: DeepgramAuthMode,
      captureId: number,
    ) => {
      const socket = await openDeepgramLiveConnection(token, authMode);

      if (captureId !== captureIdRef.current) {
        closeDeepgramLiveConnection(socket);
        stream.getTracks().forEach((track) => track.stop());
        setConnecting(false);
        return;
      }

      socketRef.current = socket;
      realtimeRef.current = true;
      startSession();

      socket.on("message", (data) => {
        const parsed = parseDeepgramLiveMessage(
          data as Parameters<typeof parseDeepgramLiveMessage>[0],
        );
        if (!parsed) return;
        if (parsed.isFinal) appendFinalSegment(parsed.transcript);
        else showLiveTranscript(parsed.transcript);
      });

      socket.on("error", () => {
        socketRef.current = null;
        realtimeRef.current = false;
      });

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) sendDeepgramLiveAudio(socketRef.current, e.data);
      };
      recorder.onstop = () => {
        stopTracks();
        releaseWakeLock();
        if (socketRef.current) finalizeRealtime();
      };

      if (captureId !== captureIdRef.current) {
        closeDeepgramLiveConnection(socket);
        socketRef.current = null;
        realtimeRef.current = false;
        setConnecting(false);
        return;
      }

      mediaRecorder.current = recorder;
      mediaStream.current = stream;
      setMode(kind);
      setConnecting(false);
      setLiveState([]);
      setPressing(false);
      setError(null);
      haptic();
      await acquireWakeLock();
      recorder.start(LIVE_CHUNK_MS);
    },
    [acquireWakeLock, appendFinalSegment, finalizeRealtime, releaseWakeLock, showLiveTranscript, startSession, stopTracks],
  );

  const begin = useCallback(
    async (kind: CaptureMode, existingStream?: MediaStream) => {
      const captureId = ++captureIdRef.current;
      try {
        keywordsRef.current = vocabularyTerms();
        const stream = existingStream ?? (await requestMicStream());
        if (captureId !== captureIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const mimeType = bestAudioMimeType();

        if (!navigator.onLine) {
          await beginBatch(kind, stream, mimeType);
          return;
        }

        setConnecting(true);
        try {
          const { token, authMode } = await fetchDeepgramToken();
          await beginRealtime(kind, stream, mimeType, token, authMode, captureId);
        } catch {
          if (captureId !== captureIdRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          socketRef.current = null;
          realtimeRef.current = false;
          setConnecting(false);
          await beginBatch(kind, stream, mimeType);
        }
      } catch {
        setConnecting(false);
        setPhaseBoth("denied");
        setPressing(false);
        releaseWakeLock();
      }
    },
    [beginBatch, beginRealtime, releaseWakeLock, setPhaseBoth],
  );

  const checkPermission = useCallback(() => {
    if (!window.isSecureContext) {
      setPhaseBoth("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhaseBoth("denied");
      return;
    }
    if (!navigator.permissions?.query) {
      setPhaseBoth("prompt");
      return;
    }
    void navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((perm) => {
        if (perm.state === "granted") setPhaseBoth("ready");
        else if (perm.state === "denied") setPhaseBoth("denied");
        else setPhaseBoth("prompt");
      })
      .catch(() => setPhaseBoth("prompt"));
  }, [setPhaseBoth]);

  const requestMic = useCallback(() => {
    if (!window.isSecureContext) {
      setPhaseBoth("insecure");
      return;
    }
    if (pendingStreamRef.current) return;
    const pending = requestMicStream();
    pendingStreamRef.current = pending;
    void pending
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        setPhaseBoth("ready");
      })
      .catch(() => setPhaseBoth("denied"))
      .finally(() => {
        if (pendingStreamRef.current === pending) pendingStreamRef.current = null;
      });
  }, [setPhaseBoth]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    const onOffline = () => setError((e) => e ?? "offline");
    const onOnline = () => setError((e) => (e === "offline" ? null : e));
    const onHidden = () => {
      if (document.hidden && (modeRef.current === "ptt" || modeRef.current === "handsfree")) {
        finishCapture();
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
  }, [finishCapture]);

  const stop = useCallback(() => {
    haptic(8);
    finishCapture();
  }, [finishCapture]);

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

  const onBtnDown = useCallback((e?: React.PointerEvent) => {
    e?.preventDefault();
    if (!window.isSecureContext) {
      setPhaseBoth("insecure");
      return;
    }

    setPressing(true);

    if (phaseRef.current === "prompt" || phaseRef.current === "checking") {
      requestMic();
      return;
    }

    if (phaseRef.current !== "ready") return;

    // iOS Safari requires getUserMedia to start during the touch — not after a delay.
    const pending = requestMicStream();
    pendingStreamRef.current = pending;

    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      if (modeRef.current !== "idle") return;
      const streamPromise = pendingStreamRef.current;
      pendingStreamRef.current = null;
      if (!streamPromise) return;
      void streamPromise
        .then((stream) => begin("ptt", stream))
        .catch(() => {
          setPhaseBoth("denied");
          setPressing(false);
        });
    }, 200);
  }, [begin, requestMic, setPhaseBoth]);

  const onBtnUp = useCallback((e?: React.PointerEvent) => {
    e?.preventDefault();
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (modeRef.current !== "ptt") releasePendingStream();
    setPressing(false);
    if (modeRef.current === "ptt") {
      stop();
      return;
    }
    registerTap();
  }, [registerTap, releasePendingStream, stop]);

  const onBtnLeave = useCallback((e?: React.PointerEvent) => {
    e?.preventDefault();
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (modeRef.current !== "ptt") releasePendingStream();
    setPressing(false);
    if (modeRef.current === "ptt") stop();
  }, [releasePendingStream, stop]);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      releasePendingStream();
      mediaRecorder.current?.stop();
      closeSocket();
      stopTracks();
      releaseWakeLock();
    },
    [closeSocket, releasePendingStream, releaseWakeLock, stopTracks],
  );

  const dismissError = useCallback(() => setError(null), []);

  return {
    phase,
    mode,
    pressing,
    live,
    error,
    processing,
    connecting,
    sessionTime,
    requestMic,
    retryMic: requestMic,
    onBtnDown,
    onBtnUp,
    onBtnLeave,
    dismissError,
  };
}
