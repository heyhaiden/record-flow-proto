/**
 * Bridges config/habitat-conditions.json into the capture model: builds the
 * criteria checklist for a habitat and computes Good/Moderate/Poor from the
 * per-habitat scoring rule. Provisional field estimate — not the statutory score.
 */

import config from "@/config/habitat-conditions.json";
import type { Condition, Criterion } from "./types";

interface ConfigCriterion {
  id: string;
  label: string;
  group?: string;
  essential?: boolean;
}
interface ConfigHabitat {
  id: string;
  label: string;
  scoring: { model: string; essentialCriterion?: string; totalCriteria?: number };
  criteria: ConfigCriterion[];
}

const HABITATS = config.habitats as ConfigHabitat[];

export function habitatById(id: string | undefined): ConfigHabitat | undefined {
  return HABITATS.find((h) => h.id === id);
}

export function habitatOptions(): { id: string; label: string }[] {
  return HABITATS.map((h) => ({ id: h.id, label: h.label }));
}

/** Fresh, all "not-assessed" criteria for a habitat. */
export function criteriaFor(habitatId: string | undefined): Criterion[] {
  const h = habitatById(habitatId);
  if (!h) return [];
  return h.criteria.map((c) => ({
    id: c.id,
    label: c.label,
    group: c.group,
    essential: c.essential,
    state: "not-assessed" as const,
  }));
}

/**
 * Compute provisional condition from criteria, honouring the per-habitat model.
 * Returns null while too many criteria are still not-assessed to call.
 */
export function computeCondition(
  habitatId: string | undefined,
  criteria: Criterion[],
): Condition | null {
  const h = habitatById(habitatId);
  if (!h) return null;
  const assessed = criteria.filter((c) => c.state !== "not-assessed");
  if (assessed.length < criteria.length) return null; // not enough to call yet

  if (h.scoring.model === "criteria_count_with_essential") {
    const passes = criteria.filter((c) => c.state === "pass").length;
    const essentialId = h.scoring.essentialCriterion ?? "A";
    const essentialPass = criteria.find((c) => c.id === essentialId)?.state === "pass";
    if (!essentialPass) return "Poor";
    if (passes >= 6) return "Good";
    if (passes >= 4) return "Moderate";
    return "Poor";
  }

  if (h.scoring.model === "failure_count_with_group_rule") {
    const fails = criteria.filter((c) => c.state === "fail");
    const failCount = fails.length;
    const byGroup = new Map<string, number>();
    fails.forEach((c) => byGroup.set(c.group ?? "?", (byGroup.get(c.group ?? "?") ?? 0) + 1));
    const groupsFailingBoth = [...byGroup.values()].filter((n) => n >= 2).length;
    const maxPerGroup = Math.max(0, ...byGroup.values());
    if (failCount <= 2 && maxPerGroup <= 1) return "Good";
    if (failCount <= 4 && groupsFailingBoth <= 1) return "Moderate";
    return "Poor";
  }

  return null;
}
