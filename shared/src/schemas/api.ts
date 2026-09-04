import { z } from "zod";

import { createApiResponseSchema, StableIdSchema } from "./common";
import { ImLostBodySchema, ImLostResponseSchema } from "./assistance";
import {
  EndSessionRequestSchema,
  EndSessionResponseSchema,
  SessionViewSchema,
  StartSessionRequestSchema,
  StartSessionResponseSchema,
} from "./session";
import { WeakAreaDrillBodySchema, WeakAreaDrillResponseSchema } from "./study";
import { TranscriptChunkSchema } from "./transcript";

export const SessionRouteParamsSchema = z
  .object({
    sessionId: StableIdSchema,
  })
  .strict();

export const AppendCommittedChunksRequestSchema = z
  .object({
    chunks: z.array(TranscriptChunkSchema).min(1).max(100),
  })
  .strict();

export const AppendCommittedChunksResponseSchema = z.object({
  acceptedChunkIds: z.array(StableIdSchema),
});

export const AppendCommittedChunksInputSchema = z
  .object({
    params: SessionRouteParamsSchema,
    body: AppendCommittedChunksRequestSchema,
  })
  .strict()
  .superRefine((input, context) => {
    input.body.chunks.forEach((chunk, chunkIndex) => {
      if (chunk.sessionId !== input.params.sessionId) {
        context.addIssue({
          code: "custom",
          message: "Chunk session ID must match the route session ID",
          path: ["body", "chunks", chunkIndex, "sessionId"],
        });
      }
    });
  });

export const ImLostInputSchema = z
  .object({
    params: SessionRouteParamsSchema,
    body: ImLostBodySchema,
  })
  .strict();

export const EndSessionInputSchema = z
  .object({
    params: SessionRouteParamsSchema,
    body: EndSessionRequestSchema,
  })
  .strict();

export const GetSessionInputSchema = z
  .object({
    params: SessionRouteParamsSchema,
  })
  .strict();

export const WeakAreaDrillInputSchema = z
  .object({
    params: SessionRouteParamsSchema,
    body: WeakAreaDrillBodySchema,
  })
  .strict();

export const ApiContracts = {
  startSession: {
    method: "POST",
    route: "/api/sessions",
    request: StartSessionRequestSchema,
    response: createApiResponseSchema(StartSessionResponseSchema),
  },
  appendCommittedChunks: {
    method: "POST",
    route: "/api/sessions/:sessionId/chunks",
    params: SessionRouteParamsSchema,
    request: AppendCommittedChunksRequestSchema,
    input: AppendCommittedChunksInputSchema,
    response: createApiResponseSchema(AppendCommittedChunksResponseSchema),
  },
  imLost: {
    method: "POST",
    route: "/api/sessions/:sessionId/im-lost",
    params: SessionRouteParamsSchema,
    request: ImLostBodySchema,
    input: ImLostInputSchema,
    response: createApiResponseSchema(ImLostResponseSchema),
  },
  endSession: {
    method: "POST",
    route: "/api/sessions/:sessionId/end",
    params: SessionRouteParamsSchema,
    request: EndSessionRequestSchema,
    input: EndSessionInputSchema,
    response: createApiResponseSchema(EndSessionResponseSchema),
  },
  getSession: {
    method: "GET",
    route: "/api/sessions/:sessionId",
    params: SessionRouteParamsSchema,
    input: GetSessionInputSchema,
    response: createApiResponseSchema(SessionViewSchema),
  },
  createWeakAreaDrill: {
    method: "POST",
    route: "/api/sessions/:sessionId/weak-area-drills",
    params: SessionRouteParamsSchema,
    request: WeakAreaDrillBodySchema,
    input: WeakAreaDrillInputSchema,
    response: createApiResponseSchema(WeakAreaDrillResponseSchema),
  },
} as const;

export type AppendCommittedChunksRequest = z.infer<typeof AppendCommittedChunksRequestSchema>;
export type AppendCommittedChunksResponse = z.infer<typeof AppendCommittedChunksResponseSchema>;
export type SessionRouteParams = z.infer<typeof SessionRouteParamsSchema>;
export type AppendCommittedChunksInput = z.infer<typeof AppendCommittedChunksInputSchema>;
export type ImLostInput = z.infer<typeof ImLostInputSchema>;
export type EndSessionInput = z.infer<typeof EndSessionInputSchema>;
export type GetSessionInput = z.infer<typeof GetSessionInputSchema>;
export type WeakAreaDrillInput = z.infer<typeof WeakAreaDrillInputSchema>;
