import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isReplayableTranscriptSource,
  SimulationTranscriptSource,
  simulationFixture,
  type TranscriptEvent,
} from "../src";

afterEach(() => {
  vi.useRealTimers();
});

async function replay(source: SimulationTranscriptSource): Promise<TranscriptEvent[]> {
  const events: TranscriptEvent[] = [];
  const unsubscribe = source.subscribe((event) => events.push(event));
  source.setSpeed(240);
  source.start();
  await vi.runAllTimersAsync();
  unsubscribe();
  return events;
}

describe("SimulationTranscriptSource", () => {
  it("emits the complete canonical event stream exactly and repeats it after reset", async () => {
    vi.useFakeTimers();
    const source = new SimulationTranscriptSource();

    const firstRun = await replay(source);
    expect(firstRun).toEqual(simulationFixture.events);
    expect(source.getSnapshot()).toMatchObject({
      mode: "simulation",
      status: "stopped",
      session: {
        sessionId: simulationFixture.session.sessionId,
        title: simulationFixture.session.title,
        subject: simulationFixture.session.subject,
      },
      progress: {
        current: simulationFixture.events.length,
        total: simulationFixture.events.length,
      },
      replay: { isPaused: false, speed: 240 },
    });

    source.reset();
    expect(source.getSnapshot()).toMatchObject({
      status: "idle",
      progress: { current: 0, total: simulationFixture.events.length },
      replay: { isPaused: false, speed: 240 },
    });
    const secondRun = await replay(source);
    expect(secondRun).toEqual(firstRun);
  });

  it("does not create duplicate replay timers when start is called repeatedly", async () => {
    vi.useFakeTimers();
    const source = new SimulationTranscriptSource();
    const events: TranscriptEvent[] = [];
    source.subscribe((event) => events.push(event));
    source.setSpeed(240);

    source.start();
    source.start();
    source.start();
    await vi.runAllTimersAsync();

    expect(events).toEqual(simulationFixture.events);
  });

  it("stops cleanly before the first scheduled replay event", async () => {
    vi.useFakeTimers();
    const source = new SimulationTranscriptSource();
    const events: TranscriptEvent[] = [];
    source.subscribe((event) => events.push(event));

    source.start();
    source.stop();
    await vi.runAllTimersAsync();

    expect(events).toEqual([
      expect.objectContaining({
        eventId: "event_control_stopped_000",
        sequence: 0,
        emittedAt: simulationFixture.session.startedAt,
        type: "source.state",
        status: "stopped",
      }),
    ]);
    expect(source.getSnapshot()).toMatchObject({
      status: "stopped",
      progress: { current: 0, total: simulationFixture.events.length },
    });
  });

  it("exposes replay controls while preserving the common transcript-source surface", async () => {
    vi.useFakeTimers();
    const source = new SimulationTranscriptSource();
    const events: TranscriptEvent[] = [];
    source.subscribe((event) => events.push(event));

    expect(isReplayableTranscriptSource(source)).toBe(true);
    source.setSpeed(12);
    source.start();
    await vi.advanceTimersByTimeAsync(0);
    source.pause();
    const pausedCount = events.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events).toHaveLength(pausedCount);
    expect(source.getSnapshot().replay).toEqual({ isPaused: true, speed: 12 });

    source.resume();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(events.length).toBeGreaterThan(pausedCount);
    source.stop();
    expect(source.getSnapshot()).toMatchObject({
      status: "stopped",
      replay: { isPaused: false, speed: 12 },
    });
    expect(events.at(-1)).toMatchObject({ type: "source.state", status: "stopped" });
  });
});
