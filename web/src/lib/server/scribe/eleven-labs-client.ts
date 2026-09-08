import { z } from "zod";
import { readBoundedJson, withDeadline, ScribeHttpError } from "./bounded-http";

/**
 * TASK-102 — server-only adapter for ElevenLabs' single-use realtime-token
 * endpoint. This is the ONLY place `ELEVENLABS_API_KEY` and the raw provider
 * HTTP response are ever touched; the route above it sees only the mapped,
 * application-shaped result.
 *
 * POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe
 * https://elevenlabs.io/docs/api-reference/tokens/create (checked 2026-09-07):
 * three token types exist ("realtime_scribe", "batch_scribe",
 * "tts_websocket"); the response is `{ token }`, described as expiring after
 * 15 minutes — the API does not return that expiry as a separate field.
 */
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const TOKEN_ENDPOINT_PATH = "/v1/single-use-token/realtime_scribe";
export const SCRIBE_TOKEN_TTL_SECONDS = 900;
export const UPSTREAM_TIMEOUT_MS = 5_000;

type FailureCode = "configuration" | "timeout" | "transport" | "upstream" | "response";
export class ScribeTokenMintError extends Error {
  constructor(readonly code: FailureCode) {
    super(`Could not obtain a transcription token (${code}).`);
    this.name = "ScribeTokenMintError";
  }
}

/** Only the one field this adapter actually needs from the provider's
 * response; everything else the provider might add is ignored, not trusted. */
const ElevenLabsTokenResponseSchema = z.object({ token: z.string().min(1).max(4_096) });

export interface MintScribeTokenOptions {
  apiKey: string;
  fetcher?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function mintScribeRealtimeToken({
  apiKey,
  fetcher = globalThis.fetch,
  baseUrl = ELEVENLABS_BASE_URL,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
  signal,
}: MintScribeTokenOptions): Promise<{ token: string; expiresInSeconds: number }> {
  if (typeof apiKey !== "string" || apiKey.length === 0)
    throw new ScribeTokenMintError("configuration");
  try {
    return await withDeadline(
      async (boundedSignal) => {
        const response = await fetcher(baseUrl + TOKEN_ENDPOINT_PATH, {
          method: "POST",
          headers: { "xi-api-key": apiKey, Accept: "application/json" },
          signal: boundedSignal,
          redirect: "error",
          cache: "no-store",
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => undefined);
          throw new ScribeTokenMintError("upstream");
        }
        const raw = await readBoundedJson(response.body, 8192, boundedSignal);
        const parsed = ElevenLabsTokenResponseSchema.safeParse(raw);
        if (!parsed.success || parsed.data.token === apiKey)
          throw new ScribeTokenMintError("response");
        return { token: parsed.data.token, expiresInSeconds: SCRIBE_TOKEN_TTL_SECONDS };
      },
      timeoutMs,
      signal,
    );
  } catch (error) {
    if (error instanceof ScribeTokenMintError) throw error;
    if (error instanceof ScribeHttpError && error.status === 408)
      throw new ScribeTokenMintError("timeout");
    if (error instanceof SyntaxError || error instanceof ScribeHttpError)
      throw new ScribeTokenMintError("response");
    throw new ScribeTokenMintError("transport");
  }
}
