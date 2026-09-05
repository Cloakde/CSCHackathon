import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SimulationTranscriptSource } from "@livelecture/shared";
import { App } from "../extension/src/App";
import { createDemoClient } from "../extension/src/demo-api";
import { createDemoDispatcher, DEMO_ORIGIN } from "../web/src/server/demo-api";
import { LectureReview } from "@meltingpot/components/lectures/lecture-review";
import { createLectureClient } from "@meltingpot/lib/lectures/client";
import { createLectureRelay } from "@meltingpot/lib/lectures/relay";
import type { ComponentProps } from "react";

// Next's router is outside this component/API test; retain actual anchor semantics.
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

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

it("connects the actual extension, lecture API, MeltingPot relay and review for two confusing concepts", async () => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External requests forbidden"));
  const dispatch = createDemoDispatcher({
    enabled: true,
    now: () => Date.parse("2026-09-04T18:00:00.000Z"),
  });
  const upstream: typeof fetch = async (input, options) => {
    const url = new URL(String(input), DEMO_ORIGIN);
    expect(url.origin).toBe(DEMO_ORIGIN);
    const headers = new Headers(options?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("Cookie")).toBe(false);
    headers.set("Host", "127.0.0.1:3000");
    return dispatch(new Request(url, { ...options, headers }));
  };
  const relay = createLectureRelay({ enabled: true, fetcher: upstream });
  const downstream: typeof fetch = async (input, options) => {
    const url = new URL(String(input), "http://127.0.0.1:3111");
    expect(url.origin).toBe("http://127.0.0.1:3111");
    const headers = new Headers(options?.headers);
    headers.set("Host", "127.0.0.1:3111");
    headers.set("Origin", url.origin);
    return relay(new Request(url, { ...options, headers }));
  };
  const lectureClient = createDemoClient(upstream);
  const reviewClient = createLectureClient(downstream);
  vi.useFakeTimers();
  const source = new SimulationTranscriptSource();
  source.setSpeed(60);
  const navigate = vi.fn();
  const lecture = render(
    <App
      source={source}
      client={lectureClient}
      navigate={navigate}
      companionDestination="meltingpot"
    />,
  );
  await click("Start sample lecture");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2500);
  });
  await click("I’m Lost");
  expect(
    screen.getByRole("heading", { name: "Identifying inner and outer functions" }),
  ).toBeVisible();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  await click("I’m Lost");
  expect(screen.getByRole("heading", { name: "Remembering the inner derivative" })).toBeVisible();
  await click("Finish lecture");
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link", { name: "Open in MeltingPot" }));
  const target = new URL(navigate.mock.calls[0]![0] as string);
  expect(target.origin).toBe("http://127.0.0.1:3111");
  expect(target.search).toBe("");
  expect(target.hash).toBe("");
  const id = target.pathname.split("/").at(-1)!;
  expect(target.pathname).toBe(`/lectures/${id}`);
  lecture.unmount();
  vi.useRealTimers();
  render(<LectureReview sessionId={id} client={reviewClient} />);
  await screen.findByRole("button", { name: /Practice Identifying inner and outer functions/ });
  await click(/Practice Identifying inner and outer functions/);
  expect(screen.getByText(/Do not differentiate yet/)).toBeVisible();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Inside 2x + 3; outside fourth power." },
  });
  await click("Show answer and explanation");
  expect(screen.getByText("g(x) = 2x + 3; f(u) = u⁴")).toBeVisible();
  await click("Read lecture passage at 0:45");
  expect(document.getElementById("passage-chunk_calc_002")).toHaveFocus();
  await click("Return to practice");
  expect(screen.getByLabelText("Your practice")).toHaveFocus();
  expect(screen.getByRole("textbox")).toHaveValue("Inside 2x + 3; outside fourth power.");
  await click(/Practice Remembering the inner derivative/);
  expect(screen.getByText(/What factor is missing/)).toBeVisible();
  expect(screen.getByRole("textbox")).toHaveValue("");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Multiply by 2." } });
  await click("Show answer and explanation");
  expect(screen.getByText("The missing factor is 2. The derivative is 8(2x + 3)³.")).toBeVisible();
  const view = await reviewClient.getSession(id);
  expect(view.confusionEvents.map((event) => event.conceptId)).toEqual([
    "concept_inner_outer",
    "concept_inner_derivative",
  ]);
  await click("Delete sample lecture");
  await click("Confirm deletion");
  expect(screen.getByRole("heading", { name: "Sample lecture deleted" })).toBeVisible();
  await expect(reviewClient.getSession(id)).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
