import { expect, test } from "vitest";
import { isConfidence } from "./schema";

test("isConfidence accepts the enum, rejects junk", () => {
  expect(isConfidence("high")).toBe(true);
  expect(isConfidence("medium")).toBe(true);
  expect(isConfidence("low")).toBe(true);
  expect(isConfidence("definitely")).toBe(false);
  expect(isConfidence("")).toBe(false);
});
