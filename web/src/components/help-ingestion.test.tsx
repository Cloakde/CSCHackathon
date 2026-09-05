// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ApiContracts,
  SimulationTranscriptSource,
  type GroundingContextSnapshot,
} from "@livelecture/shared";
import { App } from "../../../extension/src/App";
import { createDemoClient } from "../../../extension/src/demo-api";
import { createDemoDispatcher, DEMO_ORIGIN } from "../server/demo-api";
import { generateScriptedHelp } from "../server/scripted-help";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

it.each([
  {
    nextAt: 200_000,
    chunk: "chunk_calc_004",
    anchor: 145_000,
    concept: "concept_inner_outer",
    title: "Identifying inner and outer functions",
    citation: "Go to 0:45–1:30",
    passage: "Lecture passage at 0:45",
  },
  {
    nextAt: 340_000,
    chunk: "chunk_calc_007",
    anchor: 300_000,
    concept: "concept_inner_derivative",
    title: "Remembering the inner derivative",
    citation: "Go to 2:25–3:20",
    passage: "Lecture passage at 2:25",
  },
])(
  "uploads $chunk during Help at 1× and records only the retried authoritative moment",
  async (fixture) => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Readiness tests cannot access a network"));
    vi.useFakeTimers();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const contexts: GroundingContextSnapshot[] = [];
    let generating = false;
    let receivedDuringHelp = false;
    let sid = "";
    const dispatcher = createDemoDispatcher({
      enabled: true,
      generateHelp: async (context, signal) => {
        contexts.push(structuredClone(context));
        if (contexts.length === 1) {
          generating = true;
          await gate;
          generating = false;
        }
        expect(signal.aborted).toBe(false);
        return generateScriptedHelp(context);
      },
    });
    const fetcher: typeof fetch = async (input, options) => {
      const url = new URL(String(input), DEMO_ORIGIN);
      const headers = new Headers(options?.headers);
      headers.set("Host", "127.0.0.1:3000");
      const response = await dispatcher(new Request(url, { ...options, headers }));
      if (url.pathname === "/api/sessions" && response.ok) {
        const started = ApiContracts.startSession.response.parse(await response.clone().json());
        if (started.ok) sid = started.data.session.sessionId;
      }
      if (url.pathname.endsWith("/chunks") && response.ok) {
        const uploaded = ApiContracts.appendCommittedChunks.response.parse(
          await response.clone().json(),
        );
        if (uploaded.ok && uploaded.data.acceptedChunkIds.includes(fixture.chunk))
          receivedDuringHelp = generating;
      }
      return response;
    };
    const source = new SimulationTranscriptSource();
    source.setSpeed(1);
    render(<App source={source} client={createDemoClient(fetcher)} />);
    await click("Start sample lecture");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(fixture.nextAt - 1000);
    });
    await click("I’m Lost");
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.reference.anchorMs).toBe(fixture.anchor);
    expect(screen.getByRole("button", { name: "Finish lecture" })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(receivedDuringHelp).toBe(true);
    expect(source.getSnapshot().replay).toMatchObject({ speed: 1, isPaused: false });
    expect(screen.queryByRole("heading", { name: fixture.title })).not.toBeInTheDocument();
    await act(async () => {
      release();
    });
    expect(contexts).toHaveLength(2);
    expect(contexts[1]?.reference.anchorMs).toBe(fixture.nextAt);
    expect(screen.getByRole("heading", { name: fixture.title })).toBeVisible();
    await click(fixture.citation);
    expect(screen.getByRole("article", { name: fixture.passage })).toHaveFocus();
    const response = await fetcher(`${DEMO_ORIGIN}/api/sessions/${sid}`, {
      method: "GET",
      headers: { "X-LiveLecture-Demo": "scripted-v1" },
    });
    const view = ApiContracts.getSession.response.parse(await response.json());
    if (!view.ok) throw new Error(view.error.code);
    expect(view.data.committedChunks.at(-1)?.chunkId).toBe(fixture.chunk);
    expect(view.data.confusionEvents).toHaveLength(1);
    expect(view.data.confusionEvents[0]).toMatchObject({
      conceptId: fixture.concept,
      occurredAtMs: fixture.nextAt,
      anchorChunkId: fixture.chunk,
    });
    await click("Finish lecture");
    expect(screen.getByRole("link", { name: "Open my practice" })).toBeVisible();
    expect(
      (
        await fetcher(`${DEMO_ORIGIN}/api/sessions/${sid}`, {
          method: "DELETE",
          headers: { "X-LiveLecture-Demo": "scripted-v1" },
        })
      ).ok,
    ).toBe(true);
    expect(network).not.toHaveBeenCalled();
  },
);
