// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  getCommittedChunksFromFixture,
  SimulationTranscriptSource,
  type WeakAreaDrillResponse,
} from "@livelecture/shared";
import { App } from "../../../extension/src/App";
import { createDemoClient } from "../../../extension/src/demo-api";
import { createDemoDispatcher, DEMO_ORIGIN } from "../server/demo-api";
import { createStudyClient } from "../lib/client/study-client";
import { SessionReview } from "./SessionReview";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup() {
  const dispatch = createDemoDispatcher({
    enabled: true,
    now: () => Date.parse("2026-09-04T18:00:00.000Z"),
  });
  const fetcher: typeof fetch = async (input, options) => {
    const headers = new Headers(options?.headers);
    headers.set("Host", "127.0.0.1:3000");
    headers.set("Origin", DEMO_ORIGIN);
    const url = new URL(String(input), DEMO_ORIGIN);
    return dispatch(new Request(url, { ...options, headers }));
  };
  return { fetcher, lecture: createDemoClient(fetcher), study: createStudyClient(fetcher) };
}
async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function completedSession() {
  const api = setup();
  const session = await api.lecture.start({ sourceMode: "simulation" });
  const chunks = getCommittedChunksFromFixture().map((chunk) => ({
    ...chunk,
    sessionId: session.sessionId,
  }));
  await api.lecture.append(session.sessionId, { chunks: chunks.slice(0, 3) });
  const first = await api.lecture.help(session.sessionId);
  await api.lecture.append(session.sessionId, { chunks });
  const second = await api.lecture.help(session.sessionId);
  await api.lecture.end(
    session.sessionId,
    new Date(Date.parse(session.startedAt) + chunks.at(-1)!.endMs).toISOString(),
  );
  return { ...api, session, first, second };
}

it("runs the actual lecture component through the actual API into two distinct companion exercises", async () => {
  // jsdom has no layout/scrolling; focus and evidence identity are still checked below.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External requests are forbidden"));
  vi.useFakeTimers();
  const api = setup();
  const source = new SimulationTranscriptSource();
  source.setSpeed(60);
  const navigate = vi.fn();
  const lecture = render(<App source={source} client={api.lecture} navigate={navigate} />);
  await click("Start sample lecture");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2500);
  });
  await click("I’m Lost");
  expect(
    screen.getByRole("heading", { name: "Identifying inner and outer functions" }),
  ).toBeVisible();
  await click("Go to 0:45–1:30");
  expect(screen.getByRole("article", { name: "Lecture passage at 0:45" })).toHaveFocus();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  await click("I’m Lost");
  expect(screen.getByRole("heading", { name: "Remembering the inner derivative" })).toBeVisible();
  await click("Finish lecture");
  const handoff = screen.getByRole("link", { name: "Open my practice" });
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(handoff);
  expect(navigate).toHaveBeenCalledTimes(1);
  const target = new URL(navigate.mock.calls[0]![0] as string);
  expect(target.origin).toBe(DEMO_ORIGIN);
  expect(target.search).toBe("");
  const id = target.pathname.split("/").at(-1)!;
  const view = await api.study.getSession(id);
  expect(view.confusionEvents.map((event) => event.conceptId)).toEqual([
    "concept_inner_outer",
    "concept_inner_derivative",
  ]);
  lecture.unmount();
  vi.useRealTimers();
  render(<SessionReview sessionId={id} client={api.study} />);
  await screen.findByRole("radio", { name: /Identifying inner and outer functions/ });
  await click("Practice this topic");
  expect(screen.getByText(/Do not differentiate yet/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Your attempt"), {
    target: { value: "The inside is 2x + 3 and the outside is fourth power." },
  });
  await click("Show answer and explanation");
  expect(screen.getByText("g(x) = 2x + 3; f(u) = u⁴")).toBeVisible();
  await click("Lecture at 0:45");
  expect(document.getElementById("review-chunk_calc_002")).toHaveFocus();
  fireEvent.click(screen.getByRole("radio", { name: /Remembering the inner derivative/ }));
  await click("Practice this topic");
  expect(screen.getByText(/What factor is missing/)).toBeVisible();
  expect(screen.getByLabelText("Your attempt")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Your attempt"), { target: { value: "Multiply by 2." } });
  await click("Show answer and explanation");
  expect(screen.getByText("The missing factor is 2. The derivative is 8(2x + 3)³.")).toBeVisible();
  await click("Delete this sample session");
  expect(screen.getByRole("status")).toHaveTextContent("Sample session deleted");
  await expect(api.study.getSession(id)).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("ignores a late exercise after a different confusion moment is selected", async () => {
  const api = await completedSession();
  const first = await api.study.createDrill(
    api.session.sessionId,
    api.first.confusionEvent.confusionId,
  );
  const pending = deferred<WeakAreaDrillResponse>();
  const client = {
    ...api.study,
    createDrill: vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(api.study.createDrill),
  };
  render(<SessionReview sessionId={api.session.sessionId} client={client} />);
  await screen.findByRole("radio", { name: /Identifying inner and outer functions/ });
  await click("Practice this topic");
  fireEvent.click(screen.getByRole("radio", { name: /Remembering the inner derivative/ }));
  await act(async () => {
    pending.resolve(first);
  });
  expect(screen.queryByText(/Do not differentiate yet/)).not.toBeInTheDocument();
  await click("Practice this topic");
  expect(screen.getByText(/What factor is missing/)).toBeVisible();
});

it("deletion cannot be undone by a pending exercise response", async () => {
  const api = await completedSession();
  const drill = await api.study.createDrill(
    api.session.sessionId,
    api.first.confusionEvent.confusionId,
  );
  const pending = deferred<WeakAreaDrillResponse>();
  const client = { ...api.study, createDrill: () => pending.promise };
  render(<SessionReview sessionId={api.session.sessionId} client={client} />);
  await screen.findByRole("radio", { name: /Identifying inner and outer functions/ });
  await click("Practice this topic");
  await click("Delete this sample session");
  await act(async () => {
    pending.resolve(drill);
  });
  expect(screen.getByRole("status")).toHaveTextContent("Sample session deleted");
  expect(screen.queryByLabelText("Your attempt")).not.toBeInTheDocument();
});

it("rejects practice from a different stored moment", async () => {
  const api = await completedSession();
  const wrongDrill = await api.study.createDrill(
    api.session.sessionId,
    api.second.confusionEvent.confusionId,
  );
  render(
    <SessionReview
      sessionId={api.session.sessionId}
      client={{ ...api.study, createDrill: async () => wrongDrill }}
    />,
  );
  await screen.findByRole("radio", { name: /Identifying inner and outer functions/ });
  await click("Practice this topic");
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.queryByLabelText("Your attempt")).not.toBeInTheDocument();
});

it("rejects a structurally valid session returned for a different requested ID", async () => {
  const api = await completedSession();
  const view = await api.study.getSession(api.session.sessionId);
  const client = createStudyClient(async () => Response.json({ ok: true, data: view }));
  await expect(client.getSession("session_other")).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});

it("lets the user retry after a stalled companion request times out", async () => {
  vi.useFakeTimers();
  const client = createStudyClient(
    (_input, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      }),
  );
  render(<SessionReview sessionId="session_stalled" client={client} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12_000);
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Could not reach or verify");
  expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
});

it("keeps the session visible when deletion fails", async () => {
  const api = await completedSession();
  const client = {
    ...api.study,
    deleteSession: async () => {
      throw new Error("offline");
    },
  };
  render(<SessionReview sessionId={api.session.sessionId} client={client} />);
  await screen.findByRole("radio", { name: /Identifying inner and outer functions/ });
  await click("Delete this sample session");
  expect(screen.getByRole("alert")).toBeVisible();
  expect(
    screen.getByRole("radio", { name: /Identifying inner and outer functions/ }),
  ).toBeVisible();
  expect(screen.queryByText(/Sample session deleted/)).not.toBeInTheDocument();
});
