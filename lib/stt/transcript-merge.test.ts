import { expect, test } from "vitest";
import { mergeTranscript } from "./transcript-merge";

test("appends incremental segments", () => {
  expect(mergeTranscript("now I'm taking", "a look around")).toBe("now I'm taking a look around");
});

test("replaces with cumulative transcript", () => {
  expect(mergeTranscript("now I'm taking", "now I'm taking a look around")).toBe(
    "now I'm taking a look around",
  );
});

test("dedupes identical or suffix overlap", () => {
  expect(mergeTranscript("hello world", "world")).toBe("hello world");
  expect(mergeTranscript("hello", "hello")).toBe("hello");
});

test("merges word overlap at boundary", () => {
  expect(mergeTranscript("birds roosting there", "there you can tell")).toBe(
    "birds roosting there you can tell",
  );
});
