// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SimulationTranscriptSource, type LectureToolResponse } from "@livelecture/shared";
import { App } from "../../../extension/src/App";
import { createDemoClient } from "../../../extension/src/demo-api";
import { createDemoDispatcher, DEMO_ORIGIN } from "../server/demo-api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Provider requests forbidden"));
  const dispatch = createDemoDispatcher({
    enabled: true,
    now: () => Date.parse("2026-09-06T00:00:00Z"),
  });
  const fetcher: typeof fetch = async (input, options) => {
    const headers = new Headers(options?.headers);
    headers.set("Host", "127.0.0.1:3000");
    headers.set("Origin", DEMO_ORIGIN);
    return dispatch(new Request(new URL(String(input), DEMO_ORIGIN), { ...options, headers }));
  };
  const client = createDemoClient(fetcher);
  const source = new SimulationTranscriptSource();
  source.setSpeed(60);
  return { client, source };
}
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
async function ask(question = "What are inner and outer functions?") {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: question } });
  await click("Ask sample question");
}

it("uses the actual lecture/service for Ask, timestamp navigation, recap and an honest refusal", async () => {
  const api = setup();
  render(<App {...api} />);
  await click("Start sample lecture");
  await click("Catch Me Up");
  expect(screen.getByRole("region", { name: "Recent lecture recap" })).toHaveTextContent(
    "No complete lecture passage",
  );
  await advance(2500);
  await ask();
  const answer = screen.getByRole("region", { name: "Sample question answer" });
  expect(answer).toHaveTextContent("A composition places one function inside another.");
  expect(answer).toHaveTextContent("Through 2:25");
  await click("Read passage at 0:45–1:30");
  expect(screen.getByRole("article", { name: "Lecture passage at 0:45" })).toHaveFocus();
  await ask("Why multiply by the inner derivative?");
  expect(screen.getByRole("region", { name: "Sample question answer" })).toHaveTextContent(
    "have not arrived yet",
  );
  await ask("Why is the inequality flipped?");
  expect(screen.getByRole("region", { name: "Sample question answer" })).toHaveTextContent(
    "only the suggested questions",
  );
  expect(screen.queryByRole("button", { name: /Read passage at/ })).not.toBeInTheDocument();
  await advance(5500);
  await click("Catch Me Up");
  const recap = screen.getByRole("region", { name: "Recent lecture recap" });
  expect(recap).toHaveTextContent("Through 8:00");
  expect(within(recap).getAllByRole("button")).toHaveLength(3);
  await click("Read passage at 5:40–6:30");
  expect(screen.getByRole("article", { name: "Lecture passage at 5:40" })).toHaveFocus();
  await click("Finish lecture");
  expect(screen.queryByRole("region", { name: "Recent lecture recap" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open my practice" })).toBeVisible();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("waits for upload acknowledgement before answering", async () => {
  const api = setup();
  const gate = deferred<void>();
  const originalAppend = api.client.append;
  const append = vi.spyOn(api.client, "append").mockImplementation(async (...args) => {
    await gate.promise;
    return originalAppend(...args);
  });
  const lectureTools = vi.spyOn(api.client, "lectureTools");
  render(<App {...api} />);
  await click("Start sample lecture");
  await advance(2500);
  await ask();
  expect(append).toHaveBeenCalled();
  expect(lectureTools).not.toHaveBeenCalled();
  expect(screen.queryByRole("region", { name: "Sample question answer" })).not.toBeInTheDocument();
  await act(async () => {
    gate.resolve();
  });
  expect(lectureTools).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("region", { name: "Sample question answer" })).toHaveTextContent(
    "Through 2:25",
  );
});

it("keeps receiving lecture passages while a tool reply is delayed and blocks duplicate requests", async () => {
  const api = setup();
  const pending = deferred<LectureToolResponse>();
  const original = api.client.lectureTools;
  let captured!: LectureToolResponse;
  const lectureTools = vi.spyOn(api.client, "lectureTools").mockImplementation(async (...args) => {
    captured = await original(...args);
    return pending.promise;
  });
  render(<App {...api} />);
  await click("Start sample lecture");
  await advance(2500);
  await ask();
  await click("Catch Me Up");
  expect(lectureTools).toHaveBeenCalledTimes(1);
  await advance(3000);
  expect(screen.getByRole("article", { name: "Lecture passage at 4:10" })).toBeVisible();
  await act(async () => {
    pending.resolve(captured);
  });
  expect(screen.getByRole("region", { name: "Sample question answer" })).toHaveTextContent(
    "Through 2:25",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it.each(["reset", "finish", "source", "unmount"] as const)(
  "discards a late answer after %s",
  async (action) => {
    const api = setup();
    const pending = deferred<LectureToolResponse>();
    const original = api.client.lectureTools;
    let captured!: LectureToolResponse;
    let signal: AbortSignal | undefined;
    vi.spyOn(api.client, "lectureTools").mockImplementation(async (...args) => {
      signal = args[2];
      captured = await original(...args);
      return pending.promise;
    });
    const view = render(<App {...api} />);
    await click("Start sample lecture");
    await advance(2500);
    await ask();
    if (action === "reset") {
      await click("Reset & delete session");
      await click("Start sample lecture");
    }
    if (action === "finish") await click("Finish lecture");
    if (action === "source")
      view.rerender(<App client={api.client} source={new SimulationTranscriptSource()} />);
    if (action === "unmount") view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve(captured);
    });
    expect(
      screen.queryByRole("region", { name: "Sample question answer" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  },
);

it("rejects an altered server reply without losing the transcript and supports retry", async () => {
  const api = setup();
  const original = api.client.lectureTools;
  vi.spyOn(api.client, "lectureTools").mockImplementationOnce(async (...args) => {
    const response = await original(...args);
    response.passages[0]!.citation.startMs = 99;
    return response;
  });
  render(<App {...api} />);
  await click("Start sample lecture");
  await advance(2500);
  await ask();
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load the lecture passages");
  expect(screen.getByRole("article", { name: "Lecture passage at 0:45" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Sample question answer" })).not.toBeInTheDocument();
  await ask();
  expect(screen.getByRole("region", { name: "Sample question answer" })).toHaveTextContent(
    "Through 2:25",
  );
});
