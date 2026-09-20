// Bundle the delivered adapter with its runtime validators for plain Node.
// Do not rely on Node resolving the monorepo's extensionless TypeScript imports.
export { createScribeRealtimeTransport } from "../../extension/src/transcription/scribe-transport";
import { ScribeTokenResponseSchema, TranscriptEventSchema } from "@livelecture/shared";
export const validateEvent = (event: unknown) => TranscriptEventSchema.safeParse(event).success;
export const validateToken = (token: unknown) => ScribeTokenResponseSchema.parse(token);
