import { describe, expect, it } from "vitest";
import {
  classifyHsi,
  ecologyFormById,
  ECOLOGY_FORM_SCHEMAS,
  flatFields,
  flatFieldIds,
  maxHsiScore,
  requiredFields,
  repeatableSections,
  voiceHintsForForms,
} from "@/lib/model/form-schemas";
import type { ProjectFormId } from "@/lib/model/forms";
import { FORM_SCHEMAS } from "@/lib/model/forms";

const FORM_IDS: ProjectFormId[] = [
  "bng-condition",
  "pea-walkover",
  "bat-pra",
  "badger-survey",
  "gcn-hsi",
  "invasive-species",
];

describe("ecology form schemas", () => {
  it("loads all six compliance forms", () => {
    expect(ECOLOGY_FORM_SCHEMAS.length).toBe(6);
    expect(ECOLOGY_FORM_SCHEMAS.map((f) => f.id)).toEqual(FORM_IDS);
  });

  it("keeps FORM_SCHEMAS summaries aligned with full schemas", () => {
    expect(FORM_SCHEMAS.length).toBe(6);
    FORM_SCHEMAS.forEach((summary) => {
      const full = ecologyFormById(summary.id);
      expect(full?.title).toBe(summary.title);
      expect(summary.fields.length).toBe(flatFieldIds(full!).length);
    });
  });

  it("defines required fields and voice hints for each form", () => {
    ECOLOGY_FORM_SCHEMAS.forEach((form) => {
      expect(requiredFields(form).length).toBeGreaterThan(0);
      expect(flatFieldIds(form).length).toBeGreaterThan(3);
      const hints = voiceHintsForForms([form.id]);
      expect(Object.keys(hints).length).toBeGreaterThan(0);
    });
  });

  it("marks repeatable sections for multi-record forms", () => {
    expect(repeatableSections(ecologyFormById("bat-pra")!).map((s) => s.id)).toContain("structure");
    expect(repeatableSections(ecologyFormById("badger-survey")!).map((s) => s.id)).toContain("sett");
    expect(repeatableSections(ecologyFormById("gcn-hsi")!).map((s) => s.id)).toContain("pond");
    expect(repeatableSections(ecologyFormById("invasive-species")!).map((s) => s.id)).toContain(
      "species-record",
    );
  });

  it("scores GCN HSI to 30 with standard classification bands", () => {
    const gcn = ecologyFormById("gcn-hsi")!;
    expect(maxHsiScore(gcn)).toBe(30);
    expect(classifyHsi(4)).toBe("poor");
    expect(classifyHsi(8)).toBe("moderate");
    expect(classifyHsi(15)).toBe("good");
  });

  it("links BNG criteria checklist to habitat config", () => {
    const bng = ecologyFormById("bng-condition")!;
    const checklist = flatFields(bng).find((f) => f.id === "criteria_checklist");
    expect(checklist?.type).toBe("criteria-checklist");
    expect(checklist?.habitatRef).toBe("habitat_id");
  });
});
