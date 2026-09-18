import { expect, it, vi } from "vitest";
import {
  buildImLostResponseFromStoredChunks,
  InMemorySessionStore,
  simulationFixture,
  getCommittedChunksFromFixture,
} from "@livelecture/shared";
import { createGeminiAppAssistance } from "./gemini-app-assistance";

// Replay the real Run04 omission using an explicitly scripted evidence reviewer.
// This guards data flow, not model quality; the latter needs the capped real run.
it.each([false, true])(
  "keeps prerequisite evidence limited to actually cited passages (included=%s)",
  async (includePrerequisite) => {
    const chunks = getCommittedChunksFromFixture().slice(0, 3);
    const store = new InMemorySessionStore();
    await store.createSession(simulationFixture.session);
    await store.appendCommittedChunks(chunks[0]!.sessionId, chunks);
    const context = await store.createGroundingContext(chunks[0]!.sessionId, 300_000);
    const output = {
      groundingStatus: "grounded",
      context: context.reference,
      diagnosis: {
        whatJustHappened: "The lecture described identifying components in a composite function.",
        mainIdea: "Distinguish the outer operation from the inner expression.",
        simpleExplanation: "Identify the outer shell and inner content before differentiating.",
        importantPrerequisite:
          "Derivatives measure rates of change; composite functions put one function inside another.",
      },
      citationChunkIds: includePrerequisite
        ? ["chunk_calc_001", "chunk_calc_002", "chunk_calc_003"]
        : ["chunk_calc_002", "chunk_calc_003"],
      conceptId: "concept_inner_outer",
      conceptTitle: "Identifying Inner and Outer Functions",
      followUpActions: ["show_an_example"],
    };
    const requests: unknown[] = [];
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const payload = JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text);
      requests.push(payload);
      let result: unknown = output;
      if (payload.candidate) {
        expect(payload.citedPassages.map((chunk: { chunkId: string }) => chunk.chunkId)).toEqual(
          output.citationChunkIds,
        );
        const rateEvidence = payload.citedPassages.some((chunk: { text: string }) =>
          chunk.text.includes("a derivative measures how quickly"),
        );
        result = rateEvidence
          ? {
              verdict: "supported",
              supportedClaims: [
                "what_just_happened",
                "main_idea",
                "simple_explanation",
                "important_prerequisite",
                "concept",
              ],
            }
          : { verdict: "unsupported" };
      }
      return Response.json({
        responseId: "synthetic_diagnostic_replay",
        modelVersion: "gemini-3.1-flash-lite",
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 100, totalTokenCount: 200 },
        candidates: [
          {
            content: { role: "model", parts: [{ text: JSON.stringify({ result }) }] },
            finishReason: "STOP",
          },
        ],
      });
    });
    const assistant = createGeminiAppAssistance({
      apiKey: "offline-fake-key",
      meter: { reserve: () => requests.length + 1, settle: () => {} },
      fetcher,
    });
    const signal = new AbortController().signal;
    const modelOutput = await assistant.generateHelp(context, signal);
    const result = await buildImLostResponseFromStoredChunks({
      store,
      context,
      modelOutput,
      responseId: "response_diagnostic",
      confusionId: "confusion_diagnostic",
      independentEvidenceVerifier: (candidate) => assistant.verifyHelp(candidate, signal),
    });
    expect(result.groundingStatus).toBe(includePrerequisite ? "grounded" : "insufficient_evidence");
    expect(result.confusionEvent.evidenceChunkIds).toEqual(
      includePrerequisite ? output.citationChunkIds : [],
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  },
);
