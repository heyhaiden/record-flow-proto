"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { computeCondition } from "@/lib/model/conditions";
import {
  visitCompleteness,
  type Condition,
  type Criterion,
  type Feature,
  type Field,
  type Parcel,
  type Visit,
} from "@/lib/model/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CompletenessBanner } from "@/components/CompletenessBanner";
import { TriageChip } from "@/components/TriageChip";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { BottomSheet } from "@/components/BottomSheet";
import { RecordButton, type RecordMode } from "@/components/RecordButton";
import { BackButton, NotFound } from "@/components/nav";
import { color, font, radius, triage } from "@/lib/design/tokens";

interface Gap {
  question: string;
  demoAnswer: string;
  apply: (v: Visit) => Visit;
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit } = useVisitStore();
  const visit = getVisit(id);
  const [gap, setGap] = useState<Gap | null>(null);
  const firstGapRef = useRef<HTMLDivElement | null>(null);

  if (!visit) return <NotFound />;

  const summary = visitCompleteness(visit);
  const resolveGap = (g: Gap) => setGap(g);
  const commitGap = () => {
    if (gap) updateVisit(id, gap.apply);
    setGap(null);
  };

  // ---- field updaters ----
  const cycleCriterion = (parcelId: string, critId: string) =>
    updateVisit(id, (v) => ({
      ...v,
      parcels: v.parcels.map((p) => {
        if (p.id !== parcelId) return p;
        const criteria = p.criteria.map((c) =>
          c.id === critId ? { ...c, state: nextState(c.state) } : c,
        );
        const computed = computeCondition(p.habitatId, criteria);
        const condition = computed
          ? { value: computed, evidence: "derived from criteria checklist", status: "green" as const }
          : p.condition;
        return { ...p, criteria, condition };
      }),
    }));

  return (
    <>
      <ScreenHeader
        eyebrow="REPORT READY · REVIEW"
        title={visit.siteName}
        left={<BackButton onClick={() => router.push("/")} />}
      />

      <CompletenessBanner
        summary={summary}
        onJumpToGap={() => firstGapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* PARCELS */}
        {visit.parcels.map((p, pi) => (
          <ParcelSection
            key={p.id}
            parcel={p}
            firstGapRef={pi === 0 ? firstGapRef : undefined}
            onResolveType={() =>
              resolveGap({
                question: `${p.name} — what habitat type is it?`,
                demoAnswer: "Confirmed: modified grassland",
                apply: (v) => withParcel(v, p.id, (x) => ({ ...x, ukhabType: greenField("Modified grassland") })),
              })
            }
            onResolveArea={() =>
              resolveGap({
                question: `${p.name} — what’s the area?`,
                demoAnswer: p.areaUnit === "km" ? "about 0.4 km" : "about half a hectare",
                apply: (v) =>
                  withParcel(v, p.id, (x) => ({ ...x, area: { value: x.areaUnit === "km" ? 0.4 : 0.5, evidence: "answered at review", status: "green" } })),
              })
            }
            onResolveCondition={() =>
              resolveGap({
                question: `${p.name} — overall condition?`,
                demoAnswer: "Moderate",
                apply: (v) => withParcel(v, p.id, (x) => ({ ...x, condition: greenField<Condition>("Moderate") })),
              })
            }
            onCycleCriterion={(cid) => cycleCriterion(p.id, cid)}
          />
        ))}

        {/* FEATURES */}
        <Section label="PEA features & target notes">
          {visit.features.length === 0 && <Hint>No features captured.</Hint>}
          {visit.features.map((f) => (
            <FeatureRow
              key={f.id}
              feature={f}
              onResolveFollowUp={() =>
                resolveGap({
                  question: "What’s the follow-up for this protected-species trigger?",
                  demoAnswer: "Recommend badger survey before works",
                  apply: (v) => ({
                    ...v,
                    features: v.features.map((x) =>
                      x.id === f.id ? { ...x, followUp: greenField("Badger survey recommended before works") } : x,
                    ),
                  }),
                })
              }
            />
          ))}
        </Section>

        {/* SITE CONTEXT */}
        <Section label="Site context">
          <Card tone="muted">
            <SiteFieldRow
              label="Weather"
              f={visit.siteContext.weather}
              onResolve={() => resolveGap({ question: "Weather & conditions on site?", demoAnswer: "Overcast, 16°C", apply: (v) => ({ ...v, siteContext: { ...v.siteContext, weather: greenField("Overcast, 16°C, light wind") } }) })}
            />
            <SiteFieldRow
              label="Access"
              f={visit.siteContext.access}
              onResolve={() => resolveGap({ question: "Access / limitations?", demoAnswer: "Field gate off Mill Lane", apply: (v) => ({ ...v, siteContext: { ...v.siteContext, access: greenField("Field gate off Mill Lane; livestock present") } }) })}
            />
            <SiteFieldRow
              label="Designations"
              f={visit.siteContext.designations}
              onResolve={() => resolveGap({ question: "Any nearby designations?", demoAnswer: "None within 500m", apply: (v) => ({ ...v, siteContext: { ...v.siteContext, designations: greenField("None within 500m") } }) })}
            />
            <SiteFieldRow
              label="Recommendations"
              f={visit.siteContext.recommendations}
              last
              onResolve={() => resolveGap({ question: "Further-survey needs / recommendations?", demoAnswer: "Badger survey", apply: (v) => ({ ...v, siteContext: { ...v.siteContext, recommendations: greenField("Badger survey recommended (see Parcel 2)") } }) })}
            />
          </Card>
        </Section>
      </div>

      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
        <Button full disabled={summary.outstanding > 0} onClick={() => router.push(`/visit/${id}/export`)}>
          {summary.outstanding > 0 ? `${summary.outstanding} to finish` : "Finish & export →"}
        </Button>
      </div>

      <GapFillSheet gap={gap} onClose={() => setGap(null)} onCommit={commitGap} />
    </>
  );
}

/* ----------------------- parcel section ----------------------- */

function ParcelSection({
  parcel,
  firstGapRef,
  onResolveType,
  onResolveArea,
  onResolveCondition,
  onCycleCriterion,
}: {
  parcel: Parcel;
  firstGapRef?: React.RefObject<HTMLDivElement | null>;
  onResolveType: () => void;
  onResolveArea: () => void;
  onResolveCondition: () => void;
  onCycleCriterion: (critId: string) => void;
}) {
  const [showCriteria, setShowCriteria] = useState(false);
  const assessed = parcel.criteria.filter((c) => c.state !== "not-assessed").length;
  return (
    <Section label={parcel.name}>
      <Card>
        <FieldRow label="Habitat type" f={parcel.ukhabType} onResolve={onResolveType} firstGapRef={parcel.ukhabType.status !== "green" ? firstGapRef : undefined} />
        <FieldRow label="Area" f={parcel.area} suffix={parcel.areaUnit} onResolve={onResolveArea} firstGapRef={parcel.area.status !== "green" ? firstGapRef : undefined} />
        <FieldRow
          label="Condition"
          f={parcel.condition}
          onResolve={onResolveCondition}
          note="field estimate — confirm at desk"
          last={parcel.criteria.length === 0}
        />

        {parcel.criteria.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowCriteria((s) => !s)}
              style={{ marginTop: "10px", background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", color: color.muted, fontSize: "12.5px", fontWeight: 600 }}
            >
              Condition criteria
              <span style={{ fontFamily: font.mono, fontSize: "11px", color: color.faint }}>
                {assessed}/{parcel.criteria.length} assessed
              </span>
              <span style={{ marginLeft: "auto", color: color.faint }}>{showCriteria ? "▴" : "▾"}</span>
            </button>
            {showCriteria && (
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {parcel.criteria.map((c) => (
                  <CriterionRow key={c.id} c={c} onClick={() => onCycleCriterion(c.id)} />
                ))}
                <div style={{ fontSize: "10.5px", color: color.faint, fontFamily: font.mono, marginTop: "2px" }}>
                  tap a criterion to cycle pass · fail · not-assessed
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </Section>
  );
}

function CriterionRow({ c, onClick }: { c: Criterion; onClick: () => void }) {
  const status = c.state === "pass" ? "green" : c.state === "fail" ? "red" : "amber";
  const t = triage(status as "green" | "amber" | "red");
  const label = c.state === "not-assessed" ? "not assessed" : c.state;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: "9px", padding: "7px 9px", border: `1px solid ${color.borderSoft}`, borderRadius: radius.md, background: color.surface, cursor: "pointer", textAlign: "left", width: "100%" }}
    >
      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.border, flex: "none" }} />
      <span style={{ flex: 1, fontSize: "12px", color: color.body, lineHeight: 1.35 }}>
        <b style={{ fontFamily: font.mono, fontWeight: 600, marginRight: "6px", color: color.subtle }}>{c.id}</b>
        {c.label}
      </span>
      <span style={{ fontFamily: font.mono, fontSize: "10px", color: t.border }}>{label}</span>
    </button>
  );
}

/* ----------------------- generic field rows ----------------------- */

function FieldRow({
  label,
  f,
  suffix,
  note,
  last,
  onResolve,
  firstGapRef,
}: {
  label: string;
  f: Field<string | number>;
  suffix?: string;
  note?: string;
  last?: boolean;
  onResolve: () => void;
  firstGapRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const isGap = f.status !== "green";
  const display = f.value == null ? "—" : `${f.value}${suffix ? ` ${suffix}` : ""}`;
  return (
    <div ref={firstGapRef} style={{ padding: "9px 0", borderBottom: last ? "none" : `1px solid ${color.hair}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", color: color.faint }}>{label}</div>
          <div style={{ fontSize: "13.5px", color: f.value == null ? color.fainter : color.body, fontWeight: 500, marginTop: "1px" }}>
            {display}
          </div>
        </div>
        <TriageChip status={f.status}>{f.status === "green" ? "ok" : f.status === "amber" ? "review" : "missing"}</TriageChip>
      </div>
      {f.evidence && (
        <div style={{ fontSize: "11px", color: color.subtle, marginTop: "4px", fontStyle: "italic" }}>“{f.evidence}”</div>
      )}
      {note && <div style={{ fontSize: "10.5px", color: color.faint, marginTop: "3px" }}>{note}</div>}
      {isGap && (
        <button type="button" onClick={onResolve} style={voiceBtnStyle}>
          🎙 answer by voice
        </button>
      )}
    </div>
  );
}

function SiteFieldRow({ label, f, last, onResolve }: { label: string; f: Field<string>; last?: boolean; onResolve: () => void }) {
  return <FieldRow label={label} f={f} last={last} onResolve={onResolve} />;
}

function FeatureRow({ feature, onResolveFollowUp }: { feature: Feature; onResolveFollowUp: () => void }) {
  const isProtected = feature.kind === "protected-species";
  const needsFollowUp = isProtected && (!feature.followUp || feature.followUp.status !== "green");
  return (
    <Card tone={needsFollowUp ? "plain" : "muted"}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
            <TriageChip status={feature.text.status}>{kindLabel(feature.kind)}</TriageChip>
          </div>
          <div style={{ fontSize: "13.5px", color: color.body, lineHeight: 1.4 }}>{feature.text.value}</div>
          {isProtected && (
            <div style={{ fontSize: "11.5px", marginTop: "6px", color: needsFollowUp ? color.red : color.green }}>
              {feature.followUp?.value ? `Follow-up: ${feature.followUp.value}` : "Follow-up required"}
            </div>
          )}
        </div>
      </div>
      {needsFollowUp && (
        <button type="button" onClick={onResolveFollowUp} style={voiceBtnStyle}>
          🎙 set follow-up by voice
        </button>
      )}
    </Card>
  );
}

/* ----------------------- gap-fill sheet ----------------------- */

function GapFillSheet({ gap, onClose, onCommit }: { gap: Gap | null; onClose: () => void; onCommit: () => void }) {
  const [mode, setMode] = useState<RecordMode>("idle");
  const [answer, setAnswer] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    setMode("ptt");
    setAnswer("");
  };
  const stop = () => {
    setMode("idle");
    if (!gap) return;
    setAnswer(gap.demoAnswer);
    timer.current = setTimeout(() => {
      onCommit();
      setAnswer("");
    }, 700);
  };

  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    setMode("idle");
    setAnswer("");
    onClose();
  };

  return (
    <BottomSheet open={!!gap} onClose={close} title="Answer by voice">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: "10px" }}>
        <div style={{ fontSize: "15px", fontWeight: 600, color: color.ink, marginBottom: "4px" }}>{gap?.question}</div>
        <div style={{ minHeight: "22px", fontSize: "14px", color: color.body, margin: "10px 0" }}>
          {answer ? (
            <span style={{ background: color.greenBg, borderBottom: `2px solid ${color.green}`, borderRadius: "2px", padding: "0 3px" }}>{answer}</span>
          ) : (
            <span style={{ color: color.faint, fontFamily: font.mono, fontSize: "12px" }}>
              {mode === "ptt" ? "listening…" : "hold to answer"}
            </span>
          )}
        </div>
        <RecordButton
          mode={mode}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={() => mode === "ptt" && stop()}
        />
        <div style={{ fontSize: "11px", fontFamily: font.mono, color: color.faint, marginTop: "2px" }}>
          hold &amp; speak — it flips green when captured
        </div>
      </div>
    </BottomSheet>
  );
}

/* ----------------------- small helpers ----------------------- */

const voiceBtnStyle: React.CSSProperties = {
  marginTop: "8px",
  background: color.clay,
  color: "#fff",
  border: "none",
  borderRadius: radius.md,
  padding: "7px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
      <div style={{ fontFamily: font.mono, fontSize: "10px", letterSpacing: ".14em", color: color.faint }}>{label.toUpperCase()}</div>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "12.5px", color: color.fainter }}>{children}</div>;
}

function greenField<T>(value: T): Field<T> {
  return { value, evidence: "answered at review", status: "green" };
}

function withParcel(v: Visit, parcelId: string, fn: (p: Parcel) => Parcel): Visit {
  return { ...v, parcels: v.parcels.map((p) => (p.id === parcelId ? fn(p) : p)) };
}

function nextState(s: Criterion["state"]): Criterion["state"] {
  return s === "not-assessed" ? "pass" : s === "pass" ? "fail" : "not-assessed";
}

function kindLabel(k: Feature["kind"]): string {
  return k === "protected-species" ? "protected species" : k === "notable" ? "notable" : "target note";
}
