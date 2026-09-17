import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { COST_ACK } from "./run-local-scribe-spike.mjs";
import { validateVadFixture } from "./scribe-fixture.mjs";
export { validateFixture } from "./scribe-fixture.mjs";

export class ScribeSmokeFailure extends Error {
  constructor(summary) {
    super("The bounded Scribe smoke failed: " + summary.failureCode + ".");
    this.name = "ScribeSmokeFailure";
    this.summary = summary;
  }
}
// Runtime and network adapters are injected in offline tests. No synthetic fake
// transcript is used by the paid path: it must receive real canonical events.
export async function runSmoke({
  createTransport,
  validateEvent,
  bytes,
  mintToken,
  connect,
  wait,
  now = Date.now,
  log = console.log,
}) {
  // Reject the old continuously spoken crop before minting any token.
  validateVadFixture(bytes);
  const started = now(),
    events = [],
    gaps = [],
    warnings = [];
  let tokenAttempts = 0,
    tokenIssuances = 0,
    connectionAttempts = 0,
    connections = 0,
    forcedDisconnect = false,
    socket,
    transport,
    committedBeforeReconnect = 0,
    committedAfterReconnect = 0,
    invalidEvent = false,
    audioSamplesOffered = 0,
    audioSamplesSent = 0,
    failureCode = null;
  const fail = (code) => {
    failureCode = code;
    throw new Error("Bounded smoke failed.");
  };
  const alive = () => {
    if (invalidEvent) fail("invalid_canonical_event");
    if (now() - started >= 90000) fail("deadline");
    if (events.some((e) => e.type === "source.error" && !e.retryable)) fail("source_error");
  };
  try {
    transport = createTransport({
      sessionId: "scribe_synthetic_smoke",
      budget: {
        maxAudioSeconds: 30,
        maxWallClockMs: 90000,
        maxConnectionAttempts: 2,
        maxTokenIssuances: 2,
        maxReconnects: 1,
      },
      mintToken: async (signal) => {
        tokenAttempts += 1;
        const token = await mintToken(signal);
        tokenIssuances += 1;
        return token;
      },
      connect: (url) => {
        connectionAttempts += 1;
        socket = connect(url);
        connections += 1;
        return socket;
      },
      onEvent: (event) => {
        if (!validateEvent(event)) {
          invalidEvent = true;
          return;
        }
        // Keep only counters/timing; never retain or log provider text/errors.
        const safe = {
          type: event.type,
          sequence: event.sequence,
          ...(event.type === "transcript.committed"
            ? { startMs: event.chunk.startMs, endMs: event.chunk.endMs }
            : {}),
          ...(event.type === "source.error" ? { retryable: event.error.retryable } : {}),
        };
        events.push(safe);
        log(JSON.stringify(safe));
        if (event.type === "transcript.committed" && forcedDisconnect && connections === 2)
          committedAfterReconnect++;
        if (
          !forcedDisconnect &&
          event.type === "transcript.partial" &&
          events.some((e) => e.type === "transcript.committed")
        ) {
          forcedDisconnect = true;
          committedBeforeReconnect = events.filter((e) => e.type === "transcript.committed").length;
          socket?.close(); // Force loss in a new uncommitted segment.
        }
      },
      onWarning: () => {
        warnings.push(true);
        log("RETENTION_ACTIVE");
      },
      onDiscardedGap: (gap) => {
        gaps.push(gap);
        log(JSON.stringify({ gap }));
      },
    });
    while (!transport.isReady()) {
      alive();
      await wait(20);
    }
    for (let offset = 0; offset < bytes.length; offset += 3200) {
      alive();
      audioSamplesOffered += 1600;
      const sent = transport.chunk({
        startSample: offset / 2,
        endSample: (offset + 3200) / 2,
        bytes: bytes.subarray(offset, offset + 3200),
      });
      if (sent) audioSamplesSent += 1600;
      await wait(100);
    }
    const drainUntil = Math.min(started + 89000, now() + 5000);
    while (now() < drainUntil) {
      alive();
      await wait(100);
    }
    alive();
    const committed = events.filter((e) => e.type === "transcript.committed");
    if (
      !forcedDisconnect ||
      tokenIssuances !== 2 ||
      connections !== 2 ||
      committedAfterReconnect === 0 ||
      !gaps.length ||
      !events.some((e) => e.type === "transcript.partial")
    )
      fail("missing_transcription_or_reconnect_evidence");
    for (let i = 1; i < committed.length; i++)
      if (committed[i].startMs < committed[i - 1].endMs) fail("timing_regressed");
  } catch {
    failureCode ??= "transport_failure";
  } finally {
    try {
      transport?.stop();
    } catch {
      failureCode ??= "cleanup_failure";
    }
  }
  const summary = {
    type: "scribe_smoke_result",
    status: failureCode ? "fail" : "pass",
    failureCode,
    durationMs: now() - started,
    tokenAttempts,
    tokenIssuances,
    connectionAttempts,
    connections,
    forcedDisconnect,
    partials: events.filter((e) => e.type === "transcript.partial").length,
    commits: events.filter((e) => e.type === "transcript.committed").length,
    committedBeforeReconnect,
    committedAfterReconnect,
    discardedGapCount: gaps.length,
    audioSecondsOffered: audioSamplesOffered / 16000,
    audioSecondsSent: audioSamplesSent / 16000,
    canonicalValidation: events.length > 0 && !invalidEvent,
    retention: warnings.length ? "RETENTION_ACTIVE" : "not independently confirmed",
    costDelta: "Operator must record the actual account cost delta separately.",
  };
  log(JSON.stringify(summary));
  if (failureCode) throw new ScribeSmokeFailure(summary);
  return summary;
}
export async function main(env = process.env) {
  if (
    env.RUN_PAID_SCRIBE_SMOKE !== COST_ACK ||
    env.CI ||
    env.SCRIBE_SYNTHETIC_AUDIO_CONFIRMED !== "synthetic-speech-only"
  )
    throw new Error("No paid smoke authorization.");
  const origin = env.LIVELECTURE_SPIKE_ORIGIN;
  if (
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin ?? "") ||
    !/^[a-p]{32}$/.test(env.LIVELECTURE_EXTENSION_ID ?? "") ||
    !env.LIVELECTURE_SPIKE_CAPABILITY ||
    !env.SCRIBE_TRANSPORT_ARTIFACT ||
    !/^[a-f0-9]{64}$/.test(env.SCRIBE_TRANSPORT_HASH ?? "")
  )
    throw new Error("Invalid smoke configuration.");
  const bytes = new Uint8Array(await readFile(env.SCRIBE_SYNTHETIC_PCM));
  validateVadFixture(bytes);
  const hash = createHash("sha256")
    .update(await readFile(env.SCRIBE_TRANSPORT_ARTIFACT))
    .digest("hex");
  if (hash !== env.SCRIBE_TRANSPORT_HASH) throw new Error("Transport artifact changed.");
  const { createScribeRealtimeTransport, validateEvent, validateToken } = await import(
    pathToFileURL(env.SCRIBE_TRANSPORT_ARTIFACT).href
  );
  console.log(JSON.stringify({ transportHash: hash }));
  await runSmoke({
    createTransport: createScribeRealtimeTransport,
    validateEvent,
    bytes,
    mintToken: async (signal) => {
      const response = await fetch(origin + "/api/providers/elevenlabs/realtime-token", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
        headers: {
          "Content-Type": "application/json",
          Origin: "chrome-extension://" + env.LIVELECTURE_EXTENSION_ID,
          "x-livelecture-spike-capability": env.LIVELECTURE_SPIKE_CAPABILITY,
        },
        body: "{}",
      });
      if (!response.ok) throw new Error("Token route rejected the request.");
      return validateToken(await response.json());
    },
    connect: (url) => new WebSocket(url),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error("The bounded Scribe smoke failed. No provider detail was logged.");
    process.exitCode = 1;
  });
