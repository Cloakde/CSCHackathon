import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ApiContracts,
  SimulationTranscriptSource,
  formatOffset,
  type ImLostResponse,
} from "@livelecture/shared";
import { App } from "../../../../../extension/src/App";
import { createDemoClient } from "../../../../../extension/src/demo-api";
import { createDemoDispatcher } from "../../demo-api";
import {
  createProviderTrialHooks,
  TRIAL_PROMPT_HASHES,
  TRIAL_PROMPT_VERSION,
} from "../../assistance/provider-trial";
import { AI_EVALUATION_CASES } from "../cases";
import { openTrialLedger } from "./budget";
import { TRIAL_MODEL, TRIAL_POLICY_HASH } from "./policy";
import type { TrialMeter, TrialCallKind } from "./types";
import { buildTrialReport } from "./report";
import {
  invoke,
  recordComparisons,
  runStaticScenario,
  scenarioRecord,
  type TrialScenarioResult,
} from "./scenarios";

// Deliberately outside default *.test / *.spec discovery. The separate config
// and this guard both require the explicit, approved CLI launch.
if (process.env.CI || process.env.LIVELECTURE_AI_TRIAL_EXECUTE !== "approved-one-dollar-v1")
  throw new Error("This file requires the explicitly authorized trial launcher.");

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}
const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

it("records the authorized synthetic trial without declaring human or browser acceptance", async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const directory = process.env.LIVELECTURE_AI_TRIAL_DIRECTORY;
  const sourceTree = process.env.LIVELECTURE_AI_TRIAL_TREE;
  const sourceCommit = process.env.LIVELECTURE_AI_TRIAL_COMMIT;
  if (
    !apiKey ||
    !directory ||
    !sourceTree ||
    !sourceCommit ||
    process.env.LIVELECTURE_AI_TRIAL_POLICY !== TRIAL_POLICY_HASH
  )
    throw new Error("Missing verified trial execution identity.");
  const ledger = openTrialLedger({ directory, sourceTree, policyHash: TRIAL_POLICY_HASH });
  const startedAt = new Date().toISOString();
  const results: TrialScenarioResult[] = [];
  const active = new Set<number>();
  const attemptTimings: {
    attemptId: number;
    kind: TrialCallKind;
    scenarioId: string;
    startedAt: string;
    durationMs?: number;
  }[] = [];
  const clocks = new Map<number, number>();
  const meter: TrialMeter = {
    reserve(input) {
      const id = ledger.reserve(input);
      active.add(id);
      clocks.set(id, performance.now());
      attemptTimings.push({
        attemptId: id,
        kind: input.kind,
        scenarioId: input.scenarioId,
        startedAt: new Date().toISOString(),
      });
      return id;
    },
    settle(id, usage) {
      try {
        ledger.settle(id, usage);
      } finally {
        active.delete(id);
        const timing = attemptTimings.find((item) => item.attemptId === id);
        if (timing && timing.durationMs === undefined)
          timing.durationMs = performance.now() - clocks.get(id)!;
      }
    },
  };
  const fixtureSha256 = createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), "shared/fixtures/calculus-lecture.json")))
    .digest("hex");
  function save() {
    const report = buildTrialReport(
      {
        sourceTree: sourceTree!,
        sourceCommit: sourceCommit!,
        fixtureSha256,
        promptHashes: TRIAL_PROMPT_HASHES,
        promptVersion: TRIAL_PROMPT_VERSION,
        model: TRIAL_MODEL,
        startedAt,
        endedAt: new Date().toISOString(),
        results,
        attemptTimings,
        ledger: ledger.snapshot(),
      },
      [apiKey!],
    );
    writeFileSync(path.join(directory!, "report.json"), `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  try {
    for (const fixture of AI_EVALUATION_CASES) {
      const dispatcher = createDemoDispatcher({
        enabled: true,
        ...createProviderTrialHooks({ apiKey, meter, scenarioId: fixture.id }),
      });
      try {
        results.push(await runStaticScenario(dispatcher, fixture));
      } finally {
        dispatcher.dispose();
        save();
      }
    }

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: () => undefined,
    });
    for (const probe of [
      { fixture: AI_EVALUATION_CASES[0], nextAt: 200_000, chunkId: "chunk_calc_004" },
      { fixture: AI_EVALUATION_CASES[1], nextAt: 340_000, chunkId: "chunk_calc_007" },
    ]) {
      const result = scenarioRecord(probe.fixture);
      result.id = `${probe.fixture.id}_real_clock_overlap`;
      result.timingPath = "extension_component_real_clock";
      result.overlapObserved = false;
      const dispatcher = createDemoDispatcher({
        enabled: true,
        ...createProviderTrialHooks({ apiKey, meter, scenarioId: result.id }),
      });
      const source = new SimulationTranscriptSource();
      source.setSpeed(1);
      let sid = "";
      let help: ImLostResponse | undefined;
      let stage = "start";
      let resolveHelp!: () => void;
      const helpSettled = new Promise<void>((resolve) => {
        resolveHelp = resolve;
      });
      const fetcher = async (url: string, options: RequestInit) => {
        const headers = new Headers(options.headers);
        headers.set("Host", "127.0.0.1:3000");
        const response = await dispatcher(new Request(url, { ...options, headers }));
        if (url.endsWith("/api/sessions") && response.ok) {
          const start = ApiContracts.startSession.response.parse(await response.clone().json());
          if (start.ok) sid = start.data.session.sessionId;
        }
        if (url.endsWith("/chunks") && response.ok) {
          const appended = ApiContracts.appendCommittedChunks.response.parse(
            await response.clone().json(),
          );
          if (
            appended.ok &&
            appended.data.acceptedChunkIds.includes(probe.chunkId) &&
            active.size > 0
          )
            result.overlapObserved = true;
        }
        return response;
      };
      const client = createDemoClient(fetcher);
      const instrumentedClient = {
        ...client,
        help: async (sessionId: string, signal?: AbortSignal) => {
          try {
            help = await client.help(sessionId, signal);
            return help;
          } finally {
            resolveHelp();
          }
        },
      };
      const component = render(<App source={source} client={instrumentedClient} />);
      try {
        const replayStart = performance.now();
        await click("Start sample lecture");
        // Real time and unchanged 1x fixture playback: no fake clock, artificial
        // generation hold, browser surface, or prewritten provider response.
        await act(async () => {
          await sleep(Math.max(0, replayStart + probe.nextAt - 250 - performance.now()));
        });
        stage = "help";
        const clickedAt = performance.now();
        await click("I’m Lost");
        await act(async () => {
          let watchdog: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              helpSettled,
              new Promise<never>((_resolve, reject) => {
                watchdog = setTimeout(() => reject(new Error("Help did not settle")), 14_000);
              }),
            ]);
          } finally {
            clearTimeout(watchdog);
          }
        });
        result.helpDurationMs = performance.now() - clickedAt;
        result.sourceSpeed = source.getSnapshot().replay.speed;
        result.sourcePaused = source.getSnapshot().replay.isPaused;
        if (!help) throw new Error();
        result.help = help;
        recordComparisons(result);
        const firstCitation = help.citations[0];
        if (firstCitation) {
          await click(
            `Go to ${formatOffset(firstCitation.startMs)}–${formatOffset(firstCitation.endMs)}`,
          );
          result.citationFocus =
            screen.getByRole("article", {
              name: `Lecture passage at ${formatOffset(firstCitation.startMs)}`,
            }) === document.activeElement;
        }
        stage = "finish";
        await click("Finish lecture");
        if (!screen.queryByRole("link", { name: "Open my practice" })) throw new Error();
        const view = ApiContracts.getSession.response.parse(
          await (await invoke(dispatcher, `/api/sessions/${sid}`, "GET")).json(),
        );
        if (!view.ok) throw new Error();
        result.confusionCount = view.data.confusionEvents.length;
        stage = "practice";
        const practiceStarted = performance.now();
        const practiced = ApiContracts.createWeakAreaDrill.response.parse(
          await (
            await invoke(dispatcher, `/api/sessions/${sid}/weak-area-drills`, "POST", {
              confusionEventIds: [help.confusionEvent.confusionId],
            })
          ).json(),
        );
        result.practiceDurationMs = performance.now() - practiceStarted;
        if (!practiced.ok) throw new Error();
        result.practice = practiced.data;
        if (
          !result.overlapObserved ||
          result.sourceSpeed !== 1 ||
          result.sourcePaused ||
          !result.citationFocus ||
          result.confusionCount !== 1 ||
          result.helpDurationMs > 10_000 ||
          result.practiceDurationMs > 4_000 ||
          help.confusionEvent.occurredAtMs < probe.nextAt
        )
          throw new Error();
        result.status = "observed_for_review";
      } catch {
        result.failure = `${stage}_failed`;
      } finally {
        component.unmount();
        cleanup();
        source.stop();
        if (sid) await invoke(dispatcher, `/api/sessions/${sid}`, "DELETE");
        dispatcher.dispose();
        results.push(result);
        save();
      }
    }
    ledger.finish();
    save();
    if (results.some((result) => result.status !== "observed_for_review"))
      throw new Error(
        "Trial completed with findings; inspect the local report before further work.",
      );
  } finally {
    cleanup();
    ledger.close();
  }
});
