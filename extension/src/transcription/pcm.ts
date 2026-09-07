/**
 * TASK-102 — validation for the transport's input seam: mono signed 16-bit
 * little-endian PCM at 16 kHz, with absolute capture sample offsets. A later
 * integration task derives these chunks from TASK-101's captured stream;
 * this module accepts only the already-normalized shape and rejects
 * anything else before it can reach the socket.
 */
export const PCM_SAMPLE_RATE_HZ = 16_000;
const MIN_CHUNK_SECONDS = 0.1;
const MAX_CHUNK_SECONDS = 1.0;

export interface PcmChunk {
  /** Absolute sample offset since this lecture's audio began, inclusive. */
  startSample: number;
  /** Absolute sample offset, exclusive. */
  endSample: number;
  bytes: Uint8Array;
}

export type PcmRejectionReason =
  | "non_integer_offsets"
  | "non_positive_range"
  | "duration_out_of_bounds"
  | "byte_count_mismatch"
  | "stale_offset"
  | "gap"
  | "overlap";

export function validatePcmChunkShape(chunk: PcmChunk): PcmRejectionReason | undefined {
  if (!Number.isInteger(chunk.startSample) || !Number.isInteger(chunk.endSample))
    return "non_integer_offsets";
  if (chunk.endSample <= chunk.startSample) return "non_positive_range";
  const sampleCount = chunk.endSample - chunk.startSample;
  const durationSeconds = sampleCount / PCM_SAMPLE_RATE_HZ;
  if (durationSeconds < MIN_CHUNK_SECONDS - 1e-9 || durationSeconds > MAX_CHUNK_SECONDS + 1e-9)
    return "duration_out_of_bounds";
  if (chunk.bytes.byteLength !== sampleCount * 2) return "byte_count_mismatch";
  return undefined;
}

/** Continuity against the last accepted chunk's end offset. A chunk exactly
 * continuing from it is the only acceptance case; anything else — repeating
 * old audio, skipping ahead, or partially overlapping — is rejected rather
 * than silently patched, so a caller can decide how to handle the gap. */
export function validatePcmContinuity(
  chunk: PcmChunk,
  lastAcceptedEndSample: number | undefined,
): PcmRejectionReason | undefined {
  if (lastAcceptedEndSample === undefined) return undefined;
  if (chunk.startSample < lastAcceptedEndSample) return "stale_offset";
  if (chunk.startSample > lastAcceptedEndSample) return "gap";
  return undefined;
}

export function base64FromPcmBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1)
    binary += String.fromCharCode(bytes[index]!);
  return btoa(binary);
}
