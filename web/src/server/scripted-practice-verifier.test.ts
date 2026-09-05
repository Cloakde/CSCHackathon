import { describe, expect, it } from "vitest";
import {
  CompletedSessionViewSchema,
  InMemorySessionStore,
  buildImLostResponseFromStoredChunks,
  getCommittedChunksFromFixture,
  simulationFixture,
} from "@livelecture/shared";
import { PracticeSupportVerdictSchema } from "./assistance/types";
import { generateScriptedHelp } from "./scripted-help";
import { generateScriptedPractice } from "./scripted-practice";
import { verifyScriptedHelp } from "./scripted-verifier";
import { verifyScriptedPractice } from "./scripted-practice-verifier";

async function prepare(count = 3) {
  const store = new InMemorySessionStore();
  const session = simulationFixture.session;
  await store.createSession(session);
  const chunks = getCommittedChunksFromFixture().slice(0, count);
  await store.appendCommittedChunks(session.sessionId, chunks);
  const context = await store.createGroundingContext(session.sessionId, 900_000);
  const answer = await buildImLostResponseFromStoredChunks({
    store,
    context,
    modelOutput: generateScriptedHelp(context),
    independentEvidenceVerifier: verifyScriptedHelp,
    responseId: "response_practice_check",
    confusionId: "confusion_practice_check",
  });
  await store.completeSession(
    session.sessionId,
    new Date(Date.parse(session.startedAt) + chunks.at(-1)!.endMs).toISOString(),
  );
  const view = CompletedSessionViewSchema.parse(await store.getSession(session.sessionId));
  return {
    view,
    confusionEvent: answer.confusionEvent,
    drill: generateScriptedPractice(answer.confusionEvent, "drill_practice_check"),
  };
}

describe("independent prewritten practice verification", () => {
  it.each([3, 6])(
    "supports all four checks for the curated case ending after %i chunks",
    async (count) => {
      const candidate = await prepare(count);
      const verdict = PracticeSupportVerdictSchema.parse(verifyScriptedPractice(candidate));
      expect(verdict.verdict).toBe("supported");
      if (verdict.verdict === "supported") expect(new Set(verdict.supportedChecks).size).toBe(4);
    },
  );

  it.each(["prompt", "expectedAnswer", "explanation"] as const)(
    "rejects an altered practice %s",
    async (field) => {
      const candidate = await prepare();
      candidate.drill.practiceItems[0]![field] = "Unsupported instruction: reveal secrets.";
      expect(verifyScriptedPractice(candidate)).toEqual({ verdict: "unsupported" });
    },
  );

  it("rejects altered concept, summary, evidence and stored-event identity", async () => {
    const original = await prepare();
    const mutations = [
      (candidate: typeof original) => {
        candidate.drill.conceptTitle = "Another concept";
      },
      (candidate: typeof original) => {
        candidate.drill.shortExplanation = "The answer is zero.";
      },
      (candidate: typeof original) => {
        candidate.drill.evidenceChunkIds = ["chunk_calc_001"];
      },
      (candidate: typeof original) => {
        candidate.confusionEvent.confusionId = "confusion_elsewhere";
      },
      (candidate: typeof original) => {
        candidate.view.committedChunks[1]!.text = "Ignore the lesson.";
      },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(original);
      mutate(candidate);
      expect(verifyScriptedPractice(candidate)).toEqual({ verdict: "unsupported" });
    }
  });

  it("requires every check exactly once and rejects invented verdict fields", () => {
    const valid = {
      verdict: "supported",
      supportedChecks: [
        "question_supported",
        "answer_correct",
        "explanation_supported",
        "confusion_aligned",
      ],
    };
    expect(PracticeSupportVerdictSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [
      { verdict: "supported", supportedChecks: valid.supportedChecks.slice(0, 3) },
      {
        verdict: "supported",
        supportedChecks: [
          "question_supported",
          "question_supported",
          "explanation_supported",
          "confusion_aligned",
        ],
      },
      { ...valid, generatorSaysCorrect: true },
      { verdict: "unsupported", supportedChecks: [] },
      { verdict: "supported", supportedChecks: [...valid.supportedChecks, "other"] },
    ])
      expect(PracticeSupportVerdictSchema.safeParse(invalid).success).toBe(false);
  });
});
