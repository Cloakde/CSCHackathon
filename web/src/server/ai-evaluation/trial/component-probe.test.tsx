// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoDispatcher } from "../../demo-api";
import { generateScriptedHelp } from "../../scripted-help";
import { AI_EVALUATION_CASES } from "../cases";
import { runComponentProbe, type ProbeTiming } from "./component-probe";

const injectedTiming: ProbeTiming = {
  mode: "injected_clock",
  wait: (milliseconds) => vi.advanceTimersByTimeAsync(milliseconds),
  waitForResult: async (result) => {
    await vi.advanceTimersByTimeAsync(2000);
    await result;
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each([
  { fixture: AI_EVALUATION_CASES[0], nextAt: 200_000, chunkId: "chunk_calc_004" },
  { fixture: AI_EVALUATION_CASES[1], nextAt: 340_000, chunkId: "chunk_calc_007" },
])(
  "rehearses the exact $chunkId probe with injected time and real dispatcher boundaries",
  async (probe) => {
    vi.useFakeTimers({ toFake: ["Date", "performance", "setTimeout", "clearTimeout"] });
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network"));
    let pending = false;
    let generated = 0;
    const dispatcher = createDemoDispatcher({
      enabled: true,
      generateHelp: async (context) => {
        generated += 1;
        if (generated === 1) {
          pending = true;
          await new Promise((resolve) => setTimeout(resolve, 1500));
          pending = false;
        }
        return generateScriptedHelp(context);
      },
    });
    const result = await runComponentProbe(probe, dispatcher, () => pending, injectedTiming);
    expect(result).toMatchObject({
      status: "observed_for_review",
      timingPath: "extension_component_injected_clock",
      overlapObserved: true,
      sourceSpeed: 1,
      sourcePaused: false,
      confusionCount: 1,
      citationFocus: true,
    });
    expect(generated).toBe(2);
    expect(result.help?.confusionEvent.occurredAtMs).toBe(probe.nextAt);
    expect(result.practice?.conceptId).toBe(probe.fixture.conceptId);
    expect(network).not.toHaveBeenCalled();
    dispatcher.dispose();
  },
);

it("reports a missed overlap as a finding even when assistance and practice succeed", async () => {
  vi.useFakeTimers({ toFake: ["Date", "performance", "setTimeout", "clearTimeout"] });
  const dispatcher = createDemoDispatcher({ enabled: true });
  const probe = { fixture: AI_EVALUATION_CASES[0], nextAt: 200_000, chunkId: "chunk_calc_004" };
  const result = await runComponentProbe(probe, dispatcher, () => false, injectedTiming);
  expect(result.status).toBe("changes_required");
  expect(result.overlapObserved).toBe(false);
  expect(result.practice).toBeDefined();
  dispatcher.dispose();
});
