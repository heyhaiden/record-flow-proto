"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { useDriveConnection } from "@/lib/store/connections";
import type { Visit } from "@/lib/model/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { BackButton, NotFound } from "@/components/nav";
import { color, font, radius } from "@/lib/design/tokens";

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, updateVisit } = useVisitStore();
  const { connected, connect } = useDriveConnection();
  const visit = getVisit(id);
  const [syncing, setSyncing] = useState(false);
  const [filed, setFiled] = useState(false);

  if (!visit) return <NotFound />;

  const sync = () => {
    if (!connected) return;
    setSyncing(true);
    setTimeout(() => {
      updateVisit(id, (v) => ({ ...v, status: "filed", filedAt: "just now" }));
      setSyncing(false);
      setFiled(true);
    }, 1100);
  };

  if (filed) {
    return (
      <>
        <ScreenHeader eyebrow="EXPORT" title={visit.siteName} left={<BackButton onClick={() => router.push("/")} />} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px", padding: "24px", textAlign: "center" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: color.green, color: color.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px" }}>✓</div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: color.ink }}>Filed to Google Drive</div>
            <div style={{ fontSize: "12.5px", color: color.subtle, marginTop: "6px" }}>
              /Surveys/2026/{visit.siteName} — report.docx
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "280px" }}>
            <Button variant="secondary" onClick={() => router.push(`/visit/${id}/review`)}>Edit report</Button>
            <Button variant="secondary" onClick={() => router.push("/")}>New report</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHeader eyebrow="EXPORT · GOOGLE DOC" title={visit.siteName} left={<BackButton onClick={() => router.push(`/visit/${id}/review`)} />} />

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <DocPreview visit={visit} />

        {!connected && (
          <Card>
            <div style={{ fontSize: "12.5px", color: color.body, lineHeight: 1.5 }}>
              Connect Google Drive to file this report.
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <Button onClick={connect}>Connect Drive</Button>
              <Button variant="ghost" onClick={() => router.push("/settings/connections")}>Settings</Button>
            </div>
          </Card>
        )}
      </div>

      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 22px)", display: "flex", flexDirection: "column", gap: "8px" }}>
        <Button full disabled={!connected || syncing} onClick={sync}>
          {syncing ? "Syncing…" : "Sync to Google Drive"}
        </Button>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary" full onClick={() => router.push(`/visit/${id}/review`)}>Edit report</Button>
          <Button variant="secondary" full onClick={() => router.push("/")}>New report</Button>
        </div>
      </div>
    </>
  );
}

function DocPreview({ visit }: { visit: Visit }) {
  return (
    <div style={{ border: `1.5px solid ${color.border}`, borderRadius: radius.xl, background: color.surface, padding: "18px 18px 20px", boxShadow: "0 4px 14px rgba(0,0,0,.06)" }}>
      <div style={{ fontFamily: font.mono, fontSize: "10px", letterSpacing: ".14em", color: color.faint }}>
        BNG / PEA SURVEY REPORT
      </div>
      <h1 style={{ fontSize: "20px", color: color.ink, margin: "6px 0 2px" }}>{visit.siteName}</h1>
      <div style={{ fontSize: "11.5px", color: color.subtle }}>
        {visit.date} · {visit.surveyor}
      </div>

      <DocSection title="Site context">
        <DocLine k="Weather" v={visit.siteContext.weather.value} />
        <DocLine k="Access" v={visit.siteContext.access.value} />
        <DocLine k="Designations" v={visit.siteContext.designations.value} />
        <DocLine k="Recommendations" v={visit.siteContext.recommendations.value} />
      </DocSection>

      {visit.parcels.map((p) => (
        <DocSection key={p.id} title={`${p.name} — ${p.ukhabType.value ?? "untyped"}`}>
          <DocLine k="Area" v={p.area.value != null ? `${p.area.value} ${p.areaUnit}` : null} />
          <DocLine k="Condition" v={p.condition.value} />
          <DocLine
            k="Criteria"
            v={`${p.criteria.filter((c) => c.state !== "not-assessed").length}/${p.criteria.length} assessed`}
          />
        </DocSection>
      ))}

      {visit.features.length > 0 && (
        <DocSection title="Features & target notes">
          {visit.features.map((f) => (
            <div key={f.id} style={{ fontSize: "12px", color: color.body, lineHeight: 1.5, marginBottom: "4px" }}>
              • {f.text.value}
              {f.followUp?.value ? ` — ${f.followUp.value}` : ""}
            </div>
          ))}
        </DocSection>
      )}

      <div style={{ marginTop: "14px", fontSize: "10px", color: color.fainter, fontStyle: "italic" }}>
        Field estimates — confirm at desk. Provisional condition, not the statutory metric score.
      </div>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: `1px solid ${color.hair}` }}>
      <div style={{ fontSize: "12.5px", fontWeight: 700, color: color.body, marginBottom: "6px" }}>{title}</div>
      {children}
    </div>
  );
}

function DocLine({ k, v }: { k: string; v: string | null }) {
  return (
    <div style={{ display: "flex", gap: "10px", fontSize: "12px", lineHeight: 1.6, alignItems: "baseline" }}>
      <span style={{ color: color.faint, flex: "0 0 92px" }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word", color: v ? color.body : color.fainter }}>
        {v ?? "—"}
      </span>
    </div>
  );
}
