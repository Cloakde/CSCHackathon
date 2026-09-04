import {
  getCommittedChunksFromFixture,
  type GroundingSupportCandidate,
  type GroundingSupportVerdict,
} from "@livelecture/shared";

// Independent allowlist: do not call the generator to judge its own answer.
// Any alteration of a claim, concept, citation, or evidence fails closed.
export function verifyScriptedHelp(candidate: GroundingSupportCandidate): GroundingSupportVerdict {
  const { context, modelOutput, citedChunks } = candidate;
  const canonical = getCommittedChunksFromFixture();
  const matches = citedChunks.every((chunk) => {
    const expected = canonical.find((entry) => entry.chunkId === chunk.chunkId);
    return (
      expected &&
      JSON.stringify(chunk) ===
        JSON.stringify({ ...expected, sessionId: context.reference.sessionId })
    );
  });
  if (!matches || JSON.stringify(modelOutput.context) !== JSON.stringify(context.reference))
    return { verdict: "unsupported" };
  let expected;
  if (context.reference.anchorMs < 300_000) {
    expected = {
      conceptId: "concept_inner_outer",
      conceptTitle: "Identifying inner and outer functions",
      citationChunkIds: ["chunk_calc_002", "chunk_calc_003"],
      diagnosis: {
        whatJustHappened: "The lecturer separated a composed function into its inside and outside.",
        mainIdea: "The inside function acts first; the outside function acts on its result.",
        simpleExplanation:
          "In f(g(x)), first find g(x), then apply f to that result. For a power of parentheses, the expression in parentheses is inside and the power is outside.",
        importantPrerequisite: "A composition puts one function inside another.",
      },
    };
  } else {
    expected = {
      conceptId: "concept_inner_derivative",
      conceptTitle: "Remembering the inner derivative",
      citationChunkIds: ["chunk_calc_004", "chunk_calc_006"],
      diagnosis: {
        whatJustHappened: "The lecturer differentiated a composed function using the chain rule.",
        mainIdea: "Multiply the outside derivative by the inside derivative.",
        simpleExplanation:
          "Keep the inside expression in the outside derivative, then multiply by its derivative. For (3x² + 1)⁵, this gives 5(3x² + 1)⁴ × 6x.",
        importantPrerequisite: "The derivative of 3x² + 1 is 6x.",
      },
    };
  }
  if (
    modelOutput.conceptId !== expected.conceptId ||
    modelOutput.conceptTitle !== expected.conceptTitle ||
    JSON.stringify(modelOutput.citationChunkIds) !== JSON.stringify(expected.citationChunkIds) ||
    JSON.stringify(citedChunks.map((chunk) => chunk.chunkId)) !==
      JSON.stringify(expected.citationChunkIds) ||
    JSON.stringify(modelOutput.diagnosis) !== JSON.stringify(expected.diagnosis) ||
    JSON.stringify(modelOutput.followUpActions) !== JSON.stringify(["show_an_example"])
  )
    return { verdict: "unsupported" };
  return {
    verdict: "supported",
    supportedClaims: [
      "what_just_happened",
      "main_idea",
      "simple_explanation",
      "important_prerequisite",
      "concept",
    ],
  };
}
