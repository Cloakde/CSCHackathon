import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveOffscreen } from "../src/live-offscreen";
import { LIVE_CHANNEL } from "../src/live-protocol";
import type { ScribeTransportOptions } from "../src/transcription/scribe-transport";
import type { attachPcmTap } from "../src/live-audio";

afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  const transport = { chunk: vi.fn(() => true), stop: vi.fn(), isReady: () => true };
  let options!: ScribeTransportOptions;
  const factory = vi.fn((input: ScribeTransportOptions) => {
    options = input;
    return transport;
  });
  const untap = vi.fn();
  const tap = vi.fn<typeof attachPcmTap>(async () => untap);
  const media = {
    get: vi.fn(() => ({ context: {} as AudioContext, source: {} as MediaStreamAudioSourceNode })),
    stop: vi.fn(),
  };
  const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>(async () => undefined);
  const chrome = { runtime: { sendMessage, onMessage: { addListener: vi.fn() } } };
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("No real provider calls"));
  const bridge = createLiveOffscreen(chrome, media, "pcm-worklet.js", {
    tap,
    transport: factory,
    fetcher,
  });
  const command = {
    channel: LIVE_CHANNEL,
    kind: "start",
    generation: 1,
    sessionId: "session_live",
    capability: "a".repeat(32),
  };
  return {
    bridge,
    media,
    transport,
    factory,
    tap,
    untap,
    sendMessage,
    fetcher,
    command,
    options: () => options,
  };
}
describe("offscreen live ownership", () => {
  it("does not let a rejected old tap stop a replacement owner", async () => {
    const h = setup();
    let reject!: (error: Error) => void;
    h.tap.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const old = h.bridge.handle(h.command);
    h.bridge.stop();
    expect(await h.bridge.handle({ ...h.command, generation: 2 })).toEqual({ ok: true });
    reject(new Error("Old worklet failed"));
    expect(await old).toEqual({ ok: false });
    expect(h.media.stop).not.toHaveBeenCalled();
    expect(h.transport.stop).not.toHaveBeenCalled();
    h.bridge.stop();
  });
  it("ignores an old rejected broadcast after a replacement starts", async () => {
    const h = setup();
    let reject!: (error: Error) => void;
    h.sendMessage.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    await h.bridge.handle(h.command);
    const oldOptions = h.options();
    oldOptions.onEvent({
      schemaVersion: 1,
      eventId: "event_active",
      sequence: 0,
      sessionId: "session_live",
      emittedAt: "2026-09-15T00:00:00.000Z",
      type: "source.state",
      sourceMode: "live",
      status: "active",
    });
    h.bridge.stop();
    await h.bridge.handle({ ...h.command, generation: 2 });
    reject(new Error("Old panel vanished"));
    await Promise.resolve();
    await Promise.resolve();
    oldOptions.onWarning?.("RETENTION_ACTIVE");
    expect(h.media.stop).not.toHaveBeenCalled();
    h.bridge.stop();
  });
  it("allows a bounded reconnect but stops on a retention warning", async () => {
    const h = setup();
    await h.bridge.handle(h.command);
    h.options().onEvent({
      schemaVersion: 1,
      eventId: "event_retry",
      sequence: 0,
      sessionId: "session_live",
      emittedAt: "2026-09-15T00:00:00.000Z",
      type: "source.error",
      sourceMode: "live",
      error: { code: "PROVIDER_UNAVAILABLE", message: "Reconnecting", retryable: true },
    });
    expect(h.media.stop).not.toHaveBeenCalled();
    h.options().onWarning?.("RETENTION_ACTIVE");
    expect(h.media.stop).toHaveBeenCalledWith(1);
    expect(h.transport.stop).toHaveBeenCalledOnce();
  });
  it("never starts a provider without matching active media and valid one-run configuration", async () => {
    const h = setup();
    expect(await h.bridge.handle({ ...h.command, capability: "permanent-key" })).toEqual({
      ok: false,
    });
    h.media.get.mockReturnValueOnce(undefined as never);
    expect(await h.bridge.handle(h.command)).toEqual({ ok: false });
    expect(h.factory).not.toHaveBeenCalled();
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("allows one owner, rejects foreign stops and cleans PCM/socket/capture after the panel lease expires", async () => {
    const h = setup();
    expect(await h.bridge.handle(h.command)).toEqual({ ok: true });
    expect(await h.bridge.handle(h.command)).toEqual({ ok: false });
    expect(
      await h.bridge.handle({
        channel: LIVE_CHANNEL,
        kind: "stop",
        generation: 2,
        sessionId: "session_live",
      }),
    ).toEqual({ ok: false });
    await vi.advanceTimersByTimeAsync(4000);
    expect(
      await h.bridge.handle({
        channel: LIVE_CHANNEL,
        kind: "heartbeat",
        generation: 1,
        sessionId: "session_live",
      }),
    ).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(4000);
    expect(h.media.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.untap).toHaveBeenCalledOnce();
    expect(h.transport.stop).toHaveBeenCalledOnce();
    expect(h.media.stop).toHaveBeenCalledExactlyOnceWith(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels a delayed tap without creating a transport", async () => {
    const h = setup();
    let complete!: (cleanup: () => void) => void;
    h.tap.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const starting = h.bridge.handle(h.command);
    h.bridge.stop();
    complete(h.untap);
    expect(await starting).toEqual({ ok: false });
    expect(h.untap).toHaveBeenCalledOnce();
    expect(h.factory).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("stops capture on terminal provider error and sends no secret or PCM to the panel", async () => {
    const h = setup();
    await h.bridge.handle(h.command);
    h.options().onEvent({
      schemaVersion: 1,
      eventId: "event_error",
      sequence: 0,
      sessionId: "session_live",
      emittedAt: "2026-09-15T00:00:00.000Z",
      type: "source.error",
      sourceMode: "live",
      error: { code: "PROVIDER_UNAVAILABLE", message: "Transcription failed", retryable: false },
    });
    expect(h.media.stop).toHaveBeenCalledWith(1);
    expect(h.transport.stop).toHaveBeenCalledOnce();
    expect(JSON.stringify(h.sendMessage.mock.calls)).not.toContain(h.command.capability);
  });
});
