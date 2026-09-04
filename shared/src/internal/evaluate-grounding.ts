import type {
  BuildImLostResponseCommand,
  GroundingSupportCandidate,
  GroundingSupportVerifier,
} from "../grounding";
import {
  GroundingContextSnapshotSchema,
  GroundingSupportVerdictSchema,
  ImLostResponseSchema,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  ModelImLostOutputSchema,
  hydrateCitationsFromChunkIds,
  type GroundingContextSnapshot,
  type ImLostResponse,
  type ModelImLostOutput,
} from "../schemas/assistance";
import { StableIdSchema } from "../schemas/common";

export interface NormalizedImLostResponseCommand {
  context: GroundingContextSnapshot;
  modelOutput: ModelImLostOutput;
  independentEvidenceVerifier: GroundingSupportVerifier;
  responseId: string;
  confusionId: string;
}

export function normalizeImLostResponseCommand(
  input: BuildImLostResponseCommand,
): NormalizedImLostResponseCommand {
  return {
    context: GroundingContextSnapshotSchema.parse(input.context),
    modelOutput: ModelImLostOutputSchema.parse(input.modelOutput),
    independentEvidenceVerifier: input.independentEvidenceVerifier,
    responseId: StableIdSchema.parse(input.responseId),
    confusionId: StableIdSchema.parse(input.confusionId),
  };
}

function contextReferencesMatch(
  left: GroundingContextSnapshot["reference"],
  right: GroundingContextSnapshot["reference"],
): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.transcriptRevision === right.transcriptRevision &&
    left.anchorMs === right.anchorMs &&
    left.chunkIds.length === right.chunkIds.length &&
    left.chunkIds.every((chunkId, index) => chunkId === right.chunkIds[index])
  );
}

function buildInsufficientEvidenceResponse(
  context: GroundingContextSnapshot,
  responseId: string,
  confusionId: string,
): ImLostResponse {
  return ImLostResponseSchema.parse({
    responseId,
    sessionId: context.reference.sessionId,
    groundingStatus: "insufficient_evidence",
    message: INSUFFICIENT_EVIDENCE_MESSAGE,
    citations: [],
    followUpActions: ["ask_follow_up"],
    confusionEvent: {
      confusionId,
      sessionId: context.reference.sessionId,
      occurredAtMs: context.reference.anchorMs,
      trigger: "im_lost",
      anchorChunkId: context.chunks.at(-1)?.chunkId,
      contextChunkIds: context.reference.chunkIds,
      evidenceChunkIds: [],
      assistanceResponseId: responseId,
    },
  });
}

async function independentlySupportsEveryClaim(
  verifier: GroundingSupportVerifier,
  candidate: GroundingSupportCandidate,
): Promise<boolean> {
  try {
    const verdict = GroundingSupportVerdictSchema.parse(await verifier(candidate));
    return verdict.verdict === "supported";
  } catch {
    return false;
  }
}

export async function evaluateImLostResponse(
  input: BuildImLostResponseCommand,
): Promise<{ context: GroundingContextSnapshot; response: ImLostResponse }> {
  const normalized = normalizeImLostResponseCommand(input);
  const { context, modelOutput, responseId, confusionId } = normalized;

  if (!contextReferencesMatch(modelOutput.context, context.reference)) {
    throw new Error("Model output was not generated from the exact grounding context");
  }

  let response: ImLostResponse;
  if (modelOutput.groundingStatus === "insufficient_evidence") {
    response = buildInsufficientEvidenceResponse(context, responseId, confusionId);
  } else {
    const citations = hydrateCitationsFromChunkIds(
      context.reference.sessionId,
      modelOutput.citationChunkIds,
      context.chunks,
    );
    const chunksById = new Map(context.chunks.map((chunk) => [chunk.chunkId, chunk]));
    const citedChunks = citations.map((citation) => {
      const chunk = chunksById.get(citation.chunkId);
      if (!chunk) throw new Error(`Citation references nonexistent chunk: ${citation.chunkId}`);
      return chunk;
    });
    const verifierCandidate = structuredClone({ context, modelOutput, citedChunks });
    const isSupported = await independentlySupportsEveryClaim(
      normalized.independentEvidenceVerifier,
      verifierCandidate,
    );

    response = isSupported
      ? ImLostResponseSchema.parse({
          responseId,
          sessionId: context.reference.sessionId,
          groundingStatus: "grounded",
          diagnosis: modelOutput.diagnosis,
          citations,
          followUpActions: modelOutput.followUpActions,
          confusionEvent: {
            confusionId,
            sessionId: context.reference.sessionId,
            occurredAtMs: context.reference.anchorMs,
            trigger: "im_lost",
            anchorChunkId: context.chunks.at(-1)?.chunkId,
            contextChunkIds: context.reference.chunkIds,
            evidenceChunkIds: citations.map((citation) => citation.chunkId),
            assistanceResponseId: responseId,
            conceptId: modelOutput.conceptId,
            conceptTitle: modelOutput.conceptTitle,
          },
        })
      : buildInsufficientEvidenceResponse(context, responseId, confusionId);
  }

  return { context, response };
}
