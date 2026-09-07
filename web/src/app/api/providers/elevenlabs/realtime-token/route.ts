import { createRealtimeTokenHandler } from "../../../../../lib/server/scribe/realtime-token-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every value here comes from the launcher's own child-process environment
// (see scripts/manual/run-local-scribe-spike.mjs) — never from a committed
// .env file, and never logged. Reading them at module scope, once, matches
// this route's explicit local-spike-only lifetime.
const handler = createRealtimeTokenHandler({
  enabled: process.env.LIVE_SCRIBE_SPIKE_ENABLED === "true",
  extensionId: process.env.LIVELECTURE_EXTENSION_ID,
  capabilityToken: process.env.LIVELECTURE_SPIKE_CAPABILITY,
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export const POST = handler;
export const OPTIONS = handler;
