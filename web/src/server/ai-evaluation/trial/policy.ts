import { createHash } from "node:crypto";

export const TRIAL_PLAN_ID = "TASK-103B-synthetic-model-trial-v1";
export const TRIAL_MODEL = "gpt-4.1-mini-2025-04-14";
export const TRIAL_ENDPOINT = "https://api.openai.com/v1/responses";
export const TRIAL_CAP_MICRO_USD = 1_000_000;
export const TRIAL_MAX_ATTEMPTS = 32;
export const TRIAL_RESERVE_MICRO_USD = 422_308;
export const TRIAL_MAX_INPUT_TOKENS = 1_047_576;
export const TRIAL_MAX_OUTPUT_TOKENS = 2_048;
export const TRIAL_MAX_REQUEST_BYTES = 32 * 1_024;
export const TRIAL_MAX_RESPONSE_BYTES = 128 * 1_024;

// $0.40/M input and $1.60/M output equal 2/5 and 8/5 microdollars per token.
// Integer arithmetic avoids rounding a reservation or actual charge downward.
export const TRIAL_INPUT_PRICE_NUMERATOR = 2;
export const TRIAL_OUTPUT_PRICE_NUMERATOR = 8;
export const TRIAL_PRICE_DENOMINATOR = 5;

// Native Node 24 can load this module without a transpiler or application imports.
// The hash binds both accounting and the fixed, approved transport configuration.
export const TRIAL_POLICY_HASH = createHash("sha256")
  .update(
    JSON.stringify({
      version: 1,
      planId: TRIAL_PLAN_ID,
      model: TRIAL_MODEL,
      endpoint: TRIAL_ENDPOINT,
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
      background: false,
      serviceTier: "default",
      promptCacheRetention: "in_memory",
      truncation: "disabled",
      tools: [],
      streaming: false,
      conversations: false,
      previousResponses: false,
      alternateEndpoints: false,
      automaticRetries: 0,
      strictJson: true,
    }),
  )
  .digest("hex");
