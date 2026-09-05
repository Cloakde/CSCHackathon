import { describe, expect, it } from "vitest";
import { DEMO_ORIGIN } from "../src/demo-api";
import { demoHandoffUrl, MELTINGPOT_ORIGIN, type CompanionDestination } from "../src/demo-handoff";

function completed(sessionId = "session_demo_1") {
  return {
    session: {
      sessionId,
      sourceMode: "simulation",
      status: "completed",
      startedAt: "2026-09-05T00:00:00.000Z",
      endedAt: "2026-09-05T00:08:00.000Z",
    },
    handoff: { sessionId, companionRoute: `/sessions/${sessionId}` },
  };
}

describe("checked local companion destinations", () => {
  it("derives a fixed destination for the same session and preserves the prototype route", () => {
    for (const sessionId of ["session_demo_1", "session_demo_2"]) {
      expect(demoHandoffUrl("meltingpot", sessionId, completed(sessionId))).toBe(
        `${MELTINGPOT_ORIGIN}/lectures/${sessionId}`,
      );
      expect(demoHandoffUrl("prototype", sessionId, completed(sessionId))).toBe(
        `${DEMO_ORIGIN}/sessions/${sessionId}`,
      );
    }
  });

  it.each(["meltingpot", "prototype"] as const)(
    "rejects malformed, active, live, and mismatched results for %s",
    (destination) => {
      const valid = completed();
      const invalid = [
        undefined,
        {},
        completed("session_other_1"),
        { ...valid, session: { ...valid.session, status: "active" } },
        { ...valid, session: { ...valid.session, sourceMode: "live" } },
        { ...valid, session: { ...valid.session, endedAt: "2026-09-04T00:00:00.000Z" } },
        {
          ...valid,
          handoff: { sessionId: "session_other_1", companionRoute: "/sessions/session_other_1" },
        },
      ];
      for (const response of invalid) {
        expect(() => demoHandoffUrl(destination, "session_demo_1", response)).toThrow(
          "did not match this sample session",
        );
      }
    },
  );

  it.each([
    "https://example.com/sessions/session_demo_1",
    "//example.com/sessions/session_demo_1",
    "/sessions/session_demo_1?next=https://example.com",
    "/sessions/session_demo_1#private-data",
    "/sessions/session_demo_1/../session_demo_2",
    "/sessions/session_demo_1%2f..",
    "/sessions/session_demo_2",
  ])("does not accept a supplied redirect or wrong route: %s", (companionRoute) => {
    expect(() =>
      demoHandoffUrl("meltingpot", "session_demo_1", {
        ...completed(),
        handoff: { sessionId: "session_demo_1", companionRoute },
      }),
    ).toThrow("did not match this sample session");
  });

  it("rejects unsupported destinations and invalid expected session IDs", () => {
    for (const destination of ["https://example.com", "", "MeltingPot"]) {
      expect(() =>
        demoHandoffUrl(destination as CompanionDestination, "session_demo_1", completed()),
      ).toThrow("destination is not supported");
    }
    expect(() => demoHandoffUrl("meltingpot", "../session_demo_1", completed())).toThrow(
      "did not match this sample session",
    );
  });
});
