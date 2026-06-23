import {
  ECOLOGY_FORM_SCHEMAS,
  flatFields,
  type EcologyFormSchema,
} from "./form-schemas";

export type ProjectFormId =
  | "bng-condition"
  | "pea-walkover"
  | "bat-pra"
  | "badger-survey"
  | "gcn-hsi"
  | "invasive-species";

/** Summary shape for lobby UI — derived from full ecology schemas. */
export interface ProjectFormSchema {
  id: ProjectFormId;
  title: string;
  shortTitle: string;
  description: string;
  fields: string[];
}

function toSummary(form: EcologyFormSchema): ProjectFormSchema {
  return {
    id: form.id,
    title: form.title,
    shortTitle: form.shortTitle,
    description: form.description,
    fields: flatFields(form).map((f) => f.label),
  };
}

export const FORM_SCHEMAS: ProjectFormSchema[] = ECOLOGY_FORM_SCHEMAS.map(toSummary);

export { ECOLOGY_FORM_SCHEMAS, ecologyFormById, ecologyFormsByIds } from "./form-schemas";
