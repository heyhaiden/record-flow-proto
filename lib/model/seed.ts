import { criteriaFor } from "./conditions";
import { field, type Condition, type Field, type Parcel, type Visit } from "./types";
import { newId } from "@/lib/id";

// Typed empty fields (null value → "red"/missing) so generics infer correctly.
const emptyStr = (): Field<string> => field<string>(null, null, "red");
const emptyNum = (): Field<number> => field<number>(null, null, "red");
const emptyCond = (): Field<Condition> => field<Condition>(null, null, "red");

export function buildFreestyleParcel(name: string, habitatId?: string): Parcel {
  return {
    id: newId("p"),
    name,
    habitatId,
    ukhabType: emptyStr(),
    area: emptyNum(),
    areaUnit: "ha",
    condition: emptyCond(),
    criteria: criteriaFor(habitatId),
    status: "to-assess",
  };
}

export function buildFreestyle(siteName = "New site", surveyor = "E. Hartley"): Visit {
  return {
    id: newId("visit"),
    siteName,
    date: new Date().toISOString().slice(0, 10),
    surveyor,
    status: "in-progress",
    siteContext: {
      weather: emptyStr(),
      access: emptyStr(),
      designations: emptyStr(),
      recommendations: emptyStr(),
    },
    parcels: [],
    features: [],
  };
}

export function seedVisits(): Visit[] {
  return [];
}
