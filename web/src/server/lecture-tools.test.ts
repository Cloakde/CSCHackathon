import { afterEach, expect, it, vi } from "vitest";
import {
  ApiContracts,
  getCommittedChunksFromFixture,
  LectureToolEnvelopeSchema,
} from "@livelecture/shared";
import { createDemoDispatcher, DEMO_ORIGIN, type DemoDispatcherOptions } from "./demo-api";

afterEach(() => vi.restoreAllMocks());

function setup(options: DemoDispatcherOptions = {}) {
  const dispatch = createDemoDispatcher({ enabled: true, ...options });
  const call = (
    path: string,
    body: unknown = {},
    method = "POST",
    headers: Record<string, string> = {},
    signal?: AbortSignal,
  ) =>
    dispatch(
      new Request(`${DEMO_ORIGIN}${path}`, {
        method,
        headers: {
          host: "127.0.0.1:3000",
          origin: DEMO_ORIGIN,
          "content-type": "application/json",
          "x-livelecture-demo": "scripted-v1",
          ...headers,
        },
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
        signal,
      }),
    );
  const start = async () => {
    const result = ApiContracts.startSession.response.parse(
      await (await call("/api/sessions", { sourceMode: "simulation" })).json(),
    );
    if (!result.ok) throw new Error("Expected session");
    const session = result.data.session;
    const path = `/api/sessions/${session.sessionId}`;
    const chunks = getCommittedChunksFromFixture().map((chunk) => ({
      ...chunk,
      sessionId: session.sessionId,
    }));
    return { session, path, chunks };
  };
  return { call, start };
}

it("answers different sample topics and recaps stored passages without AI or confusion records", async () => {
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network"));
  const generateHelp = vi.fn();
  const generatePractice = vi.fn();
  const api = setup({ generateHelp, generatePractice });
  const { path, chunks } = await api.start();
  const tool = async (body: unknown) => {
    const response = await api.call(`${path}/lecture-tools`, body);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    return LectureToolEnvelopeSchema.parse(await response.json()).data;
  };
  expect(await tool({ kind: "catch_up", throughSequence: -1 })).toMatchObject({
    status: "insufficient_evidence",
    passages: [],
  });
  await api.call(`${path}/chunks`, { chunks: chunks.slice(0, 3) });
  expect(
    (
      await tool({
        kind: "ask",
        question: "What are inner and outer functions?",
        throughSequence: 2,
      })
    ).passages.map((passage) => passage.citation.chunkId),
  ).toEqual(["chunk_calc_002", "chunk_calc_003"]);
  expect(
    await tool({
      kind: "ask",
      question: "Why multiply by the inner derivative?",
      throughSequence: 2,
    }),
  ).toMatchObject({ status: "insufficient_evidence", passages: [] });
  expect(
    await tool({ kind: "ask", question: "Why is an inequality flipped?", throughSequence: 2 }),
  ).toMatchObject({ status: "unsupported_question", passages: [] });
  await api.call(`${path}/chunks`, { chunks });
  expect(
    (
      await tool({
        kind: "ask",
        question: "Why multiply by the inner derivative?",
        throughSequence: 9,
      })
    ).passages.map((passage) => passage.citation.chunkId),
  ).toEqual(["chunk_calc_004", "chunk_calc_008"]);
  const old = await tool({ kind: "catch_up", throughSequence: 2 });
  expect(old.anchorMs).toBe(145_000);
  expect(old.passages.every((passage) => passage.citation.endMs <= 145_000)).toBe(true);
  const view = ApiContracts.getSession.response.parse(
    await (await api.call(path, {}, "GET")).json(),
  );
  expect(view).toMatchObject({ ok: true, data: { confusionEvents: [], committedChunks: chunks } });
  expect(generateHelp).not.toHaveBeenCalled();
  expect(generatePractice).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});

it("requires an active session's own acknowledged sequence and rejects extra/unbounded inputs", async () => {
  const api = setup();
  const one = await api.start();
  const two = await api.start();
  await api.call(`${one.path}/chunks`, { chunks: one.chunks });
  expect(
    (await api.call(`${two.path}/lecture-tools`, { kind: "catch_up", throughSequence: 9 })).status,
  ).toBe(400);
  for (const body of [
    { kind: "catch_up", throughSequence: 10 },
    { kind: "catch_up", throughSequence: -2 },
    { kind: "catch_up", throughSequence: 1.5 },
    { kind: "catch_up", throughSequence: 9, chunks: one.chunks },
    { kind: "ask", throughSequence: 9, question: " " },
    { kind: "ask", throughSequence: 9, question: "a".repeat(501) },
  ])
    expect((await api.call(`${one.path}/lecture-tools`, body)).status).toBe(400);
  expect(
    (
      await api.call(`${one.path}/lecture-tools`, {
        kind: "ask",
        throughSequence: 9,
        question: "a".repeat(17_000),
      })
    ).status,
  ).toBe(413);
  await api.call(`${one.path}/end`, {
    endedAt: new Date(Date.parse(one.session.startedAt) + 480_000).toISOString(),
  });
  expect(
    (await api.call(`${one.path}/lecture-tools`, { kind: "catch_up", throughSequence: 9 })).status,
  ).toBe(409);
  await api.call(two.path, {}, "DELETE");
  expect(
    (await api.call(`${two.path}/lecture-tools`, { kind: "catch_up", throughSequence: -1 })).status,
  ).toBe(404);
});

it("inherits local access, method, preflight, cancellation and rate guards", async () => {
  const api = setup({ limits: { sessionRequestsPerMinute: 1 } });
  const { path } = await api.start();
  const route = `${path}/lecture-tools`;
  const body = { kind: "catch_up", throughSequence: -1 };
  expect((await api.call(route, body, "POST", { origin: "https://foreign.invalid" })).status).toBe(
    403,
  );
  expect((await api.call(route, body, "POST", { "x-livelecture-demo": "" })).status).toBe(403);
  expect((await api.call(route, {}, "GET")).status).toBe(405);
  const preflight = await api.call(route, {}, "OPTIONS", {
    "access-control-request-method": "POST",
    "access-control-request-headers": "content-type,x-livelecture-demo",
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-methods")).toBe("POST");
  const cancelled = new AbortController();
  cancelled.abort();
  const response = await api.call(route, body, "POST", {}, cancelled.signal);
  expect(response.status).not.toBe(200);
  expect((await api.call(route, body)).status).toBe(200);
  expect((await api.call(route, body)).status).toBe(429);
});

it("does not recover deleted or expired content by asking again", async () => {
  let now = Date.parse("2026-09-06T00:00:00Z");
  const api = setup({ now: () => now, limits: { sessionLifetimeMs: 1000 } });
  const { path, chunks } = await api.start();
  await api.call(`${path}/chunks`, { chunks });
  now += 1001;
  const response = await api.call(`${path}/lecture-tools`, {
    kind: "catch_up",
    throughSequence: 9,
  });
  expect(response.status).toBe(404);
  expect(await response.text()).not.toContain(chunks[0]!.text);
});
