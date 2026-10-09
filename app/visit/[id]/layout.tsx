"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useVisitStore } from "@/lib/store/visit-store";
import { NotFound } from "@/components/nav";
import { color } from "@/lib/design/tokens";

/**
 * Shared visit chrome. Holds the shell until localStorage has hydrated so
 * review/export never flash "Visit not found" on a cold load, and so record →
 * processing → review can swap without a root loading skeleton.
 */
export default function VisitLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { getVisit, hydrated } = useVisitStore();
  const visit = getVisit(id);

  if (!hydrated) {
    return <div style={{ flex: 1, background: color.surface }} />;
  }
  if (!visit) return <NotFound />;
  return <>{children}</>;
}
