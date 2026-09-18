import { createStreamResampler } from "./transcription/resample";
import type { PcmChunk } from "./transcription/pcm";

/** Fixed 200 ms packets; at most one packet plus a worklet frame remains in memory. */
export function createPcmPacketizer(sampleRate: number, deliver: (chunk: PcmChunk) => void) {
  const resampler = createStreamResampler(sampleRate);
  let pending = new Uint8Array(0);
  let offset = 0;
  return (frame: Float32Array) => {
    if (
      !(frame instanceof Float32Array) ||
      frame.length > Math.ceil(sampleRate / 10) ||
      frame.some((sample) => !Number.isFinite(sample))
    )
      throw new Error("Invalid audio frame");
    const result = resampler.push(frame);
    if (!result) return;
    const bytes = new Uint8Array(pending.length + result.bytes.length);
    bytes.set(pending);
    bytes.set(result.bytes, pending.length);
    let cursor = 0;
    while (bytes.length - cursor >= 6_400) {
      deliver({
        startSample: offset,
        endSample: offset + 3_200,
        bytes: bytes.slice(cursor, cursor + 6_400),
      });
      offset += 3_200;
      cursor += 6_400;
    }
    pending = bytes.slice(cursor);
  };
}

export async function attachPcmTap(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  url: string,
  deliver: (chunk: PcmChunk) => void,
  failed: () => void,
  signal: AbortSignal,
): Promise<() => void> {
  await context.audioWorklet.addModule(url);
  if (signal.aborted) throw new Error("Audio tap cancelled");
  const node = new AudioWorkletNode(context, "lecture-pcm", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const push = createPcmPacketizer(context.sampleRate, deliver);
  node.port.onmessage = (event: MessageEvent<unknown>) => {
    if (signal.aborted) return;
    try {
      push(event.data as Float32Array);
      node.port.postMessage("ack");
    } catch {
      failed();
    }
  };
  node.onprocessorerror = failed;
  source.connect(node);
  node.connect(context.destination); // The processor never writes audio to its output.
  return () => {
    node.port.onmessage = null;
    node.onprocessorerror = null;
    node.port.close();
    source.disconnect(node);
    node.disconnect();
  };
}
