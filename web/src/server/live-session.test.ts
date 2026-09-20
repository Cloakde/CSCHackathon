import { describe, expect, it } from "vitest";
import { createDemoDispatcher } from "./demo-api";
import { buildLectureToolResponse, validateLectureToolResponse } from "@livelecture/shared";

const request = (path: string, method: string, body?: unknown) =>
  new Request(`http://127.0.0.1:3000${path}`, {
    method,
    headers: {
      host: "127.0.0.1:3000",
      "content-type": "application/json",
      "x-livelecture-demo": "scripted-v1",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
describe("opt-in live session boundary", () => {
  it("keeps ordinary demo servers closed to live data", async () => {
    expect(
      (
        await createDemoDispatcher({ enabled: true })(
          request("/api/sessions", "POST", { sourceMode: "live" }),
        )
      ).status,
    ).toBe(400);
  });
  it("accepts checked live chunks, preserves source/identity, provides exact excerpts and deletes the completed session", async () => {
    const api = createDemoDispatcher({ enabled: true, liveEnabled: true });
    const start = await api(
      request("/api/sessions", "POST", { sourceMode: "live", title: "Synthetic gravity lecture" }),
    );
    const {
      data: { session },
    } = await start.json();
    const chunk = {
      chunkId: "chunk_gravity",
      sessionId: session.sessionId,
      sequence: 0,
      startMs: 0,
      endMs: 3000,
      text: "Gravity accelerates a falling object.",
    };
    const route = `/api/sessions/${session.sessionId}`;
    expect((await api(request(route + "/chunks", "POST", { chunks: [chunk] }))).status).toBe(200);
    expect((await api(request(route + "/chunks", "POST", { chunks: [chunk] }))).status).toBe(200);
    for (const bad of [
      { ...chunk, sessionId: "session_other" },
      { ...chunk, text: "Replaced" },
      { ...chunk, sequence: 300 },
      { ...chunk, endMs: 90_001 },
      { ...chunk, audio: "forbidden" },
    ])
      expect(
        (await api(request(route + "/chunks", "POST", { chunks: [bad] }))).status,
      ).toBeGreaterThanOrEqual(400);
    const prompt = { kind: "catch_up" as const, throughSequence: 0 };
    const response = await api(request(route + "/lecture-tools", "POST", prompt));
    const { data } = await response.json();
    expect(
      validateLectureToolResponse(session.sessionId, prompt, [chunk], data, "live").passages[0]
        ?.text,
    ).toBe(chunk.text);
    expect(() => buildLectureToolResponse(session.sessionId, prompt, [chunk])).toThrow();
    const endedAt = new Date(Date.parse(session.startedAt) + 3000).toISOString();
    expect((await api(request(route + "/end", "POST", { endedAt }))).status).toBe(200);
    const view = await (await api(request(route, "GET"))).json();
    expect(view.data.session).toMatchObject({ sourceMode: "live", status: "completed" });
    expect((await api(request(route, "DELETE"))).status).toBe(200);
    expect((await api(request(route, "GET"))).status).toBe(404);
    api.dispose();
  });
});
