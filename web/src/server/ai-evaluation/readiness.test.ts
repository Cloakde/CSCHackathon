import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiContracts,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  getCommittedChunksFromFixture,
  assertWeakAreaDrillLinkage,
  type GroundingContextSnapshot,
  type GroundingSupportCandidate,
  type ModelImLostOutput,
} from "@livelecture/shared";
import { createDemoDispatcher, DEMO_ORIGIN } from "../demo-api";
import { generateScriptedHelp } from "../scripted-help";
import { generateScriptedPractice } from "../scripted-practice";
import { verifyScriptedHelp } from "../scripted-verifier";
import { verifyScriptedPractice } from "../scripted-practice-verifier";
import { HELP_DEADLINE_MS, PRACTICE_DEADLINE_MS } from "../assistance/operation";
import { AI_EVALUATION_CASES, AI_EVIDENCE_STATUS } from "./cases";

afterEach(() => vi.restoreAllMocks());

// This fixture deliberately supplies a response; it is not a model invocation.
function injectedSine(context: GroundingContextSnapshot): ModelImLostOutput {
  return {
    groundingStatus: "grounded",
    context: structuredClone(context.reference),
    conceptId: "concept_sine_composition",
    conceptTitle: "The inside derivative in a sine composition",
    citationChunkIds: ["chunk_calc_004", "chunk_calc_009"],
    followUpActions: ["show_an_example"],
    diagnosis: {
      whatJustHappened: "The lecturer differentiated sine of x squared.",
      mainIdea: "Multiply the outside derivative by the inside derivative.",
      simpleExplanation:
        "Cosine of x squared is the outside derivative; two x is the inside derivative. Multiply them to get 2x cos(x²).",
      importantPrerequisite: "The inside function is x² and its derivative is 2x.",
    },
  };
}
function approveInjectedSine(candidate: GroundingSupportCandidate) {
  expect(candidate.citedChunks.map((chunk) => chunk.chunkId)).toEqual([
    "chunk_calc_004",
    "chunk_calc_009",
  ]);
  expect(candidate.context.reference.chunkIds).toContain("chunk_calc_007");
  expect(candidate.modelOutput.diagnosis.simpleExplanation).toContain("2x cos(x²)");
  expect(JSON.stringify(candidate.modelOutput)).not.toContain("pineapple");
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

describe("TASK-103 injected readiness (not actual AI quality)", () => {
  it("keeps real-model evidence pending and fits existing client/relay timeouts", () => {
    expect(AI_EVIDENCE_STATUS).toMatchObject({
      mode: "injected_only",
      providerCalls: 0,
      actualModelQuality: "PENDING",
      humanContentReview: "PENDING",
    });
    expect(HELP_DEADLINE_MS).toBe(10_000);
    expect(PRACTICE_DEADLINE_MS).toBe(4_000);
  });

  it.each(AI_EVALUATION_CASES)(
    "runs frozen $id inputs through the delivered dispatcher with independent injected collaborators",
    async (fixture) => {
      const network = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("No external requests in readiness checks"));
      const contexts: GroundingContextSnapshot[] = [];
      const verifyHelp = vi.fn((candidate: GroundingSupportCandidate) =>
        fixture.id === "instruction_text"
          ? approveInjectedSine(candidate)
          : verifyScriptedHelp(candidate),
      );
      const dispatch = createDemoDispatcher({
        enabled: true,
        generateHelp: async (context, signal) => {
          expect(signal.aborted).toBe(false);
          contexts.push(structuredClone(context));
          return fixture.id === "instruction_text"
            ? injectedSine(context)
            : generateScriptedHelp(context);
        },
        verifyHelp,
        generatePractice: async (event, drillId, { view, signal }) => {
          expect(signal.aborted).toBe(false);
          expect(view.session.status).toBe("completed");
          expect(view.confusionEvents).toContainEqual(event);
          if (fixture.id !== "instruction_text") return generateScriptedPractice(event, drillId);
          return {
            drillId,
            sessionId: event.sessionId,
            sourceConfusionEventIds: [event.confusionId],
            conceptId: event.conceptId!,
            conceptTitle: event.conceptTitle!,
            evidenceChunkIds: event.evidenceChunkIds,
            shortExplanation: "Use both factors from the lecture's sine composition example.",
            practiceItems: [
              {
                prompt: "Differentiate sin(x²). Which factor comes from the inside?",
                expectedAnswer: "2x cos(x²)",
                explanation:
                  "The inside contributes 2x. The outside contributes cos(x²). Multiply the two factors.",
              },
            ],
          };
        },
        verifyPractice: (candidate, signal) => {
          expect(signal.aborted).toBe(false);
          if (fixture.id !== "instruction_text") return verifyScriptedPractice(candidate);
          expect(candidate.drill.practiceItems[0]?.expectedAnswer).toBe("2x cos(x²)");
          expect(candidate.drill.evidenceChunkIds).not.toContain("chunk_calc_007");
          return {
            verdict: "supported",
            supportedChecks: [
              "question_supported",
              "answer_correct",
              "explanation_supported",
              "confusion_aligned",
            ],
          };
        },
      });
      async function call(path: string, method = "POST", body?: unknown) {
        return dispatch(
          new Request(`${DEMO_ORIGIN}${path}`, {
            method,
            headers: {
              Host: "127.0.0.1:3000",
              "X-LiveLecture-Demo": "scripted-v1",
              "Content-Type": "application/json",
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        );
      }
      const started = ApiContracts.startSession.response.parse(
        await (await call("/api/sessions", "POST", { sourceMode: "simulation" })).json(),
      );
      if (!started.ok) throw new Error("Could not create injected test session");
      const session = started.data.session;
      const path = `/api/sessions/${session.sessionId}`;
      try {
        const chunks = getCommittedChunksFromFixture()
          .slice(0, fixture.chunkCount)
          .map((chunk) => ({ ...chunk, sessionId: session.sessionId }));
        expect((await call(`${path}/chunks`, "POST", { chunks })).status).toBe(200);
        const helped = ApiContracts.imLost.response.parse(
          await (await call(`${path}/im-lost`, "POST", { lookbackMs: fixture.lookbackMs })).json(),
        );
        if (!helped.ok) throw new Error(helped.error.code);
        expect(contexts).toHaveLength(1);
        expect(contexts[0]?.reference.anchorMs).toBe(fixture.anchorMs);
        expect(helped.data.confusionEvent.occurredAtMs).toBe(fixture.anchorMs);
        expect(helped.data.citations.map((citation) => citation.chunkId)).toEqual(
          fixture.evidenceIds,
        );
        for (const citation of helped.data.citations) {
          const chunk = chunks.find((item) => item.chunkId === citation.chunkId)!;
          expect([citation.startMs, citation.endMs]).toEqual([chunk.startMs, chunk.endMs]);
        }
        const endedAt = new Date(Date.parse(session.startedAt) + fixture.anchorMs).toISOString();
        expect((await call(`${path}/end`, "POST", { endedAt })).status).toBe(200);
        const view = ApiContracts.getSession.response.parse(await (await call(path, "GET")).json());
        if (!view.ok) throw new Error(view.error.code);
        expect(view.data.confusionEvents).toEqual([helped.data.confusionEvent]);
        const request = { confusionEventIds: [helped.data.confusionEvent.confusionId] };
        const practiceResponse = await call(`${path}/weak-area-drills`, "POST", request);
        if (fixture.id === "insufficient") {
          expect(contexts[0]?.reference.chunkIds).toEqual(["chunk_calc_007"]);
          expect(helped.data).toMatchObject({
            groundingStatus: "insufficient_evidence",
            message: INSUFFICIENT_EVIDENCE_MESSAGE,
            citations: [],
            followUpActions: ["ask_follow_up"],
          });
          expect(helped.data.confusionEvent.conceptId).toBeUndefined();
          expect(verifyHelp).not.toHaveBeenCalled();
          expect(practiceResponse.ok).toBe(false);
        } else {
          expect(helped.data.confusionEvent.conceptId).toBe(fixture.conceptId);
          expect(verifyHelp).toHaveBeenCalledOnce();
          const practiced = ApiContracts.createWeakAreaDrill.response.parse(
            await practiceResponse.json(),
          );
          if (!practiced.ok) throw new Error(practiced.error.code);
          expect(practiced.data.practiceItems[0]?.expectedAnswer).toBe(fixture.expectedAnswer);
          assertWeakAreaDrillLinkage(
            { sessionId: session.sessionId, ...request },
            view.data.confusionEvents,
            practiced.data,
          );
        }
        expect(network).not.toHaveBeenCalled();
      } finally {
        expect((await call(path, "DELETE")).status).toBe(200);
      }
    },
  );
});
