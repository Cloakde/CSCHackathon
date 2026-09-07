import process from "node:process";

/**
 * TASK-102 — the capped paid smoke harness. Spawned only by
 * run-local-scribe-spike.mjs, with the one-run capability and the spike
 * server's origin in its environment — never a permanent provider key.
 *
 * This harness has never been run: no paid ElevenLabs call has been made in
 * this preparation phase. It exists so the exact transport artifact (not a
 * duplicated wire-protocol implementation) can be exercised once the
 * Product Owner separately authorizes a capped run. See ADR 0005.
 *
 * It imports and drives extension/src/transcription/scribe-transport.ts
 * directly, injecting only real fetch/WebSocket/clock — never reimplementing
 * the URL builder, frame parser, reconciliation, retry, deduplication, or
 * canonical-event mapping that module already owns.
 */

const MAX_AUDIO_SECONDS = 30;
const WALL_CLOCK_BUDGET_MS = 90_000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** 16 kHz mono silence — a synthetic signal only. No real audio is captured
 * or transmitted by this harness. */
function silentPcmChunk(startSample, seconds) {
  const sampleCount = Math.round(16_000 * seconds);
  return {
    startSample,
    endSample: startSample + sampleCount,
    bytes: new Uint8Array(sampleCount * 2),
  };
}

async function mintTokenViaRoute(origin, capability) {
  const response = await fetch(`${origin}/api/providers/elevenlabs/realtime-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-livelecture-spike-capability": capability,
      Origin: process.env.LIVELECTURE_EXTENSION_ORIGIN ?? "chrome-extension://smoke-harness",
    },
    body: "{}",
  });
  if (!response.ok)
    throw new Error(`Token route rejected the request (status ${response.status}).`);
  return response.json();
}

export async function main() {
  const origin = requireEnv("LIVELECTURE_SPIKE_ORIGIN");
  const capability = requireEnv("LIVELECTURE_SPIKE_CAPABILITY");

  // Imported lazily so a syntax/import error in the transport itself is
  // reported clearly, distinct from an environment/configuration failure above.
  const { createScribeRealtimeTransport } =
    await import("../../extension/src/transcription/scribe-transport.ts");

  const events = [];
  let tokenIssuances = 0;
  const startedAt = Date.now();

  const transport = createScribeRealtimeTransport({
    sessionId: "smoke_harness_session",
    mintToken: async () => {
      tokenIssuances += 1;
      const minted = await mintTokenViaRoute(origin, capability);
      return { token: minted.token, expiresInSeconds: minted.expiresInSeconds };
    },
    connect: (url) => new WebSocket(url),
    budget: {
      maxAudioSeconds: MAX_AUDIO_SECONDS,
      maxWallClockMs: WALL_CLOCK_BUDGET_MS,
      maxConnectionAttempts: 2,
      maxTokenIssuances: 2,
      maxReconnects: 1,
    },
    onEvent: (event) => {
      // Redacted: event type, timing, and sequence only — never transcript text.
      events.push({ type: event.type, sequence: event.sequence });
      console.log(`[event] ${event.type} seq=${event.sequence}`);
    },
    onWarning: (message) => console.log(`[warning] ${message.length} chars`),
    onDiscardedGap: (gap) => console.log(`[gap] ${gap.startSample}-${gap.endSample}`),
  });

  let sentSeconds = 0;
  while (sentSeconds < MAX_AUDIO_SECONDS) {
    const seconds = Math.min(0.5, MAX_AUDIO_SECONDS - sentSeconds);
    transport.chunk(silentPcmChunk(Math.round(sentSeconds * 16_000), seconds));
    sentSeconds += seconds;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1_000));
  }
  transport.stop();

  console.log(
    JSON.stringify({
      durationMs: Date.now() - startedAt,
      tokenIssuances,
      eventCount: events.length,
      eventTypes: [...new Set(events.map((event) => event.type))],
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke harness failed.");
  process.exitCode = 1;
});
