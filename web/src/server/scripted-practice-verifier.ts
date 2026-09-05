import {
  CompletedSessionViewSchema,
  ConfusionEventSchema,
  WeakAreaDrillResponseSchema,
  assertWeakAreaDrillLinkage,
  getCommittedChunksFromFixture,
} from "@livelecture/shared";
import type { PracticeSupportVerdict, PracticeVerificationCandidate } from "./assistance/types";

/** Independently maintained expected cases; never invoke the practice generator. */
export function verifyScriptedPractice(
  candidate: PracticeVerificationCandidate,
): PracticeSupportVerdict {
  try {
    const view = CompletedSessionViewSchema.parse(candidate.view);
    const event = ConfusionEventSchema.parse(candidate.confusionEvent);
    const drill = WeakAreaDrillResponseSchema.parse(candidate.drill);
    const recorded = view.confusionEvents.find((entry) => entry.confusionId === event.confusionId);
    if (
      view.session.sourceMode !== "simulation" ||
      JSON.stringify(recorded) !== JSON.stringify(event)
    )
      return { verdict: "unsupported" };
    assertWeakAreaDrillLinkage(
      { sessionId: view.session.sessionId, confusionEventIds: [event.confusionId] },
      view.confusionEvents,
      drill,
    );
    const expected =
      event.conceptId === "concept_inner_outer"
        ? {
            conceptTitle: "Identifying inner and outer functions",
            evidenceChunkIds: ["chunk_calc_002", "chunk_calc_003"],
            shortExplanation:
              "Identify the expression that acts first, then the operation applied to its result.",
            practiceItems: [
              {
                prompt:
                  "For (2x + 3)⁴, identify the inner function g(x) and the outer function f(u). Do not differentiate yet.",
                expectedAnswer: "g(x) = 2x + 3; f(u) = u⁴",
                explanation:
                  "First calculate 2x + 3. Then raise that result to the fourth power. Substituting g(x) into f(u) reconstructs (2x + 3)⁴.",
              },
            ],
          }
        : event.conceptId === "concept_inner_derivative"
          ? {
              conceptTitle: "Remembering the inner derivative",
              evidenceChunkIds: ["chunk_calc_004", "chunk_calc_006"],
              shortExplanation:
                "The outside derivative is only one factor. Include the derivative of the inside expression.",
              practiceItems: [
                {
                  prompt:
                    "A student says the derivative of (2x + 3)⁴ is 4(2x + 3)³. What factor is missing, and what is the correct derivative?",
                  expectedAnswer: "The missing factor is 2. The derivative is 8(2x + 3)³.",
                  explanation:
                    "The outside derivative is 4(2x + 3)³. The inside derivative is 2. Multiplying gives 8(2x + 3)³.",
                },
              ],
            }
          : undefined;
    if (
      !expected ||
      drill.conceptTitle !== expected.conceptTitle ||
      drill.shortExplanation !== expected.shortExplanation ||
      JSON.stringify(drill.practiceItems) !== JSON.stringify(expected.practiceItems) ||
      JSON.stringify(drill.evidenceChunkIds) !== JSON.stringify(expected.evidenceChunkIds) ||
      JSON.stringify(event.evidenceChunkIds) !== JSON.stringify(expected.evidenceChunkIds)
    )
      return { verdict: "unsupported" };
    const canonical = getCommittedChunksFromFixture();
    for (const chunkId of expected.evidenceChunkIds) {
      const actual = view.committedChunks.find((chunk) => chunk.chunkId === chunkId);
      const original = canonical.find((chunk) => chunk.chunkId === chunkId);
      if (
        !original ||
        JSON.stringify(actual) !==
          JSON.stringify({ ...original, sessionId: view.session.sessionId })
      )
        return { verdict: "unsupported" };
    }
    return {
      verdict: "supported",
      supportedChecks: [
        "question_supported",
        "answer_correct",
        "explanation_supported",
        "confusion_aligned",
      ],
    };
  } catch {
    return { verdict: "unsupported" };
  }
}
