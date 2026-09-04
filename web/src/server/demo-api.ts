import { randomUUID } from "node:crypto";
import {
  ApiContracts,
  ApiErrorSchema,
  InMemorySessionStore,
  StableIdSchema,
  WeakAreaDrillResponseSchema,
  assertWeakAreaDrillLinkage,
  buildImLostResponseFromStoredChunks,
  getCommittedChunksFromFixture,
  simulationFixture,
  type ConfusionEvent,
  type ErrorCode,
  type GroundingContextSnapshot,
  type ModelImLostOutput,
  type WeakAreaDrillResponse,
} from "@livelecture/shared";
import { generateScriptedHelp } from "./scripted-help";
import { generateScriptedPractice } from "./scripted-practice";
import { verifyScriptedHelp } from "./scripted-verifier";

export const DEMO_ORIGIN = "http://127.0.0.1:3000";
export const DEMO_HEADER = "scripted-v1";
export const DEMO_LIMITS = {
  sessions: 32,
  sessionLifetimeMs: 30 * 60_000,
  requestsPerMinute: 240,
  sessionRequestsPerMinute: 120,
  helpPerSession: 30,
  bodyBytes: 16_384,
  bodyTimeoutMs: 5_000,
} as const;

export interface DemoDispatcherOptions {
  enabled?: boolean;
  extensionId?: string;
  now?: () => number;
  id?: (kind: string) => string;
  limits?: Partial<{ [K in keyof typeof DEMO_LIMITS]: number }>;
  generateHelp?: (
    context: GroundingContextSnapshot,
  ) => ModelImLostOutput | Promise<ModelImLostOutput>;
  generatePractice?: (event: ConfusionEvent, drillId: string) => WeakAreaDrillResponse;
}

interface SessionEntry {
  // A store per session lets deletion release its tombstones and all private records.
  // Fresh random IDs prevent reuse across store incarnations.
  store: InMemorySessionStore;
  expiresAt: number;
  helps: number;
  rate: { start: number; count: number };
  drills: Map<string, WeakAreaDrillResponse>;
}

class DemoError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
const invalid = () => new DemoError(400, "INVALID_REQUEST", "The demo request is invalid.");
const unavailable = () =>
  new DemoError(
    404,
    "SESSION_NOT_FOUND",
    "This demo session is unavailable. Start a new sample lecture.",
  );
const inactive = () =>
  new DemoError(
    409,
    "SESSION_NOT_ACTIVE",
    "This lecture has ended. Start a new sample lecture for more help.",
  );
const limited = () =>
  new DemoError(
    429,
    "RATE_LIMITED",
    "The local demo limit was reached. Try again later or delete an old session.",
  );

function parse<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalid();
  return result.data;
}

// Comparing own keys as well as values rejects fields stripped by permissive nested schemas.
function exactObject(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object")
    return false;
  const a = actual as Record<string, unknown>;
  const b = expected as Record<string, unknown>;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(b).every((key) => Object.hasOwn(a, key) && exactObject(a[key], b[key]))
  );
}

async function readBytes(
  request: Request,
  maxBytes: number,
  timeoutMs: number,
): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    throw new DemoError(413, "INVALID_REQUEST", "The demo request is too large.");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const pieces: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DemoError(408, "INVALID_REQUEST", "The demo request timed out.")),
      timeoutMs,
    );
  });
  try {
    while (true) {
      const piece = await Promise.race([reader.read(), timeout]);
      if (piece.done) break;
      size += piece.value.byteLength;
      if (size > maxBytes)
        throw new DemoError(413, "INVALID_REQUEST", "The demo request is too large.");
      pieces.push(piece.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const piece of pieces) {
      bytes.set(piece, offset);
      offset += piece.byteLength;
    }
    return bytes;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
  }
}

async function readBody(request: Request, maxBytes: number, timeoutMs: number): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  )
    throw invalid();
  const bytes = await readBytes(request, maxBytes, timeoutMs);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw invalid();
  }
}

/** Isolated HTTP dispatcher used by route handlers and real component/API callback tests. */
export function createDemoDispatcher(options: DemoDispatcherOptions = {}) {
  const now = options.now ?? Date.now;
  const id = options.id ?? ((kind: string) => `${kind}_${randomUUID().replaceAll("-", "")}`);
  const limits = { ...DEMO_LIMITS, ...options.limits };
  const sessions = new Map<string, SessionEntry>();
  const globalRate = { start: now(), count: 0 };
  const fixture = getCommittedChunksFromFixture();
  const origins = new Set([DEMO_ORIGIN]);
  if (options.extensionId && /^[a-p]{32}$/.test(options.extensionId))
    origins.add(`chrome-extension://${options.extensionId}`);
  const configurationValid = !options.extensionId || /^[a-p]{32}$/.test(options.extensionId);

  function sweep() {
    for (const [sessionId, entry] of sessions) {
      if (entry.expiresAt <= now()) {
        sessions.delete(sessionId);
        void entry.store.deleteSession(sessionId);
        entry.drills.clear();
      }
    }
  }
  function rateCheck(bucket: { start: number; count: number }, maximum: number) {
    if (now() - bucket.start >= 60_000) {
      bucket.start = now();
      bucket.count = 0;
    }
    bucket.count += 1;
    if (bucket.count > maximum) throw limited();
  }
  const dispatch = async (request: Request): Promise<Response> => {
    const headers = new Headers({
      "Cache-Control": "no-store",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
    });
    try {
      sweep();
      if (!options.enabled || !configurationValid)
        throw new DemoError(503, "PROVIDER_UNAVAILABLE", "The local scripted demo is disabled.");
      const url = new URL(request.url);
      // NextRequest normalizes the loopback URL hostname to "localhost". This is
      // an internal URL representation only: the wire Host and browser Origin
      // below must still satisfy the exact 127.0.0.1 / configured-extension gate.
      const localUrl = url.origin === DEMO_ORIGIN || url.origin === "http://localhost:3000";
      if (!localUrl || request.headers.get("host") !== "127.0.0.1:3000")
        throw new DemoError(403, "INVALID_REQUEST", "This request is outside the local demo.");
      const origin = request.headers.get("origin");
      if (origin !== null && !origins.has(origin))
        throw new DemoError(403, "INVALID_REQUEST", "This request is outside the local demo.");
      if (origin) headers.set("Access-Control-Allow-Origin", origin);
      if (url.search || url.hash) throw invalid();
      const match =
        /^\/api\/sessions(?:\/([^/]+)(?:\/(chunks|im-lost|end|weak-area-drills))?)?$/.exec(
          url.pathname,
        );
      if (!match) throw invalid();
      const sessionId = match[1];
      const action = match[2];
      if (sessionId) parse(StableIdSchema, sessionId);
      const allowedMethods = sessionId && !action ? ["GET", "DELETE"] : ["POST"];
      if (request.method === "OPTIONS") {
        const desiredMethod = request.headers.get("access-control-request-method");
        const desiredHeaders = (request.headers.get("access-control-request-headers") ?? "")
          .toLowerCase()
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (
          !origin ||
          !desiredMethod ||
          !allowedMethods.includes(desiredMethod) ||
          !desiredHeaders.includes("x-livelecture-demo") ||
          desiredHeaders.some((value) => !["content-type", "x-livelecture-demo"].includes(value))
        )
          throw invalid();
        headers.set("Access-Control-Allow-Methods", allowedMethods.join(", "));
        headers.set("Access-Control-Allow-Headers", "Content-Type, X-LiveLecture-Demo");
        return new Response(null, { status: 204, headers });
      }
      if (!allowedMethods.includes(request.method))
        throw new DemoError(405, "INVALID_REQUEST", "This method is unavailable.");
      if (request.headers.get("x-livelecture-demo") !== DEMO_HEADER)
        throw new DemoError(403, "INVALID_REQUEST", "The local demo request header is required.");
      rateCheck(globalRate, limits.requestsPerMinute);
      const body =
        request.method === "POST"
          ? await readBody(request, limits.bodyBytes, limits.bodyTimeoutMs)
          : undefined;
      // Next's Node adapter supplies an empty stream even for a body-less DELETE.
      // Inspect bounded bytes instead of treating the stream object as content.
      if (request.method !== "POST") {
        if (request.method === "GET" && request.headers.has("transfer-encoding")) throw invalid();
        await readBytes(request, 0, limits.bodyTimeoutMs);
      }
      let result: unknown;
      if (!sessionId) {
        const input = parse(ApiContracts.startSession.request, body);
        if (
          input.sourceMode !== "simulation" ||
          (input.title !== undefined && input.title !== simulationFixture.session.title) ||
          (input.subject !== undefined && input.subject !== simulationFixture.session.subject)
        )
          throw invalid();
        if (sessions.size >= limits.sessions) throw limited();
        const freshId = parse(StableIdSchema, id("session"));
        if (sessions.has(freshId)) throw invalid();
        const store = new InMemorySessionStore();
        const entry: SessionEntry = {
          store,
          expiresAt: now() + limits.sessionLifetimeMs,
          helps: 0,
          rate: { start: now(), count: 0 },
          drills: new Map(),
        };
        sessions.set(freshId, entry);
        try {
          const session = await store.createSession({
            sessionId: freshId,
            title: simulationFixture.session.title,
            subject: simulationFixture.session.subject,
            sourceMode: "simulation",
            status: "active",
            startedAt: new Date(now()).toISOString(),
          });
          result = ApiContracts.startSession.response.parse({ ok: true, data: { session } });
        } catch (error) {
          sessions.delete(freshId);
          throw error;
        }
      } else if (request.method === "DELETE") {
        const entry = sessions.get(sessionId);
        sessions.delete(sessionId);
        entry?.drills.clear();
        const deleted = entry ? await entry.store.deleteSession(sessionId) : false;
        result = { ok: true, data: { deleted } };
      } else {
        const entry = sessions.get(sessionId);
        if (!entry) throw unavailable();
        rateCheck(entry.rate, limits.sessionRequestsPerMinute);
        const view = await entry.store.getSession(sessionId);
        if (!view) throw unavailable();
        if (request.method === "GET") {
          result = ApiContracts.getSession.response.parse({ ok: true, data: view });
        } else if (action === "chunks") {
          const input = parse(ApiContracts.appendCommittedChunks.input, {
            params: { sessionId },
            body,
          });
          if (view.session.status !== "active") throw inactive();
          let next = view.committedChunks.length;
          for (let index = 0; index < input.body.chunks.length; index += 1) {
            const chunk = input.body.chunks[index]!;
            const canonical = fixture[chunk.sequence];
            const rawChunk = (body as { chunks: unknown[] }).chunks[index];
            if (
              !canonical ||
              !exactObject(rawChunk, { ...canonical, sessionId }) ||
              chunk.sequence > next
            )
              throw invalid();
            if (chunk.sequence === next) next += 1;
          }
          await entry.store.appendCommittedChunks(sessionId, input.body.chunks);
          // A lost HTTP response can be retried: acknowledge already stored canonical chunks too.
          const acceptedChunkIds = [...new Set(input.body.chunks.map((chunk) => chunk.chunkId))];
          result = ApiContracts.appendCommittedChunks.response.parse({
            ok: true,
            data: { acceptedChunkIds },
          });
        } else if (action === "im-lost") {
          const input = parse(ApiContracts.imLost.input, { params: { sessionId }, body });
          if (view.session.status !== "active") throw inactive();
          if (entry.helps >= limits.helpPerSession) throw limited();
          entry.helps += 1;
          const context = await entry.store.createGroundingContext(
            sessionId,
            input.body.lookbackMs,
          );
          const modelOutput = await (options.generateHelp ?? generateScriptedHelp)(
            structuredClone(context),
          );
          let response;
          try {
            response = await buildImLostResponseFromStoredChunks({
              store: entry.store,
              context,
              modelOutput,
              independentEvidenceVerifier: verifyScriptedHelp,
              responseId: id("response"),
              confusionId: id("confusion"),
            });
          } catch {
            throw new DemoError(
              409,
              "INVALID_REQUEST",
              "The lecture changed while preparing help. Try again.",
            );
          }
          if (sessions.get(sessionId) !== entry || entry.expiresAt <= now()) throw unavailable();
          result = ApiContracts.imLost.response.parse({ ok: true, data: response });
        } else if (action === "end") {
          const input = parse(ApiContracts.endSession.input, { params: { sessionId }, body });
          const expectedEnd = new Date(
            Date.parse(view.session.startedAt) + (view.committedChunks.at(-1)?.endMs ?? 0),
          ).toISOString();
          if (input.body.endedAt !== expectedEnd) throw invalid();
          const session = await entry.store.completeSession(sessionId, input.body.endedAt);
          result = ApiContracts.endSession.response.parse({
            ok: true,
            data: { session, handoff: { sessionId, companionRoute: `/sessions/${sessionId}` } },
          });
        } else if (action === "weak-area-drills") {
          const input = parse(ApiContracts.createWeakAreaDrill.input, {
            params: { sessionId },
            body,
          });
          if (view.session.status !== "completed")
            throw new DemoError(
              409,
              "INVALID_REQUEST",
              "Finish the lecture before opening practice.",
            );
          const eventId = input.body.confusionEventIds[0]!;
          const event = view.confusionEvents.find((item) => item.confusionId === eventId);
          if (!event?.conceptId)
            throw new DemoError(
              400,
              "INSUFFICIENT_CONTEXT",
              "Choose a difficulty with a supported lecture explanation.",
            );
          const drill =
            entry.drills.get(eventId) ??
            WeakAreaDrillResponseSchema.parse(
              (options.generatePractice ?? generateScriptedPractice)(
                structuredClone(event),
                id("drill"),
              ),
            );
          assertWeakAreaDrillLinkage(
            { sessionId, confusionEventIds: [eventId] },
            view.confusionEvents,
            drill,
          );
          entry.drills.set(eventId, drill);
          result = ApiContracts.createWeakAreaDrill.response.parse({ ok: true, data: drill });
        } else throw invalid();
      }
      // A concurrent deletion/expiry must also suppress already prepared read/practice output.
      if (sessionId && request.method !== "DELETE") {
        sweep();
        if (!sessions.has(sessionId)) throw unavailable();
      }
      return Response.json(result, { status: 200, headers });
    } catch (error) {
      const safe =
        error instanceof DemoError
          ? error
          : new DemoError(500, "INTERNAL_ERROR", "The local demo could not complete this request.");
      if (safe.status === 429) headers.set("Retry-After", "60");
      return Response.json(
        ApiErrorSchema.parse({
          ok: false,
          error: {
            code: safe.code,
            message: safe.message,
            retryable: [408, 409, 429, 500, 503].includes(safe.status),
          },
        }),
        { status: safe.status, headers },
      );
    }
  };
  return Object.assign(dispatch, { sweep });
}

// Next bundles routes independently; keep the actual service on globalThis.
type Runtime = {
  dispatch: ReturnType<typeof createDemoDispatcher>;
  timer: ReturnType<typeof setInterval>;
  config: string;
};
const runtimeGlobal = globalThis as typeof globalThis & { __livelectureScriptedDemoV1?: Runtime };

export function handleDemoRequest(request: Request): Promise<Response> {
  const config = JSON.stringify([
    process.env.LIVELECTURE_DEMO_ENABLED,
    process.env.LIVELECTURE_EXTENSION_ID,
  ]);
  let runtime = runtimeGlobal.__livelectureScriptedDemoV1;
  if (!runtime || runtime.config !== config) {
    if (runtime) clearInterval(runtime.timer);
    const dispatch = createDemoDispatcher({
      enabled: process.env.LIVELECTURE_DEMO_ENABLED === "true",
      extensionId: process.env.LIVELECTURE_EXTENSION_ID,
    });
    const timer = setInterval(dispatch.sweep, 60_000);
    timer.unref();
    runtime = { dispatch, timer, config };
    runtimeGlobal.__livelectureScriptedDemoV1 = runtime;
  }
  return runtime.dispatch(request);
}
