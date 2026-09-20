import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscriptEventSchema, type TranscriptEvent } from "@livelecture/shared";
import { createLiveOffscreen } from "../src/live-offscreen";
import { LiveTranscriptSource } from "../src/live-transcript-source";
import { LIVE_CHANNEL, LiveStoppedSchema } from "../src/live-protocol";
import type { CaptureRuntimeListener } from "../src/capture-client";
import type { CaptureStatusSnapshot } from "../src/capture-protocol";
import type { ScribeTransportOptions } from "../src/transcription/scribe-transport";

afterEach(() => vi.useRealTimers());
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

function setup(delivery: "notification" | "start" | "heartbeat" = "notification") {
  vi.useFakeTimers();
  let status: CaptureStatusSnapshot = { state: "awaiting_consent", generation: 4 };
  const listeners = new Set<CaptureRuntimeListener>();
  const captureListeners = new Set<(value: CaptureStatusSnapshot) => void>();
  let options!: ScribeTransportOptions;
  const transport = { chunk: vi.fn(() => true), stop: vi.fn(), isReady: () => true };
  const untap = vi.fn();
  const rawWarning = "RETENTION_ACTIVE: untrusted-provider-detail-secret";
  const update = (next: CaptureStatusSnapshot) => {
    status = next;
    for (const listener of captureListeners) listener(next);
  };
  const media = {
    get: () => ({ context: {} as AudioContext, source: {} as MediaStreamAudioSourceNode }),
    stop: vi.fn((generation: number) => {
      if (status.generation !== generation || status.state === "idle") return;
      bridge.stop();
      update({ state: "idle", generation });
    }),
  };
  const notify = vi.fn(
    (message: unknown): Promise<unknown> =>
      new Promise((resolve) => {
        if (delivery === "notification") {
          // Deliberately async, like delivery between real extension contexts.
          void Promise.resolve().then(() => {
            for (const listener of listeners) listener(message, {}, resolve);
          });
        }
      }),
  );
  const bridge = createLiveOffscreen(
    { runtime: { sendMessage: notify, onMessage: { addListener: vi.fn() } } },
    media,
    "pcm-worklet.js",
    {
      tap: async () => untap,
      transport: (input) => {
        options = input;
        if (delivery === "start") input.onWarning?.(rawWarning);
        return transport;
      },
      fetcher: vi.fn<typeof fetch>().mockRejectedValue(new Error("No provider calls")),
    },
  );
  const capture = {
    getStatus: async () => status,
    consent: async () => ({ ...status, state: "armed" as const }),
    subscribe: (listener: (value: CaptureStatusSnapshot) => void) => {
      captureListeners.add(listener);
      return () => {
        captureListeners.delete(listener);
      };
    },
    stop: vi.fn(async (generation: number) => {
      media.stop(generation);
      return status;
    }),
  };
  const runtime = {
    sendMessage: vi.fn(async (raw: unknown) => {
      const message = raw as { channel: string; kind: string };
      if (message.channel !== LIVE_CHANNEL) return { ok: status.state !== "idle" };
      if (delivery === "heartbeat" && message.kind === "heartbeat") options.onWarning?.(rawWarning);
      return bridge.handle(raw);
    }),
    onMessage: {
      addListener: (listener: CaptureRuntimeListener) => {
        listeners.add(listener);
      },
      removeListener: (listener: CaptureRuntimeListener) => {
        listeners.delete(listener);
      },
    },
  };
  const source = new LiveTranscriptSource(capture, runtime);
  const events: TranscriptEvent[] = [];
  source.subscribe((event) => events.push(TranscriptEventSchema.parse(event)));
  source.prepare("session_live", "a".repeat(32));
  const start = async () => {
    source.start();
    await tick();
    update({ state: "active", generation: status.generation });
    await tick();
  };
  return {
    source,
    bridge,
    events,
    capture,
    media,
    transport,
    untap,
    notify,
    listeners,
    update,
    start,
    warn: () => options.onWarning?.(rawWarning),
    rawWarning,
  };
}

describe("retention stop across the live bridge and panel", () => {
  it.each(["notification", "start", "heartbeat"] as const)(
    "preserves one fixed explanation via %s while releasing capture and timers",
    async (delivery) => {
      const h = setup(delivery);
      await h.start();
      if (delivery === "notification") {
        h.warn();
        expect(h.transport.stop).toHaveBeenCalledOnce();
        expect(h.untap).toHaveBeenCalledOnce();
        expect(h.capture.stop).not.toHaveBeenCalled();
        await tick();
      } else if (delivery === "heartbeat") await vi.advanceTimersByTimeAsync(1000);
      const errors = h.events.filter((event) => event.type === "source.error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        error: { retryable: false, message: expect.stringContaining("reported session logging") },
      });
      expect(h.source.getSnapshot()).toMatchObject({ mode: "live", status: "error" });
      expect(h.capture.stop).toHaveBeenCalledExactlyOnceWith(4);
      expect(h.transport.stop).toHaveBeenCalledOnce();
      expect(h.untap).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
      expect(h.listeners.size).toBe(0);
      expect(JSON.stringify(h.events)).not.toContain(h.rawWarning);
      expect(JSON.stringify(h.notify.mock.calls)).not.toContain(h.rawWarning);
      expect(JSON.stringify(h.notify.mock.calls)).not.toContain("a".repeat(32));
    },
  );

  it("ignores stale, foreign and malformed terminal messages instead of forwarding raw text", async () => {
    const h = setup();
    await h.start();
    const message = {
      channel: LIVE_CHANNEL,
      kind: "stopped",
      generation: 4,
      sessionId: "session_live",
      reason: "retention_active",
    };
    const respond = vi.fn();
    for (const raw of [
      { ...message, generation: 3 },
      { ...message, sessionId: "session_other" },
      { ...message, reason: h.rawWarning },
      { ...message, message: h.rawWarning },
    ])
      for (const listener of h.listeners) listener(raw, {}, respond);
    expect(respond).not.toHaveBeenCalled();
    expect(h.capture.stop).not.toHaveBeenCalled();
    expect(h.events.filter((event) => event.type === "source.error")).toHaveLength(0);
    const oldListeners = [...h.listeners];
    h.source.stop();
    await tick();
    h.update({ state: "awaiting_consent", generation: 5 });
    h.source.prepare("session_new", "b".repeat(32));
    await h.start();
    for (const listener of oldListeners) listener(LiveStoppedSchema.parse(message), {}, respond);
    expect(respond).not.toHaveBeenCalled();
    expect(h.capture.stop).toHaveBeenCalledTimes(1);
    h.source.stop();
    await tick();
    expect(vi.getTimerCount()).toBe(0);
  });
});
