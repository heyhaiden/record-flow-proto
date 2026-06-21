"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Mock Google Drive connection state, shared between Settings and Export via
 * localStorage. The real DestinationProvider (Drive/Docs OAuth) replaces this
 * at M4 — the screens only ever read `connected` and call `connect/disconnect`.
 */
const KEY = "record-flow:drive-connected";

export function useDriveConnection() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(window.localStorage.getItem(KEY) === "1");
  }, []);

  const set = useCallback((v: boolean) => {
    setConnected(v);
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return {
    connected,
    connect: () => set(true),
    disconnect: () => set(false),
  };
}
