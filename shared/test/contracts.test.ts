import { describe, expect, expectTypeOf, it } from "vitest";

import {
  assertWeakAreaDrillLinkage,
  CompletedSessionViewSchema,
  getCommittedChunksFromFixture,
  GroundingContextSnapshotSchema,
  ImLostResponseSchema,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  SimulationFixtureSchema,
  simulationFixture,
  SourceStateEventSchema,
  TranscriptChunkSchema,
  WeakAreaDrillRequestSchema,
  type CompletedSessionView,
} from "../src";

describe("canonical contracts", () => {
  it("validates an active initial fixture and its expected completed artifacts", () => {
    const parsed = SimulationFixtureSchema.parse(simulationFixture);
    const endedEvents = parsed.events.filter((event) => event.type === "session.ended");

    expect(parsed.session.status).toBe("active");
    expect(parsed.session).not.toHaveProperty("endedAt");
    expect(parsed.expected.completedSession).toEqual({
      ...parsed.session,
      status: "completed",
      endedAt: "2026-09-04T16:08:00.000Z",
    });
    expect(endedEvents).toHaveLength(1);
    expect(endedEvents[0]?.endedAt).toBe(parsed.expected.completedSession.endedAt);
    expect(WeakAreaDrillRequestSchema.parse(parsed.expected.weakAreaDrillRequest)).toEqual({
      sessionId: parsed.session.sessionId,
      confusionEventIds: [parsed.expected.confusionEvent.confusionId],
    });
    expect(getCommittedChunksFromFixture()).toHaveLength(10);
    expect(parsed.scenarios.answerable.expectedCitationChunkIds).toEqual([
      "chunk_calc_004",
      "chunk_calc_006",
    ]);
  });

  it("rejects a completed initial fixture session", () => {
    expect(
      SimulationFixtureSchema.safeParse({
        ...simulationFixture,
        session: simulationFixture.expected.completedSession,
      }).success,
    ).toBe(false);
  });

  it("rejects transcript chunks with reversed time ranges", () => {
    const validChunk = getCommittedChunksFromFixture()[0];
    if (!validChunk) throw new Error("Canonical fixture must include a committed chunk");

    expect(
      TranscriptChunkSchema.safeParse({
        ...validChunk,
        startMs: 10_000,
        endMs: 9_999,
      }).success,
    ).toBe(false);
    expect(
      TranscriptChunkSchema.safeParse({
        ...validChunk,
        startMs: 10_000,
        endMs: 10_000,
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported source states", () => {
    const validState = simulationFixture.events[0];
    expect(
      SourceStateEventSchema.safeParse({
        ...validState,
        status: "recording_without_consent",
      }).success,
    ).toBe(false);
  });

  it("requires source-error events to use the fixture source mode", () => {
    const withSourceError = structuredClone(simulationFixture);
    withSourceError.events = [
      ...withSourceError.events.slice(0, 2),
      {
        schemaVersion: 1,
        eventId: "event_source_error_001",
        sessionId: withSourceError.session.sessionId,
        sequence: 2,
        emittedAt: withSourceError.session.startedAt,
        type: "source.error",
        sourceMode: "simulation",
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "Synthetic recoverable source fault",
          retryable: true,
        },
      },
      ...withSourceError.events.slice(2).map((event) => ({
        ...event,
        sequence: event.sequence + 1,
      })),
    ];

    expect(SimulationFixtureSchema.safeParse(withSourceError).success).toBe(true);
    const mismatchedMode = structuredClone(withSourceError);
    const sourceError = mismatchedMode.events[2];
    if (sourceError?.type !== "source.error") throw new Error("Source error fixture was not built");
    sourceError.sourceMode = "live";
    expect(SimulationFixtureSchema.safeParse(mismatchedMode).success).toBe(false);
  });

  it("rejects mismatched completion, drill-request, and insufficient-evidence fixture links", () => {
    const mismatchedCompletion = structuredClone(simulationFixture);
    mismatchedCompletion.expected.completedSession.sessionId = "session_other_001";
    expect(SimulationFixtureSchema.safeParse(mismatchedCompletion).success).toBe(false);

    const nonexistentDrillSource = structuredClone(simulationFixture);
    nonexistentDrillSource.expected.weakAreaDrillRequest.confusionEventIds = [
      "confusion_missing_001",
    ];
    nonexistentDrillSource.expected.weakAreaDrill.sourceConfusionEventIds = [
      "confusion_missing_001",
    ];
    expect(SimulationFixtureSchema.safeParse(nonexistentDrillSource).success).toBe(false);

    const citedInsufficientScenario = structuredClone(simulationFixture);
    citedInsufficientScenario.scenarios.unanswerable.expectedCitationChunkIds = ["chunk_calc_004"];
    expect(SimulationFixtureSchema.safeParse(citedInsufficientScenario).success).toBe(false);
  });

  it("binds a weak-area drill to the exact request and available confusion event", () => {
    const request = simulationFixture.expected.weakAreaDrillRequest;
    const confusion = simulationFixture.expected.confusionEvent;
    const drill = simulationFixture.expected.weakAreaDrill;

    expect(() => assertWeakAreaDrillLinkage(request, [confusion], drill)).not.toThrow();
    expect(() =>
      assertWeakAreaDrillLinkage(request, [confusion], {
        ...drill,
        sourceConfusionEventIds: ["confusion_different_001"],
      }),
    ).toThrow(/exactly match/);
    expect(() => assertWeakAreaDrillLinkage(request, [], drill)).toThrow(/nonexistent/);
    expect(() =>
      assertWeakAreaDrillLinkage(
        request,
        [{ ...confusion, sessionId: "session_other_001" }],
        drill,
      ),
    ).toThrow(/different session/);
    expect(() =>
      assertWeakAreaDrillLinkage(request, [confusion], {
        ...drill,
        conceptId: "concept_generic_001",
      }),
    ).toThrow(/concept does not match/);
    expect(() =>
      assertWeakAreaDrillLinkage(request, [confusion], {
        ...drill,
        evidenceChunkIds: ["chunk_calc_009"],
      }),
    ).toThrow(/outside the source confusion event/);
  });

  it("accepts an honest insufficient-evidence response and rejects invented support", () => {
    const response = {
      responseId: "response_insufficient_001",
      sessionId: simulationFixture.session.sessionId,
      groundingStatus: "insufficient_evidence" as const,
      message: INSUFFICIENT_EVIDENCE_MESSAGE,
      citations: [],
      followUpActions: ["ask_follow_up" as const],
      confusionEvent: {
        confusionId: "confusion_insufficient_001",
        sessionId: simulationFixture.session.sessionId,
        occurredAtMs: simulationFixture.scenarios.unanswerable.anchorMs,
        trigger: "im_lost" as const,
        anchorChunkId: "chunk_calc_010",
        contextChunkIds: simulationFixture.scenarios.unanswerable.expectedContextChunkIds,
        evidenceChunkIds: [],
        assistanceResponseId: "response_insufficient_001",
      },
    };

    expect(ImLostResponseSchema.safeParse(response).success).toBe(true);
    expect(
      ImLostResponseSchema.safeParse({
        ...response,
        citations: [{ chunkId: "chunk_calc_004", startMs: 145_000, endMs: 200_000 }],
      }).success,
    ).toBe(false);
    expect(
      ImLostResponseSchema.safeParse({
        ...response,
        followUpActions: ["show_an_example"],
      }).success,
    ).toBe(false);
    expect(
      ImLostResponseSchema.safeParse({
        ...response,
        confusionEvent: {
          ...response.confusionEvent,
          evidenceChunkIds: ["chunk_calc_004"],
          conceptId: "concept_chain_rule_001",
          conceptTitle: "Chain rule",
        },
      }).success,
    ).toBe(false);
  });

  it("validates completed-session chronology and narrows the completed status type", () => {
    const completedView = {
      session: simulationFixture.expected.completedSession,
      committedChunks: getCommittedChunksFromFixture(),
      confusionEvents: [simulationFixture.expected.confusionEvent],
    };

    expect(CompletedSessionViewSchema.safeParse(completedView).success).toBe(true);
    expectTypeOf<CompletedSessionView["session"]["status"]>().toEqualTypeOf<"completed">();

    expect(
      CompletedSessionViewSchema.safeParse({
        ...completedView,
        confusionEvents: [
          {
            ...simulationFixture.expected.confusionEvent,
            occurredAtMs: simulationFixture.expected.confusionEvent.occurredAtMs - 1,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      CompletedSessionViewSchema.safeParse({
        ...completedView,
        confusionEvents: [
          {
            ...simulationFixture.expected.confusionEvent,
            anchorChunkId: "chunk_calc_009",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      CompletedSessionViewSchema.safeParse({
        ...completedView,
        session: {
          ...completedView.session,
          endedAt: "2026-09-04T16:07:59.000Z",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects grounding snapshots that cannot come from a bounded lookback request", () => {
    const finalChunk = getCommittedChunksFromFixture().at(-1);
    if (!finalChunk) throw new Error("Canonical fixture must include a final chunk");

    expect(
      GroundingContextSnapshotSchema.safeParse({
        reference: {
          sessionId: simulationFixture.session.sessionId,
          transcriptRevision: 1,
          anchorMs: finalChunk.endMs,
          chunkIds: [finalChunk.chunkId],
        },
        startMs: finalChunk.endMs - 1_000,
        chunks: [finalChunk],
      }).success,
    ).toBe(false);
  });
});
