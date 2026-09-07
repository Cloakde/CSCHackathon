import {
  SCRIBE_AUDIO_FORMAT,
  SCRIBE_COMMIT_STRATEGY,
  SCRIBE_MODEL_ID,
  SCRIBE_REALTIME_URL,
  type ErrorCode,
  type TranscriptEvent,
} from "@livelecture/shared";
import {
  PCM_SAMPLE_RATE_HZ,
  base64FromPcmBytes,
  validatePcmChunkShape,
  validatePcmContinuity,
  type PcmChunk,
} from "./pcm";
import {
  isRetryableWireError,
  parseWireEvent,
  type WireErrorCode,
  type WireEvent,
} from "./wire-events";

/**
 * TASK-102 — provider-isolated realtime transport. Accepts already-normalized
 * PCM chunks and emits only the existing canonical `TranscriptEvent` union
 * (plus two small side channels below for information that union has no slot
 * for). No raw ElevenLabs type crosses this boundary.
 */

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

/** Minimal WebSocket surface, so tests inject a fake instead of a real socket. */
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
  mintToken(): Promise<MintedToken>;
  connect(url: string): ScribeSocket;
  budget: ScribeTransportBudget;
  onEvent(event: TranscriptEvent): void;
  /** The canonical `TranscriptEvent` union has no warning/gap slots; these are
   * reported separately rather than widening a frozen shared schema. */
  onWarning?: (message: string) => void;
  onDiscardedGap?: (gap: DiscardedGap) => void;
  /** Sent once, on the very first accepted chunk of the whole session only —
   * never repeated on a reconnect. Truncated to 50 characters. */
  initialContext?: string;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  idFactory?: () => string;
  random?: () => number;
}

type TerminalReason =
  | "audio_budget_exceeded"
  | "wall_clock_exceeded"
  | "attempts_exhausted"
  | "tokens_exhausted"
  | "reconnects_exhausted"
  | "nonretryable_error"
  | "stopped";

const NONRETRYABLE_ERROR_CODES: Record<WireErrorCode, ErrorCode> = {
  auth_error: "INVALID_REQUEST",
  invalid_request: "INVALID_REQUEST",
  input_error: "INVALID_REQUEST",
  chunk_size_exceeded: "INVALID_REQUEST",
  quota_exceeded: "PROVIDER_UNAVAILABLE",
  rate_limited: "RATE_LIMITED",
  commit_throttled: "RATE_LIMITED",
  queue_overflow: "RATE_LIMITED",
  resource_exhausted: "RATE_LIMITED",
  session_time_limit_exceeded: "PROVIDER_UNAVAILABLE",
  transcriber_error: "PROVIDER_UNAVAILABLE",
  insufficient_audio_activity: "PROVIDER_UNAVAILABLE",
  error: "PROVIDER_UNAVAILABLE",
};

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function connectionUrl(token: string): string {
  const params = new URLSearchParams({
    token,
    model_id: SCRIBE_MODEL_ID,
    audio_format: SCRIBE_AUDIO_FORMAT,
    include_timestamps: "true",
    commit_strategy: SCRIBE_COMMIT_STRATEGY,
    enable_logging: "false",
  });
  return `${SCRIBE_REALTIME_URL}?${params.toString()}`;
}

export function createScribeRealtimeTransport(options: ScribeTransportOptions) {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer =
    options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const random = options.random ?? Math.random;
  const { budget } = options;

  let stopped = false;
  let terminal: TerminalReason | undefined;
  let socket: ScribeSocket | undefined;
  let attempts = 0;
  let tokensIssued = 0;
  let reconnects = 0;
  let sequence = 0;
  let committedSequence = 0;
  let audioSecondsSent = 0;
  let sentInitialContext = false;
  let deadlineTimer: unknown;
  let backoffTimer: unknown;

  // Per-connection base: application ms for provider-seconds-timestamp 0 on
  // the segment currently open when this connection was established.
  let connectionBaseMs = 0;
  let lastAcceptedEndSample: number | undefined;
  let activePartialId: string | undefined;
  let activeSegmentStartSample: number | undefined;
  let latestTransmittedSample: number | undefined;
  let pendingCommitText: string | undefined;
  let lastCommittedEndMs: number | undefined;
  const seenCommittedIdentities = new Set<string>();

  function sampleToAppMs(sample: number): number {
    return Math.round((sample / PCM_SAMPLE_RATE_HZ) * 1_000);
  }
  function providerSecondsToAppMs(providerSeconds: number): number {
    return connectionBaseMs + Math.round(providerSeconds * 1_000);
  }

  function envelope(): {
    schemaVersion: 1;
    eventId: string;
    sessionId: string;
    sequence: number;
    emittedAt: string;
  } {
    return {
      schemaVersion: 1,
      eventId: idFactory(),
      sessionId: options.sessionId,
      sequence: sequence++,
      emittedAt: new Date(now()).toISOString(),
    };
  }

  function emitError(code: ErrorCode, message: string, retryable: boolean): void {
    options.onEvent({
      ...envelope(),
      type: "source.error",
      sourceMode: "live",
      error: { code, message, retryable },
    });
  }

  function stopAllTimers(): void {
    if (deadlineTimer !== undefined) clearTimer(deadlineTimer);
    if (backoffTimer !== undefined) clearTimer(backoffTimer);
    deadlineTimer = undefined;
    backoffTimer = undefined;
  }

  function terminate(reason: TerminalReason, message: string): void {
    if (terminal) return;
    terminal = reason;
    stopAllTimers();
    socket?.close();
    socket = undefined;
    if (reason !== "stopped") emitError("PROVIDER_UNAVAILABLE", message, false);
  }

  function scheduleDeadline(): void {
    deadlineTimer = setTimer(
      () => terminate("wall_clock_exceeded", "Transcription time budget exhausted."),
      budget.maxWallClockMs,
    );
  }

  async function connectOnce(): Promise<void> {
    if (terminal || stopped) return;
    if (attempts >= budget.maxConnectionAttempts) {
      terminate("attempts_exhausted", "No further connection attempts remain.");
      return;
    }
    if (tokensIssued >= budget.maxTokenIssuances) {
      terminate("tokens_exhausted", "No further transcription tokens remain.");
      return;
    }
    attempts += 1;
    tokensIssued += 1;
    let minted: MintedToken;
    try {
      minted = await options.mintToken();
    } catch {
      handleDisconnect();
      return;
    }
    if (terminal || stopped) return;
    connectionBaseMs = lastCommittedEndMs ?? 0;
    activePartialId = undefined;
    activeSegmentStartSample = undefined;
    latestTransmittedSample = undefined;
    pendingCommitText = undefined;
    const opened = options.connect(connectionUrl(minted.token));
    socket = opened;
    opened.onopen = () => {
      /* Ready for chunk() calls; nothing to send proactively. */
    };
    opened.onmessage = (event) => handleMessage(event.data);
    opened.onerror = () => {
      /* onclose follows every onerror for a real WebSocket; nothing to do here. */
    };
    opened.onclose = () => handleDisconnect();
  }

  function handleMessage(raw: string): void {
    if (terminal || stopped) return;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      emitError("INTERNAL_ERROR", "The transcription service sent an unreadable message.", true);
      return;
    }
    const event = parseWireEvent(parsedJson);
    if (!event) {
      emitError("INTERNAL_ERROR", "The transcription service sent an unrecognized message.", true);
      return;
    }
    reconcile(event);
  }

  function reconcile(event: WireEvent): void {
    if (event.type === "session_started") return;
    if (event.type === "warning") {
      options.onWarning?.(event.message);
      return;
    }
    if (event.type === "error") {
      const mappedCode = NONRETRYABLE_ERROR_CODES[event.code];
      const retryable = isRetryableWireError(event.code);
      emitError(mappedCode, event.message, retryable);
      if (!retryable) terminate("nonretryable_error", event.message);
      return;
    }
    if (event.type === "partial_transcript") {
      if (activeSegmentStartSample === undefined) return; // No audio sent yet to anchor this.
      activePartialId ??= idFactory();
      options.onEvent({
        ...envelope(),
        type: "transcript.partial",
        chunk: {
          partialId: activePartialId,
          sessionId: options.sessionId,
          text: event.text,
          startMs: sampleToAppMs(activeSegmentStartSample),
          endMs: sampleToAppMs(latestTransmittedSample ?? activeSegmentStartSample),
        },
      });
      return;
    }
    if (event.type === "committed_transcript") {
      pendingCommitText = event.text;
      return;
    }
    if (event.type === "committed_transcript_with_timestamps") {
      if (
        pendingCommitText === undefined ||
        normalize(pendingCommitText) !== normalize(event.text)
      ) {
        emitError(
          "INTERNAL_ERROR",
          "A committed transcript's timing could not be matched to its text.",
          true,
        );
        pendingCommitText = undefined;
        return;
      }
      pendingCommitText = undefined;
      const first = event.words[0]!;
      const last = event.words.at(-1)!;
      const startMs = providerSecondsToAppMs(first.start);
      const endMs = providerSecondsToAppMs(last.end);
      if (endMs <= startMs) {
        emitError("INTERNAL_ERROR", "The transcription service returned invalid timing.", true);
        return;
      }
      if (lastCommittedEndMs !== undefined && startMs < lastCommittedEndMs) {
        emitError(
          "INTERNAL_ERROR",
          "The transcription service returned out-of-order timing.",
          true,
        );
        return;
      }
      const identity = `${normalize(event.text)}|${startMs}|${endMs}`;
      if (seenCommittedIdentities.has(identity)) {
        activePartialId = undefined;
        return; // Exact duplicate, most likely from a reconnect boundary: drop silently.
      }
      seenCommittedIdentities.add(identity);
      lastCommittedEndMs = endMs;
      activePartialId = undefined;
      options.onEvent({
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
  }

  function handleDisconnect(): void {
    if (terminal || stopped) return;
    socket = undefined;
    // Discard whatever was sent but never committed in the open segment; it is
    // reported as a gap, never silently replayed as exactly-once delivery.
    if (activeSegmentStartSample !== undefined && latestTransmittedSample !== undefined) {
      options.onDiscardedGap?.({
        startSample: activeSegmentStartSample,
        endSample: latestTransmittedSample,
      });
    }
    lastAcceptedEndSample = latestTransmittedSample ?? lastAcceptedEndSample;
    activeSegmentStartSample = undefined;
    latestTransmittedSample = undefined;
    activePartialId = undefined;
    pendingCommitText = undefined;
    if (reconnects >= budget.maxReconnects) {
      terminate(
        "reconnects_exhausted",
        "The transcription connection was lost and could not be retried.",
      );
      return;
    }
    reconnects += 1;
    const backoffMs = Math.min(1_000 * 2 ** (reconnects - 1), 8_000) * (0.5 + random() * 0.5);
    backoffTimer = setTimer(() => {
      backoffTimer = undefined;
      void connectOnce();
    }, backoffMs);
  }

  function chunk(pcm: PcmChunk): void {
    if (terminal || stopped) return;
    const shapeIssue = validatePcmChunkShape(pcm);
    if (shapeIssue) {
      emitError("INVALID_REQUEST", `Rejected audio chunk (${shapeIssue}).`, false);
      return;
    }
    const continuityIssue = validatePcmContinuity(pcm, lastAcceptedEndSample);
    if (continuityIssue) {
      emitError("INVALID_REQUEST", `Rejected audio chunk (${continuityIssue}).`, false);
      return;
    }
    const sampleCount = pcm.endSample - pcm.startSample;
    const wouldBeSeconds = audioSecondsSent + sampleCount / PCM_SAMPLE_RATE_HZ;
    if (wouldBeSeconds > budget.maxAudioSeconds + 1e-9) {
      terminate("audio_budget_exceeded", "Audio budget exhausted.");
      return;
    }
    lastAcceptedEndSample = pcm.endSample;
    audioSecondsSent = wouldBeSeconds;
    activeSegmentStartSample ??= pcm.startSample;
    latestTransmittedSample = pcm.endSample;
    if (!socket) return; // Between connections: audio is validated and accounted, then dropped.
    const message: Record<string, unknown> = {
      audio_base_64: base64FromPcmBytes(pcm.bytes),
      sample_rate: PCM_SAMPLE_RATE_HZ,
      commit: false,
    };
    if (!sentInitialContext && options.initialContext) {
      message.previous_text = options.initialContext.slice(0, 50);
    }
    sentInitialContext = true;
    socket.send(JSON.stringify(message));
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    terminal = "stopped";
    stopAllTimers();
    socket?.close();
    socket = undefined;
  }

  scheduleDeadline();
  void connectOnce();

  return { chunk, stop };
}
