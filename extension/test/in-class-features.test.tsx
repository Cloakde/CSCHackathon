// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimulationTranscriptSource } from "@livelecture/shared";
import { App } from "../src/App";
import { createDemoClient, DEMO_ORIGIN, type DemoFetch } from "../src/demo-api";

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

describe("in-class live assistant features", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function setup() {
    const transport = vi.fn<DemoFetch>(async (url) => {
      if (url === `${DEMO_ORIGIN}/api/sessions`) {
        return ok({
          session: {
            sessionId: "session_test_inclass",
            sourceMode: "simulation",
            status: "active",
            startedAt: "2026-09-04T10:30:00.000Z",
          },
        });
      }
      if (url.endsWith("/chunks")) {
        return ok({ acceptedChunkIds: ["chunk_calc_001", "chunk_calc_002", "chunk_calc_004"] });
      }
      return ok({});
    });
    const client = createDemoClient(transport);
    const source = new SimulationTranscriptSource();
    source.setSpeed(60);
    return { client, source };
  }

  it("handles Ask the Lecture with in-scope question and clickable citation", async () => {
    const { client, source } = setup();
    render(<App source={source} client={client} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start sample lecture" }));
    });

    // Open Ask panel
    const askButton = screen.getByRole("button", { name: "Ask the Lecture" });
    fireEvent.click(askButton);

    const input = screen.getByPlaceholderText(/Why did the inequality flip/i);
    expect(input).toBeVisible();

    // Ask in-scope question
    fireEvent.change(input, { target: { value: "Why did the inequality sign flip?" } });
    const submitBtn = screen.getByRole("button", { name: "Ask" });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/divided both sides by a negative number/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /Go to citation at 10:41:23/i })).toBeVisible();
  });

  it("handles Ask the Lecture with out-of-scope question gracefully", async () => {
    const { client, source } = setup();
    render(<App source={source} client={client} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start sample lecture" }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Ask the Lecture" }));
    const input = screen.getByPlaceholderText(/Why did the inequality flip/i);

    fireEvent.change(input, { target: { value: "What is the capital of France?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByText("This wasn't discussed in today's lecture.")).toBeVisible();
  });

  it("provides Catch Me Up rolling summaries and bookmarks when speech arrives", async () => {
    vi.useFakeTimers();
    const { client, source } = setup();
    render(<App source={source} client={client} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start sample lecture" }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Catch Me Up button is now enabled
    const catchUpBtn = screen.getByRole("button", { name: "Catch Me Up (2m)" });
    expect(catchUpBtn).not.toBeDisabled();
    fireEvent.click(catchUpBtn);

    expect(screen.getByText(/Last 2 minutes summary/i)).toBeVisible();

    // Bookmark buttons are now rendered on the chunks
    const bookmarkBtns = screen.getAllByTitle("Bookmark moment");
    expect(bookmarkBtns.length).toBeGreaterThan(0);

    fireEvent.click(bookmarkBtns[0]!);
    expect(screen.getByRole("region", { name: "Saved Bookmarks" })).toBeVisible();
  });
});
