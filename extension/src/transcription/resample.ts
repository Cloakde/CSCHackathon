/**
 * Preparation for TASK-307 (the integration task connecting TASK-101 capture
 * to TASK-102 transcription). Captured tab audio typically arrives as
 * `Float32Array` samples at the `AudioContext`'s native rate (commonly
 * 48,000 Hz, sometimes 44,100 Hz) — TASK-102's transport requires mono
 * PCM16LE at a fixed 16,000 Hz with absolute, gap-free sample offsets. This
 * module is the seam between the two: real, tested, and usable independent
 * of how the audio is actually tapped from the offscreen document's
 * `MediaStream` (that tap itself — an `AudioWorkletNode` reading the
 * passthrough source — is not built by this preparation; see
 * PREP_HANDOFF.md and TASK-307).
 *
 * Uses linear interpolation, which is accurate enough for speech-to-text
 * (no anti-aliasing filter is applied) and simple enough to reason about
 * and test deterministically. A production integration may reconsider this
 * if real transcription quality warrants a higher-quality resampler.
 */

export const TARGET_SAMPLE_RATE_HZ = 16_000;

export interface ResampledPcmChunk {
  /** Absolute output-sample offset, inclusive, at the fixed 16 kHz rate. */
  startSample: number;
  /** Absolute output-sample offset, exclusive. */
  endSample: number;
  /** Mono PCM16LE. */
  bytes: Uint8Array;
}

export interface StreamResampler {
  /** Feed the next contiguous buffer of native-rate mono samples. Returns
   * `undefined` when too little input has accumulated yet to produce even
   * one output sample — never a zero-length chunk. */
  push(sourceSamples: Float32Array): ResampledPcmChunk | undefined;
}

function clampToInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped * 32_767);
}

export function createStreamResampler(
  sourceRateHz: number,
  targetRateHz: number = TARGET_SAMPLE_RATE_HZ,
): StreamResampler {
  if (!Number.isFinite(sourceRateHz) || sourceRateHz <= 0)
    throw new Error("sourceRateHz must be a positive finite number");
  const ratio = sourceRateHz / targetRateHz;
  let carry: number | undefined;
  // Fractional read position into the (carry-prefixed) buffer, in source samples.
  let sourcePosition = 0;
  let outputSamplesEmitted = 0;

  function push(sourceSamples: Float32Array): ResampledPcmChunk | undefined {
    if (sourceSamples.length === 0) return undefined;
    const hasCarry = carry !== undefined;
    const extended = new Float32Array(sourceSamples.length + (hasCarry ? 1 : 0));
    if (hasCarry) {
      extended[0] = carry!;
      extended.set(sourceSamples, 1);
    } else {
      extended.set(sourceSamples, 0);
    }

    const outputs: number[] = [];
    while (true) {
      const lowerIndex = Math.floor(sourcePosition);
      if (lowerIndex + 1 >= extended.length) break; // Need more input to interpolate further.
      const fraction = sourcePosition - lowerIndex;
      const interpolated =
        extended[lowerIndex]! * (1 - fraction) + extended[lowerIndex + 1]! * fraction;
      outputs.push(interpolated);
      sourcePosition += ratio;
    }

    // Rebase for the next call: keep the buffer's last sample as the new
    // carry, and shift the fractional cursor to be relative to it.
    carry = extended[extended.length - 1];
    sourcePosition -= extended.length - 1;

    if (outputs.length === 0) return undefined;
    const startSample = outputSamplesEmitted;
    outputSamplesEmitted += outputs.length;
    const bytes = new Uint8Array(outputs.length * 2);
    const view = new DataView(bytes.buffer);
    outputs.forEach((sample, index) => view.setInt16(index * 2, clampToInt16(sample), true));
    return { startSample, endSample: outputSamplesEmitted, bytes };
  }

  return { push };
}
