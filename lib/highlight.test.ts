import { expect, test } from "vitest";
import { highlightKeywords } from "./highlight";

test("plain text with no matches is one k=0 token", () => {
  expect(highlightKeywords("nothing here", [])).toEqual([
    { text: "nothing here", k: 0 },
  ]);
});

test("a matched term becomes a k=1 token, case-insensitive", () => {
  const toks = highlightKeywords("Some Hawthorn here", ["hawthorn"]);
  expect(toks).toEqual([
    { text: "Some ", k: 0 },
    { text: "Hawthorn", k: 1 },
    { text: " here", k: 0 },
  ]);
});

test("longest term wins over a shorter overlapping term", () => {
  const toks = highlightKeywords("a badger latrine here", [
    "badger",
    "badger latrine",
  ]);
  expect(toks).toEqual([
    { text: "a ", k: 0 },
    { text: "badger latrine", k: 1 },
    { text: " here", k: 0 },
  ]);
});
