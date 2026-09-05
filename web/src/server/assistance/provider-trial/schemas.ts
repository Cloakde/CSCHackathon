import { z } from "zod";
import {
  ImLostDiagnosisSchema,
  ModelGroundedImLostOutputSchema,
  ModelInsufficientImLostOutputSchema,
  PracticeItemSchema,
  WeakAreaDrillResponseSchema,
  GroundingSupportVerdictSchema,
} from "@livelecture/shared";
import { PracticeSupportVerdictSchema } from "../types";

export const TrialConceptSchema = z.enum([
  "concept_inner_outer",
  "concept_inner_derivative",
  "concept_sine_composition",
]);

export const TrialHelpSchema = z.discriminatedUnion("groundingStatus", [
  ModelGroundedImLostOutputSchema.safeExtend({
    diagnosis: ImLostDiagnosisSchema.strict(),
    conceptId: TrialConceptSchema,
  }),
  ModelInsufficientImLostOutputSchema,
]);
export const TrialPracticeSchema = WeakAreaDrillResponseSchema.safeExtend({
  conceptId: TrialConceptSchema,
  practiceItems: z.array(PracticeItemSchema.strict()).length(1),
}).strict();

export const ResultSchemas = {
  help_generate: z.object({ result: TrialHelpSchema }).strict(),
  help_verify: z.object({ result: GroundingSupportVerdictSchema }).strict(),
  practice_generate: z.object({ result: TrialPracticeSchema }).strict(),
  practice_verify: z.object({ result: PracticeSupportVerdictSchema }).strict(),
};

type JsonSchema = Record<string, unknown>;
const string: JsonSchema = { type: "string" };
const strings = (values: readonly string[]): JsonSchema => ({ type: "string", enum: values });
const array = (items: JsonSchema): JsonSchema => ({ type: "array", items });
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const context = object({
  sessionId: string,
  transcriptRevision: { type: "integer" },
  anchorMs: { type: "integer" },
  chunkIds: array(string),
});
const followUps = array(
  strings(["ask_follow_up", "explain_more_simply", "show_an_example", "bookmark_moment"]),
);
const supported = (field: string, checks: readonly string[]) => ({
  anyOf: [
    object({ verdict: strings(["supported"]), [field]: array(strings(checks)) }),
    object({ verdict: strings(["unsupported"]) }),
  ],
});

// The provider's supported JSON-Schema subset is only a formatting constraint.
// The strict runtime schemas above retain all identity/refinement validation.
export const OutputJsonSchemas = {
  help_generate: object({
    result: {
      anyOf: [
        object({
          groundingStatus: strings(["grounded"]),
          context,
          diagnosis: object({
            whatJustHappened: string,
            mainIdea: string,
            simpleExplanation: string,
            importantPrerequisite: string,
          }),
          citationChunkIds: array(string),
          conceptId: strings(TrialConceptSchema.options),
          conceptTitle: string,
          followUpActions: followUps,
        }),
        object({
          groundingStatus: strings(["insufficient_evidence"]),
          context,
          followUpActions: followUps,
        }),
      ],
    },
  }),
  help_verify: object({
    result: supported("supportedClaims", [
      "what_just_happened",
      "main_idea",
      "simple_explanation",
      "important_prerequisite",
      "concept",
    ]),
  }),
  practice_generate: object({
    result: object({
      drillId: string,
      sessionId: string,
      sourceConfusionEventIds: array(string),
      conceptId: strings(TrialConceptSchema.options),
      conceptTitle: string,
      shortExplanation: string,
      practiceItems: array(object({ prompt: string, expectedAnswer: string, explanation: string })),
      evidenceChunkIds: array(string),
    }),
  }),
  practice_verify: object({
    result: supported("supportedChecks", [
      "question_supported",
      "answer_correct",
      "explanation_supported",
      "confusion_aligned",
    ]),
  }),
} as const;
