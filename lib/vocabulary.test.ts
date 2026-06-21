import { expect, test } from "vitest";
import { loadVocabulary, vocabularyTerms } from "./vocabulary";

test("loads non-empty vocabulary terms", () => {
  const vocab = loadVocabulary();
  expect(vocab.length).toBeGreaterThan(0);
});

test("vocabularyTerms returns a flat lowercase string list", () => {
  const terms = vocabularyTerms();
  expect(terms).toContain("badger latrine");
  expect(terms.every((t) => t === t.toLowerCase())).toBe(true);
});
