export type CaptureMode = "idle" | "ptt" | "handsfree";

export interface GestureConfig {
  holdMs: number;
  doubleTapMs: number;
}

export interface GestureState {
  mode: CaptureMode;
  lastTapUpAt: number | null;
  holdArmed: boolean;
  ignoreNextUp: boolean;
}

export type GestureEvent = "press" | "unpress" | "begin-ptt" | "begin-handsfree" | "stop";

export const GESTURE: GestureConfig = { holdMs: 200, doubleTapMs: 320 };

export function initialGestureState(): GestureState {
  return { mode: "idle", lastTapUpAt: null, holdArmed: false, ignoreNextUp: false };
}

export function onPointerDown(
  state: GestureState,
  now: number,
  cfg: GestureConfig,
): { state: GestureState; events: GestureEvent[] } {
  const events: GestureEvent[] = ["press"];
  if (state.mode === "handsfree" || state.mode === "ptt") {
    return { state: { ...state, holdArmed: false }, events };
  }
  const isDouble = state.lastTapUpAt !== null && now - state.lastTapUpAt <= cfg.doubleTapMs;
  if (isDouble) {
    return {
      state: { mode: "handsfree", lastTapUpAt: null, holdArmed: false, ignoreNextUp: true },
      events: [...events, "begin-handsfree"],
    };
  }
  return { state: { ...state, holdArmed: true }, events };
}

export function onHoldTimer(
  state: GestureState,
  _now: number,
): { state: GestureState; events: GestureEvent[] } {
  if (!state.holdArmed || state.mode !== "idle") {
    return { state: { ...state, holdArmed: false }, events: [] };
  }
  return {
    state: { ...state, mode: "ptt", holdArmed: false, lastTapUpAt: null },
    events: ["begin-ptt"],
  };
}

export function onPointerUp(
  state: GestureState,
  now: number,
  _cfg: GestureConfig,
): { state: GestureState; events: GestureEvent[] } {
  const events: GestureEvent[] = ["unpress"];
  if (state.ignoreNextUp) {
    return { state: { ...state, ignoreNextUp: false, holdArmed: false }, events };
  }
  if (state.mode === "ptt" || state.mode === "handsfree") {
    return { state: initialGestureState(), events: [...events, "stop"] };
  }
  return { state: { ...state, holdArmed: false, lastTapUpAt: now }, events };
}
