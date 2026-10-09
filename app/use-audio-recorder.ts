"use client";

import { useCallback, useRef, useState } from "react";

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = useCallback(async (opts?: { timeslice?: number; onChunk?: (blob: Blob) => void }) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : undefined;
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunks.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.current.push(e.data);
        opts?.onChunk?.(e.data);
      }
    };
    mr.start(opts?.timeslice);
    mediaRecorder.current = mr;
    setRecording(true);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const mr = mediaRecorder.current;
      if (!mr || mr.state === "inactive") return resolve(new Blob());
      mr.onstop = () => {
        mr.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        resolve(new Blob(chunks.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.stop();
    });
  }, []);

  return { recording, start, stop };
}
