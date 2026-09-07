import {
  SCRIBE_AUDIO_FORMAT,
  SCRIBE_COMMIT_STRATEGY,
  SCRIBE_MODEL_ID,
  ScribeTokenRequestSchema,
} from "@livelecture/shared";
import { mintScribeRealtimeToken, ScribeTokenMintError } from "./eleven-labs-client";

/**
 * TASK-102 — the protected local-spike-only route that mints a short-lived
 * ElevenLabs realtime-transcription token. This is a self-contained
 * dispatcher, deliberately separate from `demo-api.ts`: it has its own
 * origin/host/capability rules and its own hard issuance cap, and it is
 * disabled unless explicitly turned on for a local spike run.
 *
 * "These loopback/origin/capability/issuance controls bound a local
 * feasibility spike; they are not production user authorization." — TASK-102.
 */

const MAX_BODY_BYTES = 1_024;
const DEFAULT_MAX_ISSUANCES = 2;
export const CAPABILITY_HEADER = "x-livelecture-spike-capability";

export interface RealtimeTokenHandlerOptions {
  /** Off by default. The launcher is the only intended caller that turns this on. */
  enabled: boolean;
  /** The exact `chrome-extension://<id>` origin this run's extension build uses. */
  extensionId?: string;
  /** The one-run random capability value the launcher generated. Never logged. */
  capabilityToken?: string;
  /** Never logged, never echoed, never reaches a thrown error's message. */
  apiKey?: string;
  maxIssuances?: number;
  mintToken?: typeof mintScribeRealtimeToken;
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": `Content-Type, ${CAPABILITY_HEADER}`,
    Vary: "Origin",
  };
}

function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

export function createRealtimeTokenHandler({
  enabled,
  extensionId,
  capabilityToken,
  apiKey,
  maxIssuances = DEFAULT_MAX_ISSUANCES,
  mintToken = mintScribeRealtimeToken,
}: RealtimeTokenHandlerOptions) {
  let issued = 0;
  const expectedOrigin = extensionId ? `chrome-extension://${extensionId}` : undefined;
  const misconfigured = !enabled || !expectedOrigin || !capabilityToken || !apiKey;

  return async function handleRealtimeTokenRequest(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      if (!enabled || !expectedOrigin || origin !== expectedOrigin)
        return new Response(null, { status: 404 });
      return new Response(null, { status: 204, headers: corsHeaders(expectedOrigin) });
    }

    // Every failure below happens before the upstream fetch, and before any
    // response identifies which specific check failed — a wrong origin, a
    // missing capability, and a disabled route all look the same from outside.
    const fail = (status: number) =>
      new Response(null, { status, headers: { "Cache-Control": "no-store" } });

    if (misconfigured || request.method !== "POST") return fail(404);
    if (!isLoopbackHost(request.headers.get("host"))) return fail(404);
    if (origin !== expectedOrigin) return fail(404);
    if (request.headers.get(CAPABILITY_HEADER) !== capabilityToken) return fail(404);
    if ((request.headers.get("content-type") ?? "").split(";")[0]?.trim() !== "application/json")
      return fail(415);

    const contentLength = request.headers.get("content-length");
    if (
      contentLength !== null &&
      (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)
    )
      return fail(413);

    let body: unknown;
    try {
      const text = await request.text();
      if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return fail(413);
      body = text.length === 0 ? {} : JSON.parse(text);
    } catch {
      return fail(400);
    }
    if (!ScribeTokenRequestSchema.safeParse(body).success) return fail(400);

    if (issued >= maxIssuances) return fail(429);
    // Reserve the slot before contacting the upstream: a slow or failed mint
    // must not let a concurrent request slip past the cap.
    issued += 1;

    try {
      const minted = await mintToken({ apiKey });
      return Response.json(
        {
          token: minted.token,
          expiresInSeconds: minted.expiresInSeconds,
          modelId: SCRIBE_MODEL_ID,
          audioFormat: SCRIBE_AUDIO_FORMAT,
          commitStrategy: SCRIBE_COMMIT_STRATEGY,
        },
        { headers: { "Cache-Control": "no-store", ...corsHeaders(expectedOrigin!) } },
      );
    } catch (error) {
      // The mint adapter already stripped any provider-specific detail; this
      // route adds nothing further that could leak the key or upstream body.
      void (error instanceof ScribeTokenMintError ? error.code : "unexpected");
      return fail(502);
    }
  };
}
