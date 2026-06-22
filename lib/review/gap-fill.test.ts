import { describe, expect, it } from "vitest";
import { parseArea, parseCondition, parseCriterionState } from "./gap-fill";

describe("parseArea", () => {
  it("extracts a number from speech", () => {
    expect(parseArea("about half a hectare, 0.5 ha")).toBe(0.5);
    expect(parseArea("0.4 km linear")).toBe(0.4);
  });

  it("returns null when no number", () => {
    expect(parseArea("quite large")).toBeNull();
  });
});

describe("parseCondition", () => {
  it("maps spoken condition words", () => {
    expect(parseCondition("I'd say moderate overall")).toBe("Moderate");
    expect(parseCondition("good condition")).toBe("Good");
    expect(parseCondition("poor state")).toBe("Poor");
  });
});

describe("parseCriterionState", () => {
  it("maps pass and fail", () => {
    expect(parseCriterionState("pass")).toBe("pass");
    expect(parseCriterionState("that's a fail")).toBe("fail");
    expect(parseCriterionState("unclear answer")).toBeNull();
  });
});
