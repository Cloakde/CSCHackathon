import type { GroundingContextSnapshot, ModelImLostOutput } from "@livelecture/shared";

// These are deliberately prewritten cases. They are not AI model responses.
export function generateScriptedHelp(context: GroundingContextSnapshot): ModelImLostOutput {
  const has = (id: string) => context.reference.chunkIds.includes(id);
  if (context.reference.anchorMs >= 300_000 && has("chunk_calc_004") && has("chunk_calc_006")) {
    return {
      groundingStatus: "grounded",
      context: structuredClone(context.reference),
      diagnosis: {
        whatJustHappened: "The lecturer differentiated a composed function using the chain rule.",
        mainIdea: "Multiply the outside derivative by the inside derivative.",
        simpleExplanation:
          "Keep the inside expression in the outside derivative, then multiply by its derivative. For (3x² + 1)⁵, this gives 5(3x² + 1)⁴ × 6x.",
        importantPrerequisite: "The derivative of 3x² + 1 is 6x.",
      },
      citationChunkIds: ["chunk_calc_004", "chunk_calc_006"],
      conceptId: "concept_inner_derivative",
      conceptTitle: "Remembering the inner derivative",
      followUpActions: ["show_an_example"],
    };
  }
  if (context.reference.anchorMs < 300_000 && has("chunk_calc_002") && has("chunk_calc_003")) {
    return {
      groundingStatus: "grounded",
      context: structuredClone(context.reference),
      diagnosis: {
        whatJustHappened: "The lecturer separated a composed function into its inside and outside.",
        mainIdea: "The inside function acts first; the outside function acts on its result.",
        simpleExplanation:
          "In f(g(x)), first find g(x), then apply f to that result. For a power of parentheses, the expression in parentheses is inside and the power is outside.",
        importantPrerequisite: "A composition puts one function inside another.",
      },
      citationChunkIds: ["chunk_calc_002", "chunk_calc_003"],
      conceptId: "concept_inner_outer",
      conceptTitle: "Identifying inner and outer functions",
      followUpActions: ["show_an_example"],
    };
  }
  return {
    groundingStatus: "insufficient_evidence",
    context: structuredClone(context.reference),
    followUpActions: ["ask_follow_up"],
  };
}
