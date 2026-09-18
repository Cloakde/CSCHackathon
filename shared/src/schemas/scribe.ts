import { z } from "zod";

/**
 * TASK-102 — the application-level contract for the protected ElevenLabs
 * realtime-token route. This module intentionally knows nothing about raw
 * ElevenLabs wire events: those stay inside the extension-private transport
 * adapter so no provider-specific type ever escapes it.
 */

/** Deliberately empty and strict: this route needs no client-supplied
 * parameters, and a strict schema rejects any unexpected field before the
 * request reaches the upstream fetch. */
export const ScribeTokenRequestSchema = z.object({}).strict();

export const SCRIBE_MODEL_ID = "scribe_v2_realtime" as const;
export const SCRIBE_AUDIO_FORMAT = "pcm_16000" as const;
export const SCRIBE_REALTIME_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime" as const;
/** ElevenLabs' own realtime STT guide recommends VAD specifically for
 * continuous, microphone-like streaming such as a live lecture; "manual" is
 * the default but requires the client to decide when to commit. See ADR 0005
 * for the citation. */
export const SCRIBE_COMMIT_STRATEGY = "vad" as const;

export const ScribeTokenResponseSchema = z
  .object({
    /** Opaque, single-use. Never logged, cached, or echoed anywhere else. */
    token: z.string().min(1).max(4_096),
    /** ElevenLabs documents this token as expiring after 15 minutes; the
     * route does not invent a tighter number the provider hasn't stated. */
    expiresInSeconds: z.number().int().positive().max(900),
    modelId: z.literal(SCRIBE_MODEL_ID),
    audioFormat: z.literal(SCRIBE_AUDIO_FORMAT),
    commitStrategy: z.literal(SCRIBE_COMMIT_STRATEGY),
  })
  .strict();

export const SCRIBE_SAMPLE_RATE_HZ = 16_000;

export type ScribeTokenRequest = z.infer<typeof ScribeTokenRequestSchema>;
export type ScribeTokenResponse = z.infer<typeof ScribeTokenResponseSchema>;
