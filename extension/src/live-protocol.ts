import { z } from "zod";
import { StableIdSchema, TranscriptEventSchema } from "@livelecture/shared";

export const LIVE_CHANNEL = "livelecture-live-test-v1";
// Extension-private notification; provider strings never become UI copy.
export const LiveStoppedSchema = z
  .object({
    channel: z.literal(LIVE_CHANNEL),
    kind: z.literal("stopped"),
    generation: z.number().int().positive(),
    sessionId: StableIdSchema,
    reason: z.literal("retention_active"),
  })
  .strict();
export type LiveStoppedMessage = z.infer<typeof LiveStoppedSchema>;
export const LIVE_STOP_ACK_MS = 250;
export const LiveCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      channel: z.literal(LIVE_CHANNEL),
      kind: z.literal("start"),
      generation: z.number().int().positive(),
      sessionId: StableIdSchema,
      capability: z.string().regex(/^[a-f0-9]{32}$/),
    })
    .strict(),
  z
    .object({
      channel: z.literal(LIVE_CHANNEL),
      kind: z.enum(["heartbeat", "stop"]),
      generation: z.number().int().positive(),
      sessionId: StableIdSchema,
    })
    .strict(),
]);
export const LiveEventSchema = z
  .object({
    channel: z.literal(LIVE_CHANNEL),
    kind: z.literal("event"),
    generation: z.number().int().positive(),
    event: TranscriptEventSchema,
  })
  .strict();
export const LIVE_TEST_BUDGET = {
  maxAudioSeconds: 90,
  maxWallClockMs: 90_000,
  maxConnectionAttempts: 2,
  maxTokenIssuances: 2,
  maxReconnects: 1,
} as const;
