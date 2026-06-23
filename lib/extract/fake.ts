import type { Condition } from "@/lib/model/types";
import { parseAreaFromSpeech, parseConditionFromSpeech } from "@/lib/model/gap-fill";
import type { Extractor } from "./provider";
import type {
  ExtractedValue,
  ExtractionInput,
  ExtractionPatch,
  FeaturePatch,
  ParcelPatch,
  Reconciliation,
  SiteContextPatch,
} from "./schema";

/**
 * Deterministic, key-free extractor. Reuses the gap-fill speech parsers and a
 * small keyword set so the guided demo + tests run offline. Not as good as the
 * Claude provider — just consistent enough to exercise the whole pipeline.
 */

const HABITAT_KEYWORDS = [
  "meadow", "grassland", "hedgerow", "hedge", "scrub",
  "woodland", "wood", "heath", "marsh", "pond", "wetland",
];
const PROTECTED_KEYWORDS = [
  "badger", "bat", "newt", "gcn", "dormouse", "otter", "water vole",
  "reptile", "nesting bird",
];

function val<T>(
  value: T | null,
  evidence: string | null,
  confidence: ExtractedValue<T>["confidence"] = "medium",
): ExtractedValue<T> {
  return { value, evidence, confidence };
}

function featureFrom(text: string): FeaturePatch {
  const lower = text.toLowerCase();
  const isProtected = PROTECTED_KEYWORDS.some((k) => lower.includes(k));
  return {
    kind: isProtected ? "protected-species" : "target-note",
    text,
    parcelRef: null,
    followUp: /survey|recommend|further/i.test(text) ? text : null,
  };
}

function parcelPatchFrom(
  p: ExtractionInput["parcels"][number],
  text: string,
): ParcelPatch {
  const lower = text.toLowerCase();
  const area = parseAreaFromSpeech(text);
  const condition: Condition | null = parseConditionFromSpeech(text);

  let ukhabType: ExtractedValue<string> | undefined;
  let reconciliation: Reconciliation | undefined;
  if (p.deskStudyType && lower.includes(p.deskStudyType.toLowerCase())) {
    ukhabType = val(p.deskStudyType, text, "high");
    reconciliation = "confirms";
  } else {
    const hit = HABITAT_KEYWORDS.find((k) => lower.includes(k));
    if (hit) {
      ukhabType = val(hit, text, "medium");
      if (p.deskStudyType) reconciliation = "overrides";
    } else if (p.deskStudyType) {
      reconciliation = "silent";
    }
  }

  return {
    parcelId: p.id,
    ...(ukhabType ? { ukhabType } : {}),
    ...(reconciliation ? { reconciliation } : {}),
    ...(area != null ? { area: val(area, text, "high") } : {}),
    ...(condition ? { condition: val(condition, text, "high") } : {}),
  };
}

function siteContextFrom(text: string): SiteContextPatch {
  if (!text.trim()) return {};
  const out: SiteContextPatch = {};
  if (/weather|overcast|sunny|rain|cloud|dry|wind/i.test(text)) out.weather = val(text, text);
  if (/access|gate|locked|entry|footpath/i.test(text)) out.access = val(text, text);
  if (/sssi|sac|spa|designation|ramsar|ancient/i.test(text)) out.designations = val(text, text);
  if (/recommend|further survey|mitigation/i.test(text)) out.recommendations = val(text, text);
  return out;
}

export class FakeExtractor implements Extractor {
  async extract(input: ExtractionInput): Promise<ExtractionPatch> {
    const parcelText = new Map<string, string>();
    const features: FeaturePatch[] = [];
    const site: string[] = [];

    for (const note of input.transcript) {
      if (note.target.kind === "parcel") {
        const prev = parcelText.get(note.target.parcelId) ?? "";
        parcelText.set(note.target.parcelId, `${prev} ${note.text}`.trim());
      } else if (note.target.kind === "feature") {
        features.push(featureFrom(note.text));
      } else {
        site.push(note.text);
      }
    }

    const parcels: ParcelPatch[] = [];
    for (const p of input.parcels) {
      const text = parcelText.get(p.id);
      if (text) parcels.push(parcelPatchFrom(p, text));
    }

    return { parcels, features, siteContext: siteContextFrom(site.join(" ")) };
  }
}
