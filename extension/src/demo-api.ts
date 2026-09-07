import { ApiContracts, ApiErrorSchema, SessionRouteParamsSchema } from "@livelecture/shared";
import {
  LectureToolRequestSchema,
  LectureToolEnvelopeSchema,
  type LectureToolRequest,
} from "@livelecture/shared";

export const DEMO_ORIGIN = "http://127.0.0.1:3000";
export const DEMO_REQUEST_TIMEOUT_MS = 12_000;
export type DemoFetch = (url: string, options: RequestInit) => Promise<Response>;

const friendlyErrors: Record<string, string> = {
  SESSION_NOT_FOUND: "This sample session has expired. Reset it to start again.",
  SESSION_NOT_ACTIVE: "This lecture has ended. Open your practice or reset for a new lecture.",
  RATE_LIMITED: "The demo is busy. Wait a moment, then try again.",
  INSUFFICIENT_CONTEXT: "The lecture changed while help was being prepared. Try I’m Lost again.",
  PROVIDER_UNAVAILABLE: "Help is temporarily unavailable. Try I’m Lost again.",
};

/** Every request stays on the fixed local demo service. No provider credentials are used. */
export function createDemoClient(request: DemoFetch = (url, options) => fetch(url, options)) {
  async function send(path: string, method: string, body: unknown, signal?: AbortSignal) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error("The demo took too long. Please try again."));
      }, DEMO_REQUEST_TIMEOUT_MS);
    });
    let result: { response: Response; payload: unknown };
    try {
      result = await Promise.race([
        (async () => {
          const response = await request(`${DEMO_ORIGIN}${path}`, {
            method,
            headers: { "Content-Type": "application/json", "X-LiveLecture-Demo": "scripted-v1" },
            body: body === undefined ? undefined : JSON.stringify(body),
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            signal: controller.signal,
          });
          const payload: unknown = await response.json();
          return { response, payload };
        })(),
        deadline,
      ]);
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(
        timedOut
          ? "The demo took too long. Please try again."
          : "Cannot reach the local demo. Start the demo server, then try again.",
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
    const { response, payload } = result;
    const failure = ApiErrorSchema.safeParse(payload);
    if (failure.success)
      throw new Error(
        friendlyErrors[failure.data.error.code] ?? "The demo could not finish. Please try again.",
      );
    if (!response.ok) throw new Error("The demo could not finish. Please try again.");
    return payload;
  }

  function route(sessionId: string) {
    SessionRouteParamsSchema.parse({ sessionId });
    return `/api/sessions/${sessionId}`;
  }

  async function post<K extends keyof typeof ApiContracts>(
    name: K,
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ) {
    const contract = ApiContracts[name];
    if ("request" in contract) contract.request.parse(body);
    const parsed = contract.response.safeParse(await send(path, "POST", body, signal));
    if (!parsed.success || !parsed.data.ok)
      throw new Error("The demo returned an answer we could not check. Please try again.");
    return parsed.data;
  }

  return {
    async lectureTools(sessionId: string, input: LectureToolRequest, signal?: AbortSignal) {
      const body = LectureToolRequestSchema.parse(input);
      const parsed = LectureToolEnvelopeSchema.safeParse(
        await send(`${route(sessionId)}/lecture-tools`, "POST", body, signal),
      );
      if (!parsed.success || parsed.data.data.sessionId !== sessionId)
        throw new Error("The lecture response could not be checked. Please try again.");
      return parsed.data.data;
    },
    async start(
      body: { sourceMode: "simulation"; title?: string; subject?: string },
      signal?: AbortSignal,
    ) {
      const response = ApiContracts.startSession.response.parse(
        await post("startSession", "/api/sessions", body, signal),
      );
      if (!response.ok) throw new Error("Could not start the sample lecture.");
      if (response.data.session.sourceMode !== "simulation")
        throw new Error("This demo requires a sample lecture. Please reset and try again.");
      return response.data.session;
    },
    async append(sessionId: string, body: unknown, signal?: AbortSignal) {
      const response = ApiContracts.appendCommittedChunks.response.parse(
        await post("appendCommittedChunks", `${route(sessionId)}/chunks`, body, signal),
      );
      if (!response.ok) throw new Error("Could not save the sample transcript.");
      return response.data;
    },
    async help(sessionId: string, signal?: AbortSignal) {
      const response = ApiContracts.imLost.response.parse(
        await post("imLost", `${route(sessionId)}/im-lost`, { lookbackMs: 900_000 }, signal),
      );
      if (!response.ok) throw new Error("Could not prepare help.");
      return response.data;
    },
    async end(sessionId: string, endedAt: string, signal?: AbortSignal) {
      const response = ApiContracts.endSession.response.parse(
        await post("endSession", `${route(sessionId)}/end`, { endedAt }, signal),
      );
      if (!response.ok) throw new Error("Could not finish the sample lecture.");
      if (response.data.session.sessionId !== sessionId)
        throw new Error("The demo returned another session. Please try again.");
      return response.data;
    },
    async remove(sessionId: string, signal?: AbortSignal) {
      const payload = await send(route(sessionId), "DELETE", undefined, signal);
      if (
        !payload ||
        typeof payload !== "object" ||
        !("ok" in payload) ||
        payload.ok !== true ||
        !("data" in payload) ||
        !payload.data ||
        typeof payload.data !== "object" ||
        !("deleted" in payload.data) ||
        typeof payload.data.deleted !== "boolean"
      )
        throw new Error("Could not confirm deletion. Please try Reset again.");
    },
  };
}

export type DemoClient = ReturnType<typeof createDemoClient>;
