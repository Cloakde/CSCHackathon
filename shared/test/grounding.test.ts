import { describe, expect, it, vi } from "vitest";

import {
  assertWeakAreaDrillLinkage,
  buildImLostResponseFromStoredChunks,
  getCommittedChunksFromFixture,
  ImLostResponseSchema,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  InMemorySessionStore,
  ModelImLostOutputSchema,
  simulationFixture,
  type GroundingClaim,
  type GroundingContextSnapshot,
  type GroundingSupportCandidate,
  type GroundingSupportVerifier,
  type ModelGroundedImLostOutput,
  type ModelInsufficientImLostOutput,
  type TranscriptChunk,
} from "../src";

const allSupportedClaims = [
  "what_just_happened",
  "main_idea",
  "simple_explanation",
  "important_prerequisite",
  "concept",
] satisfies GroundingClaim[];

function approveEveryClaim() {
  return {
    verdict: "supported" as const,
    supportedClaims: [...allSupportedClaims],
  };
}

function groundedModelOutput(
  context: GroundingContextSnapshot,
  citationChunkIds: readonly string[] = simulationFixture.scenarios.answerable
    .expectedCitationChunkIds,
): ModelGroundedImLostOutput {
  return {
    groundingStatus: "grounded",
    diagnosis: {
      whatJustHappened: "The professor applied the chain rule.",
      mainIdea: "A composition changes through both its outside and inside functions.",
      simpleExplanation: "Differentiate the outside, then multiply by the inside derivative.",
      importantPrerequisite: "Identify the inside and outside functions first.",
    },
    context: context.reference,
    citationChunkIds: [...citationChunkIds],
    conceptId: simulationFixture.expected.confusionEvent.conceptId ?? "concept_chain_rule_001",
    conceptTitle: simulationFixture.expected.confusionEvent.conceptTitle ?? "Chain rule",
    followUpActions: ["show_an_example"],
  };
}

function insufficientModelOutput(context: GroundingContextSnapshot): ModelInsufficientImLostOutput {
  return {
    groundingStatus: "insufficient_evidence",
    context: context.reference,
    followUpActions: ["ask_follow_up"],
  };
}

async function createPopulatedStore(): Promise<InMemorySessionStore> {
  const store = new InMemorySessionStore();
  await store.createSession(simulationFixture.session);
  await store.appendCommittedChunks(
    simulationFixture.session.sessionId,
    getCommittedChunksFromFixture(),
  );
  return store;
}

async function expectNoRecordedConfusion(store: InMemorySessionStore): Promise<void> {
  const view = await store.getSession(simulationFixture.session.sessionId);
  expect(view?.confusionEvents).toEqual([]);
}

describe("grounded assistance boundary", () => {
  it("persists the canonical grounded callback atomically and completes the session", async () => {
    const store = await createPopulatedStore();
    const sessionId = simulationFixture.session.sessionId;
    const scenario = simulationFixture.scenarios.answerable;
    const context = await store.createGroundingContext(sessionId, scenario.lookbackMs);
    const verifier = vi.fn(async (candidate: GroundingSupportCandidate) => {
      expect(candidate.context).toEqual(context);
      expect(candidate.modelOutput.context).toEqual(context.reference);
      expect(candidate.citedChunks.map((chunk) => chunk.chunkId)).toEqual(
        scenario.expectedCitationChunkIds,
      );
      return approveEveryClaim();
    });

    const response = await buildImLostResponseFromStoredChunks({
      store,
      context,
      modelOutput: groundedModelOutput(context),
      independentEvidenceVerifier: verifier,
      responseId: simulationFixture.expected.confusionEvent.assistanceResponseId,
      confusionId: simulationFixture.expected.confusionEvent.confusionId,
    });

    expect(verifier).toHaveBeenCalledOnce();
    expect(response.confusionEvent).toEqual(simulationFixture.expected.confusionEvent);
    expect(ImLostResponseSchema.parse(response)).toEqual(response);
    expect((await store.getSession(sessionId))?.confusionEvents).toEqual([
      simulationFixture.expected.confusionEvent,
    ]);
    expect(() =>
      assertWeakAreaDrillLinkage(
        simulationFixture.expected.weakAreaDrillRequest,
        [response.confusionEvent],
        simulationFixture.expected.weakAreaDrill,
      ),
    ).not.toThrow();

    await expect(
      store.completeSession(sessionId, simulationFixture.expected.completedSession.endedAt),
    ).resolves.toEqual(simulationFixture.expected.completedSession);
    await expect(store.getSession(sessionId)).resolves.toEqual({
      session: simulationFixture.expected.completedSession,
      committedChunks: getCommittedChunksFromFixture(),
      confusionEvents: [simulationFixture.expected.confusionEvent],
    });
  });

  it("owns insufficient-evidence wording on the server and persists zero evidence", async () => {
    const store = await createPopulatedStore();
    const sessionId = simulationFixture.session.sessionId;
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.unanswerable.lookbackMs,
    );
    const modelOutput = insufficientModelOutput(context);
    const verifier = vi.fn();

    expect(ModelImLostOutputSchema.parse(modelOutput)).toEqual(modelOutput);
    expect(
      ModelImLostOutputSchema.safeParse({
        ...modelOutput,
        message: "A model-authored insufficient-evidence message must not be accepted.",
      }).success,
    ).toBe(false);

    const response = await buildImLostResponseFromStoredChunks({
      store,
      context,
      modelOutput,
      independentEvidenceVerifier: verifier,
      responseId: "response_insufficient_001",
      confusionId: "confusion_insufficient_001",
    });

    expect(verifier).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      groundingStatus: "insufficient_evidence",
      message: INSUFFICIENT_EVIDENCE_MESSAGE,
      citations: [],
      confusionEvent: {
        contextChunkIds: context.reference.chunkIds,
        evidenceChunkIds: [],
      },
    });
    expect(response.confusionEvent).not.toHaveProperty("conceptId");
    expect(response.confusionEvent).not.toHaveProperty("conceptTitle");
    expect((await store.getSession(sessionId))?.confusionEvents).toEqual([response.confusionEvent]);
  });

  it("rejects a model output that does not echo the exact grounding context", async () => {
    const store = await createPopulatedStore();
    const sessionId = simulationFixture.session.sessionId;
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    const verifier = vi.fn(async () => approveEveryClaim());
    const modelOutput = {
      ...groundedModelOutput(context),
      context: {
        ...context.reference,
        transcriptRevision: context.reference.transcriptRevision + 1,
      },
    };

    expect(ModelImLostOutputSchema.safeParse(modelOutput).success).toBe(true);
    await expect(
      buildImLostResponseFromStoredChunks({
        store,
        context,
        modelOutput,
        independentEvidenceVerifier: verifier,
        responseId: "response_context_mismatch_001",
        confusionId: "confusion_context_mismatch_001",
      }),
    ).rejects.toThrow(/exact grounding context/);
    expect(verifier).not.toHaveBeenCalled();
    await expectNoRecordedConfusion(store);
  });

  it("rejects nonexistent citation IDs without recording confusion", async () => {
    const store = await createPopulatedStore();
    const sessionId = simulationFixture.session.sessionId;
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    const verifier = vi.fn(async () => approveEveryClaim());

    await expect(
      buildImLostResponseFromStoredChunks({
        store,
        context,
        modelOutput: groundedModelOutput(context, ["chunk_missing_001"]),
        independentEvidenceVerifier: verifier,
        responseId: "response_missing_citation_001",
        confusionId: "confusion_missing_citation_001",
      }),
    ).rejects.toThrow(/nonexistent/);
    expect(verifier).not.toHaveBeenCalled();
    await expectNoRecordedConfusion(store);
  });

  it("downgrades adversarial transcript evidence when the verifier marks it unsupported", async () => {
    const store = await createPopulatedStore();
    const sessionId = simulationFixture.session.sessionId;
    const scenario = simulationFixture.scenarios.adversarial;
    const context = await store.createGroundingContext(sessionId, scenario.lookbackMs);
    const verifier = vi.fn(async (candidate: GroundingSupportCandidate) => {
      expect(candidate.modelOutput.citationChunkIds).toEqual([scenario.untrustedChunkId]);
      expect(candidate.citedChunks.map((chunk) => chunk.chunkId)).toEqual([
        scenario.untrustedChunkId,
      ]);
      return { verdict: "unsupported" as const };
    });

    const response = await buildImLostResponseFromStoredChunks({
      store,
      context,
      modelOutput: groundedModelOutput(context, [scenario.untrustedChunkId]),
      independentEvidenceVerifier: verifier,
      responseId: "response_adversarial_001",
      confusionId: "confusion_adversarial_001",
    });

    expect(verifier).toHaveBeenCalledOnce();
    expect(response).toMatchObject({
      groundingStatus: "insufficient_evidence",
      message: INSUFFICIENT_EVIDENCE_MESSAGE,
      citations: [],
      confusionEvent: {
        evidenceChunkIds: [],
      },
    });
    expect(response.confusionEvent).not.toHaveProperty("conceptId");
    expect((await store.getSession(sessionId))?.confusionEvents).toEqual([response.confusionEvent]);
  });

  it("fails closed when the independent verifier is invalid or throws", async () => {
    const verifierCases: Array<{ name: string; verifier: GroundingSupportVerifier }> = [
      {
        name: "invalid",
        verifier: async () => ({ verdict: "indeterminate" }),
      },
      {
        name: "throwing",
        verifier: async () => {
          throw new Error("Verifier unavailable");
        },
      },
    ];

    for (const verifierCase of verifierCases) {
      const store = await createPopulatedStore();
      const sessionId = simulationFixture.session.sessionId;
      const context = await store.createGroundingContext(
        sessionId,
        simulationFixture.scenarios.answerable.lookbackMs,
      );
      const response = await buildImLostResponseFromStoredChunks({
        store,
        context,
        modelOutput: groundedModelOutput(context),
        independentEvidenceVerifier: verifierCase.verifier,
        responseId: `response_verifier_${verifierCase.name}_001`,
        confusionId: `confusion_verifier_${verifierCase.name}_001`,
      });

      expect(response).toMatchObject({
        groundingStatus: "insufficient_evidence",
        message: INSUFFICIENT_EVIDENCE_MESSAGE,
        citations: [],
        confusionEvent: {
          evidenceChunkIds: [],
        },
      });
      expect((await store.getSession(sessionId))?.confusionEvents).toEqual([
        response.confusionEvent,
      ]);
    }
  });

  it("rejects stale grounding contexts after transcript mutation or session completion", async () => {
    const sessionId = simulationFixture.session.sessionId;
    const scenario = simulationFixture.scenarios.answerable;
    const changedStore = await createPopulatedStore();
    const changedContext = await changedStore.createGroundingContext(
      sessionId,
      scenario.lookbackMs,
    );
    const lastChunk = getCommittedChunksFromFixture().at(-1);
    if (!lastChunk) throw new Error("Canonical fixture must include a committed chunk");
    const nextChunk: TranscriptChunk = {
      ...lastChunk,
      chunkId: "chunk_calc_011",
      sequence: lastChunk.sequence + 1,
      text: "This newly committed explanation invalidates the earlier grounding snapshot.",
      startMs: lastChunk.endMs,
      endMs: lastChunk.endMs + 30_000,
    };
    await changedStore.appendCommittedChunks(sessionId, [nextChunk]);
    const staleVerifier = vi.fn(async () => approveEveryClaim());

    await expect(
      buildImLostResponseFromStoredChunks({
        store: changedStore,
        context: changedContext,
        modelOutput: groundedModelOutput(changedContext),
        independentEvidenceVerifier: staleVerifier,
        responseId: "response_stale_transcript_001",
        confusionId: "confusion_stale_transcript_001",
      }),
    ).rejects.toThrow(/stale because the transcript changed/);
    expect(staleVerifier).not.toHaveBeenCalled();
    await expectNoRecordedConfusion(changedStore);

    const completedStore = await createPopulatedStore();
    const completedContext = await completedStore.createGroundingContext(
      sessionId,
      scenario.lookbackMs,
    );
    await completedStore.completeSession(
      sessionId,
      simulationFixture.expected.completedSession.endedAt,
    );
    const completedVerifier = vi.fn(async () => approveEveryClaim());

    await expect(
      buildImLostResponseFromStoredChunks({
        store: completedStore,
        context: completedContext,
        modelOutput: groundedModelOutput(completedContext),
        independentEvidenceVerifier: completedVerifier,
        responseId: "response_stale_completion_001",
        confusionId: "confusion_stale_completion_001",
      }),
    ).rejects.toThrow(/not active/);
    expect(completedVerifier).not.toHaveBeenCalled();
    await expectNoRecordedConfusion(completedStore);
  });

  it("rejects forged snapshot text before exposing it to the verifier", async () => {
    const store = await createPopulatedStore();
    const context = await store.createGroundingContext(
      simulationFixture.session.sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    const forgedContext = structuredClone(context);
    const firstChunk = forgedContext.chunks[0];
    if (!firstChunk) throw new Error("Grounding context must include a chunk");
    firstChunk.text = "Caller-authored forged transcript text.";
    const verifier = vi.fn(async () => approveEveryClaim());

    await expect(
      buildImLostResponseFromStoredChunks({
        store,
        context: forgedContext,
        modelOutput: groundedModelOutput(forgedContext),
        independentEvidenceVerifier: verifier,
        responseId: "response_forged_context_001",
        confusionId: "confusion_forged_context_001",
      }),
    ).rejects.toThrow(/no longer matches/);
    expect(verifier).not.toHaveBeenCalled();
    await expectNoRecordedConfusion(store);
  });

  it("isolates verifier mutations from the evaluated and persisted response", async () => {
    const store = await createPopulatedStore();
    const context = await store.createGroundingContext(
      simulationFixture.session.sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    const modelOutput = groundedModelOutput(context);
    const originalMainIdea = modelOutput.diagnosis.mainIdea;
    const verifier = vi.fn(async (candidate: GroundingSupportCandidate) => {
      candidate.modelOutput.diagnosis.mainIdea = "Unverified mutation from the verifier.";
      candidate.context.chunks[0]!.text = "Mutated verifier-only transcript text.";
      return approveEveryClaim();
    });

    const response = await buildImLostResponseFromStoredChunks({
      store,
      context,
      modelOutput,
      independentEvidenceVerifier: verifier,
      responseId: "response_isolated_verifier_001",
      confusionId: "confusion_isolated_verifier_001",
    });

    expect(response).toMatchObject({
      groundingStatus: "grounded",
      diagnosis: { mainIdea: originalMainIdea },
    });
    expect(modelOutput.diagnosis.mainIdea).toBe(originalMainIdea);
    expect(context.chunks[0]?.text).not.toContain("Mutated verifier-only");
    expect((await store.getSession(simulationFixture.session.sessionId))?.confusionEvents).toEqual([
      response.confusionEvent,
    ]);
  });

  it("returns an exact stored retry after completion and rejects response mutation", async () => {
    const store = await createPopulatedStore();
    const sessionId = simulationFixture.session.sessionId;
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    const modelOutput = groundedModelOutput(context);
    const verifier = vi.fn(async () => approveEveryClaim());
    const input = {
      store,
      context,
      modelOutput,
      independentEvidenceVerifier: verifier,
      responseId: simulationFixture.expected.confusionEvent.assistanceResponseId,
      confusionId: simulationFixture.expected.confusionEvent.confusionId,
    };
    const firstResponse = await buildImLostResponseFromStoredChunks(input);
    expect(verifier).toHaveBeenCalledOnce();
    await store.completeSession(sessionId, simulationFixture.expected.completedSession.endedAt);

    await expect(
      buildImLostResponseFromStoredChunks({
        ...input,
        independentEvidenceVerifier: async () => {
          throw new Error("An exact retry must not invoke the verifier again");
        },
      }),
    ).resolves.toEqual(firstResponse);
    expect(verifier).toHaveBeenCalledOnce();
    const mutationVerifier = vi.fn(async () => approveEveryClaim());
    await expect(
      buildImLostResponseFromStoredChunks({
        ...input,
        independentEvidenceVerifier: mutationVerifier,
        modelOutput: {
          ...modelOutput,
          diagnosis: {
            ...modelOutput.diagnosis,
            mainIdea: "A changed answer must not reuse the same response identity.",
          },
        },
      }),
    ).rejects.toThrow(/cannot be mutated/);
    expect(mutationVerifier).not.toHaveBeenCalled();
  });

  it("coalesces concurrent exact commands before invoking the verifier twice", async () => {
    const store = await createPopulatedStore();
    const context = await store.createGroundingContext(
      simulationFixture.session.sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    let releaseVerifier!: () => void;
    const verifierGate = new Promise<void>((resolve) => {
      releaseVerifier = resolve;
    });
    const verifier = vi.fn(async () => {
      await verifierGate;
      return approveEveryClaim();
    });
    const input = {
      store,
      context,
      modelOutput: groundedModelOutput(context),
      independentEvidenceVerifier: verifier,
      responseId: "response_concurrent_001",
      confusionId: "confusion_concurrent_001",
    };

    const firstRequest = buildImLostResponseFromStoredChunks(input);
    const secondRequest = buildImLostResponseFromStoredChunks(input);
    await Promise.resolve();
    expect(verifier).toHaveBeenCalledOnce();
    releaseVerifier();

    const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);
    expect(secondResponse).toEqual(firstResponse);
    expect(verifier).toHaveBeenCalledOnce();
    expect((await store.getSession(simulationFixture.session.sessionId))?.confusionEvents).toEqual([
      firstResponse.confusionEvent,
    ]);
  });
});
