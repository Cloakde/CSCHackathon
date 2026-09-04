import {
  WeakAreaDrillResponseSchema,
  type ConfusionEvent,
  type WeakAreaDrillResponse,
} from "@livelecture/shared";

export function generateScriptedPractice(
  event: ConfusionEvent,
  drillId: string,
): WeakAreaDrillResponse {
  const content =
    event.conceptId === "concept_inner_outer"
      ? {
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
  if (!content) throw new Error("Unsupported practice concept");
  return WeakAreaDrillResponseSchema.parse({
    drillId,
    sessionId: event.sessionId,
    sourceConfusionEventIds: [event.confusionId],
    conceptId: event.conceptId,
    conceptTitle: event.conceptTitle,
    evidenceChunkIds: event.evidenceChunkIds,
    ...content,
  });
}
