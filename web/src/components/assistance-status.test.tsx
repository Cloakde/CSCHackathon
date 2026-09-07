// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ASSISTANCE_STATUS_LABELS,
  SimulationTranscriptSource,
  getCommittedChunksFromFixture,
} from "@livelecture/shared";
import { App } from "../../../extension/src/App";
import { createDemoClient } from "../../../extension/src/demo-api";
import { createDemoDispatcher, DEMO_ORIGIN } from "../server/demo-api";
import { createStudyClient } from "../lib/client/study-client";
import { SessionReview } from "./SessionReview";
import { LectureTools } from "../../../extension/src/LectureTools";

const disposals: (() => void)[] = [];
afterEach(() => {
  cleanup();
  disposals.splice(0).forEach((dispose) => dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup(provider: "prewritten" | "gemini" | "blocked") {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  let fail = false;
  // Deterministic local generators exercise status propagation; provider transport and run
  // authorization have their own tests through createDemoRequestHandler with a fake network.
  const dispatch = createDemoDispatcher({ enabled: true, assistanceProvider: provider });
  disposals.push(dispatch.dispose);
  const fetcher: typeof fetch = async (input, options) => {
    if (fail) throw new Error("offline transport failure");
    const headers = new Headers(options?.headers);
    headers.set("Host", "127.0.0.1:3000");
    const url = new URL(String(input), DEMO_ORIGIN);
    return dispatch(new Request(url, { ...options, headers }));
  };
  const client = createDemoClient(fetcher);
  const study = createStudyClient(fetcher);
  const source = new SimulationTranscriptSource();
  source.setSpeed(60);
  return {
    client,
    study,
    source,
    fail: () => {
      fail = true;
    },
  };
}
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

it.each(["prewritten", "gemini", "blocked"] as const)(
  "shows confirmed %s configuration without claiming a successful Gemini answer",
  async (provider) => {
    vi.useFakeTimers();
    const api = setup(provider);
    render(<App source={api.source} client={api.client} />);
    expect(screen.getByText(ASSISTANCE_STATUS_LABELS.unknown)).toBeVisible();
    await click("Start sample lecture");
    const expected =
      provider === "gemini"
        ? "gemini_pending"
        : provider === "blocked"
          ? "gemini_blocked"
          : "prewritten";
    expect(screen.getByText(ASSISTANCE_STATUS_LABELS[expected])).toBeVisible();
    expect(screen.queryByText(ASSISTANCE_STATUS_LABELS.gemini_ready)).not.toBeInTheDocument();
    if (provider !== "prewritten")
      expect(screen.queryByText(/Gemini is not connected/)).not.toBeInTheDocument();
  },
);

it("updates lecture and companion labels after verified results and after a later failure", async () => {
  vi.useFakeTimers();
  const api = setup("gemini");
  const lecture = render(
    <App source={api.source} client={api.client} companionDestination="meltingpot" />,
  );
  await click("Start sample lecture");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2500);
  });
  await click("I’m Lost");
  expect(screen.getByText(ASSISTANCE_STATUS_LABELS.gemini_ready)).toBeVisible();
  expect(screen.queryByText(/no AI provider used/)).not.toBeInTheDocument();
  await click("Finish lecture");
  const link = screen.getByRole("link", { name: "Open my practice" }).getAttribute("href")!;
  expect(new URL(link).origin).toBe(DEMO_ORIGIN);
  const sid = new URL(link).pathname.split("/").at(-1)!;
  lecture.unmount();
  render(<SessionReview sessionId={sid} client={api.study} />);
  await act(async () => {});
  expect(screen.getByText(ASSISTANCE_STATUS_LABELS.gemini_ready)).toBeVisible();
  await click("Practice this topic");
  expect(screen.getByText(ASSISTANCE_STATUS_LABELS.gemini_ready)).toBeVisible();
  api.fail();
  await click("Practice this topic");
  expect(screen.getByText(ASSISTANCE_STATUS_LABELS.gemini_failed)).toBeVisible();
  expect(screen.queryByText(ASSISTANCE_STATUS_LABELS.gemini_ready)).not.toBeInTheDocument();
});

it("labels a checked Gemini lecture-tool result without any disconnected or sample-only claim", async () => {
  const chunk = getCommittedChunksFromFixture()[3]!;
  render(
    <LectureTools
      blocked={false}
      assistanceStatus="gemini_pending"
      jump={vi.fn()}
      request={async () => ({
        sessionId: "session_status",
        mode: "gemini",
        request: { kind: "catch_up", throughSequence: 3 },
        anchorMs: chunk.endMs,
        status: "ready",
        message: "Differentiate the outside and multiply by the inside derivative.",
        passages: [
          {
            text: chunk.text,
            citation: { chunkId: chunk.chunkId, startMs: chunk.startMs, endMs: chunk.endMs },
          },
        ],
      })}
    />,
  );
  await click("Catch Me Up");
  expect(screen.getByText(/Gemini assistance · answer checked against the lecture/)).toBeVisible();
  expect(
    screen.queryByText(/Gemini is not connected|Sample questions only/),
  ).not.toBeInTheDocument();
});
