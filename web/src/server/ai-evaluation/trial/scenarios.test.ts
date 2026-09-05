import { afterEach, expect, it, vi } from "vitest";
import { createDemoDispatcher } from "../../demo-api";
import { AI_EVALUATION_CASES } from "../cases";
import { runStaticScenario } from "./scenarios";

afterEach(() => vi.restoreAllMocks());

it("runs the static helpers through delivered contracts without sending the review oracle", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network"));
  const dispatcher = createDemoDispatcher({ enabled: true });
  const received: string[] = [];
  const wrapped = async (request: Request) => {
    received.push(await request.clone().text());
    return dispatcher(request);
  };
  for (const fixture of AI_EVALUATION_CASES.slice(0, 3)) {
    const result = await runStaticScenario(wrapped, fixture);
    expect(result.status).toBe("observed_for_review");
    expect(result.confusionCount).toBe(1);
    expect(result.comparisons?.conceptMatches).toBe(true);
    if (fixture.id !== "insufficient") expect(result.practice).toBeDefined();
  }
  expect(received.join("\n")).not.toContain("expectedAnswer");
  expect(received.join("\n")).not.toContain("g(x) = 2x + 3; f(u) = u⁴");
  expect(fetch).not.toHaveBeenCalled();
  dispatcher.dispose();
});

it("records a safe stage failure without exposing generator errors or pretending quality passed", async () => {
  const dispatcher = createDemoDispatcher({
    enabled: true,
    generateHelp: () => {
      throw new Error("private transport payload");
    },
  });
  const result = await runStaticScenario(dispatcher, AI_EVALUATION_CASES[0]);
  expect(result.status).toBe("changes_required");
  expect(result.failure).toBe("help_failed");
  expect(JSON.stringify(result)).not.toContain("private transport payload");
  dispatcher.dispose();
});
