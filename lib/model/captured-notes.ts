import { highlightKeywords } from "@/lib/highlight";
import { mergeTranscript } from "@/lib/stt/transcript-merge";
import type { Tok } from "@/lib/types";
import { vocabularyTerms } from "@/lib/vocabulary";
import type { Feature, Visit } from "./types";

export interface CapturedNote {
  toks: Tok[];
  time: string;
  targetLabel: string;
}

function labelForFeature(visit: Visit, feature: Feature): string {
  if (feature.targetLabel) return feature.targetLabel;
  const parcel = feature.parcelRef ? visit.parcels.find((p) => p.id === feature.parcelRef) : null;
  if (!parcel) return "Site-level note";
  return `${parcel.name} · ${parcel.ukhabType.value ?? parcel.deskStudyOrigin?.ukhabType ?? "untyped"}`;
}

function toksToText(toks: Tok[]): string {
  return toks.map((t) => t.text).join("");
}

/** Group persisted notes into recording events (one header per parcel + clock minute). */
export function recordingEventsFromVisit(visit: Visit): CapturedNote[] {
  const keywords = vocabularyTerms();
  const events: CapturedNote[] = [];

  for (const feature of visit.features) {
    if (feature.kind !== "target-note" || !feature.text.value) continue;

    const time = feature.capturedAt ?? "saved";
    const targetLabel = labelForFeature(visit, feature);
    const last = events[events.length - 1];

    if (last && last.time === time && last.targetLabel === targetLabel) {
      const merged = mergeTranscript(toksToText(last.toks), feature.text.value);
      last.toks = highlightKeywords(merged, keywords);
      continue;
    }

    events.push({
      toks: highlightKeywords(feature.text.value, keywords),
      time,
      targetLabel,
    });
  }

  return events;
}

/** @deprecated Use recordingEventsFromVisit */
export function capturedNotesFromVisit(visit: Visit): CapturedNote[] {
  return recordingEventsFromVisit(visit);
}
