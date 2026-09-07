import { createHash } from "node:crypto";
import { z } from "zod";
import {
  TRIAL_AUTH_HEADER,
  TRIAL_ENDPOINT,
  TRIAL_MODEL,
  TRIAL_MAX_INPUT_TOKENS,
  TRIAL_MAX_OUTPUT_TOKENS,
  TRIAL_MAX_REQUEST_BYTES,
  TRIAL_MAX_RESPONSE_BYTES,
} from "../../ai-evaluation/trial/policy";
import type { TrialCallKind, TrialMeter, TrialUsage } from "../../ai-evaluation/trial/types";
import { HELP_DEADLINE_MS, PRACTICE_DEADLINE_MS } from "../operation";
import { TrialInstructions } from "./prompts";
import { OutputJsonSchemas } from "./schemas";

type FailureCode =
  "configuration" | "input" | "budget" | "cancelled" | "transport" | "response" | "output";
export class TrialProviderError extends Error {
  constructor(readonly code: FailureCode) {
    super(`The model trial could not complete this call (${code}).`);
    this.name = "TrialProviderError";
  }
}
const failed = (code: FailureCode) => new TrialProviderError(code);
const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,200}$/);
// Implicit caching can occur without requesting cachedContent. Its tokens are a subset
// of promptTokenCount; charging the full prompt at the uncached rate remains conservative.
// Thinking and tool use are outside this trial's fixed configuration and must be zero.
// https://ai.google.dev/api/generate-content#UsageMetadata (checked 2026-09-06).
const UsageMetadataSchema = z
  .object({
    promptTokenCount: z.number().int().min(0).max(TRIAL_MAX_INPUT_TOKENS),
    candidatesTokenCount: z.number().int().min(0).max(TRIAL_MAX_OUTPUT_TOKENS),
    totalTokenCount: z
      .number()
      .int()
      .min(0)
      .max(TRIAL_MAX_INPUT_TOKENS + TRIAL_MAX_OUTPUT_TOKENS),
    thoughtsTokenCount: z.number().int().min(0).max(0).optional(),
    toolUsePromptTokenCount: z.number().int().min(0).max(0).optional(),
    cachedContentTokenCount: z.number().int().min(0).max(TRIAL_MAX_INPUT_TOKENS).optional(),
  })
  .refine((usage) => usage.totalTokenCount === usage.promptTokenCount + usage.candidatesTokenCount)
  .refine((usage) => (usage.cachedContentTokenCount ?? 0) <= usage.promptTokenCount);
const UsageEnvelope = z.object({
  responseId: safeId,
  modelVersion: z.literal(TRIAL_MODEL),
  usageMetadata: UsageMetadataSchema,
});
const CompletedEnvelope = UsageEnvelope.extend({
  candidates: z
    .array(
      z.object({
        content: z.object({
          role: z.literal("model"),
          parts: z.array(z.object({ text: z.string().min(1) })).length(1),
        }),
        finishReason: z.literal("STOP"),
      }),
    )
    .length(1),
});

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => undefined);
    return Promise.reject(failed("cancelled"));
  }
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => {
      cleanup();
      reject(failed("cancelled"));
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        if (signal.aborted) reject(failed("cancelled"));
        else resolve(value);
      },
      () => {
        cleanup();
        reject(failed(signal.aborted ? "cancelled" : "transport"));
      },
    );
  });
}

async function readResponse(response: Response, signal: AbortSignal): Promise<unknown> {
  if (
    !response.ok ||
    response.redirected ||
    (response.url !== "" && response.url !== TRIAL_ENDPOINT) ||
    response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  )
    throw failed("response");
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > TRIAL_MAX_RESPONSE_BYTES))
    throw failed("response");
  if (!response.body) throw failed("response");
  const reader = response.body.getReader();
  let bytes = 0;
  const pieces: Uint8Array[] = [];
  try {
    while (true) {
      const part = await abortable(reader.read(), signal);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > TRIAL_MAX_RESPONSE_BYTES) throw failed("response");
      pieces.push(part.value);
    }
    if (signal.aborted) throw failed("cancelled");
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const piece of pieces) {
      body.set(piece, offset);
      offset += piece.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } finally {
    void reader.cancel().catch(() => undefined);
  }
}

export interface ProviderTransportOptions {
  apiKey: string;
  meter: TrialMeter;
  scenarioId: string;
  fetcher?: typeof fetch;
}

export function createTrialTransport({
  apiKey,
  meter,
  scenarioId,
  fetcher = globalThis.fetch,
}: ProviderTransportOptions) {
  if (
    typeof apiKey !== "string" ||
    !/^[A-Za-z0-9_-]{8,512}$/.test(apiKey) ||
    !safeId.safeParse(scenarioId).success ||
    typeof fetcher !== "function"
  )
    throw failed("configuration");
  return async function call<T>(
    kind: TrialCallKind,
    input: unknown,
    signal: AbortSignal,
    parse: (output: unknown) => T,
  ): Promise<T> {
    if (signal.aborted) throw failed("cancelled");
    let body: string;
    try {
      body = JSON.stringify({
        systemInstruction: { parts: [{ text: TrialInstructions[kind] }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          // Raw JSON Schema (including additionalProperties), not Google's Schema message.
          responseJsonSchema: OutputJsonSchemas[kind],
          maxOutputTokens: TRIAL_MAX_OUTPUT_TOKENS,
          candidateCount: 1,
        },
        store: false,
      });
    } catch {
      throw failed("input");
    }
    const requestBytes = Buffer.byteLength(body, "utf8");
    if (requestBytes > TRIAL_MAX_REQUEST_BYTES || body.includes(apiKey)) throw failed("input");
    let attempt: number;
    try {
      attempt = meter.reserve({
        kind,
        scenarioId,
        requestBytes,
        requestSha256: createHash("sha256").update(body).digest("hex"),
      });
    } catch {
      throw failed("budget");
    }
    let settled = false;
    const settle = (usage?: TrialUsage) => {
      if (settled) return;
      // Set this before persistence: a persistence error cannot trigger a refund retry.
      settled = true;
      try {
        meter.settle(attempt, usage);
      } catch {
        throw failed("budget");
      }
    };
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    const timer = setTimeout(
      cancel,
      kind.startsWith("help") ? HELP_DEADLINE_MS : PRACTICE_DEADLINE_MS,
    );
    let response: Response | undefined;
    let usage: TrialUsage | undefined;
    const rejectCredentialEcho = (value: unknown) => {
      if (JSON.stringify(value)?.includes(apiKey)) {
        // An encoded echo is as untrustworthy as a literal one. Do not refund
        // this reservation even when the surrounding response reports usage.
        usage = undefined;
        throw failed("output");
      }
    };
    try {
      if (controller.signal.aborted) throw failed("cancelled");
      const pending = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw failed("cancelled");
        return fetcher(TRIAL_ENDPOINT, {
          method: "POST",
          headers: {
            [TRIAL_AUTH_HEADER]: apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body,
          signal: controller.signal,
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
        });
      });
      // A fetcher that ignores abort may still return a body. Discard it without
      // reading usage or allowing a late refund, and observe late rejections.
      void pending.then(
        (late) => {
          if (controller.signal.aborted) void late.body?.cancel().catch(() => undefined);
        },
        () => undefined,
      );
      response = await abortable(pending, controller.signal);
      const raw = await readResponse(response, controller.signal);
      if (controller.signal.aborted) throw failed("cancelled");
      if (JSON.stringify(raw).includes(apiKey)) throw failed("response");
      const billed = UsageEnvelope.safeParse(raw);
      if (!billed.success) throw failed("response");
      usage = {
        inputTokens: billed.data.usageMetadata.promptTokenCount,
        outputTokens: billed.data.usageMetadata.candidatesTokenCount,
        reportedModel: billed.data.modelVersion,
        responseId: billed.data.responseId,
      };
      const envelope = CompletedEnvelope.safeParse(raw);
      if (!envelope.success) throw failed("response");
      let result: T;
      try {
        const decoded = JSON.parse(envelope.data.candidates[0]!.content.parts[0]!.text);
        rejectCredentialEcho(decoded);
        result = parse(decoded);
        rejectCredentialEcho(result);
      } catch {
        throw failed("output");
      }
      if (controller.signal.aborted) throw failed("cancelled");
      settle(usage);
      return result;
    } catch (error) {
      settle(controller.signal.aborted ? undefined : usage);
      throw error instanceof TrialProviderError ? error : failed("transport");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      if (response && !response.bodyUsed) void response.body?.cancel().catch(() => undefined);
    }
  };
}
