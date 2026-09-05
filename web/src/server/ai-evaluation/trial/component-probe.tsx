import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ApiContracts,
  SimulationTranscriptSource,
  formatOffset,
  type ImLostResponse,
} from "@livelecture/shared";
import { App } from "../../../../../extension/src/App";
import { createDemoClient } from "../../../../../extension/src/demo-api";
import {
  invoke,
  recordComparisons,
  scenarioRecord,
  type FrozenCase,
  type TrialDispatcher,
} from "./scenarios";

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}
const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export interface ProbeTiming {
  mode: "real_clock" | "injected_clock";
  wait(milliseconds: number): Promise<void>;
  waitForResult(result: Promise<void>): Promise<void>;
}
const realTiming: ProbeTiming = {
  mode: "real_clock",
  wait: sleep,
  waitForResult: (result) => result,
};

export async function runComponentProbe(
  probe: { fixture: FrozenCase; nextAt: number; chunkId: string },
  dispatcher: TrialDispatcher,
  isProviderPending: () => boolean,
  timing: ProbeTiming = realTiming,
) {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
  const result = scenarioRecord(probe.fixture);
  result.id = `${probe.fixture.id}_${timing.mode}_overlap`;
  result.timingPath =
    timing.mode === "real_clock"
      ? "extension_component_real_clock"
      : "extension_component_injected_clock";
  result.overlapObserved = false;
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
        isProviderPending()
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
    // Paid execution uses real time and unchanged 1x fixture playback. Offline
    // tests inject the clock explicitly and label that result separately.
    await act(async () => {
      await timing.wait(Math.max(0, replayStart + probe.nextAt - 250 - performance.now()));
    });
    stage = "help";
    const clickedAt = performance.now();
    await click("I’m Lost");
    await act(async () => {
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      try {
        await timing.waitForResult(
          Promise.race([
            helpSettled,
            new Promise<never>((_resolve, reject) => {
              watchdog = setTimeout(() => reject(new Error("Help did not settle")), 14_000);
            }),
          ]),
        );
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
  }
  return result;
}
