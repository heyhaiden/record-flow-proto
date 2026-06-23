import { expect, test } from "vitest";
import { transcriptText, type TranscriptNote } from "./types";

const notes: TranscriptNote[] = [
  { id: "n1", text: "Hawthorn dominant.", target: { kind: "parcel", parcelId: "p1" }, capturedAt: "14:30" },
  { id: "n2", text: "Badger latrine south corner.", target: { kind: "feature" }, capturedAt: "14:32" },
];

test("transcriptText joins note text with newlines", () => {
  expect(transcriptText(notes)).toBe("Hawthorn dominant.\nBadger latrine south corner.");
});

test("transcriptText is empty for no notes", () => {
  expect(transcriptText([])).toBe("");
});
