/**
 * Ecology compliance form schemas — loaded from config/ecology-forms.json.
 * Drives voice extraction targets, completeness checks, and future doc merge.
 */

import ecologyFormsConfig from "@/config/ecology-forms.json";
import type { ProjectFormId } from "./forms";

export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "boolean"
  | "condition"
  | "criteria-checklist"
  | "score";

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldSchema {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  voiceHint?: string;
  unit?: string;
  options?: FormFieldOption[];
  min?: number;
  max?: number;
  /** Dynamic ref to another field id (e.g. habitat_id for criteria checklist). */
  habitatRef?: string;
}

export interface FormSectionSchema {
  id: string;
  label: string;
  description?: string;
  repeatable?: boolean;
  repeatLabel?: string;
  fields: FormFieldSchema[];
}

export interface EcologyFormSchema {
  id: ProjectFormId;
  title: string;
  shortTitle: string;
  description: string;
  methodology?: string;
  sections: FormSectionSchema[];
}

interface EcologyFormsConfig {
  version: string;
  status: string;
  forms: EcologyFormSchema[];
}

const CONFIG = ecologyFormsConfig as EcologyFormsConfig;

export const ECOLOGY_FORM_SCHEMAS: EcologyFormSchema[] = CONFIG.forms;

export function ecologyFormById(id: ProjectFormId): EcologyFormSchema | undefined {
  return ECOLOGY_FORM_SCHEMAS.find((f) => f.id === id);
}

export function ecologyFormsByIds(ids: ProjectFormId[]): EcologyFormSchema[] {
  return ids.map((id) => ecologyFormById(id)).filter((f): f is EcologyFormSchema => f != null);
}

/** All field schemas across sections (repeatable sections included once in the flat list). */
export function flatFields(form: EcologyFormSchema): FormFieldSchema[] {
  return form.sections.flatMap((s) => s.fields);
}

export function flatFieldIds(form: EcologyFormSchema): string[] {
  return flatFields(form).map((f) => f.id);
}

export function requiredFields(form: EcologyFormSchema): FormFieldSchema[] {
  return flatFields(form).filter((f) => f.required);
}

/** Repeatable section ids — each instance is a separate capture block on site. */
export function repeatableSections(form: EcologyFormSchema): FormSectionSchema[] {
  return form.sections.filter((s) => s.repeatable);
}

/** Voice hints keyed by field id for LLM / STT glossary injection. */
export function voiceHintsForForms(ids: ProjectFormId[]): Record<string, string> {
  const hints: Record<string, string> = {};
  ecologyFormsByIds(ids).forEach((form) => {
    flatFields(form).forEach((field) => {
      if (field.voiceHint) hints[`${form.id}.${field.id}`] = field.voiceHint;
    });
  });
  return hints;
}

/** Max HSI score if all score fields are present (0–3 each). */
export function maxHsiScore(form: EcologyFormSchema): number {
  return flatFields(form)
    .filter((f) => f.type === "score")
    .reduce((sum, f) => sum + (f.max ?? 3), 0);
}

/** HSI classification from total score per standard bands. */
export function classifyHsi(total: number): "poor" | "moderate" | "good" {
  if (total <= 5) return "poor";
  if (total <= 10) return "moderate";
  return "good";
}
