import { describe, expect, it } from "vitest";

import * as PublicContracts from "../src";
import {
  ApiContracts,
  AppendCommittedChunksInputSchema,
  EndSessionInputSchema,
  getCommittedChunksFromFixture,
  GetSessionInputSchema,
  ImLostInputSchema,
  simulationFixture,
  WeakAreaDrillInputSchema,
} from "../src";

describe("API contracts", () => {
  it("exports only the route-safe public Im Lost request contract", () => {
    expect("ImLostBodySchema" in PublicContracts).toBe(true);
    expect("ImLostRequestSchema" in PublicContracts).toBe(false);
  });

  it("keeps the canonical method and route table stable", () => {
    expect(
      Object.fromEntries(
        Object.entries(ApiContracts).map(([name, contract]) => [
          name,
          { method: contract.method, route: contract.route },
        ]),
      ),
    ).toEqual({
      startSession: { method: "POST", route: "/api/sessions" },
      appendCommittedChunks: {
        method: "POST",
        route: "/api/sessions/:sessionId/chunks",
      },
      imLost: { method: "POST", route: "/api/sessions/:sessionId/im-lost" },
      endSession: { method: "POST", route: "/api/sessions/:sessionId/end" },
      getSession: { method: "GET", route: "/api/sessions/:sessionId" },
      createWeakAreaDrill: {
        method: "POST",
        route: "/api/sessions/:sessionId/weak-area-drills",
      },
    });
  });

  it("keeps route-owned session IDs out of endpoint bodies", () => {
    const sessionId = simulationFixture.session.sessionId;
    const answerable = simulationFixture.scenarios.answerable;

    expect(
      ImLostInputSchema.parse({
        params: { sessionId },
        body: { lookbackMs: answerable.lookbackMs },
      }),
    ).toEqual({
      params: { sessionId },
      body: { lookbackMs: answerable.lookbackMs },
    });
    expect(
      WeakAreaDrillInputSchema.parse({
        params: { sessionId },
        body: {
          confusionEventIds: simulationFixture.expected.weakAreaDrillRequest.confusionEventIds,
        },
      }),
    ).toEqual({
      params: { sessionId },
      body: {
        confusionEventIds: simulationFixture.expected.weakAreaDrillRequest.confusionEventIds,
      },
    });
    expect(
      EndSessionInputSchema.safeParse({
        params: { sessionId },
        body: { endedAt: simulationFixture.expected.completedSession.endedAt },
      }).success,
    ).toBe(true);
    expect(GetSessionInputSchema.safeParse({ params: { sessionId } }).success).toBe(true);
    expect(
      GetSessionInputSchema.safeParse({ params: { sessionId: "not-a-stable-id" } }).success,
    ).toBe(false);
  });

  it("rejects an extraneous body session ID even when it matches the route", () => {
    const sessionId = simulationFixture.session.sessionId;
    const answerable = simulationFixture.scenarios.answerable;
    const bodySessionIds = [sessionId, "session_foreign_001"];

    for (const bodySessionId of bodySessionIds) {
      expect(
        ImLostInputSchema.safeParse({
          params: { sessionId },
          body: {
            sessionId: bodySessionId,
            lookbackMs: answerable.lookbackMs,
          },
        }).success,
      ).toBe(false);
      expect(
        EndSessionInputSchema.safeParse({
          params: { sessionId },
          body: {
            sessionId: bodySessionId,
            endedAt: simulationFixture.expected.completedSession.endedAt,
          },
        }).success,
      ).toBe(false);
      expect(
        WeakAreaDrillInputSchema.safeParse({
          params: { sessionId },
          body: {
            sessionId: bodySessionId,
            confusionEventIds: simulationFixture.expected.weakAreaDrillRequest.confusionEventIds,
          },
        }).success,
      ).toBe(false);
    }
  });

  it("rejects a client-supplied grounding anchor", () => {
    const sessionId = simulationFixture.session.sessionId;
    const answerable = simulationFixture.scenarios.answerable;

    expect(
      ImLostInputSchema.safeParse({
        params: { sessionId },
        body: {
          lookbackMs: answerable.lookbackMs,
          anchorMs: answerable.anchorMs,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects chunk bodies that disagree with the route session", () => {
    const chunk = getCommittedChunksFromFixture()[0];
    if (!chunk) throw new Error("Canonical fixture must include a committed chunk");

    expect(
      AppendCommittedChunksInputSchema.safeParse({
        params: { sessionId: simulationFixture.session.sessionId },
        body: { chunks: [chunk] },
      }).success,
    ).toBe(true);
    expect(
      AppendCommittedChunksInputSchema.safeParse({
        params: { sessionId: "session_foreign_001" },
        body: { chunks: [chunk] },
      }).success,
    ).toBe(false);
  });

  it("requires one confusion event for the MVP drill request", () => {
    const sessionId = simulationFixture.session.sessionId;
    expect(
      WeakAreaDrillInputSchema.safeParse({
        params: { sessionId },
        body: { confusionEventIds: [] },
      }).success,
    ).toBe(false);
    expect(
      WeakAreaDrillInputSchema.safeParse({
        params: { sessionId },
        body: {
          confusionEventIds: ["confusion_chain_rule_001", "confusion_chain_rule_002"],
        },
      }).success,
    ).toBe(false);
  });

  it("validates exact end-session handoff linkage and common error envelopes", () => {
    const sessionId = simulationFixture.session.sessionId;
    const success = {
      ok: true as const,
      data: {
        session: simulationFixture.expected.completedSession,
        handoff: { sessionId, companionRoute: `/sessions/${sessionId}` },
      },
    };
    expect(ApiContracts.endSession.response.safeParse(success).success).toBe(true);
    expect(
      ApiContracts.endSession.response.safeParse({
        ...success,
        data: {
          ...success.data,
          handoff: { sessionId, companionRoute: "/sessions/session_foreign_001" },
        },
      }).success,
    ).toBe(false);

    const error = {
      ok: false as const,
      error: { code: "INVALID_REQUEST" as const, message: "Invalid request", retryable: false },
    };
    for (const contract of Object.values(ApiContracts)) {
      expect(contract.response.safeParse(error).success).toBe(true);
    }
  });
});
