import { z } from "zod";

import {
  ApiErrorDetailSchema,
  OffsetMsSchema,
  SchemaVersionSchema,
  StableIdSchema,
  UtcTimestampSchema,
} from "./common";

export const SourceModeSchema = z.enum(["simulation", "live"]);
export const SourceStatusSchema = z.enum([
  "idle",
  "starting",
  "active",
  "stopping",
  "stopped",
  "error",
]);

export const TranscriptChunkSchema = z
  .object({
    chunkId: StableIdSchema,
    sessionId: StableIdSchema,
    sequence: z.number().int().nonnegative(),
    text: z.string().trim().min(1).max(10_000),
    startMs: OffsetMsSchema,
    endMs: OffsetMsSchema,
    speakerLabel: z.string().trim().min(1).max(80).optional(),
  })
  .superRefine((chunk, context) => {
    if (chunk.endMs <= chunk.startMs) {
      context.addIssue({
        code: "custom",
        message: "Committed transcript chunks must have positive duration",
        path: ["endMs"],
      });
    }
  });

export const PartialTranscriptChunkSchema = z
  .object({
    partialId: StableIdSchema,
    sessionId: StableIdSchema,
    text: z.string().trim().min(1).max(10_000),
    startMs: OffsetMsSchema,
    endMs: OffsetMsSchema,
    speakerLabel: z.string().trim().min(1).max(80).optional(),
  })
  .superRefine((chunk, context) => {
    if (chunk.endMs < chunk.startMs) {
      context.addIssue({
        code: "custom",
        message: "endMs must be greater than or equal to startMs",
        path: ["endMs"],
      });
    }
  });

const EventEnvelopeShape = {
  schemaVersion: SchemaVersionSchema,
  eventId: StableIdSchema,
  sessionId: StableIdSchema,
  sequence: z.number().int().nonnegative(),
  emittedAt: UtcTimestampSchema,
};

export const SourceStateEventSchema = z.object({
  ...EventEnvelopeShape,
  type: z.literal("source.state"),
  sourceMode: SourceModeSchema,
  status: SourceStatusSchema,
});

export const SessionStartedEventSchema = z.object({
  ...EventEnvelopeShape,
  type: z.literal("session.started"),
  sourceMode: SourceModeSchema,
  startedAt: UtcTimestampSchema,
  title: z.string().trim().min(1).max(160).optional(),
  subject: z.string().trim().min(1).max(120).optional(),
});

export const TranscriptPartialEventSchema = z.object({
  ...EventEnvelopeShape,
  type: z.literal("transcript.partial"),
  chunk: PartialTranscriptChunkSchema,
});

export const TranscriptCommittedEventSchema = z.object({
  ...EventEnvelopeShape,
  type: z.literal("transcript.committed"),
  chunk: TranscriptChunkSchema,
});

export const SessionEndedEventSchema = z.object({
  ...EventEnvelopeShape,
  type: z.literal("session.ended"),
  endedAt: UtcTimestampSchema,
});

export const SourceErrorEventSchema = z.object({
  ...EventEnvelopeShape,
  type: z.literal("source.error"),
  sourceMode: SourceModeSchema,
  error: ApiErrorDetailSchema,
});

export const TranscriptEventSchema = z
  .discriminatedUnion("type", [
    SourceStateEventSchema,
    SessionStartedEventSchema,
    TranscriptPartialEventSchema,
    TranscriptCommittedEventSchema,
    SessionEndedEventSchema,
    SourceErrorEventSchema,
  ])
  .superRefine((event, context) => {
    if (
      (event.type === "transcript.partial" || event.type === "transcript.committed") &&
      event.chunk.sessionId !== event.sessionId
    ) {
      context.addIssue({
        code: "custom",
        message: "Transcript chunk must belong to the event session",
        path: ["chunk", "sessionId"],
      });
    }
  });

export type SourceMode = z.infer<typeof SourceModeSchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
export type TranscriptChunk = z.infer<typeof TranscriptChunkSchema>;
export type PartialTranscriptChunk = z.infer<typeof PartialTranscriptChunkSchema>;
export type TranscriptEvent = z.infer<typeof TranscriptEventSchema>;
