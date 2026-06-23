import { describe, expect, it } from "vitest";
import { parseAreaFromSpeech, parseConditionFromSpeech } from "@/lib/model/gap-fill";

describe("gap-fill parsers", () => {
  it("parses area from speech", () => {
    expect(parseAreaFromSpeech("about half a hectare")).toBeNull();
    expect(parseAreaFromSpeech("0.5 hectares")).toBe(0.5);
    expect(parseAreaFromSpeech("roughly 1.2 ha")).toBe(1.2);
  });

  it("parses condition from speech", () => {
    expect(parseConditionFromSpeech("I'd say moderate condition")).toBe("Moderate");
    expect(parseConditionFromSpeech("good")).toBe("Good");
    expect(parseConditionFromSpeech("unclear")).toBeNull();
  });
});
