import { describe, expect, it, vi } from "vitest";

import {
  buildImLostResponseFromStoredChunks,
  getCommittedChunksFromFixture,
  InMemorySessionStore,
  SessionViewSchema,
  simulationFixture,
  type BuildImLostResponseInput,
  type GroundingContextSnapshot,
  type TranscriptChunk,
} from "../src";

async function createStore(): Promise<InMemorySessionStore> {
  const store = new InMemorySessionStore();
  await store.createSession(simulationFixture.session);
  return store;
}

function createGroundedInput(
  store: InMemorySessionStore,
  context: GroundingContextSnapshot,
  identity: { responseId: string; confusionId: string } = {
    responseId: simulationFixture.expected.confusionEvent.assistanceResponseId,
    confusionId: simulationFixture.expected.confusionEvent.confusionId,
  },
): BuildImLostResponseInput {
  return {
    store,
    context,
    modelOutput: {
      groundingStatus: "grounded",
      diagnosis: {
        whatJustHappened: "The professor applied the chain rule.",
        mainIdea: "A composition changes through its outer and inner functions.",
        simpleExplanation: "Differentiate the outside and multiply by the inside derivative.",
        importantPrerequisite: "Identify the inside and outside functions.",
      },
      context: context.reference,
      citationChunkIds: simulationFixture.scenarios.answerable.expectedCitationChunkIds,
      conceptId: simulationFixture.expected.confusionEvent.conceptId ?? "concept_chain_rule_001",
      conceptTitle: simulationFixture.expected.confusionEvent.conceptTitle ?? "Chain rule",
      followUpActions: ["show_an_example"],
    },
    independentEvidenceVerifier: async () => ({
      verdict: "supported",
      supportedClaims: [
        "what_just_happened",
        "main_idea",
        "simple_explanation",
        "important_prerequisite",
        "concept",
      ],
    }),
    ...identity,
  };
}

describe("InMemorySessionStore", () => {
  it("stores committed chunks idempotently and rejects mutation", async () => {
    const store = await createStore();
    const chunk = getCommittedChunksFromFixture()[0];
    if (!chunk) throw new Error("Canonical fixture must include a committed chunk");

    await expect(
      store.appendCommittedChunks(simulationFixture.session.sessionId, [chunk]),
    ).resolves.toEqual([chunk.chunkId]);
    await expect(
      store.appendCommittedChunks(simulationFixture.session.sessionId, [chunk]),
    ).resolves.toEqual([]);
    await expect(
      store.appendCommittedChunks(simulationFixture.session.sessionId, [
        { ...chunk, text: "Mutated text" },
      ]),
    ).rejects.toThrow(/cannot be mutated/);

    expect((await store.getSession(simulationFixture.session.sessionId))?.committedChunks).toEqual([
      chunk,
    ]);
  });

  it("never reuses a deleted session ID", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;

    await expect(store.deleteSession(sessionId)).resolves.toBe(true);
    await expect(store.createSession(simulationFixture.session)).rejects.toThrow(
      /already been used/,
    );
  });

  it("rejects sequence collisions and chronological overlap without partially writing a batch", async () => {
    const [firstChunk, secondChunk] = getCommittedChunksFromFixture();
    if (!firstChunk || !secondChunk) throw new Error("Fixture must include two chunks");
    const invalidBatches: Array<{ chunks: TranscriptChunk[]; error: RegExp }> = [
      {
        chunks: [firstChunk, { ...secondChunk, sequence: firstChunk.sequence }],
        error: /sequence/,
      },
      {
        chunks: [firstChunk, { ...secondChunk, startMs: firstChunk.endMs - 1 }],
        error: /overlap/,
      },
    ];

    for (const invalidBatch of invalidBatches) {
      const store = await createStore();
      await expect(
        store.appendCommittedChunks(simulationFixture.session.sessionId, invalidBatch.chunks),
      ).rejects.toThrow(invalidBatch.error);
      expect(
        (await store.getSession(simulationFixture.session.sessionId))?.committedChunks,
      ).toEqual([]);
    }
  });

  it("rejects a time-regressing append against already stored chunks", async () => {
    const store = await createStore();
    const [firstChunk, secondChunk] = getCommittedChunksFromFixture();
    if (!firstChunk || !secondChunk) throw new Error("Fixture must include two chunks");

    await store.appendCommittedChunks(simulationFixture.session.sessionId, [firstChunk]);
    await expect(
      store.appendCommittedChunks(simulationFixture.session.sessionId, [
        { ...secondChunk, startMs: firstChunk.endMs - 1 },
      ]),
    ).rejects.toThrow(/overlap/);
    expect((await store.getSession(simulationFixture.session.sessionId))?.committedChunks).toEqual([
      firstChunk,
    ]);
  });

  it("replays the canonical session idempotently while preserving session-view invariants", async () => {
    const store = await createStore();
    const chunks = getCommittedChunksFromFixture();
    const sessionId = simulationFixture.session.sessionId;

    for (const chunk of chunks) {
      await expect(store.appendCommittedChunks(sessionId, [chunk])).resolves.toEqual([
        chunk.chunkId,
      ]);
    }
    await expect(store.appendCommittedChunks(sessionId, chunks)).resolves.toEqual([]);

    const selectedChunks = await store.getChunksInRange(
      sessionId,
      Math.max(
        0,
        simulationFixture.scenarios.answerable.anchorMs -
          simulationFixture.scenarios.answerable.lookbackMs,
      ),
      simulationFixture.scenarios.answerable.anchorMs,
    );
    expect(selectedChunks.map((chunk) => chunk.chunkId)).toEqual(
      simulationFixture.scenarios.answerable.expectedContextChunkIds,
    );
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    const assistanceInput = createGroundedInput(store, context);
    const response = await buildImLostResponseFromStoredChunks(assistanceInput);

    await expect(buildImLostResponseFromStoredChunks(assistanceInput)).resolves.toEqual(response);
    await expect(
      buildImLostResponseFromStoredChunks(
        createGroundedInput(store, context, {
          responseId: simulationFixture.expected.confusionEvent.assistanceResponseId,
          confusionId: "confusion_chain_rule_002",
        }),
      ),
    ).rejects.toThrow(/Assistance response IDs must be unique/);

    await expect(
      store.completeSession(sessionId, simulationFixture.expected.completedSession.endedAt),
    ).resolves.toEqual(simulationFixture.expected.completedSession);
    await expect(
      store.completeSession(sessionId, simulationFixture.expected.completedSession.endedAt),
    ).resolves.toEqual(simulationFixture.expected.completedSession);
    await expect(store.appendCommittedChunks(sessionId, chunks)).resolves.toEqual([]);
    await expect(buildImLostResponseFromStoredChunks(assistanceInput)).resolves.toEqual(response);
    const finalChunk = chunks.at(-1);
    if (!finalChunk) throw new Error("Fixture must include a final chunk");
    await expect(
      store.appendCommittedChunks(sessionId, [
        {
          ...finalChunk,
          chunkId: "chunk_calc_011",
          sequence: finalChunk.sequence + 1,
          startMs: finalChunk.endMs,
          endMs: finalChunk.endMs + 1_000,
          text: "A new committed chunk must not be accepted after completion.",
        },
      ]),
    ).rejects.toThrow(/not active/);
    await expect(
      buildImLostResponseFromStoredChunks(
        createGroundedInput(store, context, {
          confusionId: "confusion_chain_rule_002",
          responseId: "response_chain_rule_002",
        }),
      ),
    ).rejects.toThrow(/not active/);

    const view = await store.getSession(sessionId);
    expect(view).toEqual({
      session: simulationFixture.expected.completedSession,
      committedChunks: chunks,
      confusionEvents: [simulationFixture.expected.confusionEvent],
    });
    expect(SessionViewSchema.safeParse(view).success).toBe(true);
  });

  it("never returns a chunk that has not fully committed by the range end", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;
    await store.appendCommittedChunks(sessionId, getCommittedChunksFromFixture());

    const beforeFinalCommitMs = 470_000;
    const chunks = await store.getChunksInRange(sessionId, 0, beforeFinalCommitMs);

    expect(chunks.every((chunk) => chunk.endMs <= beforeFinalCommitMs)).toBe(true);
    expect(chunks.map((chunk) => chunk.chunkId)).not.toContain("chunk_calc_010");
    expect(chunks.at(-1)?.chunkId).toBe("chunk_calc_009");
  });

  it("cannot invalidate a recorded confusion anchor with a zero-duration later chunk", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;
    const chunks = getCommittedChunksFromFixture();
    await store.appendCommittedChunks(sessionId, chunks);
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    const response = await buildImLostResponseFromStoredChunks(createGroundedInput(store, context));
    const finalChunk = chunks.at(-1);
    if (!finalChunk) throw new Error("Fixture must include a final chunk");

    await expect(
      store.appendCommittedChunks(sessionId, [
        {
          ...finalChunk,
          chunkId: "chunk_calc_011",
          sequence: finalChunk.sequence + 1,
          startMs: finalChunk.endMs,
          endMs: finalChunk.endMs,
          text: "A zero-duration chunk must never replace an existing confusion anchor.",
        },
      ]),
    ).rejects.toThrow(/positive duration/);
    await expect(store.getSession(sessionId)).resolves.toMatchObject({
      confusionEvents: [response.confusionEvent],
    });
  });

  it("rejects non-integer, non-finite, and reversed transcript ranges", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;

    const invalidRanges: Array<readonly [number, number]> = [
      [0.5, 1_000],
      [0, Number.POSITIVE_INFINITY],
      [Number.NaN, 1_000],
      [2_000, 1_000],
    ];
    for (const [startMs, endMs] of invalidRanges) {
      await expect(store.getChunksInRange(sessionId, startMs, endMs)).rejects.toThrow();
    }
  });

  it("derives an authoritative grounding snapshot and rejects it after transcript mutation", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;
    const chunks = getCommittedChunksFromFixture();
    await store.appendCommittedChunks(sessionId, chunks.slice(0, -1));

    const firstContext = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    expect(firstContext.reference).toMatchObject({
      sessionId,
      transcriptRevision: 1,
      anchorMs: 435_000,
    });
    expect(firstContext.reference.chunkIds).not.toContain("chunk_calc_010");

    const finalChunk = chunks.at(-1);
    if (!finalChunk) throw new Error("Fixture must include a final chunk");
    await store.appendCommittedChunks(sessionId, [finalChunk]);
    const currentContext = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    expect(currentContext.reference).toMatchObject({
      sessionId,
      transcriptRevision: 2,
      anchorMs: simulationFixture.scenarios.answerable.anchorMs,
      chunkIds: simulationFixture.scenarios.answerable.expectedContextChunkIds,
    });

    const forgedContext = {
      ...firstContext,
      reference: {
        ...firstContext.reference,
        transcriptRevision: currentContext.reference.transcriptRevision,
      },
    };
    await expect(
      buildImLostResponseFromStoredChunks(createGroundedInput(store, forgedContext)),
    ).rejects.toThrow(/authoritative transcript anchor/);

    await expect(
      buildImLostResponseFromStoredChunks(createGroundedInput(store, firstContext)),
    ).rejects.toThrow(/stale/);
  });

  it("rejects model citations outside the server-owned context and exposes no raw write bypass", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;
    await store.appendCommittedChunks(sessionId, getCommittedChunksFromFixture());
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    const invalidCitationInput = createGroundedInput(store, context);
    if (invalidCitationInput.modelOutput.groundingStatus !== "grounded") {
      throw new Error("Grounded test input was not constructed");
    }

    await expect(
      buildImLostResponseFromStoredChunks({
        ...invalidCitationInput,
        modelOutput: {
          ...invalidCitationInput.modelOutput,
          citationChunkIds: ["chunk_missing_001"],
        },
      }),
    ).rejects.toThrow(/nonexistent/);
    expect("recordConfusion" in store).toBe(false);
    expect("recordAssistanceAgainstContext" in store).toBe(false);
    expect(Object.keys(store)).toEqual([]);
    expect(Object.getOwnPropertyNames(store)).toEqual([]);
    expect((store as unknown as Record<string, unknown>).records).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).usedSessionIds).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).inFlightAssistance).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).requireRecord).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).orderedChunks).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).selectChunks).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).validateConfusion).toBeUndefined();
  });

  it("rejects a committed response-ID collision before invoking the verifier", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;
    await store.appendCommittedChunks(sessionId, getCommittedChunksFromFixture());
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    await buildImLostResponseFromStoredChunks(createGroundedInput(store, context));
    const verifier = vi.fn(async () => ({
      verdict: "supported" as const,
      supportedClaims: [
        "what_just_happened" as const,
        "main_idea" as const,
        "simple_explanation" as const,
        "important_prerequisite" as const,
        "concept" as const,
      ],
    }));

    await expect(
      buildImLostResponseFromStoredChunks({
        ...createGroundedInput(store, context, {
          responseId: simulationFixture.expected.confusionEvent.assistanceResponseId,
          confusionId: "confusion_response_collision_002",
        }),
        independentEvidenceVerifier: verifier,
      }),
    ).rejects.toThrow(/response IDs must be unique/);
    expect(verifier).not.toHaveBeenCalled();
  });

  it("reserves response IDs and coalesces exact retries before verifier execution", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;
    await store.appendCommittedChunks(sessionId, getCommittedChunksFromFixture());
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    let releaseVerifier: (() => void) | undefined;
    const verifierGate = new Promise<void>((resolve) => {
      releaseVerifier = resolve;
    });
    const firstVerifier = vi.fn(async () => {
      await verifierGate;
      return {
        verdict: "supported" as const,
        supportedClaims: [
          "what_just_happened" as const,
          "main_idea" as const,
          "simple_explanation" as const,
          "important_prerequisite" as const,
          "concept" as const,
        ],
      };
    });
    const firstInput = {
      ...createGroundedInput(store, context),
      independentEvidenceVerifier: firstVerifier,
    };
    const firstPromise = buildImLostResponseFromStoredChunks(firstInput);
    const collidingVerifier = vi.fn(async () => ({
      verdict: "supported" as const,
      supportedClaims: [
        "what_just_happened" as const,
        "main_idea" as const,
        "simple_explanation" as const,
        "important_prerequisite" as const,
        "concept" as const,
      ],
    }));

    await expect(
      buildImLostResponseFromStoredChunks({
        ...createGroundedInput(store, context, {
          responseId: simulationFixture.expected.confusionEvent.assistanceResponseId,
          confusionId: "confusion_inflight_collision_002",
        }),
        independentEvidenceVerifier: collidingVerifier,
      }),
    ).rejects.toThrow(/response IDs must be unique/);
    expect(collidingVerifier).not.toHaveBeenCalled();

    const exactRetry = buildImLostResponseFromStoredChunks({
      ...firstInput,
      independentEvidenceVerifier: firstVerifier,
    });
    releaseVerifier?.();
    const [firstResponse, retryResponse] = await Promise.all([firstPromise, exactRetry]);
    expect(firstResponse).toEqual(retryResponse);
    expect(firstVerifier).toHaveBeenCalledTimes(1);
  });

  it("registers an exact in-flight operation before invoking a reentrant verifier", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;
    await store.appendCommittedChunks(sessionId, getCommittedChunksFromFixture());
    const context = await store.createGroundingContext(
      sessionId,
      simulationFixture.scenarios.answerable.lookbackMs,
    );
    let reentrantPromise: ReturnType<typeof buildImLostResponseFromStoredChunks> | undefined;
    const verifier = vi.fn(async () => {
      reentrantPromise = buildImLostResponseFromStoredChunks(input);
      return {
        verdict: "supported" as const,
        supportedClaims: [
          "what_just_happened" as const,
          "main_idea" as const,
          "simple_explanation" as const,
          "important_prerequisite" as const,
          "concept" as const,
        ],
      };
    });
    const input: BuildImLostResponseInput = {
      ...createGroundedInput(store, context, {
        responseId: "response_reentrant_001",
        confusionId: "confusion_reentrant_001",
      }),
      independentEvidenceVerifier: verifier,
    };

    const response = await buildImLostResponseFromStoredChunks(input);
    expect(reentrantPromise).toBeDefined();
    await expect(reentrantPromise).resolves.toEqual(response);
    expect(verifier).toHaveBeenCalledTimes(1);
  });

  it("cannot complete a session before its latest committed transcript", async () => {
    const store = await createStore();
    const sessionId = simulationFixture.session.sessionId;
    await store.appendCommittedChunks(sessionId, getCommittedChunksFromFixture());

    await expect(store.completeSession(sessionId, "2026-09-04T16:07:59.000Z")).rejects.toThrow(
      /before its latest/,
    );
    expect((await store.getSession(sessionId))?.session.status).toBe("active");
  });
});
