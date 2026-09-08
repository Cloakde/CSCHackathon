import { createHash } from "node:crypto";

export const TRIAL_PLAN_ID = "TASK-103C-gemini-synthetic-model-trial-v1";
export const TRIAL_PROVIDER = "gemini";
export const TRIAL_MODEL = "gemini-2.5-flash-lite";
export const TRIAL_API_VERSION = "v1beta";
export const TRIAL_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
export const TRIAL_AUTH_HEADER = "x-goog-api-key";
export const TRIAL_CAP_MICRO_USD = 1_000_000;
export const TRIAL_MAX_ATTEMPTS = 32;
// gemini-2.5-flash-lite's documented context: 1,048,576 input tokens, 65,536 output tokens.
// https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite (checked 2026-09-06).
// The output bound below is a deliberate, much smaller request-time cap (see TRIAL_MAX_OUTPUT_TOKENS);
// only the input bound uses the model's full documented context as the conservative worst case.
export const TRIAL_MAX_INPUT_TOKENS = 1_048_576;
export const TRIAL_MAX_OUTPUT_TOKENS = 2_048;
export const TRIAL_MAX_REQUEST_BYTES = 32 * 1_024;
export const TRIAL_MAX_RESPONSE_BYTES = 128 * 1_024;

// Paid-tier text pricing per https://ai.google.dev/gemini-api/docs/pricing (checked 2026-09-06):
// $0.10 / 1M input tokens (text/image/video; audio input is priced separately and is not used here),
// $0.40 / 1M output tokens. As microdollars per token: 1/10 and 4/10.
// Integer arithmetic avoids rounding a reservation or actual charge downward.
export const TRIAL_INPUT_PRICE_NUMERATOR = 1;
export const TRIAL_OUTPUT_PRICE_NUMERATOR = 4;
export const TRIAL_PRICE_DENOMINATOR = 10;

// Conservative worst-case reservation per attempt, ceil((1_048_576*1 + 2_048*4) / 10) microdollars.
export const TRIAL_RESERVE_MICRO_USD = 105_677;

// Native Node 24 can load this module without a transpiler or application imports.
// The hash binds both accounting and the fixed, approved transport configuration.
export const TRIAL_POLICY_HASH = createHash("sha256")
  .update(
    JSON.stringify({
      version: 2,
      planId: TRIAL_PLAN_ID,
      provider: TRIAL_PROVIDER,
      model: TRIAL_MODEL,
      apiVersion: TRIAL_API_VERSION,
      endpoint: TRIAL_ENDPOINT,
      authHeader: TRIAL_AUTH_HEADER,
      capMicroUsd: TRIAL_CAP_MICRO_USD,
      maxAttempts: TRIAL_MAX_ATTEMPTS,
      reserveMicroUsd: TRIAL_RESERVE_MICRO_USD,
      maxInputTokens: TRIAL_MAX_INPUT_TOKENS,
      maxOutputTokens: TRIAL_MAX_OUTPUT_TOKENS,
      maxRequestBytes: TRIAL_MAX_REQUEST_BYTES,
      maxResponseBytes: TRIAL_MAX_RESPONSE_BYTES,
      inputPriceNumerator: TRIAL_INPUT_PRICE_NUMERATOR,
      outputPriceNumerator: TRIAL_OUTPUT_PRICE_NUMERATOR,
      priceDenominator: TRIAL_PRICE_DENOMINATOR,
      accounting: "ceil-uncached-input-plus-output-microdollars",
      unknownUsage: "retain-full-reservation",
      maximumActiveClientRequests: 1,
      store: false,
      thinkingRequested: false,
      explicitCachedContentUsed: false,
      implicitCacheAccounting: "validate-subset-and-charge-full-uncached-prompt",
      toolUsePromptTokens: 0,
      responseMimeType: "application/json",
      schemaField: "responseJsonSchema",
      candidateCount: 1,
      tools: "none",
      streaming: false,
      previousInteractions: false,
      alternateEndpoints: false,
      automaticRetries: 0,
    }),
  )
  .digest("hex");
