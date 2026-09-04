import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SimulationTranscriptSource,
  type TranscriptSource,
  type TranscriptSourceSnapshot,
} from "@livelecture/shared";

import { App } from "../src/App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

class LiveTranscriptSourceStub implements TranscriptSource {
  readonly start = vi.fn();
  readonly stop = vi.fn();

  subscribe(): () => void {
    return () => undefined;
  }

  getSnapshot(): TranscriptSourceSnapshot {
    return {
      mode: "live",
      status: "idle",
      session: {
        sessionId: "session_live_001",
        title: "Cell Biology Seminar",
        subject: "Biology",
      },
    };
  }
}

describe("simulation transcript UI", () => {
  it("labels the source honestly and renders deterministic committed chunks", async () => {
    vi.useFakeTimers();
    const source = new SimulationTranscriptSource();
    source.setSpeed(240);
    render(<App source={source} />);

    expect(screen.getAllByText("SIMULATION").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/no audio is being captured/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("SIMULATION · Idle");
    expect(screen.getByRole("log", { name: "Lecture transcript" })).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByRole("log", { name: "Lecture transcript" })).not.toHaveAttribute(
      "aria-busy",
    );

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/Before the chain rule, remember/)).toBeInTheDocument();
    expect(
      screen.getByText(/The multiplication combines the outside function/),
    ).toBeInTheDocument();
    expect(screen.getByText("10 chunks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled();
  });

  it("clears the transcript on reset", async () => {
    vi.useFakeTimers();
    const source = new SimulationTranscriptSource();
    render(<App source={source} />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText(/Start the deterministic replay/)).toBeInTheDocument();
    expect(screen.getByText("0 chunks")).toBeInTheDocument();
  });

  it("wires pause, resume, stop, and replay speed controls", async () => {
    vi.useFakeTimers();
    const source = new SimulationTranscriptSource();
    const pause = vi.spyOn(source, "pause");
    const resume = vi.spyOn(source, "resume");
    const stop = vi.spyOn(source, "stop");
    const setSpeed = vi.spyOn(source, "setSpeed");
    render(<App source={source} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Speed" }), {
      target: { value: "12" },
    });
    expect(setSpeed).toHaveBeenCalledWith(12);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(resume).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("SIMULATION · Stopped");
  });

  it("derives live metadata and hides replay-only controls for a generic source", () => {
    const source = new LiveTranscriptSourceStub();
    render(<App source={source} />);

    expect(screen.getByRole("heading", { name: "Cell Biology Seminar" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("LIVE · Idle");
    expect(screen.getByLabelText("LIVE source disclosure")).toHaveTextContent(
      "Selected-tab audio source",
    );
    expect(screen.getByText("Idle", { selector: ".session-summary strong" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Speed" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(source.start).toHaveBeenCalledOnce();
  });

  it("replaces the active source and resets source-specific UI state", async () => {
    vi.useFakeTimers();
    const simulationSource = new SimulationTranscriptSource();
    const liveSource = new LiveTranscriptSourceStub();
    const { rerender } = render(<App source={simulationSource} />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.queryByText("0 chunks")).not.toBeInTheDocument();

    rerender(<App source={liveSource} />);

    expect(screen.getByRole("heading", { name: "Cell Biology Seminar" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("LIVE · Idle");
    expect(screen.getByText("0 chunks")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  });

  it("uses non-animated transcript scrolling when reduced motion is requested", async () => {
    vi.useFakeTimers();
    const source = new SimulationTranscriptSource();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true } as MediaQueryList));
    render(<App source={source} />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: "auto", block: "nearest" });
  });
});
