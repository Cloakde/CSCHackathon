import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { attachPcmTap, createPcmPacketizer } from "../src/live-audio";
import { validatePcmChunkShape, type PcmChunk } from "../src/transcription/pcm";

describe("live PCM bridge", () => {
  it.each([44_100, 48_000])("converts %i Hz frames into contiguous 200ms PCM packets", (rate) => {
    const packets: PcmChunk[] = [];
    const push = createPcmPacketizer(rate, (chunk) => packets.push(chunk));
    for (let frame = 0; frame < 21; frame++) push(new Float32Array(rate / 10).fill(0.5));
    expect(packets).toHaveLength(10);
    for (const [index, packet] of packets.entries()) {
      expect(validatePcmChunkShape(packet)).toBeUndefined();
      expect(packet.startSample).toBe(index * 3200);
      expect(packet.endSample).toBe((index + 1) * 3200);
      expect(new DataView(packet.bytes.buffer).getInt16(0, true)).toBe(16384);
    }
  });
  it("keeps the existing audible connection and removes only the silent tap", async () => {
    const destination = {};
    const connect = vi.fn();
    const disconnect = vi.fn();
    const node = {
      port: { onmessage: null, postMessage: vi.fn(), close: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      onprocessorerror: null,
    };
    vi.stubGlobal(
      "AudioWorkletNode",
      class {
        constructor() {
          return node;
        }
      },
    );
    const source = { connect, disconnect } as unknown as MediaStreamAudioSourceNode;
    const context = {
      destination,
      sampleRate: 48000,
      audioWorklet: { addModule: vi.fn(async () => undefined) },
    } as unknown as AudioContext;
    source.connect(destination as AudioNode);
    const cleanup = await attachPcmTap(
      context,
      source,
      "pcm-worklet.js",
      vi.fn(),
      vi.fn(),
      new AbortController().signal,
    );
    expect(connect.mock.calls.filter(([target]) => target === destination)).toHaveLength(1);
    expect(connect).toHaveBeenCalledWith(node);
    cleanup();
    expect(disconnect).toHaveBeenCalledExactlyOnceWith(node);
    expect(node.port.close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
  it("bounds the worklet queue, averages stereo and never writes an audible output", () => {
    let Processor!: new () => {
      process(inputs: Float32Array[][]): boolean;
      port: { onmessage: () => void; postMessage: ReturnType<typeof vi.fn> };
    };
    class Base {
      port = { onmessage: () => undefined, postMessage: vi.fn() };
    }
    runInNewContext(
      readFileSync(new NodeURL("../public/pcm-worklet.js", import.meta.url), "utf8"),
      {
        AudioWorkletProcessor: Base,
        sampleRate: 16000,
        Float32Array,
        registerProcessor: (_name: string, ctor: typeof Processor) => {
          Processor = ctor;
        },
      },
    );
    const processor = new Processor();
    const frame = [new Float32Array(1600).fill(0.8), new Float32Array(1600).fill(0.2)];
    expect(processor.process([frame])).toBe(true);
    expect(processor.port.postMessage.mock.calls[0]?.[0][0]).toBeCloseTo(0.5);
    processor.process([frame]);
    expect(processor.process([frame])).toBe(false);
    expect(processor.port.postMessage).toHaveBeenCalledTimes(3);
    expect(processor.port.postMessage.mock.calls[2]?.[0]).toEqual({ overflow: true });
  });
});
