import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Extractor } from "./provider";
import {
  ExtractionPatchSchema,
  type ExtractionInput,
  type ExtractionPatch,
} from "./schema";

const SYSTEM = `You extract structured BNG condition-assessment and PEA walkover data from a UK ecologist's voice walk-through transcript.

For each parcel, extract: ukhabType (UKHab habitat type), area (in hectares as a number), condition (Good/Moderate/Poor), and the state (pass/fail/not-assessed) of the criteria whose ids are listed for that parcel. Also extract site context (weather, access, designations, recommendations) and discrete features (target notes, protected-species triggers, notable features).

Rules:
- Ground every value in the transcript. Put the verbatim supporting span in "evidence". If nothing supports a value, return value null.
- Set "confidence": "high" when the transcript states it clearly, "medium" when you infer it, "low" when it is a guess.
- Do NOT decide green/amber/red status — that is derived downstream from confidence + evidence.
- Desk-study reconciliation for a parcel's habitat type: set "reconciliation" to "confirms" if the surveyor confirms the desk-study type, "overrides" if they describe a different type (put the reason in the type's evidence), or "silent" if they never address that parcel's type.
- The target hint in brackets is a strong hint, not a hard rule — reassign a note if its content clearly belongs to a different parcel/site/feature.
- Only mark criteria whose ids are listed for that parcel; leave others "not-assessed".
- For protected-species features, set "followUp" to the surveyor's recommended next step if given, else null.`;

function buildUserMessage(input: ExtractionInput): string {
  const parcels = input.parcels
    .map(
      (p) =>
        `- ${p.name} (id: ${p.id}); desk-study type: ${p.deskStudyType ?? "none"}; criteria ids: ${p.criteriaIds.join(", ") || "none"}`,
    )
    .join("\n");
  const notes = input.transcript
    .map((n) => {
      const tgt = n.target.kind === "parcel" ? `parcel ${n.target.parcelId}` : n.target.kind;
      return `[${tgt}] ${n.text}`;
    })
    .join("\n");
  return `PARCELS (desk-study priors):\n${parcels || "none"}\n\nTRANSCRIPT NOTES (bracketed target is a strong hint):\n${notes}`;
}

export class ClaudeExtractor implements Extractor {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extract(input: ExtractionInput): Promise<ExtractionPatch> {
    const message = await this.client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(ExtractionPatchSchema), effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });
    const parsed = message.parsed_output;
    if (!parsed) throw new Error("extraction returned no parsed output");
    // Runtime shape matches ExtractionPatch; nullable fields are handled by merge.
    return parsed as unknown as ExtractionPatch;
  }
}
