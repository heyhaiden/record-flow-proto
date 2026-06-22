"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { NotFound } from "@/components/nav";
import { color } from "@/lib/design/tokens";

export default function VisitOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getVisit, hydrated } = useVisitStore();
  const visit = getVisit(id);

  useEffect(() => {
    if (!hydrated || !visit) return;
    router.replace(visit.parcels.length === 0 ? `/visit/${id}/setup` : `/visit/${id}/record`);
  }, [hydrated, id, router, visit]);

  if (!hydrated) {
    return <div style={{ flex: 1 }} aria-busy="true" />;
  }

  if (!visit) return <NotFound />;

  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", color: color.faint, fontSize: "13px" }}>
      Opening recorder...
    </div>
  );
}
