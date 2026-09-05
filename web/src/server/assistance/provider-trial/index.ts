import {
  CompletedSessionViewSchema,
  ConfusionEventSchema,
  GroundingContextSnapshotSchema,
  StableIdSchema,
  assertWeakAreaDrillLinkage,
  hydrateCitationsFromChunkIds,
  type GroundingSupportCandidate,
  type ConfusionEvent,
  type CompletedSessionView,
} from "@livelecture/shared";
import type { DemoDispatcherOptions } from "../../demo-api";
import { BENCHMARK_QUESTIONS } from "./prompts";
import { ResultSchemas, TrialConceptSchema, TrialHelpSchema, TrialPracticeSchema } from "./schemas";
import {
  createTrialTransport,
  TrialProviderError,
  type ProviderTransportOptions,
} from "./transport";
export { TRIAL_PROMPT_VERSION, TRIAL_PROMPT_HASHES } from "./prompts";

type TrialHooks = Required<
  Pick<DemoDispatcherOptions, "generateHelp" | "verifyHelp" | "generatePractice" | "verifyPractice">
>;

function prepare<T>(work: () => T): T {
  try {
    return work();
  } catch {
    throw new TrialProviderError("input");
  }
}
function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Invalid trial identity");
}
function helpCandidate(candidate: GroundingSupportCandidate) {
  const context = GroundingContextSnapshotSchema.parse(candidate.context);
  const modelOutput = TrialHelpSchema.parse(candidate.modelOutput);
  if (modelOutput.groundingStatus !== "grounded")
    throw new Error("A grounded candidate is required");
  equal(modelOutput.context, context.reference);
  const citedChunks = modelOutput.citationChunkIds.map((chunkId) => {
    const chunk = context.chunks.find((entry) => entry.chunkId === chunkId);
    if (!chunk) throw new Error("Missing evidence");
    return chunk;
  });
  equal(candidate.citedChunks, citedChunks);
  return { candidate: modelOutput, citedPassages: citedChunks };
}
function sourceEvidence(event: ConfusionEvent, view: CompletedSessionView) {
  equal(
    view.confusionEvents.find((entry) => entry.confusionId === event.confusionId),
    event,
  );
  if (event.sessionId !== view.session.sessionId) throw new Error("Invalid session");
  return event.evidenceChunkIds.map((chunkId) => {
    const chunk = view.committedChunks.find((entry) => entry.chunkId === chunkId);
    if (!chunk) throw new Error("Missing evidence");
    return chunk;
  });
}

/** Only the explicit trial runner calls this factory. The app defaults stay prewritten. */
export function createProviderTrialHooks(options: ProviderTransportOptions): TrialHooks {
  const call = createTrialTransport(options);
  return {
    async generateHelp(input, signal) {
      const context = prepare(() => GroundingContextSnapshotSchema.parse(input));
      return call("help_generate", { context }, signal, (raw) => {
        const output = ResultSchemas.help_generate.parse(raw).result;
        equal(output.context, context.reference);
        if (output.groundingStatus === "grounded")
          hydrateCitationsFromChunkIds(
            context.reference.sessionId,
            output.citationChunkIds,
            context.chunks,
          );
        return output;
      });
    },
    async verifyHelp(input, signal) {
      const candidate = prepare(() => helpCandidate(input));
      return call(
        "help_verify",
        candidate,
        signal,
        (raw) => ResultSchemas.help_verify.parse(raw).result,
      );
    },
    async generatePractice(input, id, context) {
      const payload = prepare(() => {
        const event = ConfusionEventSchema.parse(input);
        const view = CompletedSessionViewSchema.parse(context.view);
        const conceptId = TrialConceptSchema.parse(event.conceptId);
        return {
          confusion: event,
          identities: { drillId: StableIdSchema.parse(id), sessionId: event.sessionId },
          sourceEvidence: sourceEvidence(event, view),
          benchmarkQuestion: BENCHMARK_QUESTIONS[conceptId],
        };
      });
      return call("practice_generate", payload, context.signal, (raw) => {
        const drill = ResultSchemas.practice_generate.parse(raw).result;
        equal(drill.drillId, payload.identities.drillId);
        assertWeakAreaDrillLinkage(
          {
            sessionId: payload.confusion.sessionId,
            confusionEventIds: [payload.confusion.confusionId],
          },
          [payload.confusion],
          drill,
        );
        return drill;
      });
    },
    async verifyPractice(input, signal) {
      const payload = prepare(() => {
        const event = ConfusionEventSchema.parse(input.confusionEvent);
        const view = CompletedSessionViewSchema.parse(input.view);
        const drill = TrialPracticeSchema.parse(input.drill);
        const source = sourceEvidence(event, view);
        assertWeakAreaDrillLinkage(
          { sessionId: event.sessionId, confusionEventIds: [event.confusionId] },
          [event],
          drill,
        );
        return {
          candidate: drill,
          confusion: event,
          citedPassages: source.filter((chunk) => drill.evidenceChunkIds.includes(chunk.chunkId)),
          benchmarkQuestion: BENCHMARK_QUESTIONS[TrialConceptSchema.parse(event.conceptId)],
        };
      });
      return call(
        "practice_verify",
        payload,
        signal,
        (raw) => ResultSchemas.practice_verify.parse(raw).result,
      );
    },
  };
}
