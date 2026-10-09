import { expect, test } from "vitest";
import {
  initialGestureState,
  onHoldTimer,
  onPointerDown,
  onPointerUp,
} from "./gesture";

const cfg = { holdMs: 200, doubleTapMs: 320 };

test("a hold longer than the threshold begins push-to-talk", () => {
  let state = initialGestureState();
  const down = onPointerDown(state, 0, cfg);
  expect(down.events).toEqual(["press"]);
  expect(down.state.holdArmed).toBe(true);

  const held = onHoldTimer(down.state, 200);
  expect(held.events).toEqual(["begin-ptt"]);
  expect(held.state.mode).toBe("ptt");

  const up = onPointerUp(held.state, 900, cfg);
  expect(up.events).toContain("stop");
  expect(up.state.mode).toBe("idle");
});

test("a short tap does not start recording", () => {
  let state = initialGestureState();
  state = onPointerDown(state, 0, cfg).state;
  const up = onPointerUp(state, 80, cfg);
  expect(up.events).toEqual(["unpress"]);
  expect(up.state.mode).toBe("idle");
  expect(up.state.lastTapUpAt).toBe(80);
});

test("a second tap within the double-tap window starts hands-free", () => {
  let state = initialGestureState();
  state = onPointerDown(state, 0, cfg).state;
  state = onPointerUp(state, 60, cfg).state;

  const down2 = onPointerDown(state, 200, cfg);
  expect(down2.events).toContain("begin-handsfree");
  expect(down2.state.mode).toBe("handsfree");

  const up2 = onPointerUp(down2.state, 260, cfg);
  expect(up2.events).not.toContain("stop");
  expect(up2.state.mode).toBe("handsfree");
});

test("a later tap while hands-free stops recording", () => {
  let state = initialGestureState();
  state = onPointerDown(state, 0, cfg).state;
  state = onPointerUp(state, 60, cfg).state;
  state = onPointerDown(state, 200, cfg).state;
  state = onPointerUp(state, 260, cfg).state;

  const down = onPointerDown(state, 1200, cfg);
  const up = onPointerUp(down.state, 1280, cfg);
  expect(up.events).toContain("stop");
  expect(up.state.mode).toBe("idle");
});

test("a hold timer that fires after hands-free started is ignored", () => {
  let state = initialGestureState();
  state = onPointerDown(state, 0, cfg).state;
  state = onPointerUp(state, 40, cfg).state;
  state = onPointerDown(state, 100, cfg).state;
  const late = onHoldTimer(state, 300);
  expect(late.events).toEqual([]);
  expect(late.state.mode).toBe("handsfree");
});
