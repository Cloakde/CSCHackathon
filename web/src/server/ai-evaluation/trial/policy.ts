import { createHash } from "node:crypto";

export const TRIAL_PLAN_ID = "TASK-103C-gemini-synthetic-model-trial-v1";
export const TRIAL_PROVIDER = "gemini";
export const TRIAL_MODEL = "gemini-3.1-flash-lite";
export const TRIAL_API_VERSION = "v1beta";
export const TRIAL_ENDPOINT = `https://generativelanguage.googleapis.com/${TRIAL_API_VERSION}/models/${TRIAL_MODEL}:generateContent`;
export const TRIAL_AUTH_HEADER = "x-goog-api-key";
export const TRIAL_CAP_MICRO_USD = 1_000_000;
export const TRIAL_MAX_ATTEMPTS = 32;
// https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite (2026-09-15).
// Keep a small requested answer, but conservatively reserve the model's entire
// output limit for response + thinking: minimal thinking is not guaranteed off.
export const TRIAL_MAX_INPUT_TOKENS = 1_048_576;
export const TRIAL_MAX_OUTPUT_TOKENS = 2_048;
export const TRIAL_MAX_BILLABLE_OUTPUT_TOKENS = 65_536;
export const TRIAL_THINKING_LEVEL = "minimal";
export const TRIAL_MAX_REQUEST_BYTES = 32 * 1_024;
export const TRIAL_MAX_RESPONSE_BYTES = 128 * 1_024;

// Paid-tier standard text pricing (2026-09-15): $0.25/M input, $1.50/M output
// including thinking. Audio, tools, priority and explicit caching are not used.
// https://ai.google.dev/gemini-api/docs/pricing
// Integer arithmetic avoids rounding a reservation or actual charge downward.
export const TRIAL_INPUT_PRICE_NUMERATOR = 25;
export const TRIAL_OUTPUT_PRICE_NUMERATOR = 150;
export const TRIAL_PRICE_DENOMINATOR = 100;

// Full model bounds: ceil((1_048_576*25 + 65_536*150) / 100) microdollars.
export const TRIAL_RESERVE_MICRO_USD = 360_448;

// Native Node 24 can load this module without a transpiler or application imports.
// The hash binds both accounting and the fixed, approved transport configuration.
export const TRIAL_POLICY_HASH = createHash("sha256")
  .update(
    JSON.stringify({
      version: 3,
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
      maxBillableOutputTokens: TRIAL_MAX_BILLABLE_OUTPUT_TOKENS,
      maxRequestBytes: TRIAL_MAX_REQUEST_BYTES,
      maxResponseBytes: TRIAL_MAX_RESPONSE_BYTES,
      inputPriceNumerator: TRIAL_INPUT_PRICE_NUMERATOR,
      outputPriceNumerator: TRIAL_OUTPUT_PRICE_NUMERATOR,
      priceDenominator: TRIAL_PRICE_DENOMINATOR,
      accounting: "ceil-uncached-input-plus-candidate-and-thinking-output-microdollars",
      unknownUsage: "retain-full-reservation",
      maximumActiveClientRequests: 1,
      store: false,
      thinkingLevel: TRIAL_THINKING_LEVEL,
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
