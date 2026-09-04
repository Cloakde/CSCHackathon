import { z } from "zod";

import { GroundingStatusSchema } from "./assistance";
import { OffsetMsSchema, StableIdSchema } from "./common";
import { ActiveLectureSessionSchema, CompletedLectureSessionSchema } from "./session";
import {
  assertWeakAreaDrillLinkage,
  ConfusionEventSchema,
  WeakAreaDrillRequestSchema,
  WeakAreaDrillResponseSchema,
} from "./study";
import { TranscriptEventSchema, type TranscriptChunk } from "./transcript";

const ScenarioSchema = z.object({
  scenarioId: StableIdSchema,
  question: z.string().trim().min(1).max(1_000),
  anchorMs: OffsetMsSchema,
  lookbackMs: z.number().int().min(30_000).max(900_000),
  expectedGroundingStatus: GroundingStatusSchema,
  expectedContextChunkIds: z.array(StableIdSchema),
  expectedCitationChunkIds: z.array(StableIdSchema),
});

const AdversarialScenarioSchema = ScenarioSchema.extend({
  untrustedChunkId: StableIdSchema,
  expectedBehavior: z.string().trim().min(1).max(500),
});

export const SimulationFixtureSchema = z
  .object({
    fixtureId: StableIdSchema,
    description: z.string().trim().min(1).max(500),
    session: ActiveLectureSessionSchema,
    events: z.array(TranscriptEventSchema).min(6),
    scenarios: z.object({
      answerable: ScenarioSchema,
      unanswerable: ScenarioSchema,
      adversarial: AdversarialScenarioSchema,
    }),
    expected: z.object({
      completedSession: CompletedLectureSessionSchema,
      confusionEvent: ConfusionEventSchema,
      weakAreaDrillRequest: WeakAreaDrillRequestSchema,
      weakAreaDrill: WeakAreaDrillResponseSchema,
    }),
  })
  .superRefine((fixture, context) => {
    const eventIds = new Set<string>();
    const committedChunkIds = new Set<string>();
    const committedChunkSequences = new Set<number>();
    const partialIds = new Set<string>();
    const committedChunks: TranscriptChunk[] = [];
    let previousSequence = -1;
    let previousEmittedAt = Number.NEGATIVE_INFINITY;
    let previousChunkEndMs = 0;
    let previousChunkSequence = -1;
    let startedEventCount = 0;
    let endedEventCount = 0;
    let activeSourceStateCount = 0;
    let stoppedSourceStateCount = 0;

    if (fixture.session.sourceMode !== "simulation") {
      context.addIssue({
        code: "custom",
        message: "A SimulationFixture must use simulation source mode",
        path: ["session", "sourceMode"],
      });
    }

    const completedSession = fixture.expected.completedSession;
    for (const key of ["sessionId", "title", "subject", "sourceMode", "startedAt"] as const) {
      if (completedSession[key] !== fixture.session[key]) {
        context.addIssue({
          code: "custom",
          message: `Completed session ${key} must match the initial session`,
          path: ["expected", "completedSession", key],
        });
      }
    }

    fixture.events.forEach((event, eventIndex) => {
      if (eventIds.has(event.eventId)) {
        context.addIssue({
          code: "custom",
          message: "Event IDs must be unique",
          path: ["events", eventIndex, "eventId"],
        });
      }
      eventIds.add(event.eventId);

      if (event.sessionId !== fixture.session.sessionId) {
        context.addIssue({
          code: "custom",
          message: "Every event must belong to the fixture session",
          path: ["events", eventIndex, "sessionId"],
        });
      }

      if (event.sequence !== previousSequence + 1) {
        context.addIssue({
          code: "custom",
          message: "Event sequences must start at zero and increase by one",
          path: ["events", eventIndex, "sequence"],
        });
      }
      previousSequence = event.sequence;

      const emittedAt = Date.parse(event.emittedAt);
      if (emittedAt < previousEmittedAt) {
        context.addIssue({
          code: "custom",
          message: "Events must be ordered by emittedAt",
          path: ["events", eventIndex, "emittedAt"],
        });
      }
      previousEmittedAt = emittedAt;

      if (event.type === "source.state" || event.type === "source.error") {
        if (event.sourceMode !== fixture.session.sourceMode) {
          context.addIssue({
            code: "custom",
            message: "Source event mode must match the fixture session",
            path: ["events", eventIndex, "sourceMode"],
          });
        }
      }
      if (event.type === "source.state") {
        if (event.status === "active") activeSourceStateCount += 1;
        if (event.status === "stopped") stoppedSourceStateCount += 1;
      }

      if (event.type === "session.started") {
        startedEventCount += 1;
        if (
          event.sourceMode !== fixture.session.sourceMode ||
          event.startedAt !== fixture.session.startedAt ||
          event.emittedAt !== fixture.session.startedAt ||
          event.title !== fixture.session.title ||
          event.subject !== fixture.session.subject
        ) {
          context.addIssue({
            code: "custom",
            message: "Session-started event must match the initial session",
            path: ["events", eventIndex],
          });
        }
      }

      if (event.type === "session.ended") {
        endedEventCount += 1;
        if (
          event.endedAt !== completedSession.endedAt ||
          event.emittedAt !== completedSession.endedAt
        ) {
          context.addIssue({
            code: "custom",
            message: "Session-ended event must match the expected completed session",
            path: ["events", eventIndex, "endedAt"],
          });
        }
      }

      if (event.type === "transcript.partial") {
        if (event.chunk.sessionId !== fixture.session.sessionId) {
          context.addIssue({
            code: "custom",
            message: "Partial transcript chunk must belong to the fixture session",
            path: ["events", eventIndex, "chunk", "sessionId"],
          });
        }
        if (partialIds.has(event.chunk.partialId)) {
          context.addIssue({
            code: "custom",
            message: "Partial transcript IDs must be unique within the fixture",
            path: ["events", eventIndex, "chunk", "partialId"],
          });
        }
        partialIds.add(event.chunk.partialId);
        if (
          Date.parse(event.emittedAt) !==
          Date.parse(fixture.session.startedAt) + event.chunk.endMs
        ) {
          context.addIssue({
            code: "custom",
            message: "Partial transcript emission time must match its lecture offset",
            path: ["events", eventIndex, "emittedAt"],
          });
        }
      }

      if (event.type === "transcript.committed") {
        if (event.chunk.sessionId !== fixture.session.sessionId) {
          context.addIssue({
            code: "custom",
            message: "Committed transcript chunk must belong to the fixture session",
            path: ["events", eventIndex, "chunk", "sessionId"],
          });
        }
        if (committedChunkIds.has(event.chunk.chunkId)) {
          context.addIssue({
            code: "custom",
            message: "Committed chunk IDs must be unique",
            path: ["events", eventIndex, "chunk", "chunkId"],
          });
        }
        committedChunkIds.add(event.chunk.chunkId);

        if (committedChunkSequences.has(event.chunk.sequence)) {
          context.addIssue({
            code: "custom",
            message: "Committed chunk sequences must be unique",
            path: ["events", eventIndex, "chunk", "sequence"],
          });
        }
        if (event.chunk.sequence !== previousChunkSequence + 1) {
          context.addIssue({
            code: "custom",
            message: "Committed chunk sequences must start at zero and increase by one",
            path: ["events", eventIndex, "chunk", "sequence"],
          });
        }
        committedChunkSequences.add(event.chunk.sequence);
        previousChunkSequence = event.chunk.sequence;

        if (event.chunk.startMs < previousChunkEndMs) {
          context.addIssue({
            code: "custom",
            message: "Committed chunks must not overlap or move backward",
            path: ["events", eventIndex, "chunk", "startMs"],
          });
        }
        previousChunkEndMs = event.chunk.endMs;
        committedChunks.push(event.chunk);
        if (
          Date.parse(event.emittedAt) !==
          Date.parse(fixture.session.startedAt) + event.chunk.endMs
        ) {
          context.addIssue({
            code: "custom",
            message: "Committed transcript emission time must match its lecture offset",
            path: ["events", eventIndex, "emittedAt"],
          });
        }
      }
    });

    if (startedEventCount !== 1 || endedEventCount !== 1) {
      context.addIssue({
        code: "custom",
        message: "Fixture must contain exactly one session start and one session end",
        path: ["events"],
      });
    }

    if (activeSourceStateCount !== 1 || stoppedSourceStateCount !== 1) {
      context.addIssue({
        code: "custom",
        message: "Fixture must contain exactly one active and one stopped source-state event",
        path: ["events"],
      });
    }

    const firstEvent = fixture.events[0];
    const secondEvent = fixture.events[1];
    const penultimateEvent = fixture.events.at(-2);
    const finalEvent = fixture.events.at(-1);
    if (
      firstEvent?.type !== "source.state" ||
      firstEvent.status !== "active" ||
      secondEvent?.type !== "session.started" ||
      penultimateEvent?.type !== "session.ended" ||
      finalEvent?.type !== "source.state" ||
      finalEvent.status !== "stopped"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Fixture lifecycle must be active source, session start, transcript events, session end, then stopped source",
        path: ["events"],
      });
    }

    const fixtureDurationMs =
      Date.parse(completedSession.endedAt) - Date.parse(fixture.session.startedAt);
    if (fixtureDurationMs < 360_000 || fixtureDurationMs > 480_000) {
      context.addIssue({
        code: "custom",
        message: "Canonical simulation lecture must be between six and eight minutes",
        path: ["expected", "completedSession", "endedAt"],
      });
    }

    const scenarios = Object.entries(fixture.scenarios) as Array<
      [keyof typeof fixture.scenarios, (typeof fixture.scenarios)[keyof typeof fixture.scenarios]]
    >;

    if (new Set(scenarios.map(([, scenario]) => scenario.scenarioId)).size !== scenarios.length) {
      context.addIssue({
        code: "custom",
        message: "Scenario IDs must be unique",
        path: ["scenarios"],
      });
    }

    if (
      fixture.scenarios.answerable.expectedGroundingStatus !== "grounded" ||
      fixture.scenarios.answerable.expectedCitationChunkIds.length === 0 ||
      fixture.scenarios.unanswerable.expectedGroundingStatus !== "insufficient_evidence" ||
      fixture.scenarios.adversarial.expectedGroundingStatus !== "grounded" ||
      fixture.scenarios.adversarial.expectedCitationChunkIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Canonical scenarios must include grounded answerable and adversarial cases plus an unanswerable insufficient-evidence case",
        path: ["scenarios"],
      });
    }

    scenarios.forEach(([scenarioName, scenario]) => {
      const contextIds = new Set(scenario.expectedContextChunkIds);
      if (contextIds.size !== scenario.expectedContextChunkIds.length) {
        context.addIssue({
          code: "custom",
          message: "Expected context chunk IDs must be unique",
          path: ["scenarios", scenarioName, "expectedContextChunkIds"],
        });
      }

      if (
        new Set(scenario.expectedCitationChunkIds).size !== scenario.expectedCitationChunkIds.length
      ) {
        context.addIssue({
          code: "custom",
          message: "Expected citation chunk IDs must be unique",
          path: ["scenarios", scenarioName, "expectedCitationChunkIds"],
        });
      }

      if (scenario.anchorMs > fixtureDurationMs) {
        context.addIssue({
          code: "custom",
          message: "Scenario anchor must fall within the fixture lecture",
          path: ["scenarios", scenarioName, "anchorMs"],
        });
      }

      const windowStartMs = Math.max(0, scenario.anchorMs - scenario.lookbackMs);
      const actualContextChunkIds = committedChunks
        .filter((chunk) => chunk.endMs >= windowStartMs && chunk.endMs <= scenario.anchorMs)
        .map((chunk) => chunk.chunkId);
      if (
        JSON.stringify(actualContextChunkIds) !== JSON.stringify(scenario.expectedContextChunkIds)
      ) {
        context.addIssue({
          code: "custom",
          message: "Expected context must exactly match the configured lecture time window",
          path: ["scenarios", scenarioName, "expectedContextChunkIds"],
        });
      }

      for (const chunkId of contextIds) {
        if (!committedChunkIds.has(chunkId)) {
          context.addIssue({
            code: "custom",
            message: `Scenario context references nonexistent chunk ${chunkId}`,
            path: ["scenarios", scenarioName, "expectedContextChunkIds"],
          });
        }
      }
      for (const chunkId of scenario.expectedCitationChunkIds) {
        if (!contextIds.has(chunkId)) {
          context.addIssue({
            code: "custom",
            message: `Scenario citation ${chunkId} is outside its expected context`,
            path: ["scenarios", scenarioName, "expectedCitationChunkIds"],
          });
        }
      }

      if (
        scenario.expectedGroundingStatus === "insufficient_evidence" &&
        scenario.expectedCitationChunkIds.length > 0
      ) {
        context.addIssue({
          code: "custom",
          message: "Insufficient-evidence scenarios cannot expect citations",
          path: ["scenarios", scenarioName, "expectedCitationChunkIds"],
        });
      }
    });

    if (!committedChunkIds.has(fixture.scenarios.adversarial.untrustedChunkId)) {
      context.addIssue({
        code: "custom",
        message: "Adversarial scenario must identify an existing committed chunk",
        path: ["scenarios", "adversarial", "untrustedChunkId"],
      });
    }
    if (
      !fixture.scenarios.adversarial.expectedContextChunkIds.includes(
        fixture.scenarios.adversarial.untrustedChunkId,
      ) ||
      fixture.scenarios.adversarial.expectedCitationChunkIds.includes(
        fixture.scenarios.adversarial.untrustedChunkId,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Adversarial text must be present in context while remaining excluded from trusted citations",
        path: ["scenarios", "adversarial"],
      });
    }

    const confusion = fixture.expected.confusionEvent;
    const confusionReferences = [
      ...(confusion.anchorChunkId ? [confusion.anchorChunkId] : []),
      ...confusion.contextChunkIds,
      ...confusion.evidenceChunkIds,
    ];
    if (confusion.sessionId !== fixture.session.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Expected confusion event must belong to the fixture session",
        path: ["expected", "confusionEvent", "sessionId"],
      });
    }
    if (
      confusion.occurredAtMs !== fixture.scenarios.answerable.anchorMs ||
      JSON.stringify(confusion.contextChunkIds) !==
        JSON.stringify(fixture.scenarios.answerable.expectedContextChunkIds) ||
      JSON.stringify(confusion.evidenceChunkIds) !==
        JSON.stringify(fixture.scenarios.answerable.expectedCitationChunkIds)
    ) {
      context.addIssue({
        code: "custom",
        message: "Expected confusion event must be the canonical answerable scenario result",
        path: ["expected", "confusionEvent"],
      });
    }
    const expectedAnchorChunkId = [...committedChunks]
      .filter((chunk) => chunk.endMs <= fixture.scenarios.answerable.anchorMs)
      .sort((left, right) => right.endMs - left.endMs)[0]?.chunkId;
    if (confusion.anchorChunkId !== expectedAnchorChunkId) {
      context.addIssue({
        code: "custom",
        message: "Expected confusion anchor must be the latest chunk at the answerable moment",
        path: ["expected", "confusionEvent", "anchorChunkId"],
      });
    }
    for (const chunkId of confusionReferences) {
      if (!committedChunkIds.has(chunkId)) {
        context.addIssue({
          code: "custom",
          message: `Expected confusion event references nonexistent chunk ${chunkId}`,
          path: ["expected", "confusionEvent"],
        });
      }
    }

    try {
      assertWeakAreaDrillLinkage(
        fixture.expected.weakAreaDrillRequest,
        [confusion],
        fixture.expected.weakAreaDrill,
      );
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid weak-area linkage",
        path: ["expected", "weakAreaDrill"],
      });
    }
  });

export type SimulationFixture = z.infer<typeof SimulationFixtureSchema>;
