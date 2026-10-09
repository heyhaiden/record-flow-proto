import { expect, test } from "vitest";
import { resolveFirstProjectId } from "./onboarding";

test("the first stored id wins even if more projects are created later", () => {
  expect(resolveFirstProjectId("visit_a", ["visit_b", "visit_a"])).toBe("visit_a");
});

test("with no stored id, the oldest freestyle visit is the tutorial project", () => {
  // newest-first order, matching createFreestyle prepending
  expect(resolveFirstProjectId(null, ["visit_new", "visit_old"])).toBe("visit_old");
});

test("no tutorial when there are no freestyle visits yet", () => {
  expect(resolveFirstProjectId(null, [])).toBeNull();
});
