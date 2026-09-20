import {
  SCRIBE_AUDIO_FORMAT,
  SCRIBE_COMMIT_STRATEGY,
  SCRIBE_MODEL_ID,
  SCRIBE_REALTIME_URL,
  TranscriptEventSchema,
  type ErrorCode,
  type SourceStatus,
  type TranscriptEvent,
} from "@livelecture/shared";
import {
  PCM_SAMPLE_RATE_HZ,
  base64FromPcmBytes,
  validatePcmChunkShape,
  validatePcmContinuity,
  type PcmChunk,
} from "./pcm";
import { isRetryableWireError, parseWireEvent, type WireErrorCode } from "./wire-events";

export interface ScribeTransportBudget {
  maxAudioSeconds: number;
  maxWallClockMs: number;
  maxConnectionAttempts: number;
  maxTokenIssuances: number;
  maxReconnects: number;
}
export interface MintedToken {
  token: string;
  expiresInSeconds: number;
}
export interface ScribeSocket {
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
}
export interface DiscardedGap {
  startSample: number;
  endSample: number;
}
export interface ScribeTransportOptions {
  sessionId: string;
  mintToken(signal?: AbortSignal): Promise<MintedToken>;
  connect(url: string): ScribeSocket;
  budget: ScribeTransportBudget;
  onEvent(event: TranscriptEvent): void;
  onWarning?: (message: string) => void;
  onDiscardedGap?: (gap: DiscardedGap) => void;
  initialContext?: string;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  idFactory?: () => string;
  random?: () => number;
}
const TIMING_WAIT_MS = 5_000,
  MAX_PENDING_COMMITS = 32,
  MAX_WIRE_CHARS = 256 * 1024;
const errorDetails: Record<WireErrorCode, [ErrorCode, string]> = {
  auth_error: ["INVALID_REQUEST", "Transcription authentication failed."],
  unaccepted_terms: [
    "INVALID_REQUEST",
    "Accept the transcription provider's terms in its dashboard before retrying.",
  ],
  quota_exceeded: ["PROVIDER_UNAVAILABLE", "The transcription allowance is exhausted."],
  rate_limited: ["RATE_LIMITED", "Transcription is rate limited."],
  commit_throttled: ["RATE_LIMITED", "Transcription commits are rate limited."],
  queue_overflow: ["RATE_LIMITED", "The transcription queue is full."],
  resource_exhausted: ["RATE_LIMITED", "Transcription capacity is unavailable."],
  session_time_limit_exceeded: [
    "PROVIDER_UNAVAILABLE",
    "The transcription session time limit was reached.",
  ],
  input_error: ["INVALID_REQUEST", "The transcription service rejected the audio."],
  invalid_request: ["INVALID_REQUEST", "The transcription service rejected the request."],
  chunk_size_exceeded: ["INVALID_REQUEST", "The transcription audio chunk is too large."],
  insufficient_audio_activity: [
    "PROVIDER_UNAVAILABLE",
    "The transcription service detected insufficient audio.",
  ],
  transcriber_error: ["PROVIDER_UNAVAILABLE", "The transcription service failed."],
  error: ["PROVIDER_UNAVAILABLE", "The transcription service failed."],
};
function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ");
}
function connectionUrl(token: string) {
  return (
    SCRIBE_REALTIME_URL +
    "?" +
    new URLSearchParams({
      token,
      model_id: SCRIBE_MODEL_ID,
      audio_format: SCRIBE_AUDIO_FORMAT,
      include_timestamps: "true",
      commit_strategy: SCRIBE_COMMIT_STRATEGY,
      enable_logging: "false",
    })
  );
}
interface PendingCommit {
  text: string;
  timer: unknown;
}
interface Connection {
  socket?: ScribeSocket;
  opened: boolean;
  ready: boolean;
  abort: AbortController;
  baseMs?: number;
  uncommittedSample?: number;
  latestSample?: number;
  pending: PendingCommit[];
}
export function createScribeRealtimeTransport(options: ScribeTransportOptions) {
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const idFactory =
    options.idFactory ?? (() => `scribe_${crypto.randomUUID().replaceAll("-", "_")}`);
  const random = options.random ?? Math.random;
  const { budget } = options;
  if (
    !Object.values(budget).every((v) => Number.isFinite(v) && v >= 0) ||
    ![budget.maxConnectionAttempts, budget.maxTokenIssuances, budget.maxReconnects].every(
      Number.isSafeInteger,
    ) ||
    budget.maxWallClockMs <= 0 ||
    budget.maxAudioSeconds <= 0
  )
    throw new Error("Invalid transcription budget.");
  let terminal = false,
    attempts = 0,
    tokensIssued = 0,
    reconnects = 0;
  let sequence = 0,
    committedSequence = 0,
    audioSecondsSent = 0,
    sentInitialContext = false;
  let current: Connection | undefined;
  let lastInputEnd: number | undefined, lastCommittedEndMs: number | undefined;
  let partialId: string | undefined, dropped: DiscardedGap | undefined, backoff: unknown;
  const identities = new Set<string>();
  const envelope = () => ({
    schemaVersion: 1 as const,
    eventId: idFactory(),
    sessionId: options.sessionId,
    sequence: sequence++,
    emittedAt: new Date(now()).toISOString(),
  });
  function emit(event: TranscriptEvent) {
    options.onEvent(TranscriptEventSchema.parse(event));
  }
  function state(status: SourceStatus) {
    emit({ ...envelope(), type: "source.state", sourceMode: "live", status });
  }
  function error(code: ErrorCode, message: string, retryable: boolean) {
    emit({
      ...envelope(),
      type: "source.error",
      sourceMode: "live",
      error: { code, message, retryable },
    });
  }
  const toMs = (sample: number) => Math.round((sample * 1000) / PCM_SAMPLE_RATE_HZ);
  function reportGap(startSample: number | undefined, endSample: number | undefined) {
    if (startSample !== undefined && endSample !== undefined && endSample > startSample)
      options.onDiscardedGap?.({ startSample, endSample });
  }
  function flushDropped() {
    if (dropped) reportGap(dropped.startSample, dropped.endSample);
    dropped = undefined;
  }
  function closeConnection() {
    const old = current;
    current = undefined;
    if (!old) return;
    old.abort.abort();
    old.pending.forEach((p) => clearTimer(p.timer));
    old.pending = [];
    reportGap(old.uncommittedSample, old.latestSample);
    if (old.socket) {
      old.socket.onopen = old.socket.onmessage = old.socket.onerror = old.socket.onclose = null;
      try {
        old.socket.close();
      } catch {
        /* already gone */
      }
    }
    partialId = undefined;
  }
  function finish(message?: string, code: ErrorCode = "PROVIDER_UNAVAILABLE") {
    if (terminal) return;
    terminal = true;
    clearTimer(deadline);
    if (backoff !== undefined) clearTimer(backoff);
    backoff = undefined;
    closeConnection();
    flushDropped();
    identities.clear();
    if (message) error(code, message, false);
    state(message ? "error" : "stopped");
  }
  function disconnect(
    connection: Connection,
    message = "The transcription connection was interrupted.",
    code: ErrorCode = "PROVIDER_UNAVAILABLE",
  ) {
    if (terminal || current !== connection) return;
    closeConnection();
    if (reconnects >= budget.maxReconnects) {
      finish("No transcription reconnects remain.");
      return;
    }
    reconnects += 1;
    error(code, message, true);
    state("starting");
    backoff = setTimer(
      () => {
        backoff = undefined;
        void connectOnce();
      },
      Math.min(1000 * 2 ** (reconnects - 1), 8000) * (0.5 + random() * 0.5),
    );
  }
  function protocolFailure() {
    finish("The transcription response could not be validated.", "INTERNAL_ERROR");
  }
  function message(connection: Connection, raw: string) {
    if (terminal || current !== connection) return;
    if (typeof raw !== "string" || raw.length > MAX_WIRE_CHARS) {
      protocolFailure();
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      protocolFailure();
      return;
    }
    const event = parseWireEvent(value);
    if (!event) {
      protocolFailure();
      return;
    }
    if (event.type === "warning") {
      options.onWarning?.(
        "RETENTION_ACTIVE: the provider reports that this transcription session is being logged.",
      );
      return;
    }
    if (event.type === "error") {
      const [code, safeMessage] = errorDetails[event.code];
      if (isRetryableWireError(event.code)) disconnect(connection, safeMessage, code);
      else finish(safeMessage, code);
      return;
    }
    if (event.type === "session_started") {
      if (!connection.opened) {
        protocolFailure();
        return;
      }
      connection.ready = true;
      state("active");
      return;
    }
    if (
      !connection.ready ||
      connection.baseMs === undefined ||
      connection.latestSample === undefined
    ) {
      protocolFailure();
      return;
    }
    if (event.type === "partial_transcript") {
      if (!event.text.trim()) return;
      partialId ??= idFactory();
      emit({
        ...envelope(),
        type: "transcript.partial",
        chunk: {
          partialId,
          sessionId: options.sessionId,
          text: event.text,
          startMs: toMs(connection.uncommittedSample ?? connection.latestSample),
          endMs: toMs(connection.latestSample),
        },
      });
      return;
    }
    if (event.type === "committed_transcript") {
      if (connection.pending.length >= MAX_PENDING_COMMITS) {
        protocolFailure();
        return;
      }
      const pending: PendingCommit = { text: event.text, timer: undefined };
      pending.timer = setTimer(() => {
        if (!terminal && current === connection && connection.pending.includes(pending))
          protocolFailure();
      }, TIMING_WAIT_MS);
      connection.pending.push(pending);
      return;
    }
    const matches = connection.pending.filter((p) => normalize(p.text) === normalize(event.text));
    if (matches.length !== 1 || connection.pending[0] !== matches[0]) {
      protocolFailure();
      return;
    }
    const pending = connection.pending.shift()!;
    clearTimer(pending.timer);
    const startMs = connection.baseMs + Math.round(event.words[0]!.start * 1000);
    const endMs = connection.baseMs + Math.round(event.words.at(-1)!.end * 1000);
    const identity = JSON.stringify([normalize(event.text), startMs, endMs]);
    if (identities.has(identity)) return;
    if (
      endMs <= startMs ||
      endMs > toMs(connection.latestSample) + 1 ||
      (lastCommittedEndMs !== undefined && startMs < lastCommittedEndMs)
    ) {
      protocolFailure();
      return;
    }
    identities.add(identity);
    if (identities.size > 10000) {
      protocolFailure();
      return;
    }
    lastCommittedEndMs = endMs;
    connection.uncommittedSample = Math.min(
      connection.latestSample,
      Math.round((endMs * PCM_SAMPLE_RATE_HZ) / 1000),
    );
    partialId = undefined;
    emit({
      ...envelope(),
      type: "transcript.committed",
      chunk: {
        chunkId: idFactory(),
        sessionId: options.sessionId,
        sequence: committedSequence++,
        text: event.text,
        startMs,
        endMs,
      },
    });
  }
  async function connectOnce() {
    if (terminal) return;
    if (attempts >= budget.maxConnectionAttempts) {
      finish("No further connection attempts remain.");
      return;
    }
    if (tokensIssued >= budget.maxTokenIssuances) {
      finish("No further transcription tokens remain.");
      return;
    }
    attempts += 1;
    tokensIssued += 1;
    const connection: Connection = {
      opened: false,
      ready: false,
      abort: new AbortController(),
      pending: [],
    };
    current = connection;
    let minted: MintedToken;
    try {
      minted = await options.mintToken(connection.abort.signal);
    } catch {
      disconnect(connection, "A transcription token could not be obtained.");
      return;
    }
    if (terminal || current !== connection) return;
    if (
      !minted ||
      typeof minted.token !== "string" ||
      !minted.token ||
      minted.token.length > 4096 ||
      !Number.isFinite(minted.expiresInSeconds) ||
      minted.expiresInSeconds <= 0 ||
      minted.expiresInSeconds > 900
    ) {
      protocolFailure();
      return;
    }
    try {
      const socket = options.connect(connectionUrl(minted.token));
      connection.socket = socket;
      socket.onopen = () => {
        if (current === connection && !terminal) connection.opened = true;
      };
      socket.onmessage = (e) => message(connection, e.data);
      socket.onerror = () => disconnect(connection);
      socket.onclose = () => disconnect(connection);
    } catch {
      disconnect(connection);
    }
  }
  // True only when sent. Dropped input is reported as a gap and never replayed.
  function chunk(pcm: PcmChunk): boolean {
    if (terminal) return false;
    const issue = validatePcmChunkShape(pcm) ?? validatePcmContinuity(pcm, lastInputEnd);
    if (issue) {
      error("INVALID_REQUEST", "Rejected audio chunk (" + issue + ").", false);
      return false;
    }
    lastInputEnd = pcm.endSample;
    const connection = current;
    if (!connection?.ready || !connection.socket) {
      dropped ??= { startSample: pcm.startSample, endSample: pcm.endSample };
      dropped.endSample = pcm.endSample;
      return false;
    }
    const seconds = (pcm.endSample - pcm.startSample) / PCM_SAMPLE_RATE_HZ;
    if (audioSecondsSent + seconds > budget.maxAudioSeconds + 1e-9) {
      finish("Audio budget exhausted.");
      return false;
    }
    flushDropped();
    connection.baseMs ??= toMs(pcm.startSample);
    connection.uncommittedSample ??= pcm.startSample;
    const payload: Record<string, unknown> = {
      message_type: "input_audio_chunk",
      audio_base_64: base64FromPcmBytes(pcm.bytes),
      sample_rate: PCM_SAMPLE_RATE_HZ,
      commit: false,
    };
    if (!sentInitialContext && options.initialContext)
      payload.previous_text = options.initialContext.slice(0, 49);
    audioSecondsSent += seconds;
    connection.latestSample = pcm.endSample;
    sentInitialContext = true;
    try {
      connection.socket.send(JSON.stringify(payload));
    } catch {
      disconnect(connection);
      return false;
    }
    return true;
  }
  const deadline = setTimer(
    () => finish("Transcription time budget exhausted."),
    budget.maxWallClockMs,
  );
  state("starting");
  void connectOnce();
  return { chunk, stop: () => finish(), isReady: () => !terminal && Boolean(current?.ready) };
}
