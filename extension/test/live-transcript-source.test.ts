import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscriptEventSchema, type TranscriptEvent } from "@livelecture/shared";
import { LiveTranscriptSource } from "../src/live-transcript-source";
import { LIVE_CHANNEL } from "../src/live-protocol";
import type { CaptureStatusSnapshot } from "../src/capture-protocol";

afterEach(() => vi.useRealTimers());
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
function setup() {
  vi.useFakeTimers();
  let status: CaptureStatusSnapshot = { state: "awaiting_consent", generation: 4 };
  let captureListener: (value: CaptureStatusSnapshot) => void = () => undefined;
  const listeners = new Set<(raw: unknown) => void>();
  const capture = {
    getStatus: vi.fn(async () => status),
    subscribe: (listener: typeof captureListener) => {
      captureListener = listener;
      return () => {
        captureListener = () => undefined;
      };
    },
    consent: vi.fn(async () => ({ ...status, state: "armed" as const })),
    stop: vi.fn(async () => ({ state: "idle" as const, generation: 4 })),
  };
  const runtime = {
    sendMessage: vi.fn<(raw: unknown) => Promise<unknown>>(async () => ({ ok: true })),
    onMessage: {
      addListener: (f: (raw: unknown) => void) => listeners.add(f),
      removeListener: (f: (raw: unknown) => void) => listeners.delete(f),
    },
  };
  const source = new LiveTranscriptSource(capture, runtime);
  const events: TranscriptEvent[] = [];
  source.subscribe((event) => events.push(TranscriptEventSchema.parse(event)));
  source.prepare("session_live", "a".repeat(32));
  const update = (next: CaptureStatusSnapshot) => {
    status = next;
    captureListener(next);
  };
  const emit = (event: Record<string, unknown>, generation = 4) =>
    listeners.forEach((fn) =>
      fn({
        channel: LIVE_CHANNEL,
        kind: "event",
        generation,
        event: {
          schemaVersion: 1,
          eventId: "event_test",
          sequence: 0,
          emittedAt: "2026-09-15T00:00:00.000Z",
          sessionId: "session_live",
          ...event,
        },
      }),
    );
  return { source, events, capture, runtime, update, emit };
}
describe("bounded live source", () => {
  it("keeps the capture lease alive while waiting for media and stops if that lease fails", async () => {
    const h = setup();
    h.source.start();
    await tick();
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "lease_heartbeat", generation: 4 }),
    );
    expect(h.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "start" }),
    );
    h.runtime.sendMessage.mockResolvedValueOnce({ ok: false });
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.source.getSnapshot().status).toBe("error");
    expect(h.capture.stop).toHaveBeenCalledWith(4);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps capture alive for a retryable transport interruption", async () => {
    const h = setup();
    h.source.start();
    await tick();
    h.update({ state: "active", generation: 4 });
    await tick();
    h.emit({
      type: "source.error",
      sourceMode: "live",
      error: { code: "PROVIDER_UNAVAILABLE", message: "Reconnecting", retryable: true },
    });
    h.emit({ type: "source.state", sourceMode: "live", status: "starting" });
    expect(h.capture.stop).not.toHaveBeenCalled();
    h.emit({ type: "source.state", sourceMode: "live", status: "active" });
    expect(h.source.getSnapshot().status).toBe("active");
    h.source.stop();
  });
  it("requires consent, waits for capture, forwards only validated current-session events and stops both halves", async () => {
    const h = setup();
    h.source.start();
    await tick();
    expect(h.capture.consent).toHaveBeenCalledWith(4);
    expect(h.runtime.sendMessage).not.toHaveBeenCalled();
    h.update({ state: "active", generation: 4 });
    await tick();
    expect(h.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "start", sessionId: "session_live" }),
    );
    h.emit({ type: "source.state", sourceMode: "live", status: "active" });
    const chunk = {
      chunkId: "chunk_live",
      sessionId: "session_live",
      sequence: 0,
      startMs: 0,
      endMs: 1200,
      text: "A synthetic lecture sentence.",
    };
    h.emit({ type: "transcript.committed", chunk });
    h.emit({ type: "transcript.committed", chunk }, 3);
    h.emit({ type: "transcript.committed", chunk: { ...chunk, sessionId: "session_wrong" } });
    expect(h.events.filter((e) => e.type === "transcript.committed")).toHaveLength(1);
    expect(h.source.getSnapshot().status).toBe("active");
    expect(h.events.map((e) => e.sequence)).toEqual(h.events.map((_e, i) => i));
    h.source.stop();
    await tick();
    expect(h.capture.stop).toHaveBeenCalledWith(4);
    expect(h.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "stop" }));
    expect(h.source.getSnapshot().status).toBe("stopped");
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["capture", "transport", "changed_generation"])(
    "stops on %s failure without simulation fallback",
    async (failure) => {
      const h = setup();
      h.source.start();
      await tick();
      h.update({ state: "active", generation: 4 });
      await tick();
      if (failure === "capture") h.update({ state: "error", generation: 4 });
      else if (failure === "changed_generation") h.update({ state: "active", generation: 5 });
      else
        h.emit({
          type: "source.error",
          sourceMode: "live",
          error: { code: "PROVIDER_UNAVAILABLE", message: "Synthetic failure", retryable: false },
        });
      await tick();
      expect(h.capture.stop).toHaveBeenCalledWith(4);
      expect(h.source.getSnapshot()).toMatchObject({ mode: "live", status: "error" });
      expect(h.events.at(-1)?.type).toBe("source.error");
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("cancels a pending consent request and ignores late starts", async () => {
    const h = setup();
    let resolve!: (value: CaptureStatusSnapshot) => void;
    h.capture.getStatus.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    h.source.start();
    h.source.stop();
    resolve({ state: "awaiting_consent", generation: 4 });
    await tick();
    expect(h.capture.consent).not.toHaveBeenCalled();
    expect(h.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
