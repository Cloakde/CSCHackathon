import { z } from "zod";

import { StableIdSchema, UtcTimestampSchema } from "./common";
import { ConfusionEventSchema, type ConfusionEvent } from "./study";
import { SourceModeSchema, TranscriptChunkSchema, type TranscriptChunk } from "./transcript";

export const SessionStatusSchema = z.enum(["active", "completed"]);

const LectureSessionBaseShape = {
  sessionId: StableIdSchema,
  title: z.string().trim().min(1).max(160).optional(),
  subject: z.string().trim().min(1).max(120).optional(),
  sourceMode: SourceModeSchema,
  startedAt: UtcTimestampSchema,
};

export const ActiveLectureSessionSchema = z.object({
  ...LectureSessionBaseShape,
  status: z.literal("active"),
  endedAt: z.never().optional(),
});

export const CompletedLectureSessionSchema = z
  .object({
    ...LectureSessionBaseShape,
    status: z.literal("completed"),
    endedAt: UtcTimestampSchema,
  })
  .superRefine((session, context) => {
    if (Date.parse(session.endedAt) < Date.parse(session.startedAt)) {
      context.addIssue({
        code: "custom",
        message: "endedAt cannot be before startedAt",
        path: ["endedAt"],
      });
    }
  });

export const LectureSessionSchema = z.union([
  ActiveLectureSessionSchema,
  CompletedLectureSessionSchema,
]);

export const StartSessionRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    subject: z.string().trim().min(1).max(120).optional(),
    sourceMode: SourceModeSchema,
  })
  .strict();

export const StartSessionResponseSchema = z.object({
  session: ActiveLectureSessionSchema,
});

export const EndSessionRequestSchema = z
  .object({
    endedAt: UtcTimestampSchema,
  })
  .strict();

export const SessionHandoffSchema = z
  .object({
    sessionId: StableIdSchema,
    companionRoute: z
      .string()
      .regex(/^\/sessions\/[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/, "Use a path-only session route"),
  })
  .superRefine((handoff, context) => {
    if (handoff.companionRoute !== `/sessions/${handoff.sessionId}`) {
      context.addIssue({
        code: "custom",
        message: "Companion route must contain the same session ID",
        path: ["companionRoute"],
      });
    }
  });

export const EndSessionResponseSchema = z
  .object({
    session: CompletedLectureSessionSchema,
    handoff: SessionHandoffSchema,
  })
  .superRefine((response, context) => {
    if (response.handoff.sessionId !== response.session.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Handoff must reference the completed session",
        path: ["handoff", "sessionId"],
      });
    }
  });

interface SessionViewValidationTarget {
  session: z.infer<typeof LectureSessionSchema>;
  committedChunks: TranscriptChunk[];
  confusionEvents: ConfusionEvent[];
}

function validateSessionView(view: SessionViewValidationTarget, context: z.RefinementCtx): void {
  const chunksById = new Map<string, TranscriptChunk>();
  const chunkSequences = new Set<number>();
  let previousSequence = -1;
  let previousEndMs = 0;
  const completedDurationMs =
    view.session.status === "completed"
      ? Date.parse(view.session.endedAt) - Date.parse(view.session.startedAt)
      : undefined;

  view.committedChunks.forEach((chunk, chunkIndex) => {
    if (chunk.sessionId !== view.session.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Committed chunk belongs to another session",
        path: ["committedChunks", chunkIndex, "sessionId"],
      });
    }
    if (chunksById.has(chunk.chunkId)) {
      context.addIssue({
        code: "custom",
        message: "Committed chunk IDs must be unique",
        path: ["committedChunks", chunkIndex, "chunkId"],
      });
    }
    if (chunkSequences.has(chunk.sequence)) {
      context.addIssue({
        code: "custom",
        message: "Committed chunk sequences must be unique",
        path: ["committedChunks", chunkIndex, "sequence"],
      });
    }
    if (chunk.sequence <= previousSequence) {
      context.addIssue({
        code: "custom",
        message: "Committed chunks must be ordered by increasing sequence",
        path: ["committedChunks", chunkIndex, "sequence"],
      });
    }
    if (chunk.startMs < previousEndMs) {
      context.addIssue({
        code: "custom",
        message: "Committed chunk time cannot overlap or move backward",
        path: ["committedChunks", chunkIndex, "startMs"],
      });
    }
    if (completedDurationMs !== undefined && chunk.endMs > completedDurationMs) {
      context.addIssue({
        code: "custom",
        message: "Committed chunk extends beyond the completed session",
        path: ["committedChunks", chunkIndex, "endMs"],
      });
    }
    chunksById.set(chunk.chunkId, chunk);
    chunkSequences.add(chunk.sequence);
    previousSequence = chunk.sequence;
    previousEndMs = chunk.endMs;
  });

  const confusionIds = new Set<string>();
  const assistanceResponseIds = new Set<string>();
  const authoritativeProgressMs = view.committedChunks.at(-1)?.endMs;
  view.confusionEvents.forEach((event, eventIndex) => {
    if (event.sessionId !== view.session.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Confusion event belongs to another session",
        path: ["confusionEvents", eventIndex, "sessionId"],
      });
    }
    if (confusionIds.has(event.confusionId)) {
      context.addIssue({
        code: "custom",
        message: "Confusion event IDs must be unique",
        path: ["confusionEvents", eventIndex, "confusionId"],
      });
    }
    if (assistanceResponseIds.has(event.assistanceResponseId)) {
      context.addIssue({
        code: "custom",
        message: "Assistance response IDs must be unique",
        path: ["confusionEvents", eventIndex, "assistanceResponseId"],
      });
    }
    const referencedChunkIds = [
      ...(event.anchorChunkId ? [event.anchorChunkId] : []),
      ...event.contextChunkIds,
      ...event.evidenceChunkIds,
    ];
    referencedChunkIds.forEach((chunkId) => {
      const chunk = chunksById.get(chunkId);
      if (!chunk) {
        context.addIssue({
          code: "custom",
          message: "Confusion event references a chunk absent from this session view",
          path: ["confusionEvents", eventIndex],
        });
      } else if (chunk.endMs > event.occurredAtMs) {
        context.addIssue({
          code: "custom",
          message: "Confusion event references transcript content from its future",
          path: ["confusionEvents", eventIndex, "occurredAtMs"],
        });
      }
    });
    if (
      (authoritativeProgressMs === undefined && event.occurredAtMs !== 0) ||
      (authoritativeProgressMs !== undefined && event.occurredAtMs > authoritativeProgressMs)
    ) {
      context.addIssue({
        code: "custom",
        message: "Confusion event exceeds authoritative transcript progress",
        path: ["confusionEvents", eventIndex, "occurredAtMs"],
      });
    }
    const expectedAnchorChunkId = view.committedChunks
      .filter((chunk) => chunk.endMs <= event.occurredAtMs)
      .at(-1)?.chunkId;
    if (event.anchorChunkId !== expectedAnchorChunkId) {
      context.addIssue({
        code: "custom",
        message: "Confusion event anchor must be the latest committed chunk at that moment",
        path: ["confusionEvents", eventIndex, "anchorChunkId"],
      });
    }
    if (completedDurationMs !== undefined && event.occurredAtMs > completedDurationMs) {
      context.addIssue({
        code: "custom",
        message: "Confusion event occurs after the completed session",
        path: ["confusionEvents", eventIndex, "occurredAtMs"],
      });
    }
    confusionIds.add(event.confusionId);
    assistanceResponseIds.add(event.assistanceResponseId);
  });
}

const SessionViewCollectionsShape = {
  committedChunks: z.array(TranscriptChunkSchema),
  confusionEvents: z.array(ConfusionEventSchema),
};

export const SessionViewSchema = z
  .object({
    session: LectureSessionSchema,
    ...SessionViewCollectionsShape,
  })
  .superRefine(validateSessionView);

export const CompletedSessionViewSchema = z
  .object({
    session: CompletedLectureSessionSchema,
    ...SessionViewCollectionsShape,
  })
  .superRefine(validateSessionView);

export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type ActiveLectureSession = z.infer<typeof ActiveLectureSessionSchema>;
export type CompletedLectureSession = z.infer<typeof CompletedLectureSessionSchema>;
export type LectureSession = z.infer<typeof LectureSessionSchema>;
export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;
export type StartSessionResponse = z.infer<typeof StartSessionResponseSchema>;
export type EndSessionRequest = z.infer<typeof EndSessionRequestSchema>;
export type EndSessionResponse = z.infer<typeof EndSessionResponseSchema>;
export type SessionHandoff = z.infer<typeof SessionHandoffSchema>;
export type SessionView = z.infer<typeof SessionViewSchema>;
export type CompletedSessionView = z.infer<typeof CompletedSessionViewSchema>;
