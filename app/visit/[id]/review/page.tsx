"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { useCapture } from "@/lib/capture/use-capture";
import { computeCondition } from "@/lib/model/conditions";
import { fieldFromSpeech } from "@/lib/model/gap-fill";
import { collectReviewGaps, evidenceAddsDetail, type ReviewGap } from "@/lib/model/review-gaps";
import {
  visitCompleteness,
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
import { RecordButton } from "@/components/RecordButton";
import { BackButton, NotFound } from "@/components/nav";
import { color, font, radius, triage } from "@/lib/design/tokens";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit } = useVisitStore();
  const visit = getVisit(id);
  const [selectedGapId, setSelectedGapId] = useState<string | null>(null);
  const gapRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const selectedGapRef = useRef<ReviewGap | null>(null);

  const gaps = useMemo(() => (visit ? collectReviewGaps(visit) : []), [visit]);
  const selectedGap = gaps.find((g) => g.id === selectedGapId) ?? null;
  selectedGapRef.current = selectedGap;

  useEffect(() => {
    if (gaps.length === 0) {
      setSelectedGapId(null);
      return;
    }
    if (!selectedGapId || !gaps.some((g) => g.id === selectedGapId)) {
      setSelectedGapId(gaps[0].id);
    }
  }, [gaps, selectedGapId]);

  const cap = useCapture((toks) => {
    const g = selectedGapRef.current;
    if (!g || !visit) return;
    const text = toks.map((t) => t.text).join("").trim();
    if (!text) return;
    updateVisit(id, (v) => g.apply(v, text));
    const idx = gaps.findIndex((x) => x.id === g.id);
    const next = gaps[idx + 1];
    if (next) setSelectedGapId(next.id);
  });

  if (!visit) return <NotFound />;

  const summary = visitCompleteness(visit);
  const canSubmit = summary.outstanding === 0;

  const jumpToGap = (gapId: string) => {
    setSelectedGapId(gapId);
    gapRowRefs.current.get(gapId)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
          ? fieldFromSpeech(computed, "derived from criteria checklist", "green")
          : p.condition;
        return { ...p, criteria, condition };
      }),
    }));

  const btnLabel = cap.mode === "ptt" ? "Release to stop" : cap.transcribing ? "Transcribing…" : "";
  const subHint = cap.transcribing
    ? "processing your answer"
    : cap.mode === "ptt"
      ? "keep holding"
      : "hold to talk";

  return (
    <>
      <ScreenHeader title={visit.siteName} left={<BackButton onClick={() => router.push("/")} />} />

      <CompletenessBanner
        summary={summary}
        onJumpToGap={() => gaps[0] && jumpToGap(gaps[0].id)}
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {visit.parcels.map((p) => (
          <ParcelSection
            key={p.id}
            parcel={p}
            selectedGapId={selectedGapId}
            onSelectGap={setSelectedGapId}
            gapRowRefs={gapRowRefs}
            onCycleCriterion={(cid) => cycleCriterion(p.id, cid)}
          />
        ))}

        {visit.features.length > 0 && (
          <Section label="Features">
            {visit.features.map((f) => (
              <FeatureRow
                key={f.id}
                feature={f}
                gapId={`feature:${f.id}:followup`}
                selectedGapId={selectedGapId}
                onSelectGap={setSelectedGapId}
                gapRowRefs={gapRowRefs}
              />
            ))}
          </Section>
        )}

        <Section label="Site context">
          <Card tone="muted">
            <SiteFieldRow
              label="Weather"
              f={visit.siteContext.weather}
              gapId="site:weather"
              selectedGapId={selectedGapId}
              onSelectGap={setSelectedGapId}
              gapRowRefs={gapRowRefs}
            />
            <SiteFieldRow
              label="Access"
              f={visit.siteContext.access}
              gapId="site:access"
              selectedGapId={selectedGapId}
              onSelectGap={setSelectedGapId}
              gapRowRefs={gapRowRefs}
            />
            <SiteFieldRow
              label="Designations"
              f={visit.siteContext.designations}
              gapId="site:designations"
              selectedGapId={selectedGapId}
              onSelectGap={setSelectedGapId}
              gapRowRefs={gapRowRefs}
            />
            <SiteFieldRow
              label="Recommendations"
              f={visit.siteContext.recommendations}
              gapId="site:recommendations"
              last
              selectedGapId={selectedGapId}
              onSelectGap={setSelectedGapId}
              gapRowRefs={gapRowRefs}
            />
          </Card>
        </Section>
      </div>

      {gaps.length > 0 && (
        <div
          style={{
            flex: "none",
            borderTop: `1.5px solid ${color.borderSoft}`,
            background: color.surface,
            padding: "10px 18px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              paddingBottom: "10px",
              WebkitOverflowScrolling: "touch",
            }}
            className="tscroll"
          >
            {gaps.map((g) => {
              const active = g.id === selectedGapId;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => jumpToGap(g.id)}
                  style={{
                    flex: "none",
                    padding: "6px 10px",
                    borderRadius: radius.md,
                    border: `1.5px solid ${active ? color.clay : color.borderSofter}`,
                    background: active ? color.clayTint : color.surface,
                    fontSize: "11.5px",
                    fontWeight: 600,
                    color: active ? color.clay : color.muted,
                    cursor: "pointer",
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: "13px", fontWeight: 600, color: color.ink, textAlign: "center", marginBottom: "4px" }}>
            {selectedGap?.question}
          </div>

          {cap.error && (
            <div
              style={{
                fontSize: "12px",
                color: color.amberInk,
                background: color.amberBg,
                border: `1px solid ${color.amberBorder}`,
                borderRadius: radius.md,
                padding: "8px 10px",
                marginBottom: "8px",
                textAlign: "center",
              }}
            >
              {cap.error === "no-speech" ? "No speech detected — try again." : "Transcription failed — try again."}
            </div>
          )}

          {cap.phase === "prompt" && (
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <Button variant="secondary" onClick={cap.requestMic}>Enable microphone</Button>
            </div>
          )}

          {cap.phase === "ready" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <RecordButton
                mode={cap.mode}
                pressing={cap.pressing}
                onPointerDown={cap.onBtnDown}
                onPointerUp={cap.onBtnUp}
                onPointerLeave={cap.onBtnLeave}
              />
              <div style={{ fontSize: "12px", fontWeight: 600, color: color.ink, marginTop: "2px", minHeight: "14px" }}>
                {btnLabel}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  fontFamily: font.mono,
                  color: color.faint,
                  marginTop: "2px",
                  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
                }}
              >
                {subHint}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
        <Button full disabled={!canSubmit} onClick={() => router.push(`/visit/${id}/export`)}>
          Submit
        </Button>
      </div>
    </>
  );
}

function ParcelSection({
  parcel,
  selectedGapId,
  onSelectGap,
  gapRowRefs,
  onCycleCriterion,
}: {
  parcel: Parcel;
  selectedGapId: string | null;
  onSelectGap: (id: string) => void;
  gapRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onCycleCriterion: (critId: string) => void;
}) {
  const [showCriteria, setShowCriteria] = useState(false);
  const assessed = parcel.criteria.filter((c) => c.state !== "not-assessed").length;

  return (
    <Section label={parcel.name}>
      <Card>
        <FieldRow
          label="Habitat type"
          f={parcel.ukhabType}
          gapId={`parcel:${parcel.id}:ukhab`}
          selectedGapId={selectedGapId}
          onSelectGap={onSelectGap}
          gapRowRefs={gapRowRefs}
        />
        <FieldRow
          label="Area"
          f={parcel.area}
          suffix={parcel.areaUnit}
          gapId={`parcel:${parcel.id}:area`}
          selectedGapId={selectedGapId}
          onSelectGap={onSelectGap}
          gapRowRefs={gapRowRefs}
        />
        <FieldRow
          label="Condition"
          f={parcel.condition}
          gapId={`parcel:${parcel.id}:condition`}
          selectedGapId={selectedGapId}
          onSelectGap={onSelectGap}
          gapRowRefs={gapRowRefs}
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
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: color.muted,
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Criteria {assessed}/{parcel.criteria.length}
              <span style={{ marginLeft: "auto", color: color.faint }}>{showCriteria ? "▴" : "▾"}</span>
            </button>
            {showCriteria && (
              <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {parcel.criteria.map((c) => (
                  <CriterionRow key={c.id} c={c} onClick={() => onCycleCriterion(c.id)} />
                ))}
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
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 8px",
        border: `1px solid ${color.borderSoft}`,
        borderRadius: radius.md,
        background: color.surface,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: t.border, flex: "none" }} />
      <span style={{ flex: 1, fontSize: "11.5px", color: color.body, lineHeight: 1.35 }}>
        <b style={{ fontFamily: font.mono, marginRight: "5px", color: color.subtle }}>{c.id}</b>
        {c.label}
      </span>
    </button>
  );
}

function FieldRow({
  label,
  f,
  suffix,
  last,
  gapId,
  selectedGapId,
  onSelectGap,
  gapRowRefs,
}: {
  label: string;
  f: Field<string | number>;
  suffix?: string;
  last?: boolean;
  gapId: string;
  selectedGapId: string | null;
  onSelectGap: (id: string) => void;
  gapRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const isGap = f.status !== "green";
  const selected = isGap && selectedGapId === gapId;
  const display = f.value == null ? "—" : `${f.value}${suffix ? ` ${suffix}` : ""}`;

  return (
    <div
      ref={(el) => {
        if (el && isGap) gapRowRefs.current.set(gapId, el);
      }}
      style={{
        padding: "8px 0",
        borderBottom: last ? "none" : `1px solid ${color.hair}`,
        borderRadius: selected ? radius.md : 0,
        background: selected ? color.clayTint : "transparent",
        margin: selected ? "0 -6px" : 0,
        paddingLeft: selected ? "6px" : 0,
        paddingRight: selected ? "6px" : 0,
      }}
    >
      <button
        type="button"
        disabled={!isGap}
        onClick={() => isGap && onSelectGap(gapId)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: isGap ? "pointer" : "default",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "10px", fontFamily: font.mono, color: color.faint, letterSpacing: ".08em" }}>
            {label.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: f.value == null ? color.fainter : color.body,
              fontWeight: 500,
              marginTop: "2px",
            }}
          >
            {display}
          </div>
          {evidenceAddsDetail(f) && (
            <div style={{ fontSize: "11px", color: color.subtle, marginTop: "3px", fontStyle: "italic" }}>
              “{f.evidence}”
            </div>
          )}
        </div>
        <TriageChip status={f.status}>
          {f.status === "green" ? "ok" : f.status === "amber" ? "review" : "missing"}
        </TriageChip>
      </button>
    </div>
  );
}

function SiteFieldRow(props: {
  label: string;
  f: Field<string>;
  gapId: string;
  last?: boolean;
  selectedGapId: string | null;
  onSelectGap: (id: string) => void;
  gapRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  return <FieldRow {...props} />;
}

function FeatureRow({
  feature,
  gapId,
  selectedGapId,
  onSelectGap,
  gapRowRefs,
}: {
  feature: Feature;
  gapId: string;
  selectedGapId: string | null;
  onSelectGap: (id: string) => void;
  gapRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const isProtected = feature.kind === "protected-species";
  const needsFollowUp = isProtected && (!feature.followUp || feature.followUp.status !== "green");
  const selected = needsFollowUp && selectedGapId === gapId;

  return (
    <Card
      tone="muted"
      style={
        selected
          ? { borderColor: color.clay, background: color.clayTint }
          : undefined
      }
    >
      <button
        type="button"
        disabled={!needsFollowUp}
        onClick={() => needsFollowUp && onSelectGap(gapId)}
        ref={(el) => {
          if (el && needsFollowUp) gapRowRefs.current.set(gapId, el);
        }}
        style={{
          display: "block",
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: needsFollowUp ? "pointer" : "default",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <TriageChip status={feature.text.status}>{kindLabel(feature.kind)}</TriageChip>
          <div style={{ flex: 1, fontSize: "13px", color: color.body, lineHeight: 1.4 }}>{feature.text.value}</div>
        </div>
        {isProtected && (
          <div style={{ fontSize: "11.5px", marginTop: "6px", color: needsFollowUp ? color.red : color.green }}>
            {feature.followUp?.value ? `Follow-up: ${feature.followUp.value}` : "Follow-up required"}
          </div>
        )}
      </button>
    </Card>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontFamily: font.mono, fontSize: "10px", letterSpacing: ".12em", color: color.faint }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function nextState(s: Criterion["state"]): Criterion["state"] {
  return s === "not-assessed" ? "pass" : s === "pass" ? "fail" : "not-assessed";
}

function kindLabel(k: Feature["kind"]): string {
  return k === "protected-species" ? "protected" : k === "notable" ? "notable" : "note";
}
