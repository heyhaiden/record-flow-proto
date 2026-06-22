import { computeCondition } from "@/lib/model/conditions";
import {
  field,
  type Condition,
  type Criterion,
  type CriterionState,
  type Field,
  type Parcel,
  type Visit,
} from "@/lib/model/types";

export interface Gap {
  id: string;
  label: string;
  question: string;
  apply: (v: Visit, transcript: string) => Visit;
}

export function parseArea(transcript: string): number | null {
  const m = transcript.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function parseCondition(transcript: string): Condition | null {
  const t = transcript.toLowerCase();
  if (/\bgood\b/.test(t)) return "Good";
  if (/\bpoor\b/.test(t)) return "Poor";
  if (/\bmoderate\b/.test(t)) return "Moderate";
  return null;
}

export function parseCriterionState(transcript: string): CriterionState | null {
  const t = transcript.toLowerCase();
  if (/\b(fail|failed|no|not met)\b/.test(t)) return "fail";
  if (/\b(pass|passed|yes|met|good)\b/.test(t)) return "pass";
  return null;
}

function voiceString(transcript: string): Field<string> {
  const t = transcript.trim();
  return field(t || null, t || null, t ? "green" : "amber");
}

function voiceArea(transcript: string): Field<number> {
  const t = transcript.trim();
  const num = parseArea(t);
  return field(num, t || null, num != null ? "green" : "amber");
}

function voiceCondition(transcript: string): Field<Condition> {
  const t = transcript.trim();
  const cond = parseCondition(t);
  return field(cond, t || null, cond ? "green" : "amber");
}

function withParcel(v: Visit, parcelId: string, fn: (p: Parcel) => Parcel): Visit {
  return { ...v, parcels: v.parcels.map((p) => (p.id === parcelId ? fn(p) : p)) };
}

export function collectGaps(visit: Visit): Gap[] {
  const gaps: Gap[] = [];

  visit.parcels.forEach((p) => {
    if (p.ukhabType.status !== "green") {
      gaps.push({
        id: `${p.id}-type`,
        label: `${p.name} — habitat type`,
        question: `${p.name} — what habitat type is it?`,
        apply: (v, transcript) =>
          withParcel(v, p.id, (x) => ({ ...x, ukhabType: voiceString(transcript) })),
      });
    }
    if (p.area.status !== "green") {
      gaps.push({
        id: `${p.id}-area`,
        label: `${p.name} — area`,
        question: `${p.name} — what's the area?`,
        apply: (v, transcript) => withParcel(v, p.id, (x) => ({ ...x, area: voiceArea(transcript) })),
      });
    }
    if (p.condition.status !== "green") {
      gaps.push({
        id: `${p.id}-cond`,
        label: `${p.name} — condition`,
        question: `${p.name} — overall condition? (good, moderate, or poor)`,
        apply: (v, transcript) => withParcel(v, p.id, (x) => ({ ...x, condition: voiceCondition(transcript) })),
      });
    }
    p.criteria
      .filter((c) => c.state === "not-assessed")
      .forEach((c) => {
        gaps.push({
          id: `${p.id}-crit-${c.id}`,
          label: `${p.name} — criterion ${c.id}`,
          question: `${p.name} — ${c.label}? (pass or fail)`,
          apply: (v, transcript) =>
            withParcel(v, p.id, (x) => {
              const state = parseCriterionState(transcript);
              const criteria = x.criteria.map((cr) =>
                cr.id === c.id
                  ? { ...cr, state: state ?? cr.state, evidence: transcript.trim() || cr.evidence }
                  : cr,
              );
              const computed = computeCondition(x.habitatId, criteria);
              const condition = computed
                ? { value: computed, evidence: transcript.trim(), status: "green" as const }
                : x.condition;
              return { ...x, criteria, condition };
            }),
        });
      });
  });

  const ctxFields: Array<{ key: keyof Visit["siteContext"]; label: string; question: string }> = [
    { key: "weather", label: "Weather on site", question: "Weather & conditions on site?" },
    { key: "access", label: "Site access", question: "Access / limitations?" },
    { key: "designations", label: "Nearby designations", question: "Any nearby designations?" },
    { key: "recommendations", label: "Recommendations", question: "Further-survey needs / recommendations?" },
  ];

  ctxFields.forEach(({ key, label, question }) => {
    const f = visit.siteContext[key];
    if (f.status !== "green") {
      gaps.push({
        id: `ctx-${key}`,
        label,
        question,
        apply: (v, transcript) => ({
          ...v,
          siteContext: { ...v.siteContext, [key]: voiceString(transcript) },
        }),
      });
    }
  });

  visit.features
    .filter((f) => f.kind === "protected-species" && (!f.followUp || f.followUp.status !== "green"))
    .forEach((f) => {
      gaps.push({
        id: `${f.id}-followup`,
        label: "Protected species follow-up",
        question: "What's the follow-up for this protected-species trigger?",
        apply: (v, transcript) => ({
          ...v,
          features: v.features.map((x) =>
            x.id === f.id ? { ...x, followUp: voiceString(transcript) } : x,
          ),
        }),
      });
    });

  return gaps;
}

export function gapById(gaps: Gap[], id: string): Gap | undefined {
  return gaps.find((g) => g.id === id);
}
