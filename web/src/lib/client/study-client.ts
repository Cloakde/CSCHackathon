import {
  ApiContracts,
  ApiErrorSchema,
  StableIdSchema,
  type ApiError,
  type SessionView,
  type WeakAreaDrillResponse,
} from "@livelecture/shared";

export class StudyError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export function studyErrorMessage(error: unknown): string {
  if (error instanceof StudyError) {
    if (error.code === "SESSION_NOT_FOUND") {
      return "This sample session has expired or was deleted. Start a new demo to try again.";
    }
    if (error.code === "RATE_LIMITED") return "Please wait a moment, then try again.";
    if (error.code === "INSUFFICIENT_CONTEXT") {
      return "There is not enough lecture evidence for practice at this moment. Choose another moment.";
    }
    if (error.code === "INVALID_REQUEST") {
      return "The local demo is unavailable or this request could not be verified. Check that the demo server is running.";
    }
  }
  return "Could not reach or verify the local demo. Check that it is running, then try again.";
}

export interface StudyClient {
  getSession(sessionId: string, signal?: AbortSignal): Promise<SessionView>;
  createDrill(
    sessionId: string,
    confusionId: string,
    signal?: AbortSignal,
  ): Promise<WeakAreaDrillResponse>;
  deleteSession(sessionId: string, signal?: AbortSignal): Promise<boolean>;
}

export function createStudyClient(
  fetcher: typeof fetch = (...args) => fetch(...args),
): StudyClient {
  async function request(path: string, method: string, signal?: AbortSignal, body?: unknown) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 12_000);
    try {
      const response = await fetcher(path, {
        method,
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: {
          "X-LiveLecture-Demo": "scripted-v1",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const value: unknown = await response.json();
      const error = ApiErrorSchema.safeParse(value);
      if (error.success) throw new StudyError(error.data.error.code);
      if (!response.ok) throw new StudyError("INVALID_RESPONSE");
      return value;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  function unwrap<T>(envelope: { ok: true; data: T } | ApiError): T {
    if (!envelope.ok) throw new StudyError(envelope.error.code);
    return envelope.data;
  }

  const path = (id: string) => `/api/sessions/${StableIdSchema.parse(id)}`;
  return {
    async getSession(id, signal) {
      const view = unwrap(
        ApiContracts.getSession.response.parse(await request(path(id), "GET", signal)),
      );
      if (view.session.sessionId !== id) throw new StudyError("INVALID_RESPONSE");
      return view;
    },
    async createDrill(id, confusionId, signal) {
      const body = ApiContracts.createWeakAreaDrill.request.parse({
        confusionEventIds: [confusionId],
      });
      return unwrap(
        ApiContracts.createWeakAreaDrill.response.parse(
          await request(`${path(id)}/weak-area-drills`, "POST", signal, body),
        ),
      );
    },
    async deleteSession(id, signal) {
      const value = await request(path(id), "DELETE", signal);
      if (
        typeof value !== "object" ||
        value === null ||
        !("ok" in value) ||
        value.ok !== true ||
        !("data" in value)
      ) {
        throw new StudyError("INVALID_RESPONSE");
      }
      const data = value.data;
      if (
        typeof data !== "object" ||
        data === null ||
        !("deleted" in data) ||
        typeof data.deleted !== "boolean"
      ) {
        throw new StudyError("INVALID_RESPONSE");
      }
      return data.deleted;
    },
  };
}
