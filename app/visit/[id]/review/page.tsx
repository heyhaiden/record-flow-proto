"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { computeCondition } from "@/lib/model/conditions";
import {
  parcelCompleteness,
  visitCompleteness,
  type Criterion,
  type Feature,
  type Field,
  type Parcel,
  type Visit,
} from "@/lib/model/types";
import { collectGaps, gapById, type Gap } from "@/lib/review/gap-fill";
import { useCapture } from "@/lib/capture/use-capture";
import type { Tok } from "@/lib/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/Button";
import { BottomSheet } from "@/components/BottomSheet";
import { RecordButton } from "@/components/RecordButton";
import { BackButton, NotFound } from "@/components/nav";
import { color, font, radius } from "@/lib/design/tokens";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit, hydrated } = useVisitStore();
  const visit = getVisit(id);
  const [gap, setGap] = useState<Gap | null>(null);
  const todoRef = useRef<HTMLDivElement | null>(null);

  if (!hydrated) {
    return <div style={{ flex: 1 }} aria-busy="true" />;
  }

  if (!visit) return <NotFound />;

  const summary = visitCompleteness(visit);
  const gaps = collectGaps(visit);
  const done = summary.outstanding === 0;
  const progress = summary.total > 0 ? (summary.total - summary.outstanding) / summary.total : 1;

  const resolveGap = (g: Gap) => setGap(g);
  const commitGap = (transcript: string) => {
    if (gap) updateVisit(id, (v) => gap.apply(v, transcript));
    setGap(null);
  };

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
        eyebrow="REVIEW"
        title={visit.siteName}
        left={<BackButton onClick={() => router.push("/")} />}
      />

      <div style={{ padding: "14px 18px 0" }}>
        <div
          style={{
            padding: "14px 16px",
            borderRadius: radius.xl,
            background: done ? color.greenBg : color.surface,
            border: `1.5px solid ${done ? color.greenBorder : color.borderSoft}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: done ? color.greenInk : color.ink }}>
              {done ? "Ready to export" : `${summary.outstanding} to finish`}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: "11px", color: color.faint }}>
              {summary.total - summary.outstanding}/{summary.total}
            </div>
          </div>
          <div
            style={{
              marginTop: "10px",
              height: "4px",
              borderRadius: radius.pill,
              background: color.hair,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round(progress * 100)}%`,
                background: done ? color.green : color.clay,
                borderRadius: radius.pill,
                transition: "width .3s ease",
              }}
            />
          </div>
          {!done && (
            <button
              type="button"
              onClick={() => todoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{
                marginTop: "10px",
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: "12px",
                fontWeight: 600,
                color: color.muted,
                cursor: "pointer",
              }}
            >
              Jump to to-do ↓
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {gaps.length > 0 && (
          <div ref={todoRef}>
            <SectionLabel>To finish</SectionLabel>
            <div
              style={{
                borderRadius: radius.xl,
                border: `1.5px solid ${color.borderSoft}`,
                background: color.surface,
                overflow: "hidden",
              }}
            >
              {gaps.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => resolveGap(g)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "13px 14px",
                    border: "none",
                    borderBottom: i < gaps.length - 1 ? `1px solid ${color.hair}` : "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: color.clay,
                      flex: "none",
                    }}
                  />
                  <span style={{ flex: 1, fontSize: "14px", color: color.body, lineHeight: 1.35 }}>{g.label}</span>
                  <span style={{ fontSize: "12px", color: color.clay, fontWeight: 600 }}>Answer</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <SectionLabel>Parcels</SectionLabel>
        {visit.parcels.map((p) => (
          <ParcelAccordion
            key={p.id}
            parcel={p}
            gaps={gaps}
            onResolve={(gapId) => {
              const g = gapById(gaps, gapId);
              if (g) resolveGap(g);
            }}
            onCycleCriterion={(cid) => cycleCriterion(p.id, cid)}
          />
        ))}

        <CollapsibleBlock
          title="Memos & features"
          summary={featuresSummary(visit.features)}
          complete={featuresComplete(visit.features)}
        >
          {visit.features.length === 0 ? (
            <MutedHint>No features captured from your recording.</MutedHint>
          ) : (
            visit.features.map((f) => (
              <FeatureBlock
                key={f.id}
                feature={f}
                onResolveFollowUp={() => {
                  const g = gapById(gaps, `${f.id}-followup`);
                  if (g) resolveGap(g);
                }}
              />
            ))
          )}
        </CollapsibleBlock>

        <CollapsibleBlock
          title="Site context"
          summary={siteContextSummary(visit)}
          complete={siteContextComplete(visit)}
        >
          <DetailRow
            label="Weather"
            f={visit.siteContext.weather}
            onResolve={() => {
              const g = gapById(gaps, "ctx-weather");
              if (g) resolveGap(g);
            }}
          />
          <DetailRow
            label="Access"
            f={visit.siteContext.access}
            onResolve={() => {
              const g = gapById(gaps, "ctx-access");
              if (g) resolveGap(g);
            }}
          />
          <DetailRow
            label="Designations"
            f={visit.siteContext.designations}
            onResolve={() => {
              const g = gapById(gaps, "ctx-designations");
              if (g) resolveGap(g);
            }}
          />
          <DetailRow
            label="Recommendations"
            f={visit.siteContext.recommendations}
            last
            onResolve={() => {
              const g = gapById(gaps, "ctx-recs");
              if (g) resolveGap(g);
            }}
          />
        </CollapsibleBlock>
      </div>

      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
        <Button full disabled={!done} onClick={() => router.push(`/visit/${id}/export`)}>
          {done ? "Finish & export →" : `${summary.outstanding} remaining`}
        </Button>
      </div>

      <GapFillSheet gap={gap} onClose={() => setGap(null)} onCommit={commitGap} />
    </>
  );
}

/* ----------------------- collapsible blocks ----------------------- */

function CollapsibleBlock({
  title,
  summary,
  complete,
  children,
}: {
  title: string;
  summary: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!complete);

  return (
    <div
      style={{
        borderRadius: radius.xl,
        border: `1.5px solid ${color.borderSoft}`,
        background: color.surface,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "13px 14px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {complete && (
          <span style={{ color: color.green, fontSize: "13px", flex: "none" }} aria-hidden>
            ✓
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: color.ink }}>{title}</div>
          {!open && (
            <div
              style={{
                fontSize: "12.5px",
                color: complete ? color.subtle : color.muted,
                marginTop: "2px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {summary}
            </div>
          )}
        </div>
        <span style={{ color: color.faint, fontSize: "12px", flex: "none" }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>{children}</div>}
    </div>
  );
}

function ParcelAccordion({
  parcel,
  gaps,
  onResolve,
  onCycleCriterion,
}: {
  parcel: Parcel;
  gaps: Gap[];
  onResolve: (gapId: string) => void;
  onCycleCriterion: (critId: string) => void;
}) {
  const { outstanding } = parcelCompleteness(parcel);
  const complete = outstanding === 0;
  const [open, setOpen] = useState(!complete);
  const [showCriteria, setShowCriteria] = useState(false);
  const assessed = parcel.criteria.filter((c) => c.state !== "not-assessed").length;

  return (
    <div
      style={{
        borderRadius: radius.xl,
        border: `1.5px solid ${color.borderSoft}`,
        background: color.surface,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "13px 14px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {complete && (
          <span style={{ color: color.green, fontSize: "13px", flex: "none" }} aria-hidden>
            ✓
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: color.ink }}>{parcel.name}</div>
          {!open && (
            <div
              style={{
                fontSize: "12.5px",
                color: complete ? color.subtle : color.muted,
                marginTop: "2px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {parcelSummary(parcel)}
            </div>
          )}
        </div>
        <span style={{ color: color.faint, fontSize: "12px", flex: "none" }}>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <DetailRow
            label="Habitat type"
            f={parcel.ukhabType}
            onResolve={gapById(gaps, `${parcel.id}-type`) ? () => onResolve(`${parcel.id}-type`) : undefined}
          />
          <DetailRow
            label="Area"
            f={parcel.area}
            suffix={parcel.areaUnit}
            onResolve={gapById(gaps, `${parcel.id}-area`) ? () => onResolve(`${parcel.id}-area`) : undefined}
          />
          <DetailRow
            label="Condition"
            f={parcel.condition}
            onResolve={gapById(gaps, `${parcel.id}-cond`) ? () => onResolve(`${parcel.id}-cond`) : undefined}
            note="field estimate — confirm at desk"
            last={parcel.criteria.length === 0}
          />

          {parcel.criteria.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowCriteria((s) => !s)}
                style={{
                  marginTop: "8px",
                  background: "transparent",
                  border: "none",
                  padding: "6px 0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: color.muted,
                  fontSize: "12px",
                  fontWeight: 600,
                  width: "100%",
                }}
              >
                Condition criteria
                <span style={{ fontFamily: font.mono, fontSize: "10.5px", color: color.faint }}>
                  {assessed}/{parcel.criteria.length}
                </span>
                <span style={{ marginLeft: "auto", color: color.faint }}>{showCriteria ? "▴" : "▾"}</span>
              </button>
              {showCriteria && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                  {parcel.criteria.map((c) => (
                    <CriterionRow key={c.id} c={c} onClick={() => onCycleCriterion(c.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  f,
  suffix,
  note,
  last,
  onResolve,
}: {
  label: string;
  f: Field<string | number>;
  suffix?: string;
  note?: string;
  last?: boolean;
  onResolve?: () => void;
}) {
  const complete = f.status === "green";
  const display = f.value == null ? null : `${f.value}${suffix ? ` ${suffix}` : ""}`;

  return (
    <div style={{ padding: "10px 0", borderBottom: last ? "none" : `1px solid ${color.hair}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", color: color.faint, letterSpacing: ".02em" }}>{label}</div>
          {complete ? (
            <div style={{ fontSize: "14px", color: color.body, fontWeight: 500, marginTop: "2px" }}>{display}</div>
          ) : (
            <div style={{ fontSize: "14px", color: color.fainter, marginTop: "2px" }}>Not captured</div>
          )}
          {f.evidence && complete && (
            <div style={{ fontSize: "11px", color: color.subtle, marginTop: "4px", fontStyle: "italic" }}>
              “{f.evidence}”
            </div>
          )}
          {note && <div style={{ fontSize: "10.5px", color: color.faint, marginTop: "3px" }}>{note}</div>}
        </div>
        {!complete && onResolve && (
          <button type="button" onClick={onResolve} style={answerBtnStyle}>
            Answer
          </button>
        )}
      </div>
    </div>
  );
}

function FeatureBlock({
  feature,
  onResolveFollowUp,
}: {
  feature: Feature;
  onResolveFollowUp: () => void;
}) {
  const isProtected = feature.kind === "protected-species";
  const needsFollowUp = isProtected && (!feature.followUp || feature.followUp.status !== "green");

  return (
    <div
      style={{
        padding: "12px",
        borderRadius: radius.lg,
        border: `1px solid ${color.borderSoft}`,
        background: color.hair,
      }}
    >
      <div style={{ fontFamily: font.mono, fontSize: "10px", color: color.faint, marginBottom: "4px" }}>
        {kindLabel(feature.kind)}
      </div>
      <div style={{ fontSize: "14px", color: color.body, lineHeight: 1.4 }}>{feature.text.value}</div>
      {isProtected && (
        <div style={{ fontSize: "12px", marginTop: "8px", color: needsFollowUp ? color.muted : color.subtle }}>
          {feature.followUp?.value ? `Follow-up: ${feature.followUp.value}` : "Follow-up needed"}
        </div>
      )}
      {needsFollowUp && (
        <button type="button" onClick={onResolveFollowUp} style={{ ...answerBtnStyle, marginTop: "10px" }}>
          Answer
        </button>
      )}
    </div>
  );
}

function CriterionRow({ c, onClick }: { c: Criterion; onClick: () => void }) {
  const dot =
    c.state === "pass" ? color.green : c.state === "fail" ? color.amber : color.fainter;
  const label = c.state === "not-assessed" ? "not assessed" : c.state;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: "8px 10px",
        border: `1px solid ${color.borderSoft}`,
        borderRadius: radius.md,
        background: color.surface,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dot, flex: "none" }} />
      <span style={{ flex: 1, fontSize: "12px", color: color.body, lineHeight: 1.35 }}>
        <b style={{ fontFamily: font.mono, fontWeight: 600, marginRight: "6px", color: color.subtle }}>{c.id}</b>
        {c.label}
      </span>
      <span style={{ fontFamily: font.mono, fontSize: "10px", color: color.faint }}>{label}</span>
    </button>
  );
}

/* ----------------------- gap-fill sheet ----------------------- */

function GapFillSheet({
  gap,
  onClose,
  onCommit,
}: {
  gap: Gap | null;
  onClose: () => void;
  onCommit: (transcript: string) => void;
}) {
  const [committed, setCommitted] = useState("");
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCapture = useCallback(
    (toks: Tok[], _time: string) => {
      const text = toks.map((t) => t.text).join("").trim();
      if (!text) return;
      setCommitted(text);
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => {
        onCommit(text);
        setCommitted("");
      }, 500);
    },
    [onCommit],
  );

  const cap = useCapture(onCapture);

  useEffect(() => {
    if (!gap) {
      setCommitted("");
      if (commitTimer.current) clearTimeout(commitTimer.current);
    }
  }, [gap]);

  const close = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    setCommitted("");
    onClose();
  };

  const liveText = cap.live.map((t) => t.text).join("");
  const display = committed || liveText;
  const needsMic = cap.phase === "prompt" || cap.phase === "checking";
  const hint = cap.processing
    ? "transcribing…"
    : cap.connecting
      ? "connecting…"
      : cap.mode === "ptt"
        ? "listening…"
        : needsMic
          ? "hold to allow microphone"
          : cap.error === "no-speech"
            ? "no speech detected — try again"
            : cap.error
              ? "couldn't transcribe — try again"
              : "hold to answer";

  return (
    <BottomSheet open={!!gap} onClose={close} title="Answer by voice">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: "10px" }}>
        <div style={{ fontSize: "15px", fontWeight: 600, color: color.ink, marginBottom: "4px", lineHeight: 1.4 }}>
          {gap?.question}
        </div>
        <div style={{ minHeight: "22px", fontSize: "14px", color: color.body, margin: "10px 0", maxWidth: "100%" }}>
          {display ? (
            <span
              style={{
                background: color.greenBg,
                borderBottom: `2px solid ${color.green}`,
                borderRadius: "2px",
                padding: "0 3px",
              }}
            >
              {display}
            </span>
          ) : (
            <span style={{ color: color.faint, fontFamily: font.mono, fontSize: "12px" }}>{hint}</span>
          )}
        </div>
        <RecordButton
          mode={cap.mode}
          pressing={cap.pressing}
          onPointerDown={cap.onBtnDown}
          onPointerUp={cap.onBtnUp}
          onPointerLeave={cap.onBtnLeave}
        />
        <div style={{ fontSize: "11px", fontFamily: font.mono, color: color.faint, marginTop: "2px" }}>
          hold &amp; speak — saved when you release
        </div>
      </div>
    </BottomSheet>
  );
}

/* ----------------------- summaries ----------------------- */

function parcelSummary(p: Parcel): string {
  const parts: string[] = [];
  if (p.ukhabType.value) parts.push(String(p.ukhabType.value));
  if (p.area.value != null) parts.push(`${p.area.value} ${p.areaUnit}`);
  if (p.condition.value) parts.push(String(p.condition.value));
  const { outstanding } = parcelCompleteness(p);
  if (parts.length === 0) return `${outstanding} field${outstanding === 1 ? "" : "s"} to complete`;
  if (outstanding > 0) return `${parts.join(" · ")} · ${outstanding} left`;
  return parts.join(" · ");
}

function featuresSummary(features: Feature[]): string {
  if (features.length === 0) return "Nothing captured";
  const pending = features.filter(
    (f) => f.kind === "protected-species" && (!f.followUp || f.followUp.status !== "green"),
  ).length;
  if (pending > 0) return `${features.length} captured · ${pending} follow-up needed`;
  return `${features.length} captured`;
}

function featuresComplete(features: Feature[]): boolean {
  return features.every(
    (f) => f.kind !== "protected-species" || (f.followUp && f.followUp.status === "green"),
  );
}

function siteContextSummary(visit: Visit): string {
  const filled = [
    visit.siteContext.weather,
    visit.siteContext.access,
    visit.siteContext.designations,
    visit.siteContext.recommendations,
  ].filter((f) => f.status === "green").length;
  return `${filled}/4 fields`;
}

function siteContextComplete(visit: Visit): boolean {
  return siteContextSummary(visit).startsWith("4/");
}

/* ----------------------- small helpers ----------------------- */

const answerBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: color.clay,
  border: `1.5px solid ${color.border}`,
  borderRadius: radius.md,
  padding: "6px 11px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  flex: "none",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: "10px",
        letterSpacing: ".14em",
        color: color.faint,
        marginTop: "4px",
      }}
    >
      {children}
    </div>
  );
}

function MutedHint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "13px", color: color.fainter, lineHeight: 1.45 }}>{children}</div>;
}

function nextState(s: Criterion["state"]): Criterion["state"] {
  return s === "not-assessed" ? "pass" : s === "pass" ? "fail" : "not-assessed";
}

function kindLabel(k: Feature["kind"]): string {
  return k === "protected-species" ? "protected species" : k === "notable" ? "notable" : "target note";
}
