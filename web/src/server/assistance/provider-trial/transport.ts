import { createHash } from "node:crypto";
import { z } from "zod";
import {
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
const UsageEnvelope = z.object({
  id: safeId,
  model: z.literal(TRIAL_MODEL),
  service_tier: z.literal("default"),
  usage: z
    .object({
      input_tokens: z.number().int().min(0).max(TRIAL_MAX_INPUT_TOKENS),
      output_tokens: z.number().int().min(0).max(TRIAL_MAX_OUTPUT_TOKENS),
      total_tokens: z
        .number()
        .int()
        .min(0)
        .max(TRIAL_MAX_INPUT_TOKENS + TRIAL_MAX_OUTPUT_TOKENS),
    })
    .refine((usage) => usage.total_tokens === usage.input_tokens + usage.output_tokens),
});
const CompletedEnvelope = UsageEnvelope.extend({
  object: z.literal("response"),
  status: z.literal("completed"),
  error: z.null(),
  incomplete_details: z.null(),
  output: z
    .array(
      z.object({
        type: z.literal("message"),
        role: z.literal("assistant"),
        status: z.literal("completed"),
        content: z
          .array(
            z.object({
              type: z.literal("output_text"),
              text: z.string().min(1),
              annotations: z.array(z.unknown()).length(0),
            }),
          )
          .length(1),
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
        model: TRIAL_MODEL,
        instructions: TrialInstructions[kind],
        input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(input) }] }],
        text: {
          format: {
            type: "json_schema",
            name: kind,
            strict: true,
            schema: OutputJsonSchemas[kind],
          },
        },
        max_output_tokens: TRIAL_MAX_OUTPUT_TOKENS,
        store: false,
        background: false,
        service_tier: "default",
        prompt_cache_retention: "in_memory",
        truncation: "disabled",
        stream: false,
        tools: [],
        tool_choice: "none",
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
    try {
      if (controller.signal.aborted) throw failed("cancelled");
      const pending = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw failed("cancelled");
        return fetcher(TRIAL_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
      const requestId = response.headers.get("x-request-id");
      if (
        !billed.success ||
        (requestId !== null && (!safeId.safeParse(requestId).success || requestId.includes(apiKey)))
      )
        throw failed("response");
      usage = {
        inputTokens: billed.data.usage.input_tokens,
        outputTokens: billed.data.usage.output_tokens,
        reportedModel: billed.data.model,
        responseId: billed.data.id,
        ...(requestId === null ? {} : { requestId }),
      };
      const envelope = CompletedEnvelope.safeParse(raw);
      if (!envelope.success) throw failed("response");
      let result: T;
      try {
        result = parse(JSON.parse(envelope.data.output[0]!.content[0]!.text));
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
