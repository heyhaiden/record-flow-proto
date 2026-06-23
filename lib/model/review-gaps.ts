import {
  fieldFromSpeech,
  parseAreaFromSpeech,
  parseConditionFromSpeech,
} from "./gap-fill";
import type { Visit } from "./types";

export interface ReviewGap {
  id: string;
  label: string;
  question: string;
  apply: (v: Visit, text: string) => Visit;
}

/** Outstanding field gaps the review screen can fill by voice. */
export function collectReviewGaps(visit: Visit): ReviewGap[] {
  const gaps: ReviewGap[] = [];

  visit.parcels.forEach((p) => {
    if (p.ukhabType.status !== "green") {
      gaps.push({
        id: `parcel:${p.id}:ukhab`,
        label: `${p.name} · type`,
        question: `${p.name} — habitat type?`,
        apply: (v, text) => ({
          ...v,
          parcels: v.parcels.map((x) =>
            x.id === p.id ? { ...x, ukhabType: fieldFromSpeech(text.trim(), text) } : x,
          ),
        }),
      });
    }
    if (p.area.status !== "green") {
      gaps.push({
        id: `parcel:${p.id}:area`,
        label: `${p.name} · area`,
        question: `${p.name} — area?`,
        apply: (v, text) => {
          const n = parseAreaFromSpeech(text);
          return {
            ...v,
            parcels: v.parcels.map((x) =>
              x.id === p.id
                ? { ...x, area: fieldFromSpeech(n, text, n == null ? "amber" : "green") }
                : x,
            ),
          };
        },
      });
    }
    if (p.condition.status !== "green") {
      gaps.push({
        id: `parcel:${p.id}:condition`,
        label: `${p.name} · condition`,
        question: `${p.name} — condition?`,
        apply: (v, text) => {
          const c = parseConditionFromSpeech(text);
          return {
            ...v,
            parcels: v.parcels.map((x) =>
              x.id === p.id
                ? { ...x, condition: fieldFromSpeech(c, text, c ? "green" : "amber") }
                : x,
            ),
          };
        },
      });
    }
  });

  visit.features.forEach((f) => {
    const needsFollowUp =
      f.kind === "protected-species" && (!f.followUp || f.followUp.status !== "green");
    if (needsFollowUp) {
      gaps.push({
        id: `feature:${f.id}:followup`,
        label: "Protected species follow-up",
        question: "Follow-up for this trigger?",
        apply: (v, text) => ({
          ...v,
          features: v.features.map((x) =>
            x.id === f.id ? { ...x, followUp: fieldFromSpeech(text.trim(), text) } : x,
          ),
        }),
      });
    }
  });

  const ctx = visit.siteContext;
  if (ctx.weather.status !== "green") {
    gaps.push({
      id: "site:weather",
      label: "Weather",
      question: "Weather on site?",
      apply: (v, text) => ({
        ...v,
        siteContext: { ...v.siteContext, weather: fieldFromSpeech(text.trim(), text) },
      }),
    });
  }
  if (ctx.access.status !== "green") {
    gaps.push({
      id: "site:access",
      label: "Access",
      question: "Access and limitations?",
      apply: (v, text) => ({
        ...v,
        siteContext: { ...v.siteContext, access: fieldFromSpeech(text.trim(), text) },
      }),
    });
  }
  if (ctx.designations.status !== "green") {
    gaps.push({
      id: "site:designations",
      label: "Designations",
      question: "Nearby designations?",
      apply: (v, text) => ({
        ...v,
        siteContext: { ...v.siteContext, designations: fieldFromSpeech(text.trim(), text) },
      }),
    });
  }
  if (ctx.recommendations.status !== "green") {
    gaps.push({
      id: "site:recommendations",
      label: "Recommendations",
      question: "Recommendations or further survey?",
      apply: (v, text) => ({
        ...v,
        siteContext: { ...v.siteContext, recommendations: fieldFromSpeech(text.trim(), text) },
      }),
    });
  }

  return gaps;
}

export function evidenceAddsDetail(f: { value: unknown; evidence: string | null }): boolean {
  if (!f.evidence?.trim()) return false;
  if (f.value == null) return true;
  return f.evidence.trim() !== String(f.value).trim();
}
