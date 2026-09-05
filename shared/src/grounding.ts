import type {
  GroundingContextSnapshot,
  ImLostResponse,
  ModelGroundedImLostOutput,
  ModelImLostOutput,
} from "./schemas/assistance";
import type { TranscriptChunk } from "./schemas/transcript";
import type { SessionStore } from "./store";

export interface GroundingSupportCandidate {
  context: GroundingContextSnapshot;
  modelOutput: ModelGroundedImLostOutput;
  citedChunks: TranscriptChunk[];
}

export type GroundingSupportVerifier = (
  candidate: GroundingSupportCandidate,
) => unknown | Promise<unknown>;

export interface BuildImLostResponseCommand {
  /** Server-internal cancellation; never serialized into lecture/API data. */
  signal?: AbortSignal;
  context: GroundingContextSnapshot;
  modelOutput: ModelImLostOutput;
  independentEvidenceVerifier: GroundingSupportVerifier;
  responseId: string;
  confusionId: string;
}

export interface BuildImLostResponseInput extends BuildImLostResponseCommand {
  store: SessionStore;
}

export async function buildImLostResponseFromStoredChunks(
  input: BuildImLostResponseInput,
): Promise<ImLostResponse> {
  return input.store.buildAndRecordImLostResponse({
    signal: input.signal,
    context: input.context,
    modelOutput: input.modelOutput,
    independentEvidenceVerifier: input.independentEvidenceVerifier,
    responseId: input.responseId,
    confusionId: input.confusionId,
  });
}
