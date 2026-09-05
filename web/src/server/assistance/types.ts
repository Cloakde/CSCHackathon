import { z } from "zod";
import type {
  CompletedSessionView,
  ConfusionEvent,
  WeakAreaDrillResponse,
} from "@livelecture/shared";

export interface PracticeGenerationContext {
  view: CompletedSessionView;
  signal: AbortSignal;
}

export interface PracticeVerificationCandidate {
  view: CompletedSessionView;
  confusionEvent: ConfusionEvent;
  drill: WeakAreaDrillResponse;
}

const PracticeCheckSchema = z.enum([
  "question_supported",
  "answer_correct",
  "explanation_supported",
  "confusion_aligned",
]);

export const PracticeSupportVerdictSchema = z.discriminatedUnion("verdict", [
  z
    .object({
      verdict: z.literal("supported"),
      supportedChecks: z
        .array(PracticeCheckSchema)
        .length(4)
        .refine((checks) => new Set(checks).size === 4, "All four checks must be supported"),
    })
    .strict(),
  z.object({ verdict: z.literal("unsupported") }).strict(),
]);

export type PracticeSupportVerdict = z.infer<typeof PracticeSupportVerdictSchema>;
