import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiContracts,
  getCommittedChunksFromFixture,
  ImLostResponseSchema,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  SimulationTranscriptSource,
  type ActiveLectureSession,
  type ImLostResponse,
  type TranscriptChunk,
} from "@livelecture/shared";
import { App } from "../src/App";
import { createDemoClient, DEMO_ORIGIN, type DemoFetch } from "../src/demo-api";
import { MELTINGPOT_ORIGIN } from "../src/demo-handoff";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const canonical = getCommittedChunksFromFixture();
const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
const unavailable = () =>
  new Response(
    JSON.stringify({
      ok: false,
      error: { code: "PROVIDER_UNAVAILABLE", message: "test", retryable: true },
    }),
    { status: 503 },
  );

/** Test transport only; actual grounding and practice are exercised by server tests. */
function harness() {
  let counter = 0;
  let helpCounter = 0;
  let session: ActiveLectureSession;
  let uploaded: TranscriptChunk[] = [];
  const calls: { url: string; options: RequestInit; body: unknown }[] = [];
  const transport = vi.fn<DemoFetch>(async (url, options) => {
    const body: unknown = options.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({ url, options, body });
    if (url === `${DEMO_ORIGIN}/api/sessions`) {
      const input = ApiContracts.startSession.request.parse(body);
      session = {
        ...input,
        sourceMode: "simulation",
        status: "active",
        sessionId: `session_demo_${++counter}`,
        startedAt: "2026-09-05T08:00:00.000Z",
      };
      uploaded = [];
      return ok({ session });
    }
    if (options.method === "DELETE") return ok({ deleted: true });
    if (url.endsWith("/chunks")) {
      const input = ApiContracts.appendCommittedChunks.request.parse(body);
      expect(input.chunks.every((chunk) => chunk.sessionId === session.sessionId)).toBe(true);
      for (const chunk of input.chunks) {
        const original = canonical.find((candidate) => candidate.chunkId === chunk.chunkId);
        expect(chunk).toEqual({ ...original, sessionId: session.sessionId });
        if (!uploaded.some((existing) => existing.chunkId === chunk.chunkId)) uploaded.push(chunk);
      }
      expect(uploaded.map((chunk) => chunk.sequence)).toEqual(
        [...uploaded.map((chunk) => chunk.sequence)].sort((a, b) => a - b),
      );
      return ok({ acceptedChunkIds: input.chunks.map((chunk) => chunk.chunkId) });
    }
    if (url.endsWith("/im-lost")) {
      const last = uploaded.at(-1);
      const innerDerivative = (last?.endMs ?? 0) >= 300_000;
      const evidence = uploaded.length > 1 ? uploaded[innerDerivative ? 3 : 1] : undefined;
      const responseId = `response_test_${++helpCounter}`;
      const event = {
        confusionId: `confusion_test_${helpCounter}`,
        sessionId: session.sessionId,
        occurredAtMs: last?.endMs ?? 0,
        trigger: "im_lost",
        anchorChunkId: last?.chunkId,
        contextChunkIds: uploaded.map((chunk) => chunk.chunkId),
        evidenceChunkIds: evidence ? [evidence.chunkId] : [],
        assistanceResponseId: responseId,
        ...(evidence
          ? {
              conceptId: innerDerivative ? "concept_inner_derivative" : "concept_inner_outer",
              conceptTitle: innerDerivative ? "Inner derivative" : "Inner and outer functions",
            }
          : {}),
      };
      const response = ImLostResponseSchema.parse({
        sessionId: session.sessionId,
        responseId,
        confusionEvent: event,
        followUpActions: ["ask_follow_up"],
        ...(evidence
          ? {
              groundingStatus: "grounded",
              diagnosis: {
                whatJustHappened: "A chain rule step.",
                mainIdea: "Apply the correct step.",
                simpleExplanation: innerDerivative
                  ? "Multiply by the derivative of the inside."
                  : "The inside acts first; the outside acts on that result.",
                importantPrerequisite: "A derivative measures change.",
              },
              citations: [
                { chunkId: evidence.chunkId, startMs: evidence.startMs, endMs: evidence.endMs },
              ],
            }
          : {
              groundingStatus: "insufficient_evidence",
              message: INSUFFICIENT_EVIDENCE_MESSAGE,
              citations: [],
            }),
      });
      return ok(response);
    }
    if (url.endsWith("/end")) {
      const input = ApiContracts.endSession.request.parse(body);
      return ok({
        session: { ...session, ...input, status: "completed" },
        handoff: { sessionId: session.sessionId, companionRoute: `/sessions/${session.sessionId}` },
      });
    }
    throw new Error(`Unexpected test request ${url}`);
  });
  const client = createDemoClient(transport);
  const source = new SimulationTranscriptSource();
  source.setSpeed(60);
  return { client, source, transport, calls, getUploaded: () => uploaded };
}

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}
async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}
async function start(h: ReturnType<typeof harness>, milliseconds = 2500) {
  render(<App source={h.source} client={h.client} />);
  await click("Start sample lecture");
  await advance(milliseconds);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("local learning demo", () => {
  it("keeps the MeltingPot reopening link after Finish without probing or silently changing destinations", async () => {
    vi.useFakeTimers();
    const h = harness();
    const navigate = vi.fn();
    render(
      <App
        source={h.source}
        client={h.client}
        companionDestination="meltingpot"
        navigate={navigate}
      />,
    );
    await click("Start sample lecture");
    await advance(2500);
    await click("I’m Lost");
    await click("Finish lecture");
    expect(navigate).not.toHaveBeenCalled();
    const link = screen.getByRole("link", { name: "Open in MeltingPot" });
    const expected = `${MELTINGPOT_ORIGIN}/lectures/session_demo_1`;
    expect(link).toHaveAttribute("href", expected);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/If it is unavailable/)).toHaveTextContent(
      "start the MeltingPot rework app and use this link again",
    );
    expect(screen.queryByRole("link", { name: "Open my practice" })).not.toBeInTheDocument();
    // Opening a tab does not acknowledge availability. It must not clear or replace the link.
    fireEvent.click(link);
    fireEvent.click(link);
    await click("Finish lecture");
    expect(navigate.mock.calls).toEqual([[expected], [expected]]);
    expect(screen.getByRole("link", { name: "Open in MeltingPot" })).toHaveAttribute(
      "href",
      expected,
    );
    expect(h.calls.filter((call) => call.url.endsWith("/end"))).toHaveLength(1);
    expect(h.calls.every((call) => call.url.startsWith(`${DEMO_ORIGIN}/api/sessions`))).toBe(true);
    expect(screen.getByText(/Saved for practice:/)).toHaveTextContent("Inner and outer functions");
  });

  it("ignores a late Finish after reset and opens only the new MeltingPot session", async () => {
    vi.useFakeTimers();
    const h = harness();
    const finish = h.client.end;
    const pending = deferred<void>();
    const endSpy = vi.spyOn(h.client, "end").mockImplementationOnce(async (...args) => {
      const result = await finish(...args);
      await pending.promise;
      return result;
    });
    render(<App source={h.source} client={h.client} companionDestination="meltingpot" />);
    await click("Start sample lecture");
    await advance(2500);
    await click("Finish lecture");
    await click("Finishing…");
    expect(endSpy).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: "Open in MeltingPot" })).not.toBeInTheDocument();
    await click("Reset & delete session");
    expect(endSpy.mock.calls[0]?.[2]?.aborted).toBe(true);
    await click("Start sample lecture");
    await advance(2500);
    await act(async () => pending.resolve());
    expect(screen.queryByRole("link", { name: "Open in MeltingPot" })).not.toBeInTheDocument();
    await click("Finish lecture");
    expect(screen.getByRole("link", { name: "Open in MeltingPot" })).toHaveAttribute(
      "href",
      `${MELTINGPOT_ORIGIN}/lectures/session_demo_2`,
    );
    await click("Reset & delete session");
    expect(screen.queryByRole("link", { name: "Open in MeltingPot" })).not.toBeInTheDocument();
    expect(screen.getByText("Sample lecture · 0 passages")).toBeVisible();
  });

  it("rejects a foreign completed session and retries Finish without losing the lecture", async () => {
    vi.useFakeTimers();
    const h = harness();
    const finish = h.client.end;
    vi.spyOn(h.client, "end").mockImplementationOnce(async (...args) => {
      const result = await finish(...args);
      return {
        session: { ...result.session, sessionId: "session_other_1" },
        handoff: { sessionId: "session_other_1", companionRoute: "/sessions/session_other_1" },
      };
    });
    render(<App source={h.source} client={h.client} companionDestination="meltingpot" />);
    await click("Start sample lecture");
    await advance(2500);
    await click("Finish lecture");
    expect(screen.getByRole("alert")).toHaveTextContent("did not match this sample session");
    expect(screen.queryByRole("link", { name: "Open in MeltingPot" })).not.toBeInTheDocument();
    expect(screen.getByText("Sample lecture · 3 passages")).toBeVisible();
    await click("Try again");
    expect(screen.getByRole("link", { name: "Open in MeltingPot" })).toHaveAttribute(
      "href",
      `${MELTINGPOT_ORIGIN}/lectures/session_demo_1`,
    );
  });

  it("keeps the explicitly selected prototype handoff available", async () => {
    vi.useFakeTimers();
    const h = harness();
    render(<App source={h.source} client={h.client} companionDestination="prototype" />);
    await click("Start sample lecture");
    await click("Finish lecture");
    expect(screen.getByRole("link", { name: "Open my practice" })).toHaveAttribute(
      "href",
      `${DEMO_ORIGIN}/sessions/session_demo_1`,
    );
    expect(screen.queryByRole("link", { name: "Open in MeltingPot" })).not.toBeInTheDocument();
  });

  it("connects two different help moments to citations and a deliberate companion handoff", async () => {
    vi.useFakeTimers();
    const h = harness();
    const navigate = vi.fn();
    render(<App source={h.source} client={h.client} navigate={navigate} />);
    expect(screen.getByText("PREWRITTEN DEMO HELP")).toBeVisible();
    expect(screen.getByLabelText("SIMULATION source disclosure")).toHaveTextContent(
      "no audio is being captured",
    );
    await click("Start sample lecture");
    await advance(2500);
    await click("I’m Lost");
    expect(screen.getByRole("heading", { name: "Inner and outer functions" })).toBeVisible();
    expect(h.calls.map((call) => call.url.split("/").at(-1))).toEqual([
      "sessions",
      "chunks",
      "im-lost",
    ]);
    await click("Go to 0:45–1:30");
    const passage = screen.getByRole("article", { name: "Lecture passage at 0:45" });
    expect(passage).toHaveClass("citation-highlight");
    expect(passage).toHaveFocus();
    await advance(3000);
    expect(passage).toHaveClass("citation-highlight");
    await click("I’m Lost");
    expect(screen.getByRole("heading", { name: "Inner derivative" })).toBeVisible();
    expect(screen.getByText(/Saved for practice:/)).toHaveTextContent(
      "Inner and outer functions · Inner derivative",
    );
    await click("Finish lecture");
    expect(screen.getByRole("link", { name: "Open my practice" })).toHaveAttribute(
      "href",
      `${DEMO_ORIGIN}/sessions/session_demo_1`,
    );
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Open my practice" }));
    expect(navigate).toHaveBeenCalledWith(`${DEMO_ORIGIN}/sessions/session_demo_1`);
    const ended = h.calls.find((call) => call.url.endsWith("/end"));
    // Replay stopped during the 5:18 partial passage; only the committed 5:00 counts.
    expect(ended?.body).toEqual({ endedAt: "2026-09-05T08:05:00.000Z" });
    for (const call of h.calls) {
      expect(call.options.headers).toEqual({
        "Content-Type": "application/json",
        "X-LiveLecture-Demo": "scripted-v1",
      });
      expect(call.options.credentials).toBe("omit");
      expect(call.options.redirect).toBe("error");
    }
  });

  it("leaves help and finishing available after the replay reaches its end", async () => {
    vi.useFakeTimers();
    const h = harness();
    await start(h, 9000);
    expect(screen.getByText("Sample lecture · 10 passages")).toBeVisible();
    expect(screen.getByRole("button", { name: "I’m Lost" })).toBeEnabled();
    expect(h.calls.some((call) => call.url.endsWith("/end"))).toBe(false);
    await click("I’m Lost");
    await click("Finish lecture");
    expect(h.calls.find((call) => call.url.endsWith("/end"))?.body).toEqual({
      endedAt: "2026-09-05T08:08:00.000Z",
    });
  });

  it("wires pause, resume, speed, Stop and reduced-motion scrolling without losing saved help", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const h = harness();
    await start(h);
    expect(scroll).toHaveBeenCalledWith({ behavior: "auto", block: "nearest" });
    await click("Pause");
    expect(h.source.getSnapshot().replay.isPaused).toBe(true);
    const passageCount = screen.getAllByRole("article").length;
    await advance(5000);
    expect(screen.getAllByRole("article")).toHaveLength(passageCount);
    await click("Resume");
    fireEvent.change(screen.getByRole("combobox", { name: "Speed" }), { target: { value: "12" } });
    expect(h.source.getSnapshot().replay.speed).toBe(12);
    await click("I’m Lost");
    await click("Stop replay");
    expect(screen.getByRole("heading", { name: "Inner and outer functions" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Finish lecture" })).toBeEnabled();
  });

  it("reports insufficient evidence honestly before enough lecture has played", async () => {
    vi.useFakeTimers();
    const h = harness();
    await start(h, 0);
    await click("I’m Lost");
    expect(screen.getByText(/I could not verify an explanation/)).toBeVisible();
    expect(screen.queryByText(/Saved for practice:/)).not.toBeInTheDocument();
    await advance(2500);
    await click("I’m Lost");
    expect(screen.getByRole("heading", { name: "Inner and outer functions" })).toBeVisible();
  });

  it("does not start replay or duplicate sessions when Start is delayed", async () => {
    const h = harness();
    const pending = deferred<ActiveLectureSession>();
    const startSpy = vi.spyOn(h.client, "start").mockReturnValue(pending.promise);
    const sourceStart = vi.spyOn(h.source, "start");
    render(<App source={h.source} client={h.client} />);
    await click("Start sample lecture");
    await click("Starting…");
    expect(startSpy).toHaveBeenCalledOnce();
    expect(sourceStart).not.toHaveBeenCalled();
    await click("Reset & delete session");
    await act(async () => {
      pending.resolve({
        sessionId: "session_cancelled_1",
        sourceMode: "simulation",
        status: "active",
        startedAt: "2026-09-05T08:00:00.000Z",
      });
    });
    expect(sourceStart).not.toHaveBeenCalled();
    expect(
      h.calls.some(
        (call) => call.options.method === "DELETE" && call.url.endsWith("session_cancelled_1"),
      ),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Start sample lecture" })).toBeEnabled();
  });

  it("discards a help answer that completes after Reset and uses a fresh session", async () => {
    vi.useFakeTimers();
    const h = harness();
    await start(h);
    await click("I’m Lost");
    const oldAnswer = ImLostResponseSchema.parse(
      await (
        await h.transport(`${DEMO_ORIGIN}/api/sessions/session_demo_1/im-lost`, { method: "POST" })
      )
        .json()
        .then((body) => body.data),
    );
    const pending = deferred<ImLostResponse>();
    vi.spyOn(h.client, "help").mockReturnValueOnce(pending.promise);
    await click("I’m Lost");
    await click("Reset & delete session");
    await act(async () => {
      pending.resolve(oldAnswer);
    });
    expect(
      screen.queryByRole("heading", { name: "Inner and outer functions" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Sample lecture · 0 passages")).toBeVisible();
    await click("Start sample lecture");
    await advance(2500);
    await click("I’m Lost");
    expect(h.getUploaded()[0]?.sessionId).toBe("session_demo_2");
  });

  it("stops playback and ignores asynchronous Help after unmount", async () => {
    vi.useFakeTimers();
    const h = harness();
    const view = render(<App source={h.source} client={h.client} />);
    await click("Start sample lecture");
    await advance(2500);
    const pending = deferred<ImLostResponse>();
    const helpSpy = vi.spyOn(h.client, "help").mockReturnValue(pending.promise);
    await click("I’m Lost");
    const signal = helpSpy.mock.calls[0]?.[1];
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(h.source.getSnapshot().status).toBe("stopped");
  });

  it("shows retry for unavailable service and preserves committed passages", async () => {
    vi.useFakeTimers();
    const h = harness();
    h.transport.mockRejectedValueOnce(new Error("offline"));
    render(<App source={h.source} client={h.client} />);
    await click("Start sample lecture");
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot reach the local demo");
    await click("Try again");
    await advance(2500);
    h.transport.mockResolvedValueOnce(unavailable());
    await click("I’m Lost");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByText("Sample lecture · 3 passages")).toBeVisible();
    await click("Try again");
    expect(screen.getByRole("heading", { name: "Inner and outer functions" })).toBeVisible();
  });

  it("rejects an otherwise well-formed citation whose timestamp does not match the passage", async () => {
    vi.useFakeTimers();
    const h = harness();
    await start(h);
    const originalHelp = h.client.help;
    vi.spyOn(h.client, "help").mockImplementation(async (...args) => {
      const answer = await originalHelp(...args);
      if (answer.groundingStatus === "grounded") answer.citations[0]!.startMs += 1;
      return answer;
    });
    await click("I’m Lost");
    expect(screen.getByRole("alert")).toHaveTextContent("did not match the lecture passage");
    expect(screen.queryByRole("button", { name: /Go to/ })).not.toBeInTheDocument();
  });

  it("does not claim reset succeeded when deletion fails and allows retry", async () => {
    vi.useFakeTimers();
    const h = harness();
    await start(h);
    h.transport.mockResolvedValueOnce(unavailable());
    await click("Reset & delete session");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByText("Sample lecture · 3 passages")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start sample lecture" })).toBeDisabled();
    await click("Try again");
    expect(screen.getByText("Sample lecture · 0 passages")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start sample lecture" })).toBeEnabled();
  });

  it("flushes new passages that arrive during an upload before asking for help", async () => {
    vi.useFakeTimers();
    const h = harness();
    await start(h, 1500);
    const pending = deferred<{ acceptedChunkIds: string[] }>();
    const append = h.client.append;
    vi.spyOn(h.client, "append").mockImplementationOnce(async (...args) => {
      const result = await append(...args);
      await pending.promise;
      return result;
    });
    await click("I’m Lost");
    await advance(1500);
    await act(async () => {
      pending.resolve({ acceptedChunkIds: [] });
    });
    const paths = h.calls.map((call) => call.url.split("/").at(-1));
    expect(paths).toEqual(["sessions", "chunks", "chunks", "im-lost"]);
    expect(h.getUploaded()).toHaveLength(3);
  });
});
