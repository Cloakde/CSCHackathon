import { z } from "zod";

import { OffsetMsSchema, StableIdSchema } from "./common";
import { ConfusionEventSchema } from "./study";
import { TranscriptChunkSchema, type TranscriptChunk } from "./transcript";

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  "I could not verify an explanation from the lecture transcript available at this moment.";

const MIN_LOOKBACK_MS = 30_000;
const MAX_LOOKBACK_MS = 900_000;

export const LookbackMsSchema = z.number().int().min(MIN_LOOKBACK_MS).max(MAX_LOOKBACK_MS);

export const ImLostBodySchema = z
  .object({
    lookbackMs: LookbackMsSchema.default(300_000),
  })
  .strict();

export const GroundingStatusSchema = z.enum(["grounded", "insufficient_evidence"]);

export const ImLostDiagnosisSchema = z.object({
  whatJustHappened: z.string().trim().min(1).max(4_000),
  mainIdea: z.string().trim().min(1).max(4_000),
  simpleExplanation: z.string().trim().min(1).max(4_000),
  importantPrerequisite: z.string().trim().min(1).max(4_000),
});

export const FollowUpActionSchema = z.enum([
  "ask_follow_up",
  "explain_more_simply",
  "show_an_example",
  "bookmark_moment",
]);

export const GroundingContextReferenceSchema = z
  .object({
    sessionId: StableIdSchema,
    transcriptRevision: z.number().int().nonnegative(),
    anchorMs: OffsetMsSchema,
    chunkIds: z.array(StableIdSchema),
  })
  .strict()
  .superRefine((reference, context) => {
    if (new Set(reference.chunkIds).size !== reference.chunkIds.length) {
      context.addIssue({
        code: "custom",
        message: "Grounding context chunk IDs must be unique",
        path: ["chunkIds"],
      });
    }
  });

export const GroundingContextSnapshotSchema = z
  .object({
    reference: GroundingContextReferenceSchema,
    startMs: OffsetMsSchema,
    chunks: z.array(TranscriptChunkSchema),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.startMs > snapshot.reference.anchorMs) {
      context.addIssue({
        code: "custom",
        message: "Grounding context start cannot follow its anchor",
        path: ["startMs"],
      });
    }
    const windowLengthMs = snapshot.reference.anchorMs - snapshot.startMs;
    if (
      windowLengthMs > MAX_LOOKBACK_MS ||
      (snapshot.startMs > 0 && windowLengthMs < MIN_LOOKBACK_MS)
    ) {
      context.addIssue({
        code: "custom",
        message: "Grounding context must represent a valid bounded lookback window",
        path: ["startMs"],
      });
    }
    const actualChunkIds = snapshot.chunks.map((chunk) => chunk.chunkId);
    if (
      actualChunkIds.length !== snapshot.reference.chunkIds.length ||
      actualChunkIds.some((chunkId, index) => chunkId !== snapshot.reference.chunkIds[index])
    ) {
      context.addIssue({
        code: "custom",
        message: "Grounding context reference must exactly identify the snapshot chunks",
        path: ["reference", "chunkIds"],
      });
    }
    let previousSequence = -1;
    let previousEndMs = 0;
    snapshot.chunks.forEach((chunk, chunkIndex) => {
      if (chunk.sessionId !== snapshot.reference.sessionId) {
        context.addIssue({
          code: "custom",
          message: "Grounding context chunk belongs to another session",
          path: ["chunks", chunkIndex, "sessionId"],
        });
      }
      if (chunk.sequence <= previousSequence || chunk.startMs < previousEndMs) {
        context.addIssue({
          code: "custom",
          message: "Grounding context chunks must remain in canonical transcript order",
          path: ["chunks", chunkIndex],
        });
      }
      if (chunk.endMs < snapshot.startMs || chunk.endMs > snapshot.reference.anchorMs) {
        context.addIssue({
          code: "custom",
          message: "Grounding context chunk falls outside the authoritative time window",
          path: ["chunks", chunkIndex],
        });
      }
      previousSequence = chunk.sequence;
      previousEndMs = chunk.endMs;
    });
  });

export const ModelGroundedImLostOutputSchema = z
  .object({
    groundingStatus: z.literal("grounded"),
    diagnosis: ImLostDiagnosisSchema,
    context: GroundingContextReferenceSchema,
    citationChunkIds: z.array(StableIdSchema).min(1),
    conceptId: StableIdSchema,
    conceptTitle: z.string().trim().min(1).max(160),
    followUpActions: z.array(FollowUpActionSchema).min(1),
  })
  .strict()
  .superRefine((output, context) => {
    if (new Set(output.citationChunkIds).size !== output.citationChunkIds.length) {
      context.addIssue({
        code: "custom",
        message: "Model citation chunk IDs must be unique",
        path: ["citationChunkIds"],
      });
    }
  });

export const ModelInsufficientImLostOutputSchema = z
  .object({
    groundingStatus: z.literal("insufficient_evidence"),
    context: GroundingContextReferenceSchema,
    followUpActions: z.array(FollowUpActionSchema).min(1),
  })
  .strict();

export const GroundingClaimSchema = z.enum([
  "what_just_happened",
  "main_idea",
  "simple_explanation",
  "important_prerequisite",
  "concept",
]);

const GroundingClaims = GroundingClaimSchema.options;

export const SupportedGroundingVerdictSchema = z
  .object({
    verdict: z.literal("supported"),
    supportedClaims: z.array(GroundingClaimSchema).length(GroundingClaims.length),
  })
  .strict()
  .superRefine((decision, context) => {
    if (
      new Set(decision.supportedClaims).size !== GroundingClaims.length ||
      GroundingClaims.some((claim) => !decision.supportedClaims.includes(claim))
    ) {
      context.addIssue({
        code: "custom",
        message: "A supported verdict must independently verify every material claim",
        path: ["supportedClaims"],
      });
    }
  });

export const UnsupportedGroundingVerdictSchema = z
  .object({
    verdict: z.literal("unsupported"),
  })
  .strict();

export const GroundingSupportVerdictSchema = z.discriminatedUnion("verdict", [
  SupportedGroundingVerdictSchema,
  UnsupportedGroundingVerdictSchema,
]);

export const ModelImLostOutputSchema = z.discriminatedUnion("groundingStatus", [
  ModelGroundedImLostOutputSchema,
  ModelInsufficientImLostOutputSchema,
]);

export const CitationSchema = z
  .object({
    chunkId: StableIdSchema,
    startMs: OffsetMsSchema,
    endMs: OffsetMsSchema,
  })
  .superRefine((citation, context) => {
    if (citation.endMs <= citation.startMs) {
      context.addIssue({
        code: "custom",
        message: "Citation endMs must be greater than startMs",
        path: ["endMs"],
      });
    }
  });

const ImLostResponseEnvelopeShape = {
  responseId: StableIdSchema,
  sessionId: StableIdSchema,
  followUpActions: z.array(FollowUpActionSchema).min(1),
  confusionEvent: ConfusionEventSchema,
};

export const GroundedImLostResponseSchema = z.object({
  ...ImLostResponseEnvelopeShape,
  groundingStatus: z.literal("grounded"),
  diagnosis: ImLostDiagnosisSchema,
  citations: z.array(CitationSchema).min(1),
});

export const InsufficientEvidenceImLostResponseSchema = z.object({
  ...ImLostResponseEnvelopeShape,
  groundingStatus: z.literal("insufficient_evidence"),
  message: z.literal(INSUFFICIENT_EVIDENCE_MESSAGE),
  citations: z.array(CitationSchema).length(0),
  followUpActions: z.tuple([z.literal("ask_follow_up")]),
});

export const ImLostResponseSchema = z
  .discriminatedUnion("groundingStatus", [
    GroundedImLostResponseSchema,
    InsufficientEvidenceImLostResponseSchema,
  ])
  .superRefine((response, context) => {
    if (response.confusionEvent.sessionId !== response.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Confusion event must belong to the assistance session",
        path: ["confusionEvent", "sessionId"],
      });
    }
    if (response.confusionEvent.assistanceResponseId !== response.responseId) {
      context.addIssue({
        code: "custom",
        message: "Confusion event must reference this assistance response",
        path: ["confusionEvent", "assistanceResponseId"],
      });
    }
    const citationIds = response.citations.map((citation) => citation.chunkId);
    if (new Set(citationIds).size !== citationIds.length) {
      context.addIssue({
        code: "custom",
        message: "Citation chunk IDs must be unique",
        path: ["citations"],
      });
    }
    const evidenceIds = response.confusionEvent.evidenceChunkIds;
    if (response.groundingStatus === "grounded" && !response.confusionEvent.anchorChunkId) {
      context.addIssue({
        code: "custom",
        message: "A grounded response must retain the transcript chunk at the confusion moment",
        path: ["confusionEvent", "anchorChunkId"],
      });
    }
    if (
      response.groundingStatus === "grounded" &&
      (citationIds.length !== evidenceIds.length ||
        citationIds.some((chunkId, index) => chunkId !== evidenceIds[index]))
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Response citations must exactly match the evidence recorded with the confusion event",
        path: ["citations"],
      });
    }
    if (
      response.groundingStatus === "insufficient_evidence" &&
      (response.confusionEvent.evidenceChunkIds.length > 0 ||
        response.confusionEvent.conceptId !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Insufficient-evidence responses cannot invent evidence or a supported concept",
        path: ["confusionEvent"],
      });
    }
  });

export function hydrateCitationsFromChunkIds(
  sessionId: string,
  chunkIds: readonly string[],
  chunks: readonly TranscriptChunk[],
): Citation[] {
  const chunksById = new Map(chunks.map((chunk) => [chunk.chunkId, chunk]));

  return chunkIds.map((chunkId) => {
    const chunk = chunksById.get(chunkId);
    if (!chunk) {
      throw new Error(`Citation references nonexistent chunk: ${chunkId}`);
    }
    if (chunk.sessionId !== sessionId) {
      throw new Error(`Citation references a chunk from another session: ${chunkId}`);
    }

    return CitationSchema.parse({
      chunkId: chunk.chunkId,
      startMs: chunk.startMs,
      endMs: chunk.endMs,
    });
  });
}

export type ImLostBody = z.infer<typeof ImLostBodySchema>;
export type GroundingContextReference = z.infer<typeof GroundingContextReferenceSchema>;
export type GroundingContextSnapshot = z.infer<typeof GroundingContextSnapshotSchema>;
export type GroundingStatus = z.infer<typeof GroundingStatusSchema>;
export type ImLostDiagnosis = z.infer<typeof ImLostDiagnosisSchema>;
export type FollowUpAction = z.infer<typeof FollowUpActionSchema>;
export type ModelGroundedImLostOutput = z.infer<typeof ModelGroundedImLostOutputSchema>;
export type ModelInsufficientImLostOutput = z.infer<typeof ModelInsufficientImLostOutputSchema>;
export type ModelImLostOutput = z.infer<typeof ModelImLostOutputSchema>;
export type GroundingClaim = z.infer<typeof GroundingClaimSchema>;
export type GroundingSupportVerdict = z.infer<typeof GroundingSupportVerdictSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type GroundedImLostResponse = z.infer<typeof GroundedImLostResponseSchema>;
export type InsufficientEvidenceImLostResponse = z.infer<
  typeof InsufficientEvidenceImLostResponseSchema
>;
export type ImLostResponse = z.infer<typeof ImLostResponseSchema>;
