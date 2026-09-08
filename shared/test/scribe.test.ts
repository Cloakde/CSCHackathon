import { describe, expect, it } from "vitest";
import {
  SCRIBE_AUDIO_FORMAT,
  SCRIBE_COMMIT_STRATEGY,
  SCRIBE_MODEL_ID,
  ScribeTokenRequestSchema,
  ScribeTokenResponseSchema,
} from "../src/schemas/scribe";

describe("Scribe application token contract (TASK-102)", () => {
  it("accepts only a strictly empty request body", () => {
    expect(ScribeTokenRequestSchema.safeParse({}).success).toBe(true);
    expect(ScribeTokenRequestSchema.safeParse({ extra: "field" }).success).toBe(false);
  });

  it("accepts a well-formed response and pins the connection configuration", () => {
    const parsed = ScribeTokenResponseSchema.safeParse({
      token: "opaque-single-use-token",
      expiresInSeconds: 900,
      modelId: SCRIBE_MODEL_ID,
      audioFormat: SCRIBE_AUDIO_FORMAT,
      commitStrategy: SCRIBE_COMMIT_STRATEGY,
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    { modelId: "some-other-model" },
    { audioFormat: "pcm_44100" },
    { commitStrategy: "manual" },
    { expiresInSeconds: 901 },
    { expiresInSeconds: 0 },
    { token: "" },
    { unexpected: "field" },
  ])("rejects a response that drifts from the pinned configuration: %j", (patch) => {
    const base = {
      token: "opaque-single-use-token",
      expiresInSeconds: 900,
      modelId: SCRIBE_MODEL_ID,
      audioFormat: SCRIBE_AUDIO_FORMAT,
      commitStrategy: SCRIBE_COMMIT_STRATEGY,
    };
    expect(ScribeTokenResponseSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});
