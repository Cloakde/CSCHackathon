import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { COST_ACK } from "./run-local-scribe-spike.mjs";

export function validateFixture(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length < 3200 ||
    bytes.length > 30 * 32000 ||
    bytes.length % 3200 !== 0 ||
    !bytes.some((value) => value !== 0)
  )
    throw new Error(
      "Use non-silent synthetic mono PCM16LE, 16 kHz, in 0.1-second units, at most 30 seconds.",
    );
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
  validateFixture(bytes);
  const started = now(),
    events = [],
    gaps = [],
    warnings = [];
  let tokenIssuances = 0,
    connections = 0,
    forcedDisconnect = false,
    socket,
    committedBeforeReconnect = 0;
  const transport = createTransport({
    sessionId: "scribe_synthetic_smoke",
    budget: {
      maxAudioSeconds: 30,
      maxWallClockMs: 90000,
      maxConnectionAttempts: 2,
      maxTokenIssuances: 2,
      maxReconnects: 1,
    },
    mintToken: async (signal) => {
      tokenIssuances += 1;
      return mintToken(signal);
    },
    connect: (url) => {
      connections += 1;
      socket = connect(url);
      return socket;
    },
    onEvent: (event) => {
      if (!validateEvent(event)) throw new Error("Invalid canonical event.");
      events.push(event);
      log(
        JSON.stringify({
          type: event.type,
          sequence: event.sequence,
          ...(event.type === "transcript.committed"
            ? { startMs: event.chunk.startMs, endMs: event.chunk.endMs }
            : {}),
        }),
      );
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
    onWarning: (warning) => {
      warnings.push(warning);
      log("RETENTION_ACTIVE");
    },
    onDiscardedGap: (gap) => {
      gaps.push(gap);
      log(JSON.stringify({ gap }));
    },
  });
  const alive = () => {
    if (
      now() - started >= 90000 ||
      events.some((e) => e.type === "source.error" && !e.error.retryable)
    )
      throw new Error("The bounded transcription smoke failed.");
  };
  try {
    while (!transport.isReady()) {
      alive();
      await wait(20);
    }
    for (let offset = 0; offset < bytes.length; offset += 3200) {
      alive();
      transport.chunk({
        startSample: offset / 2,
        endSample: (offset + 3200) / 2,
        bytes: bytes.subarray(offset, offset + 3200),
      });
      await wait(100);
    }
    const drainUntil = Math.min(started + 89000, now() + 5000);
    while (now() < drainUntil) {
      alive();
      await wait(100);
    }
    const committed = events.filter((e) => e.type === "transcript.committed");
    if (
      !forcedDisconnect ||
      tokenIssuances !== 2 ||
      connections !== 2 ||
      committed.length <= committedBeforeReconnect ||
      !gaps.length ||
      !events.some((e) => e.type === "transcript.partial")
    )
      throw new Error("Required transcription/reconnect evidence is missing.");
    for (let i = 1; i < committed.length; i++)
      if (committed[i].chunk.startMs < committed[i - 1].chunk.endMs)
        throw new Error("Transcript timing regressed.");
    return {
      durationMs: now() - started,
      tokenIssuances,
      connections,
      commits: committed.length,
      canonicalValidation: true,
      retention: warnings.length ? "RETENTION_ACTIVE" : "not independently confirmed",
      costDelta: "Operator must record the actual account cost delta separately.",
    };
  } finally {
    transport.stop();
  }
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
  validateFixture(bytes);
  const hash = createHash("sha256")
    .update(await readFile(env.SCRIBE_TRANSPORT_ARTIFACT))
    .digest("hex");
  if (hash !== env.SCRIBE_TRANSPORT_HASH) throw new Error("Transport artifact changed.");
  const { createScribeRealtimeTransport, validateEvent, validateToken } = await import(
    pathToFileURL(env.SCRIBE_TRANSPORT_ARTIFACT).href
  );
  console.log(JSON.stringify({ transportHash: hash }));
  const result = await runSmoke({
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
  console.log(JSON.stringify(result));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error("The bounded Scribe smoke failed. No provider detail was logged.");
    process.exitCode = 1;
  });
