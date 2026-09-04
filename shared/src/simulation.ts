import fixtureJson from "../fixtures/calculus-lecture.json";

import { SimulationFixtureSchema, type SimulationFixture } from "./schemas/fixture";
import {
  TranscriptEventSchema,
  type SourceMode,
  type SourceStatus,
  type TranscriptChunk,
  type TranscriptEvent,
} from "./schemas/transcript";

export const simulationFixture: SimulationFixture = SimulationFixtureSchema.parse(fixtureJson);

export interface TranscriptSourceSnapshot {
  mode: SourceMode;
  status: SourceStatus;
  session: {
    sessionId: string;
    title?: string;
    subject?: string;
  };
  progress?: {
    current: number;
    total: number;
  };
}

export interface TranscriptSource {
  subscribe(listener: (event: TranscriptEvent) => void): () => void;
  start(): void;
  stop(): void;
  getSnapshot(): TranscriptSourceSnapshot;
}

export interface ReplayTranscriptSourceSnapshot extends TranscriptSourceSnapshot {
  mode: "simulation";
  replay: {
    isPaused: boolean;
    speed: number;
  };
}

export interface ReplayableTranscriptSource extends TranscriptSource {
  readonly replayControls: true;
  pause(): void;
  resume(): void;
  reset(): void;
  setSpeed(speed: number): void;
  getSnapshot(): ReplayTranscriptSourceSnapshot;
}

export function isReplayableTranscriptSource(
  source: TranscriptSource,
): source is ReplayableTranscriptSource {
  return "replayControls" in source && source.replayControls === true;
}

export class SimulationTranscriptSource implements ReplayableTranscriptSource {
  readonly replayControls = true as const;
  private readonly listeners = new Set<(event: TranscriptEvent) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cursor = 0;
  private status: SourceStatus = "idle";
  private isPaused = false;
  private speed = 60;

  constructor(private readonly fixture: SimulationFixture = simulationFixture) {}

  subscribe(listener: (event: TranscriptEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.status === "starting" || this.status === "active" || this.timer !== undefined) return;
    if (this.cursor >= this.fixture.events.length || this.status === "stopped") this.reset();

    this.status = "starting";
    this.isPaused = false;
    this.scheduleNext();
  }

  stop(): void {
    if (this.status === "idle" || this.status === "stopped") return;
    this.clearTimer();
    this.isPaused = false;
    this.status = "stopped";
    this.emitControlState("stopped");
  }

  pause(): void {
    if (this.status !== "active" || this.isPaused) return;
    this.clearTimer();
    this.isPaused = true;
  }

  resume(): void {
    if (this.status !== "active" || !this.isPaused) return;
    this.isPaused = false;
    this.scheduleNext();
  }

  reset(): void {
    this.clearTimer();
    this.cursor = 0;
    this.status = "idle";
    this.isPaused = false;
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0 || speed > 240) {
      throw new Error("Simulation speed must be greater than zero and at most 240");
    }
    this.speed = speed;
    if (this.status === "active" && !this.isPaused) {
      this.clearTimer();
      this.scheduleNext();
    }
  }

  getSnapshot(): ReplayTranscriptSourceSnapshot {
    return {
      mode: "simulation",
      status: this.status,
      session: {
        sessionId: this.fixture.session.sessionId,
        title: this.fixture.session.title,
        subject: this.fixture.session.subject,
      },
      progress: {
        current: this.cursor,
        total: this.fixture.events.length,
      },
      replay: {
        isPaused: this.isPaused,
        speed: this.speed,
      },
    };
  }

  private scheduleNext(): void {
    if (this.timer !== undefined) return;
    const event = this.fixture.events[this.cursor];
    if (!event) {
      this.status = "stopped";
      return;
    }

    const previousEvent = this.fixture.events[this.cursor - 1];
    const delayMs = previousEvent
      ? Math.max(0, Date.parse(event.emittedAt) - Date.parse(previousEvent.emittedAt)) / this.speed
      : 0;

    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.isPaused || this.status === "stopped") return;

      const validatedEvent = TranscriptEventSchema.parse(event);
      this.status = this.statusFromEvent(validatedEvent);
      this.cursor += 1;
      this.emit(validatedEvent);
      this.scheduleNext();
    }, delayMs);
  }

  private emitControlState(status: SourceStatus): void {
    const previousEvent = this.cursor > 0 ? this.fixture.events[this.cursor - 1] : undefined;
    const event = TranscriptEventSchema.parse({
      schemaVersion: 1,
      eventId: `event_control_${status}_${String(this.cursor).padStart(3, "0")}`,
      sessionId: this.fixture.session.sessionId,
      sequence: previousEvent ? previousEvent.sequence + 1 : 0,
      emittedAt: previousEvent?.emittedAt ?? this.fixture.session.startedAt,
      type: "source.state",
      sourceMode: "simulation",
      status,
    });
    this.emit(event);
  }

  private emit(event: TranscriptEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private statusFromEvent(event: TranscriptEvent): SourceStatus {
    if (event.type === "source.state") return event.status;
    if (event.type === "source.error") return "error";
    if (event.type === "session.ended") return "stopping";
    return "active";
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

export function getCommittedChunksFromFixture(
  fixture: SimulationFixture = simulationFixture,
): TranscriptChunk[] {
  return fixture.events
    .filter(
      (event): event is Extract<TranscriptEvent, { type: "transcript.committed" }> =>
        event.type === "transcript.committed",
    )
    .map((event) => structuredClone(event.chunk));
}

export function formatOffset(offsetMs: number): string {
  const totalSeconds = Math.floor(offsetMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
