import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createHash } from "node:crypto";
import { createTrialTransport } from "./transport";
import {
  TRIAL_ENDPOINT,
  TRIAL_MODEL,
  TRIAL_MAX_INPUT_TOKENS,
  TRIAL_MAX_OUTPUT_TOKENS,
  TRIAL_MAX_REQUEST_BYTES,
  TRIAL_MAX_RESPONSE_BYTES,
} from "../../ai-evaluation/trial/policy";
import type { TrialMeter } from "../../ai-evaluation/trial/types";
import { HELP_DEADLINE_MS, PRACTICE_DEADLINE_MS } from "../operation";

const key = "offline-test-credential";
const signal = () => new AbortController().signal;
const parse = (value: unknown) => z.object({ result: z.string() }).strict().parse(value).result;
function envelope() {
  return {
    id: "resp_offline",
    object: "response",
    model: TRIAL_MODEL,
    service_tier: "default",
    status: "completed",
    error: null,
    incomplete_details: null,
    usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ result: "safe synthetic answer" }),
            annotations: [],
          },
        ],
      },
    ],
  };
}
function response(raw: unknown = envelope()) {
  return Response.json(raw, { headers: { "x-request-id": "req_offline" } });
}
function setup(fetcher: typeof fetch = vi.fn(async () => response())) {
  const meter: TrialMeter = { reserve: vi.fn(() => 1), settle: vi.fn() };
  const call = createTrialTransport({ apiKey: key, scenarioId: "offline_case", meter, fetcher });
  return { call, meter, fetcher };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("offline bounded Responses transport", () => {
  it("reserves before sending a pinned request and reconciles validated usage exactly once", async () => {
    vi.useFakeTimers();
    const state = setup(
      vi.fn(async (url, options) => {
        expect(state.meter.reserve).toHaveBeenCalledOnce();
        expect(url).toBe(TRIAL_ENDPOINT);
        expect(options).toMatchObject({
          method: "POST",
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
        });
        expect(new Headers(options!.headers).get("authorization")).toBe(`Bearer ${key}`);
        const body = JSON.parse(options!.body as string);
        expect(body).toMatchObject({
          model: TRIAL_MODEL,
          max_output_tokens: 2048,
          store: false,
          background: false,
          service_tier: "default",
          prompt_cache_retention: "in_memory",
          truncation: "disabled",
          stream: false,
          tools: [],
          tool_choice: "none",
          text: {
            format: {
              name: "help_generate",
              type: "json_schema",
              strict: true,
              schema: { type: "object", required: ["result"], additionalProperties: false },
            },
          },
        });
        expect(body).not.toHaveProperty("previous_response_id");
        expect(body).not.toHaveProperty("conversation");
        expect(body).not.toHaveProperty("temperature");
        expect(options!.body).not.toContain(key);
        expect(state.meter.reserve).toHaveBeenCalledWith({
          kind: "help_generate",
          scenarioId: "offline_case",
          requestBytes: Buffer.byteLength(options!.body as string),
          requestSha256: createHash("sha256")
            .update(options!.body as string)
            .digest("hex"),
        });
        return response();
      }),
    );
    const upstream = new AbortController();
    const added = vi.spyOn(upstream.signal, "addEventListener");
    const removed = vi.spyOn(upstream.signal, "removeEventListener");
    expect(
      await state.call("help_generate", { lecture: "synthetic" }, upstream.signal, parse),
    ).toBe("safe synthetic answer");
    expect(state.meter.settle).toHaveBeenCalledExactlyOnceWith(1, {
      inputTokens: 120,
      outputTokens: 30,
      reportedModel: TRIAL_MODEL,
      responseId: "resp_offline",
      requestId: "req_offline",
    });
    expect(removed).toHaveBeenCalledWith("abort", added.mock.calls[0]![1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("blocks oversized UTF-8 input, invalid configuration and already-aborted work before reserving", async () => {
    const { call, meter, fetcher } = setup();
    await expect(
      call("help_generate", "🧪".repeat(TRIAL_MAX_REQUEST_BYTES / 4), signal(), parse),
    ).rejects.toMatchObject({ code: "input" });
    const controller = new AbortController();
    controller.abort(new Error(key));
    await expect(call("help_generate", {}, controller.signal, parse)).rejects.toMatchObject({
      code: "cancelled",
    });
    await expect(call("help_generate", { secret: key }, signal(), parse)).rejects.toMatchObject({
      code: "input",
    });
    expect(() =>
      createTrialTransport({ apiKey: `${key}\n`, scenarioId: "case", meter, fetcher }),
    ).toThrow("configuration");
    expect(meter.reserve).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never sends when reservation fails, and redacts both reservation and settlement errors", async () => {
    const fetcher = vi.fn(async () => response());
    const settle = vi.fn(() => {
      throw new Error(key);
    });
    const meter = {
      reserve: vi.fn(() => {
        throw new Error(key);
      }),
      settle,
    };
    const call = createTrialTransport({ apiKey: key, scenarioId: "case", meter, fetcher });
    await expect(call("help_generate", {}, signal(), parse)).rejects.toMatchObject({
      code: "budget",
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
    meter.reserve.mockImplementation(() => 1 as never);
    await expect(call("help_generate", {}, signal(), parse)).rejects.toMatchObject({
      code: "budget",
    });
    expect(settle).toHaveBeenCalledOnce();
  });

  it.each(["headers", "body"])(
    "cancels during %s without a late refund or leaked timer",
    async (stage) => {
      vi.useFakeTimers();
      const entered = deferred<void>();
      const late = deferred<Response>();
      let forwarded!: AbortSignal;
      const cancelBody = vi.fn();
      const stream = new ReadableStream<Uint8Array>({
        start() {
          if (stage === "body") entered.resolve();
        },
        cancel: cancelBody,
      });
      const { call, meter } = setup(
        vi.fn(async (_url, options) => {
          forwarded = options!.signal as AbortSignal;
          if (stage === "headers") {
            entered.resolve();
            return late.promise;
          }
          return new Response(stream, { headers: { "Content-Type": "application/json" } });
        }),
      );
      const controller = new AbortController();
      const waiting = call("help_generate", {}, controller.signal, parse);
      const rejected = expect(waiting).rejects.toMatchObject({ code: "cancelled" });
      await entered.promise;
      await Promise.resolve();
      controller.abort(new Error(key));
      await rejected;
      expect(forwarded.aborted).toBe(true);
      expect(meter.settle).toHaveBeenCalledExactlyOnceWith(1, undefined);
      if (stage === "headers") late.resolve(response());
      await Promise.resolve();
      await Promise.resolve();
      expect(meter.settle).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
      if (stage === "body") expect(cancelBody).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["help_generate", HELP_DEADLINE_MS],
    ["practice_verify", PRACTICE_DEADLINE_MS],
  ] as const)(
    "bounds the entire %s call even when the fetcher ignores abort",
    async (kind, timeout) => {
      vi.useFakeTimers();
      const entered = deferred<void>();
      const late = deferred<Response>();
      const { call, meter } = setup(
        vi.fn(async () => {
          entered.resolve();
          return late.promise;
        }),
      );
      const waiting = call(kind, {}, signal(), parse);
      const rejected = expect(waiting).rejects.toMatchObject({ code: "cancelled" });
      await entered.promise;
      await vi.advanceTimersByTimeAsync(timeout);
      await rejected;
      late.reject(new Error(key));
      await Promise.resolve();
      expect(meter.settle).toHaveBeenCalledExactlyOnceWith(1, undefined);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("bounds a stalled response body without waiting for another response chunk", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const entered = deferred<void>();
    const { call, meter } = setup(
      vi.fn(async () => {
        entered.resolve();
        return new Response(new ReadableStream({ cancel }), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const waiting = call("practice_generate", {}, signal(), parse);
    const rejected = expect(waiting).rejects.toMatchObject({ code: "cancelled" });
    await entered.promise;
    await vi.advanceTimersByTimeAsync(PRACTICE_DEADLINE_MS);
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
    expect(meter.settle).toHaveBeenCalledExactlyOnceWith(1, undefined);
  });

  it.each([
    "content-length",
    "stream-size",
    "invalid-utf8",
    "invalid-json",
    "non-json",
    "redirect",
    "http-error",
  ])("rejects %s without trusting any reported usage or retrying", async (mode) => {
    let raw: Response;
    if (mode === "content-length")
      raw = new Response("{}", {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(TRIAL_MAX_RESPONSE_BYTES + 1),
        },
      });
    else if (mode === "stream-size")
      raw = new Response(" ".repeat(TRIAL_MAX_RESPONSE_BYTES + 1), {
        headers: { "Content-Type": "application/json" },
      });
    else if (mode === "invalid-utf8")
      raw = new Response(new Uint8Array([0xff]), {
        headers: { "Content-Type": "application/json" },
      });
    else if (mode === "invalid-json")
      raw = new Response(key, { headers: { "Content-Type": "application/json" } });
    else if (mode === "non-json")
      raw = new Response(JSON.stringify(envelope()), { headers: { "Content-Type": "text/html" } });
    else if (mode === "redirect") raw = Response.redirect("https://example.invalid/");
    else
      raw = new Response(JSON.stringify({ ...envelope(), error: key }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    const { call, meter, fetcher } = setup(vi.fn(async () => raw));
    await expect(call("help_verify", {}, signal(), parse)).rejects.toThrow(
      "The model trial could not complete this call",
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(meter.settle).toHaveBeenCalledExactlyOnceWith(1, undefined);
  });

  it.each([
    "missing",
    "negative",
    "fraction",
    "input-bound",
    "output-bound",
    "sum",
    "model",
    "tier",
    "id",
  ])("retains the full charge for %s usage evidence", async (mode) => {
    const raw = envelope();
    if (mode === "missing") delete (raw as Partial<typeof raw>).usage;
    else if (mode === "negative") raw.usage.input_tokens = -1;
    else if (mode === "fraction") raw.usage.output_tokens = 0.5;
    else if (mode === "input-bound") raw.usage.input_tokens = TRIAL_MAX_INPUT_TOKENS + 1;
    else if (mode === "output-bound") raw.usage.output_tokens = TRIAL_MAX_OUTPUT_TOKENS + 1;
    else if (mode === "sum") raw.usage.total_tokens += 1;
    else if (mode === "model") raw.model = "gpt-4.1-mini";
    else if (mode === "tier") raw.service_tier = "priority";
    else raw.id = "untrusted provider text";
    const { call, meter } = setup(vi.fn(async () => response(raw)));
    await expect(call("help_generate", {}, signal(), parse)).rejects.toMatchObject({
      code: "response",
    });
    expect(meter.settle).toHaveBeenCalledExactlyOnceWith(1, undefined);
  });

  it.each(["incomplete", "refusal", "tool", "extra-message", "bad-output", "extra-field"])(
    "rejects %s content while charging independently valid usage",
    async (mode) => {
      const raw = envelope();
      if (mode === "incomplete") raw.status = "incomplete";
      else if (mode === "refusal") raw.output[0]!.content[0]!.type = "refusal";
      else if (mode === "tool") raw.output[0]!.type = "function_call";
      else if (mode === "extra-message") raw.output.push(raw.output[0]!);
      else if (mode === "bad-output") raw.output[0]!.content[0]!.text = key.slice(0, 5);
      else raw.output[0]!.content[0]!.text = JSON.stringify({ result: "text", unexpected: true });
      const { call, meter, fetcher } = setup(vi.fn(async () => response(raw)));
      await expect(call("practice_verify", {}, signal(), parse)).rejects.toThrow(
        "The model trial could not complete this call",
      );
      expect(fetcher).toHaveBeenCalledOnce();
      expect(meter.settle).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ inputTokens: 120, outputTokens: 30 }),
      );
    },
  );

  it.each(["fetch", "body", "output", "request-id", "response-id"])(
    "never exposes the credential through %s",
    async (mode) => {
      const raw = envelope();
      if (mode === "output") raw.output[0]!.content[0]!.text = JSON.stringify({ result: key });
      if (mode === "response-id") raw.id = key;
      const state = setup(
        vi.fn(async () => {
          if (mode === "fetch") throw new Error(`Authorization: ${key}`);
          if (mode === "body")
            return new Response(
              new ReadableStream({
                start(controller) {
                  controller.error(new Error(key));
                },
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          return Response.json(raw, {
            headers: { "x-request-id": mode === "request-id" ? key : "req_safe" },
          });
        }),
      );
      const error = await state
        .call("help_generate", {}, signal(), parse)
        .catch((value: unknown) => value);
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain(key);
      expect(JSON.stringify(error)).not.toContain(key);
      expect(state.meter.settle).toHaveBeenCalledExactlyOnceWith(1, undefined);
    },
  );
});
