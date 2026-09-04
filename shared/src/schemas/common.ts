import { z } from "zod";

export const SchemaVersionSchema = z.literal(1);

export const StableIdSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/, "Use a stable lowercase underscore ID");

export const UtcTimestampSchema = z
  .string()
  .datetime()
  .refine((value) => value.endsWith("Z"), "Timestamp must be normalized to UTC");

export const OffsetMsSchema = z.number().int().nonnegative();

export const ErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "SESSION_NOT_FOUND",
  "SESSION_NOT_ACTIVE",
  "INSUFFICIENT_CONTEXT",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

export const ApiErrorDetailSchema = z
  .object({
    code: ErrorCodeSchema,
    message: z.string().min(1).max(300),
    retryable: z.boolean(),
  })
  .strict();

export const ApiErrorSchema = z
  .object({
    ok: z.literal(false),
    error: ApiErrorDetailSchema,
  })
  .strict();

export const createApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z
    .object({
      ok: z.literal(true),
      data: dataSchema,
    })
    .strict();

export const createApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.union([createApiSuccessSchema(dataSchema), ApiErrorSchema]);

export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;
export type StableId = z.infer<typeof StableIdSchema>;
export type UtcTimestamp = z.infer<typeof UtcTimestampSchema>;
export type OffsetMs = z.infer<typeof OffsetMsSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
