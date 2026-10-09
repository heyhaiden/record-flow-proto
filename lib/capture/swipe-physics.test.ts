import { expect, test } from "vitest";
import {
  FINISH_DISTANCE,
  resistedDy,
  sampleVelocity,
  shouldFinish,
  tickInertia,
} from "./swipe-physics";

test("upward drag is resisted so the sheet feels heavy", () => {
  const raw = -120;
  const visual = resistedDy(raw);
  expect(visual).toBeLessThan(0);
  expect(visual).toBeGreaterThan(raw);
});

test("downward drag is clamped", () => {
  expect(resistedDy(40)).toBe(0);
});

test("a deep pull finishes even with little velocity", () => {
  expect(shouldFinish(FINISH_DISTANCE - 10, 0)).toBe(true);
});

test("a flick finishes even if the pull is short", () => {
  expect(shouldFinish(-40, -1.2)).toBe(true);
});

test("a tiny nudge springs back", () => {
  expect(shouldFinish(-12, -0.05)).toBe(false);
});

test("inertia keeps travelling after release", () => {
  const next = tickInertia(-50, -0.9, 16);
  expect(next.dy).toBeLessThan(-50);
  expect(Math.abs(next.velocity)).toBeLessThan(0.9);
  expect(next.settled).toBe(false);
});

test("inertia settles near rest", () => {
  const next = tickInertia(-8, -0.01, 16);
  expect(next.settled).toBe(true);
});

test("velocity sampling smooths noisy pointer moves", () => {
  const v = sampleVelocity(100, 80, 0, 16, 0);
  expect(v).toBeLessThan(0);
  const v2 = sampleVelocity(80, 70, 16, 32, v);
  expect(v2).toBeLessThan(0);
});
