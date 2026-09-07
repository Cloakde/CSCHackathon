import { describe, expect, it, vi } from "vitest";
import {
  createOffscreenCaptureHandler,
  type OffscreenChrome,
  type OffscreenMediaApis,
} from "../src/offscreen";
import { OFFSCREEN_ACK_CHANNEL, OFFSCREEN_COMMAND_CHANNEL } from "../src/capture-protocol";

function fakeTrack(): MediaStreamTrack {
  return { onended: null, stop: vi.fn() } as unknown as MediaStreamTrack;
}

function fakeStream(tracks: MediaStreamTrack[]): MediaStream {
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks,
  } as unknown as MediaStream;
}

function fakeChrome(): { chrome: OffscreenChrome; sent: unknown[]; deliver: (m: unknown) => void } {
  const sent: unknown[] = [];
  const listeners: ((
    message: unknown,
    sender: unknown,
    respond: (r: unknown) => void,
  ) => boolean | void)[] = [];
  return {
    sent,
    chrome: {
      runtime: {
        sendMessage: async (message) => {
          sent.push(message);
          return undefined;
        },
        onMessage: { addListener: (l) => listeners.push(l) },
      },
    },
    deliver: (message) => listeners.forEach((l) => l(message, {}, () => undefined)),
  };
}

describe("offscreen capture handler (TASK-101)", () => {
  it("consumes a stream ID exactly once, connects passthrough exactly once, and acks track_active", async () => {
    const track = fakeTrack();
    const stream = fakeStream([track]);
    const getUserMedia = vi.fn(async () => stream);
    const connect = vi.fn();
    const createAudioContext = vi.fn(() => ({
      createMediaStreamSource: () => ({ connect }),
      destination: {},
      close: vi.fn(async () => undefined),
    }));
    const { chrome, sent } = fakeChrome();
    const media: OffscreenMediaApis = { getUserMedia, createAudioContext };
    const handler = createOffscreenCaptureHandler(chrome, media);

    await handler._internal.consumeStream(1, "stream-abc");

    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: "stream-abc" } },
      video: false,
    });
    expect(connect).toHaveBeenCalledOnce();
    expect(sent).toContainEqual({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    expect(sent.some((m) => JSON.stringify(m).includes("stream-abc"))).toBe(false);
  });

  it("never consumes a second stream while one is already active", async () => {
    const media: OffscreenMediaApis = {
      getUserMedia: vi.fn(async () => fakeStream([fakeTrack()])),
      createAudioContext: () => ({
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        destination: {},
        close: async () => undefined,
      }),
    };
    const { chrome, sent } = fakeChrome();
    const handler = createOffscreenCaptureHandler(chrome, media);
    await handler._internal.consumeStream(1, "first");
    await handler._internal.consumeStream(2, "second");
    expect(media.getUserMedia).toHaveBeenCalledOnce();
    expect(sent).toContainEqual(expect.objectContaining({ kind: "track_failed", generation: 2 }));
  });

  it("acks track_failed on a getUserMedia rejection without leaking the raw error", async () => {
    const media: OffscreenMediaApis = {
      getUserMedia: vi.fn(async () => {
        throw new Error("Permission denied by the user's device policy");
      }),
      createAudioContext: vi.fn(),
    };
    const { chrome, sent } = fakeChrome();
    const handler = createOffscreenCaptureHandler(chrome, media);
    await handler._internal.consumeStream(1, "s1");
    expect(sent).toContainEqual({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_failed",
      generation: 1,
      reason: "getusermedia_failed",
    });
    expect(JSON.stringify(sent)).not.toContain("device policy");
  });

  it("a stop for a stale generation is ignored; a stop for the current generation stops every track", async () => {
    const track = fakeTrack();
    const stream = fakeStream([track]);
    const close = vi.fn(async () => undefined);
    const media: OffscreenMediaApis = {
      getUserMedia: vi.fn(async () => stream),
      createAudioContext: () => ({
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        destination: {},
        close,
      }),
    };
    const { chrome, sent } = fakeChrome();
    const handler = createOffscreenCaptureHandler(chrome, media);
    await handler._internal.consumeStream(1, "s1");

    handler._internal.stop(0); // Stale: must do nothing.
    expect(track.stop).not.toHaveBeenCalled();

    handler._internal.stop(1);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(sent).toContainEqual({ channel: OFFSCREEN_ACK_CHANNEL, kind: "stopped", generation: 1 });

    // Idempotent: a second Stop for the same, now-inactive generation is harmless.
    handler._internal.stop(1);
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("reports its own track-ended event and cleans up without a second Stop being required", async () => {
    const track = fakeTrack();
    const stream = fakeStream([track]);
    const close = vi.fn(async () => undefined);
    const media: OffscreenMediaApis = {
      getUserMedia: vi.fn(async () => stream),
      createAudioContext: () => ({
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        destination: {},
        close,
      }),
    };
    const { chrome, sent } = fakeChrome();
    const handler = createOffscreenCaptureHandler(chrome, media);
    await handler._internal.consumeStream(1, "s1");
    expect(track.onended).toBeTypeOf("function");

    (track.onended as () => void)();

    expect(close).toHaveBeenCalledOnce();
    expect(sent).toContainEqual({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_ended",
      generation: 1,
    });
  });

  it("get_status reports track_active only for the exact live generation, otherwise track_ended", async () => {
    const media: OffscreenMediaApis = {
      getUserMedia: vi.fn(async () => fakeStream([fakeTrack()])),
      createAudioContext: () => ({
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        destination: {},
        close: async () => undefined,
      }),
    };
    const { chrome, sent } = fakeChrome();
    const handler = createOffscreenCaptureHandler(chrome, media);
    await handler._internal.consumeStream(5, "s5");

    handler._internal.getStatus(5);
    expect(sent).toContainEqual({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 5,
    });

    handler._internal.getStatus(6); // A different (e.g. superseded) generation.
    expect(sent).toContainEqual({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_ended",
      generation: 6,
    });
  });

  it("attach() only reacts to well-formed background->offscreen protocol messages", async () => {
    const media: OffscreenMediaApis = {
      getUserMedia: vi.fn(async () => fakeStream([fakeTrack()])),
      createAudioContext: () => ({
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        destination: {},
        close: async () => undefined,
      }),
    };
    const { chrome, sent, deliver } = fakeChrome();
    createOffscreenCaptureHandler(chrome, media).attach();

    deliver({ channel: "not-ours", kind: "consume_stream", generation: 1, streamId: "x" });
    deliver({
      channel: OFFSCREEN_COMMAND_CHANNEL,
      kind: "consume_stream",
      generation: 1,
      streamId: "s1",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(media.getUserMedia).toHaveBeenCalledOnce();
    expect(sent).toContainEqual({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
  });
});
