import { describe, expect, it } from "vitest";
import { createStreamResampler, TARGET_SAMPLE_RATE_HZ } from "../src/transcription/resample";

function readInt16LE(bytes: Uint8Array, index: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt16(index * 2, true);
}

describe("streaming 48kHz-family -> 16kHz PCM resampler (TASK-307 preparation)", () => {
  it("produces roughly the expected output length for a 3:1 ratio", () => {
    const resampler = createStreamResampler(48_000);
    const result = resampler.push(new Float32Array(48_000)); // 1 second of silence at 48kHz.
    expect(result).toBeDefined();
    // ~16,000 output samples for 1 second of input; interpolation boundary
    // effects mean "close to", not exact, is the right assertion.
    expect(result!.endSample - result!.startSample).toBeGreaterThan(15_900);
    expect(result!.endSample - result!.startSample).toBeLessThan(16_050);
  });

  it("emits contiguous, gap-free, non-overlapping absolute offsets across chunk boundaries", () => {
    const resampler = createStreamResampler(48_000);
    const first = resampler.push(new Float32Array(24_000));
    const second = resampler.push(new Float32Array(24_000));
    const third = resampler.push(new Float32Array(24_000));
    for (const chunk of [first, second, third]) expect(chunk).toBeDefined();
    expect(second!.startSample).toBe(first!.endSample);
    expect(third!.startSample).toBe(second!.endSample);
  });

  it("encodes little-endian 16-bit PCM that round-trips a known amplitude", () => {
    const resampler = createStreamResampler(TARGET_SAMPLE_RATE_HZ); // 1:1, easiest to reason about exactly.
    const input = new Float32Array(100).fill(0.5);
    const result = resampler.push(input)!;
    const decoded = readInt16LE(result.bytes, 10);
    expect(decoded).toBeCloseTo(0.5 * 32_767, -1);
  });

  it("clamps out-of-range samples instead of wrapping or throwing", () => {
    const resampler = createStreamResampler(TARGET_SAMPLE_RATE_HZ);
    const result = resampler.push(new Float32Array(10).fill(3.0))!; // Way outside [-1, 1].
    expect(readInt16LE(result.bytes, 5)).toBe(32_767);
  });

  it("returns undefined rather than a zero-length chunk when too little input has accumulated", () => {
    const resampler = createStreamResampler(48_000);
    // A single sample has no next sample to interpolate against yet.
    expect(resampler.push(new Float32Array(1))).toBeUndefined();
  });

  it("rejects a non-positive or non-finite source rate", () => {
    expect(() => createStreamResampler(0)).toThrow();
    expect(() => createStreamResampler(-1)).toThrow();
    expect(() => createStreamResampler(Number.NaN)).toThrow();
  });

  it("passes 16kHz input through with output length matching input length (1:1 ratio)", () => {
    const resampler = createStreamResampler(16_000);
    const result = resampler.push(new Float32Array(500))!;
    expect(result.endSample - result.startSample).toBe(499); // Off-by-one at the trailing edge, held as carry.
  });
});
