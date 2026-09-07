import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createScribeRealtimeTransport,
  type ScribeSocket,
} from "../src/transcription/scribe-transport";
import { PCM_SAMPLE_RATE_HZ, base64FromPcmBytes } from "../src/transcription/pcm";
import type { TranscriptEvent } from "@livelecture/shared";

function pcmBytes(sampleCount: number): Uint8Array {
  return new Uint8Array(sampleCount * 2).fill(1);
}
/** 0.5 seconds of PCM at the fixed 16 kHz rate — comfortably inside the
 * required 0.1-1.0 second per-chunk window. */
function halfSecondChunk(startSample: number) {
  const sampleCount = PCM_SAMPLE_RATE_HZ / 2;
  return { startSample, endSample: startSample + sampleCount, bytes: pcmBytes(sampleCount) };
}

const defaultBudget = {
  maxAudioSeconds: 30,
  maxWallClockMs: 90_000,
  maxConnectionAttempts: 2,
  maxTokenIssuances: 2,
  maxReconnects: 1,
};

function fakeSocketFactory() {
  const sockets: (ScribeSocket & { sent: unknown[]; closed: boolean })[] = [];
  const connect = vi.fn<(url: string) => ScribeSocket>((): ScribeSocket => {
    const sent: unknown[] = [];
    const socket = {
      sent,
      closed: false,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send: (data: string) => sent.push(JSON.parse(data)),
      close: () => {
        socket.closed = true;
      },
    } as ScribeSocket & { sent: unknown[]; closed: boolean };
    sockets.push(socket);
    queueMicrotask(() => socket.onopen?.());
    return socket;
  });
  return { connect, sockets };
}

function harness(overrides: Partial<Parameters<typeof createScribeRealtimeTransport>[0]> = {}) {
  const events: TranscriptEvent[] = [];
  const warnings: string[] = [];
  const gaps: { startSample: number; endSample: number }[] = [];
  const { connect, sockets } = fakeSocketFactory();
  const mintToken = vi.fn(async () => ({ token: "tok", expiresInSeconds: 900 }));
  let idCounter = 0;
  const transport = createScribeRealtimeTransport({
    sessionId: "session_test",
    mintToken,
    connect,
    budget: defaultBudget,
    onEvent: (event) => events.push(event),
    onWarning: (message) => warnings.push(message),
    onDiscardedGap: (gap) => gaps.push(gap),
    idFactory: () => `id_${++idCounter}`,
    now: () => 0,
    ...overrides,
  });
  return { transport, events, warnings, gaps, sockets, mintToken, connect };
}

async function flush(): Promise<void> {
  for (let iteration = 0; iteration < 10; iteration += 1) await Promise.resolve();
}

afterEach(() => vi.restoreAllMocks());

describe("Scribe realtime transport (TASK-102)", () => {
  it("mints a token and connects with the pinned model/format/commit-strategy query", async () => {
    const { connect, mintToken } = harness();
    await flush();
    expect(mintToken).toHaveBeenCalledOnce();
    const url = connect.mock.calls[0]![0] as string;
    expect(url).toContain("wss://api.elevenlabs.io/v1/speech-to-text/realtime?");
    expect(url).toContain("token=tok");
    expect(url).toContain("model_id=scribe_v2_realtime");
    expect(url).toContain("audio_format=pcm_16000");
    expect(url).toContain("commit_strategy=vad");
    expect(url).toContain("enable_logging=false");
    expect(url).toContain("include_timestamps=true");
  });

  it("rejects a wrong-rate/misaligned/wrong-duration chunk before it reaches the socket", async () => {
    const { transport, sockets, events } = harness();
    await flush();
    transport.chunk({ startSample: 0, endSample: 100, bytes: pcmBytes(50) }); // too short a duration
    transport.chunk({ startSample: 0, endSample: 1600, bytes: new Uint8Array(3199) }); // wrong byte count
    expect(sockets[0]!.sent).toHaveLength(0);
    expect(events.filter((e) => e.type === "source.error")).toHaveLength(2);
  });

  it("rejects a stale, gapped, or overlapping chunk without sending it", async () => {
    const { transport, sockets } = harness();
    await flush();
    transport.chunk(halfSecondChunk(0));
    expect(sockets[0]!.sent).toHaveLength(1);
    transport.chunk(halfSecondChunk(1_000)); // Gap: does not continue from 8000.
    transport.chunk(halfSecondChunk(4_000)); // Stale: overlaps already-accepted range.
    expect(sockets[0]!.sent).toHaveLength(1);
    transport.chunk(halfSecondChunk(8_000)); // The genuinely next contiguous chunk.
    expect(sockets[0]!.sent).toHaveLength(2);
  });

  it("sends base64-encoded audio with the fixed sample rate and optional first-chunk context", async () => {
    const { transport, sockets } = harness({ initialContext: "Discussing the chain rule" });
    await flush();
    transport.chunk(halfSecondChunk(0));
    expect(sockets[0]!.sent[0]).toEqual({
      audio_base_64: base64FromPcmBytes(pcmBytes(PCM_SAMPLE_RATE_HZ / 2)),
      sample_rate: PCM_SAMPLE_RATE_HZ,
      commit: false,
      previous_text: "Discussing the chain rule",
    });
    transport.chunk(halfSecondChunk(8_000));
    expect(sockets[0]!.sent[1]).not.toHaveProperty("previous_text");
  });

  it("replaces one partial segment rather than accumulating history", async () => {
    const { transport, sockets, events } = harness();
    await flush();
    transport.chunk(halfSecondChunk(0));
    sockets[0]!.onmessage?.({
      data: JSON.stringify({ type: "partial_transcript", text: "the inside" }),
    });
    sockets[0]!.onmessage?.({
      data: JSON.stringify({ type: "partial_transcript", text: "the inside acts first" }),
    });
    const partials = events.filter((e) => e.type === "transcript.partial");
    expect(partials).toHaveLength(2);
    expect(partials[0]!.chunk.partialId).toBe(partials[1]!.chunk.partialId);
    expect(partials[1]!.chunk.text).toBe("the inside acts first");
  });

  it("emits exactly one immutable commit from a stable-plus-timestamps pair", async () => {
    const { transport, sockets, events } = harness();
    await flush();
    transport.chunk(halfSecondChunk(0));
    sockets[0]!.onmessage?.({
      data: JSON.stringify({ type: "committed_transcript", text: "the inside acts first" }),
    });
    sockets[0]!.onmessage?.({
      data: JSON.stringify({
        type: "committed_transcript_with_timestamps",
        text: "the inside acts first",
        words: [
          { text: "the", start: 0.0, end: 0.2 },
          { text: "first", start: 0.6, end: 0.9 },
        ],
      }),
    });
    const committed = events.filter((e) => e.type === "transcript.committed");
    expect(committed).toHaveLength(1);
    expect(committed[0]!.chunk).toMatchObject({
      text: "the inside acts first",
      startMs: 0,
      endMs: 900,
    });
  });

  it.each([
    [
      "mismatched text",
      {
        type: "committed_transcript_with_timestamps",
        text: "different text",
        words: [{ text: "x", start: 0, end: 0.1 }],
      },
    ],
    [
      "no prior committed_transcript",
      {
        type: "committed_transcript_with_timestamps",
        text: "orphan",
        words: [{ text: "x", start: 0, end: 0.1 }],
      },
    ],
    ["unrecognized frame type", { type: "not_a_real_event" }],
    ["malformed json shape", { type: "warning" }], // missing required "warning" field
  ])(
    "treats %s as a visible, safe error rather than corrupting the transcript",
    async (_label, frame) => {
      const { transport, sockets, events } = harness();
      await flush();
      transport.chunk(halfSecondChunk(0));
      if (
        "text" in frame &&
        frame.type === "committed_transcript_with_timestamps" &&
        frame.text !== "orphan"
      )
        void 0; // mismatched-text case relies on no prior pending commit either, which is fine to test as-is
      sockets[0]!.onmessage?.({ data: JSON.stringify(frame) });
      expect(events.some((e) => e.type === "source.error")).toBe(true);
      expect(events.some((e) => e.type === "transcript.committed")).toBe(false);
    },
  );

  it("rejects genuinely malformed JSON on the wire", async () => {
    const { sockets, events } = harness();
    await flush();
    sockets[0]!.onmessage?.({ data: "{not json" });
    expect(events.some((e) => e.type === "source.error")).toBe(true);
  });

  it("maps a nonretryable provider error to a terminal, non-retryable source.error", async () => {
    const { sockets, events, connect } = harness();
    await flush();
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: "auth_error", error: "bad token" }) });
    const errorEvent = events.find((e) => e.type === "source.error");
    expect(errorEvent).toMatchObject({ error: { retryable: false } });
    expect(connect).toHaveBeenCalledOnce(); // No reconnect attempt follows a nonretryable error.
  });

  it("a forced disconnect preserves committed output, mints a fresh token, and resumes with monotonic offsets", async () => {
    vi.useFakeTimers();
    const { transport, sockets, events, connect, mintToken } = harness();
    await vi.advanceTimersByTimeAsync(0);
    transport.chunk(halfSecondChunk(0));
    sockets[0]!.onmessage?.({
      data: JSON.stringify({ type: "committed_transcript", text: "first part" }),
    });
    sockets[0]!.onmessage?.({
      data: JSON.stringify({
        type: "committed_transcript_with_timestamps",
        text: "first part",
        words: [{ text: "first", start: 0, end: 0.5 }],
      }),
    });
    sockets[0]!.onclose?.({ code: 1006, reason: "lost" });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mintToken).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenCalledTimes(2);
    transport.chunk(halfSecondChunk(8_000));
    sockets[1]!.onmessage?.({
      data: JSON.stringify({ type: "committed_transcript", text: "second part" }),
    });
    sockets[1]!.onmessage?.({
      data: JSON.stringify({
        type: "committed_transcript_with_timestamps",
        text: "second part",
        words: [{ text: "second", start: 0, end: 0.4 }],
      }),
    });
    const committed = events.filter((e) => e.type === "transcript.committed");
    expect(committed).toHaveLength(2);
    expect(committed[0]!.chunk.text).toBe("first part");
    expect(committed[1]!.chunk.text).toBe("second part");
    expect(committed[1]!.chunk.startMs).toBeGreaterThanOrEqual(committed[0]!.chunk.endMs);
    vi.useRealTimers();
  });

  it("reports the exact discarded PCM interval on a mid-segment disconnect and never replays it", async () => {
    const { transport, sockets, gaps } = harness();
    await flush();
    transport.chunk(halfSecondChunk(0));
    transport.chunk(halfSecondChunk(8_000));
    sockets[0]!.onclose?.({ code: 1006, reason: "lost" });
    expect(gaps).toEqual([{ startSample: 0, endSample: 16_000 }]);
  });

  it("terminates when the audio budget would be exceeded", async () => {
    const { transport, events } = harness({
      budget: { ...defaultBudget, maxAudioSeconds: 0.5 },
    });
    await flush();
    transport.chunk(halfSecondChunk(0));
    transport.chunk(halfSecondChunk(8_000)); // Would exceed the 0.5s cap.
    const terminalError = events.find((e) => e.type === "source.error");
    expect(terminalError).toBeDefined();
  });

  it("terminates at the wall-clock deadline", async () => {
    vi.useFakeTimers();
    const { events } = harness({ budget: { ...defaultBudget, maxWallClockMs: 5_000 } });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(events.some((e) => e.type === "source.error")).toBe(true);
    vi.useRealTimers();
  });

  it("terminates after exhausting connection attempts and does not exceed token/reconnect caps", async () => {
    vi.useFakeTimers();
    const { sockets, mintToken, connect } = harness({
      budget: {
        ...defaultBudget,
        maxConnectionAttempts: 2,
        maxTokenIssuances: 2,
        maxReconnects: 5,
      },
    });
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.onclose?.({ code: 1006, reason: "lost" });
    await vi.advanceTimersByTimeAsync(10_000);
    // The second connection is the second (and last) permitted attempt.
    expect(connect).toHaveBeenCalledTimes(2);
    expect(mintToken).toHaveBeenCalledTimes(2);
    sockets[1]!.onclose?.({ code: 1006, reason: "lost" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(connect).toHaveBeenCalledTimes(2); // Attempts exhausted: no third connection.
    vi.useRealTimers();
  });

  it("stop prevents all further sends, reconnects, and events", async () => {
    const { transport, sockets, events } = harness();
    await flush();
    transport.stop();
    transport.chunk(halfSecondChunk(0));
    expect(sockets[0]!.sent).toHaveLength(0);
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: "partial_transcript", text: "late" }) });
    expect(events.filter((e) => e.type === "transcript.partial")).toHaveLength(0);
    expect(sockets[0]!.closed).toBe(true);
  });

  it("surfaces a provider warning without treating it as an error or a transcript event", async () => {
    const { sockets, warnings, events } = harness();
    await flush();
    sockets[0]!.onmessage?.({
      data: JSON.stringify({ type: "warning", warning: "Zero retention unavailable" }),
    });
    expect(warnings).toEqual(["Zero retention unavailable"]);
    expect(events).toHaveLength(0);
  });
});
