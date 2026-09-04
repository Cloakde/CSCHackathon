import { z } from "zod";

import { OffsetMsSchema, StableIdSchema } from "./common";

export const ConfusionTriggerSchema = z.literal("im_lost");

export const ConfusionEventSchema = z
  .object({
    confusionId: StableIdSchema,
    sessionId: StableIdSchema,
    occurredAtMs: OffsetMsSchema,
    trigger: ConfusionTriggerSchema,
    anchorChunkId: StableIdSchema.optional(),
    contextChunkIds: z.array(StableIdSchema),
    evidenceChunkIds: z.array(StableIdSchema),
    assistanceResponseId: StableIdSchema,
    conceptId: StableIdSchema.optional(),
    conceptTitle: z.string().trim().min(1).max(160).optional(),
  })
  .superRefine((event, context) => {
    const contextIds = new Set(event.contextChunkIds);
    if (contextIds.size !== event.contextChunkIds.length) {
      context.addIssue({
        code: "custom",
        message: "Context chunk IDs must be unique",
        path: ["contextChunkIds"],
      });
    }
    if (event.anchorChunkId && !contextIds.has(event.anchorChunkId)) {
      context.addIssue({
        code: "custom",
        message: "Anchor chunk must be part of the selected context",
        path: ["anchorChunkId"],
      });
    }
    const evidenceIds = new Set(event.evidenceChunkIds);
    if (evidenceIds.size !== event.evidenceChunkIds.length) {
      context.addIssue({
        code: "custom",
        message: "Evidence chunk IDs must be unique",
        path: ["evidenceChunkIds"],
      });
    }
    if (event.evidenceChunkIds.some((chunkId) => !contextIds.has(chunkId))) {
      context.addIssue({
        code: "custom",
        message: "Evidence chunks must come from the selected context",
        path: ["evidenceChunkIds"],
      });
    }
    if (Boolean(event.conceptId) !== Boolean(event.conceptTitle)) {
      context.addIssue({
        code: "custom",
        message: "Concept ID and title must either both be present or both be absent",
        path: ["conceptId"],
      });
    }
    if (event.evidenceChunkIds.length > 0 && !event.conceptId) {
      context.addIssue({
        code: "custom",
        message: "Evidence-backed confusion must identify its supported concept",
        path: ["conceptId"],
      });
    }
    if (event.conceptId && event.evidenceChunkIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "An identified concept requires transcript evidence",
        path: ["evidenceChunkIds"],
      });
    }
  });

export const WeakAreaDrillBodySchema = z
  .object({
    confusionEventIds: z.array(StableIdSchema).length(1),
  })
  .strict();

export const WeakAreaDrillRequestSchema = WeakAreaDrillBodySchema.extend({
  sessionId: StableIdSchema,
});

export const PracticeItemSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  expectedAnswer: z.string().trim().min(1).max(2_000),
  explanation: z.string().trim().min(1).max(4_000),
});

export const WeakAreaDrillResponseSchema = z
  .object({
    drillId: StableIdSchema,
    sessionId: StableIdSchema,
    sourceConfusionEventIds: z.array(StableIdSchema).length(1),
    conceptId: StableIdSchema,
    conceptTitle: z.string().trim().min(1).max(160),
    shortExplanation: z.string().trim().min(1).max(4_000),
    practiceItems: z.array(PracticeItemSchema).min(1).max(10),
    evidenceChunkIds: z.array(StableIdSchema).min(1),
  })
  .superRefine((drill, context) => {
    if (new Set(drill.sourceConfusionEventIds).size !== drill.sourceConfusionEventIds.length) {
      context.addIssue({
        code: "custom",
        message: "Source confusion event IDs must be unique",
        path: ["sourceConfusionEventIds"],
      });
    }
    if (new Set(drill.evidenceChunkIds).size !== drill.evidenceChunkIds.length) {
      context.addIssue({
        code: "custom",
        message: "Evidence chunk IDs must be unique",
        path: ["evidenceChunkIds"],
      });
    }
  });

export function assertWeakAreaDrillLinkage(
  request: WeakAreaDrillRequest,
  availableConfusionEvents: readonly ConfusionEvent[],
  drill: WeakAreaDrillResponse,
): void {
  if (drill.sessionId !== request.sessionId) {
    throw new Error("Weak-area drill belongs to a different session");
  }

  if (
    drill.sourceConfusionEventIds.length !== request.confusionEventIds.length ||
    drill.sourceConfusionEventIds.some(
      (confusionId, index) => confusionId !== request.confusionEventIds[index],
    )
  ) {
    throw new Error("Weak-area drill does not exactly match the requested confusion events");
  }

  const confusionEvent = availableConfusionEvents.find(
    (event) => event.confusionId === request.confusionEventIds[0],
  );
  if (!confusionEvent) {
    throw new Error("Weak-area drill request references a nonexistent confusion event");
  }
  if (confusionEvent.sessionId !== request.sessionId) {
    throw new Error("Source confusion event belongs to a different session");
  }
  if (!confusionEvent.conceptId || !confusionEvent.conceptTitle) {
    throw new Error("Source confusion event does not contain an evidence-backed concept");
  }

  if (
    drill.conceptId !== confusionEvent.conceptId ||
    drill.conceptTitle !== confusionEvent.conceptTitle
  ) {
    throw new Error("Weak-area drill concept does not match the source confusion event");
  }

  const validEvidenceIds = new Set(confusionEvent.evidenceChunkIds);
  if (drill.evidenceChunkIds.some((chunkId) => !validEvidenceIds.has(chunkId))) {
    throw new Error("Weak-area drill cites evidence outside the source confusion event");
  }
}

export type ConfusionEvent = z.infer<typeof ConfusionEventSchema>;
export type WeakAreaDrillBody = z.infer<typeof WeakAreaDrillBodySchema>;
export type WeakAreaDrillRequest = z.infer<typeof WeakAreaDrillRequestSchema>;
export type PracticeItem = z.infer<typeof PracticeItemSchema>;
export type WeakAreaDrillResponse = z.infer<typeof WeakAreaDrillResponseSchema>;
