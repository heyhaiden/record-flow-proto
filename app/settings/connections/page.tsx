"use client";

import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { BackButton } from "@/components/nav";
import { TriageChip } from "@/components/TriageChip";
import { useDriveConnection } from "@/lib/store/connections";
import { color, font } from "@/lib/design/tokens";

/**
 * Connections seam screen — mocked Google Drive OAuth + output template picker.
 * Real DestinationProvider (Drive/Docs) wires in here at M4.
 */
export default function ConnectionsPage() {
  const router = useRouter();
  const { connected, connect, disconnect } = useDriveConnection();

  return (
    <>
      <ScreenHeader eyebrow="SETTINGS" title="Connections" left={<BackButton />} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div>
              <div style={{ fontSize: "13.5px", fontWeight: 600, color: color.body }}>Google Drive</div>
              <div style={{ fontSize: "11.5px", color: color.faint, marginTop: "2px" }}>
                Finished reports sync to your Drive folder.
              </div>
            </div>
            {connected ? <TriageChip status="green">connected</TriageChip> : <TriageChip status="red">not connected</TriageChip>}
          </div>
          <div style={{ marginTop: "12px" }}>
            <Button variant={connected ? "secondary" : "primary"} onClick={connected ? disconnect : connect} full>
              {connected ? "Disconnect" : "Connect Google Drive"}
            </Button>
          </div>
        </Card>

        <Card tone="muted">
          <div style={{ fontSize: "13.5px", fontWeight: 600, color: color.body }}>Output template</div>
          <div style={{ fontSize: "11.5px", color: color.faint, marginTop: "2px" }}>
            Your own Google Doc with documented merge tokens. We never edit your document.
          </div>
          <div style={{ marginTop: "8px", fontFamily: font.mono, fontSize: "11.5px", color: color.muted }}>
            BNG/PEA default template ▾
          </div>
        </Card>
      </div>
      <div style={{ padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
        <Button full variant="secondary" onClick={() => router.back()}>
          Done
        </Button>
      </div>
    </>
  );
}
