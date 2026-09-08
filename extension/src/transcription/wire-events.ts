/**
 * TASK-102 — extension-private, runtime-validated shapes for ElevenLabs'
 * raw realtime Speech-to-Text WebSocket frames. Nothing exported from this
 * file may be re-exported outside `extension/src/transcription/**`: the
 * adapter maps every one of these into the existing canonical
 * `TranscriptEvent` union before anything else in the app ever sees it.
 *
 * Wire format verified against the official realtime API reference, 2026-09-07.
 * The provider uses message_type; internal type values below stay adapter-local.
 */

export interface WireWord {
  text: string;
  /** Seconds, as documented by ElevenLabs. Live epoch behavior still needs verification. */
  start: number;
  end: number;
}

export type WireEvent =
  | { type: "session_started"; sessionId: string }
  | { type: "partial_transcript"; text: string }
  | { type: "committed_transcript"; text: string }
  | { type: "committed_transcript_with_timestamps"; text: string; words: WireWord[] }
  | { type: "warning"; message: string }
  | { type: "error"; message: string; code: WireErrorCode };

export type WireErrorCode =
  | "error"
  | "auth_error"
  | "unaccepted_terms"
  | "quota_exceeded"
  | "rate_limited"
  | "commit_throttled"
  | "queue_overflow"
  | "resource_exhausted"
  | "session_time_limit_exceeded"
  | "input_error"
  | "invalid_request"
  | "chunk_size_exceeded"
  | "insufficient_audio_activity"
  | "transcriber_error";

const ERROR_CODES: readonly WireErrorCode[] = [
  "error",
  "auth_error",
  "unaccepted_terms",
  "quota_exceeded",
  "rate_limited",
  "commit_throttled",
  "queue_overflow",
  "resource_exhausted",
  "session_time_limit_exceeded",
  "input_error",
  "invalid_request",
  "chunk_size_exceeded",
  "insufficient_audio_activity",
  "transcriber_error",
];

/** Per the task contract: authentication, quota, invalid-request, and
 * unaccepted-terms-shaped failures never get an automatic retry. */
const NONRETRYABLE_CODES = new Set<WireErrorCode>([
  "auth_error",
  "unaccepted_terms",
  "quota_exceeded",
  "invalid_request",
  "input_error",
  "chunk_size_exceeded",
]);

export function isRetryableWireError(code: WireErrorCode): boolean {
  return !NONRETRYABLE_CODES.has(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 10_000;
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseWords(value: unknown): WireWord[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10000) return undefined;
  const words: WireWord[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return undefined;
    // The documented words array can also contain untimed spacing tokens.
    // These carry no boundary evidence; only timed words establish citations.
    if (entry.type === "spacing") {
      if (typeof entry.text !== "string" || entry.text.length > 10000 || entry.text.trim())
        return undefined;
      continue;
    }
    if (
      (entry.type !== undefined && entry.type !== "word") ||
      !isNonEmptyString(entry.text) ||
      !isFiniteNumber(entry.start) ||
      !isFiniteNumber(entry.end) ||
      entry.end < entry.start ||
      entry.start < 0 ||
      (words.length > 0 && entry.start < words.at(-1)!.end)
    )
      return undefined;
    words.push({ text: entry.text, start: entry.start, end: entry.end });
  }
  return words.length > 0 ? words : undefined;
}

/** Parses one raw JSON WebSocket message. Returns `undefined` for anything
 * that does not match a known, well-formed frame — the caller treats that as
 * a visible, safe protocol error, never as data to guess at. */
export function parseWireEvent(raw: unknown): WireEvent | undefined {
  if (!isRecord(raw) || typeof raw.message_type !== "string") return undefined;
  switch (raw.message_type) {
    case "session_started":
      return isNonEmptyString(raw.session_id)
        ? { type: "session_started", sessionId: raw.session_id }
        : undefined;
    case "partial_transcript":
      return typeof raw.text === "string" && raw.text.length <= 10_000
        ? { type: "partial_transcript", text: raw.text }
        : undefined;
    case "committed_transcript":
      return isNonEmptyString(raw.text)
        ? { type: "committed_transcript", text: raw.text }
        : undefined;
    case "committed_transcript_with_timestamps": {
      if (!isNonEmptyString(raw.text)) return undefined;
      const words = parseWords(raw.words);
      return words
        ? { type: "committed_transcript_with_timestamps", text: raw.text, words }
        : undefined;
    }
    case "warning":
      return isNonEmptyString(raw.warning) ? { type: "warning", message: raw.warning } : undefined;
    default:
      if (
        (ERROR_CODES as readonly string[]).includes(raw.message_type) &&
        isNonEmptyString(raw.error)
      )
        return { type: "error", message: raw.error, code: raw.message_type as WireErrorCode };
      return undefined;
  }
}
